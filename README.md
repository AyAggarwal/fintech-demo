# fintech-demo — internal-tools prototype

Three thin internal applications — **Refunds**, **KYC**, and **Feature flags** — built on one shared
foundation for identity, authorization, privileged-action policy, and an application audit trail.

This is a take-home prototype. Everything in it is synthetic: fictional data, a clearly labeled
**DEMO MODE** identity picker, and simulated decisions. It never moves money, calls a KYC vendor, or
handles real customer data. Passing tests here are not evidence of production readiness.

## Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict, `exactOptionalPropertyTypes`) everywhere |
| Frontend | React 19 + Vite, TanStack Query, React Router |
| API | Fastify 5 + Zod 4 |
| Persistence | PostgreSQL 16 + Prisma 6 (committed migrations, deterministic seed) |
| Tests | Vitest (API integration tests against a real test database), Playwright (browser smoke) |
| Tooling | npm workspaces, Docker Compose (PostgreSQL only), ESLint (typed rules) |

Layout (see [docs/architecture.md](docs/architecture.md) for the request flow):

```text
apps/web        React operations console          apps/web/src/{app,features/*,shared/*}
apps/api        Fastify API                       apps/api/src/{app.ts,server.ts,modules/*,platform/*}
packages/contracts  Shared Zod schemas + inferred types used by both apps and the e2e tests
tests/e2e       Playwright smoke suite (runs the full stack against the test database)
docs/           architecture.md, demo.md
```

## Setup

Prerequisites: Node.js ≥ 20.19 (developed on 24.x), npm ≥ 10, Docker with Compose.

```bash
cp .env.example .env         # local-only defaults; nothing secret
npm install
npm run db:setup             # docker compose up postgres, prisma migrate deploy, seed
npm run dev                  # API on http://127.0.0.1:3001, web on http://localhost:5173
```

Open <http://localhost:5173>, pick a demo identity, and follow [docs/demo.md](docs/demo.md).

The API and the web app are independently runnable (`npm run dev:api`, `npm run dev:web`). In
development Vite proxies `/api/*` to the API so the browser talks to a single origin; override the
target with `VITE_API_PROXY_TARGET`.

### Root scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `dev:api` / `dev:web` | Start both apps, or one of them, with reload |
| `npm run build` | Production builds: contracts → API (`prisma generate` + `tsc`) → web (`vite build`) |
| `npm run typecheck` | `tsc --noEmit` in every workspace, including the e2e project |
| `npm run lint` | ESLint with type-aware rules across the repo |
| `npm test` | Migrates `fintech_demo_test`, then runs the API integration suite (Vitest) |
| `npm run test:e2e` | Playwright: seeds the test database, boots API+web on ports 3101/5174, runs the browser suite |
| `npm run db:up` / `db:down` | Start / stop the PostgreSQL container |
| `npm run db:migrate` / `db:seed` / `db:reset` | Apply migrations / re-seed / drop and recreate + seed the dev database |
| `npm run db:setup` | `db:up` + `db:migrate` + `db:seed` |
| `npm run db:test:setup` | Apply migrations to the test database only |

The Compose file creates both `fintech_demo` (dev) and `fintech_demo_test` (tests) on first start via
`scripts/init-test-db.sql`. Tests refuse to run against any `TEST_DATABASE_URL` whose database name
does not end in `_test`.

## Demo identities

Sign-in is a **DEMO MODE** picker of three seeded users. The endpoint exists only when
`DEMO_AUTH_ENABLED=true`, the API refuses to start with that flag when `NODE_ENV=production`, and can only select one of
these seeded rows — it cannot create users or assign roles.

| Picker | Display name | Role | Permissions |
| --- | --- | --- | --- |
| `viewer` | Demo Viewer | `VIEWER` | read refunds, KYC, flags, audit |
| `analyst` | Demo Ops Analyst | `OPS_ANALYST` | viewer + `refunds:decide`, `kyc:decide` |
| `admin` | Demo Administrator | `ADMIN` | analyst + `feature-flags:write` |

The actor and its permissions are resolved server-side from an HTTP-only, signed session cookie
(`fintech_demo_session`, `SameSite=Lax`, 12 h TTL, `Secure` in production) backed by a `Session`
table. Request bodies never carry an actor ID or role; any such fields are ignored.

## Implemented behavior

**Refunds** — list with status filter and reference/customer search; detail panel with the synthetic
transaction; approve / reject a `PENDING` request with an optional reason. Decisions are simulated
records only.

**KYC** — list with status and risk-level filters; detail panel with fictional risk flags; approve /
reject a `PENDING` case with an optional reason.

**Feature flags** — list of flags with current state and last change; administrators can enable /
disable a flag through a confirmation dialog; the resulting audit event is shown inline. Writes from
non-admins are rejected by the API (`403 FORBIDDEN`) regardless of what the UI renders.

