# Architecture

One request path is shared by every internal app. A feature adds a Prisma model, a small API module
(routes → service → repository), a React feature folder, and contracts — it does not add its own auth,
permission check, transaction handling, or audit writer.

## Request flow

```text
Browser (apps/web)                         API (apps/api)                                   PostgreSQL
──────────────────                         ──────────────                                   ──────────
features/refunds ─┐                        modules/refunds/routes.ts   ── thin: parse params/body
features/kyc ─────┼─ shared/api/client ──▶ modules/kyc/routes.ts       ── with Zod (packages/contracts),
features/flags ───┘   (fetch + Zod parse,  modules/feature-flags/routes.ts  call the service, return DTO
features/audit        CSRF header,              │
                      cookie)                   ▼
    ▲                                      modules/<feature>/<feature>-service.ts
    │  Vite proxies /api → :3001                │  business rule, e.g. "only PENDING can be decided"
    │  (same origin in dev)                     ▼
    │                                      platform/policies/privileged-action.ts
    │                                        executePrivilegedAction(db, { actor, permission, action, apply })
    │                                          1. authorization/requirePermission(actor, permission)   ── 403
    │                                          2. policies/reason-policy   (shared action rules)        ── 400
    │                                          3. db.$transaction(tx):
    │                                               apply(tx)  → modules/<feature>/<feature>-repository.ts ── guarded UPDATE ──▶ refunds / kyc_cases / feature_flags
    │                                               audit/recordAuditEvent(tx, before/after/reason)      ── INSERT ────────────▶ audit_events
    │                                             commit both or neither
    │                                                                                           
    └───────────── { result, auditEventId }  ◀──── platform/errors/error-handler → { error: { code, message } }
```

Before any route runs, `platform/auth/authenticate.ts` registers two hooks:

1. `onRequest` — reads the signed HTTP-only cookie `fintech_demo_session`, loads the `Session` row and
   its `User`, and sets `request.actor` (id, display name, role) or `null`;
2. `preHandler` — for mutating methods, enforces `platform/auth/csrf.ts`: `x-requested-with:
   fintech-demo-console` must be present, `Sec-Fetch-Site: cross-site` is rejected, and an `Origin`
   header (when present) must equal `WEB_ORIGIN`.

Routes call `requireActor(request)` (401 when absent); permissions are derived from the role table in
`platform/authorization/permissions.ts` at check time.

Nothing in a request body is trusted for identity. `actorId`/`role` fields, if sent, are ignored by
the Zod schemas.

## Module boundaries

```text
apps/api/src
  app.ts                 assembles plugins/routes; importable by tests (buildApp(deps))
  server.ts              startup only (loadConfig → createDatabaseClient → listen)
  platform/              shared, feature-agnostic
    auth/                cookie, session store, authenticate hook, CSRF
    authorization/       Role → Permission table, Actor type, requirePermission
    policies/            executePrivilegedAction + reason-policy (the common action policy)
    audit/               recordAuditEvent (insert only)
    database/            Prisma client + TransactionClient type
    errors/              AppError subclasses + Fastify error handler → one envelope
    http/                param/body/query validation helpers
  modules/<feature>/     routes.ts · <feature>-service.ts · <feature>-repository.ts · index.ts · *.test.ts
apps/web/src
  app/                   App (router, providers), Shell (nav, identity card, demo notice)
  shared/api             fetch wrapper: cookies, CSRF header, Zod response parsing, ApiError
  shared/auth            SessionProvider, DemoSignIn (DEMO MODE picker), permission hook
  shared/components      DataTable, Panel, ActionDialog, DecisionButtons, Alert, QueryState…
  features/<feature>/    api.ts (typed client + query keys), Page, DetailPanel
packages/contracts       Zod schemas + inferred types for every request/response; CSRF constants
```

ESLint (`eslint.config.js`) forbids a feature/module from importing another feature's files except
through its `index.ts`, so cross-feature reuse must go through a public surface or `shared/`/`platform/`.

## Where real systems would connect

| Boundary | Today | Later |
| --- | --- | --- |
| Identity | `modules/auth/demo-identity-provider.ts` implements `IdentityProvider` by selecting one of three seeded `User` rows. Mounted only when `DEMO_AUTH_ENABLED=true`; refused at startup in `NODE_ENV=production`. | Add an OIDC implementation of `IdentityProvider` (authorization-code flow with the company IdP), map IdP groups/claims to `Role` in one place, create/refresh `Session` rows exactly as demo login does. `authenticate.ts`, permissions, policies, features are unchanged. |
| Authorization | Static role → permission table. | Replace the table with a lookup against the org's entitlement service behind the same `requirePermission` call. |
| Payments | `refund-service.ts` records a decision; no processor call. | Introduce a `RefundExecutor` port called from the service **after** commit (outbox or job), keeping the decision transaction as is. |
| KYC vendor | Risk flags are seeded JSON. | A `KycProvider` port that fills `riskFlags` on case creation; decisions stay human and audited. |
| Feature-flag consumers | Flags are rows in PostgreSQL, read only by this console. | A read endpoint or SDK cache for services; writes keep going through `executePrivilegedAction`. |
| Audit sink | `audit_events` table, append-only by code path, no update/delete endpoint. | Stream inserts to the compliance log store; the table remains the app-level trail. |

## Data

Prisma models: `User`, `Session`, `SyntheticTransaction`, `Refund`, `KycCase`, `FeatureFlag`,
`AuditEvent`. Migrations live in `apps/api/prisma/migrations` and are applied with
`prisma migrate deploy`; `prisma/seed.ts` is deterministic (fixed IDs, references, timestamps) so the
same fixtures back the dev database, the Vitest suite, and the Playwright suite.

## Testing strategy

- **API integration (Vitest)** — real `buildApp()` + real Prisma against `fintech_demo_test`; each test
  file re-seeds. Nothing under test is mocked; the identity boundary is exercised through the real
  demo-login route.
- **Browser (Playwright)** — boots API (`:3101`) and Vite (`:5174`) against the same test database,
  seeds once per run, and drives the UI as viewer / analyst / admin, including a direct API call from
  the viewer's browser session to prove the server, not the UI, is the enforcement point.

## Non-goals

No microservices, Kubernetes, message bus, GraphQL, or generic low-code builder. Each app is ordinary
TypeScript on the shared platform, which is what a team of ~60 engineers would extend with the next
ten tools.
