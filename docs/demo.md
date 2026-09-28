# Demo walkthrough (60–90 seconds)

Prereq: `./demo.sh` (installs dependencies, creates `.env`, starts PostgreSQL, migrates, seeds, starts both
servers; `npm run demo -- reset` restores the seed data between runs), then open
<http://localhost:5173>. Every screen shows the persistent notice
*Synthetic data · Demo identity · No live transactions*.

## 1. Denied role — Viewer (≈20 s)

1. On the **DEMO MODE** sign-in screen pick **Demo Viewer**. The identity card shows *Viewer*.
2. **Refunds** → click `RF-1002`. The detail panel shows the synthetic transaction and a
   *permission-denied* notice instead of Approve/Reject.
3. **Feature flags** → the read-only banner is shown and every Enable/Disable button is disabled.
   (The API returns `403 FORBIDDEN` for the same calls even without the UI — the Playwright suite
   proves this with a direct request from the viewer's session.)
4. **Switch identity** (in the identity card).

## 2. Permitted action — Operations analyst (≈30 s)

1. Sign in as **Demo Ops Analyst**.
2. **Refunds** → filter *PENDING* → click `RF-1001` → **Approve** → optionally type a reason →
   **Record approval**.
3. Status flips to `APPROVED`, a success banner links to the audit event, and the record's audit
   trail shows *Refund approved · RF-1001* with actor, before/after state, and the reason.
4. Press **Approve** again? It is gone — the record is no longer pending. A second decision via the
   API returns `409 CONFLICT`.
5. Reload the page: the decision persisted (PostgreSQL), and the same event appears under **Audit**.
6. Optional: **KYC** → pick a `PENDING` case → **Reject** — same dialog, same audit shape.

## 3. Admin-only write — Administrator (≈20 s)

1. **Switch identity**, sign in as **Demo Administrator**.
2. **Feature flags** → **Enable** on `ops.bulk-actions` → **Enable flag**. State becomes `ENABLED` and the
   audit trail shows *Feature flag enabled · ops.bulk-actions*.
3. **Audit** → filter by entity type to see refunds, KYC, and flags in one trail.

## What you just saw

- Three apps, one shared path: `executePrivilegedAction()` did the permission check, applied the
  action policy, and wrote the business change plus the audit event in **one** transaction.
- Identity resolved server-side from an HTTP-only session cookie; the UI only *hints* at permissions.
- Everything is synthetic: no money moved, no KYC vendor, no real people.

## Proposed second iteration

> Require a nonblank reason for every privileged action across refunds, KYC, and feature flags.
> Update the API, shared action form, and regression tests.

Expected touch points, and why it should be small:

| Layer | Change |
| --- | --- |
| `packages/contracts/src/actions.ts` | `privilegedActionInputSchema.reason` becomes `z.string().trim().min(1).max(500)` |
| `apps/api/src/platform/policies/reason-policy.ts` | `resolveActionReason` returns a `string` and throws `ValidationError` on blank |
| `apps/web/src/shared/components/ActionDialog.tsx` | label *Reason (optional)* → *Reason*, `required`, disable Confirm until nonblank |
| Tests | update the "optional reason" cases in `refunds.test.ts`, `kyc.test.ts`, `feature-flags.test.ts`; add a blank-reason → `400` case in `platform.test.ts`; adjust the Playwright specs to fill a reason |

No feature route, service, or repository needs to change, and no new abstraction is introduced —
which is the point of the shared action policy.