**Audit** — one shared, read-only view across all three apps with filters by entity type and action,
plus a detail card showing actor, role snapshot, action, entity, timestamp, optional reason,
and before/after state. Each record's detail panel also embeds its own audit trail.

**Shared controls** (`apps/api/src/platform`):

- `authorization/` — role → permission table, `requirePermission(actor, permission)`.
- `policies/privileged-action.ts` — `executePrivilegedAction()`: the single path for every mutation.
  Permission check → shared action policy (currently: normalize the optional reason) → the feature's
  mutation **and** its audit event in one Prisma transaction. If the mutation throws, nothing is
  committed and nothing is audited.
- `audit/` — `recordAuditEvent(tx, …)`; no update/delete code path or endpoint exists.
- `auth/` — session cookie, session store, `authenticate` hook, CSRF/same-origin checks
  (`x-requested-with: fintech-demo-console` required on mutations; cross-site `Sec-Fetch-Site` and
  foreign `Origin` rejected).
- `errors/` — one error envelope `{ error: { code, message, details? } }` with codes
  `VALIDATION_ERROR | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL_ERROR`.

**State-transition safety** — refund and KYC decisions update with `WHERE id = ? AND status = 'PENDING'`
and flag toggles with `WHERE id = ? AND enabled = <previous>`; a zero-row update becomes `409 CONFLICT`.
Competing requests therefore produce exactly one success and one audit event (covered by tests).

## API

```text
GET  /api/health
GET  /api/auth/session            GET  /api/auth/demo-identities (demo only)
POST /api/auth/demo-login         POST /api/auth/logout          (demo only for login)
GET  /api/refunds?status=&search= GET  /api/refunds/:id          POST /api/refunds/:id/decision
GET  /api/kyc-cases?status=&riskLevel=&search=   GET /api/kyc-cases/:id   POST /api/kyc-cases/:id/decision
GET  /api/feature-flags           PATCH /api/feature-flags/:id
GET  /api/audit-events?entityType=&action=&entityId=&limit=     GET /api/audit-events/:id
```

Request/response shapes live in `packages/contracts` and are validated with Zod on both sides.

## Tests

```bash
npm test          # 24 API integration tests against fintech_demo_test (no mocks of the behavior under test)
npm run test:e2e  # 3 Playwright browser tests against the same test database
```

API tests build the real Fastify app, sign in through the real demo-login route, and use Prisma
against the test database. They cover:

- a viewer cannot mutate refunds, KYC, or flags via direct API calls; actor/role fields in bodies are ignored;
- an analyst cannot toggle a feature flag;
- an authorized action changes the record and creates exactly one matching audit event (before/after, reason, actor snapshot);
- invalid, unknown, or repeated actions leave business state and the audit table unchanged;
- four competing decisions on one refund / KYC case / flag → one `200`, the rest `409`;
- input validation (bad decision enum, oversized reason, wrong body types);
- unauthenticated access, missing/invalid CSRF header, cross-site requests, foreign origin, demo login limited to seeded identities, demo routes absent when disabled, logout invalidates the session;
- audit list/detail filtering and the absence of audit write endpoints.

Browser tests: an analyst approves a refund and the decision survives a reload; a viewer sees the
denied state and a direct API call from the same browser session gets `403`; an administrator toggles
a flag and sees the audit event, which survives a reload.

## Mocked or simulated components

- **Identity provider** — replaced by the seeded DEMO MODE picker. See the OIDC boundary in
  [docs/architecture.md](docs/architecture.md).
- **Payments** — refund approval writes a decision row; there is no processor client and no money movement.
- **KYC** — cases, applicants (`Applicant A-2000`…), and risk flags are fictional; no documents, no vendor calls, no claim of automated compliance.
- **Customers / transactions** — `Customer C-1040`, `TX-90000`… are synthetic labels with no PII fields.
- **Feature flags** — stored in PostgreSQL and read by this console only; nothing consumes them.

## Known limitations

- Application audit trail only: rows are append-only by convention and code path, not tamper-evident or compliance-certified.
- Sessions are server-side rows with a signed cookie; there is no refresh, rotation, MFA, or rate limiting.
- No pagination — lists are sized for the seed data.
- No optimistic concurrency beyond the guarded state-transition updates; no outbox/events for downstream consumers.
- Reason is optional on every privileged action (by design for this iteration; see [docs/demo.md](docs/demo.md) for the next task).
- No CI workflow is committed; checks are run locally with the root scripts.
- Docker Hub rate limits may require pulling `postgres:16-alpine` from a mirror (e.g. `mirror.gcr.io/library/postgres:16-alpine`) and retagging.
