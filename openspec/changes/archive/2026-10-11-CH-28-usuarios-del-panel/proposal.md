# Proposal: CH-28 — Panel users managed from the console (T3)

**Status**: ready for spec and design. Inputs: exploration.md, DEC-155 to DEC-158, `docs/02-mapa-de-changes.md` (CH-28). CH-29 is merged: every route below sits behind the operator guard (DEC-152).

## Intent
- The implementer (P1) gives a client administrator (P2) access to the panel from the console, without hand-written inserts.
- P1 can reset a lost password and cut or restore a user's access.
- Passwords are never chosen by a person: the system generates them and shows each one once (DEC-155, DEC-156).

## Scope

### In Scope
- `POST /usuarios`: create a panel user in the header's tenant with `correo` and optional `nombre`; answers the user and a generated password, once, with `Cache-Control: no-store` (DEC-155). A `correo` taken in any tenant is `409 correo-en-uso`, without saying where (DEC-157).
- `GET /usuarios`: the tenant's users (`id`, `correo`, `nombre`, `activo`, `creadoEn`), capped by `LIMITE_LISTADO` with `truncado`. Never a hash.
- `POST /usuarios/:id/clave`: a new generated password, shown once; the user's sessions are deleted in the same transaction (DEC-156).
- `POST /usuarios/:id/desactivar` and `POST /usuarios/:id/reactivar`: deactivating deletes every session in the same transaction; reactivating keeps the password (DEC-158).
- `correo` normalized (trimmed, lowercased) on create and on panel login, so the client logs in whatever case they type.
- A two-tenant proof on every route; `scripts/smoke.sh` creates a panel user and logs into the panel with the generated password.

### Out of Scope
- The console screen for users: CH-30 designs the console's screens; until then the API and the smoke script cover the demo.
- A password change by the client from the panel, recovery by email, multi-factor (DEC-133, DEC-156).
- Deleting a user, or editing its `correo` or `nombre`.
- Any change in the engine or the operator authentication.

## Capabilities

### New Capabilities
- `panel-user-management`: create, list, reset the password, deactivate and reactivate panel users from the console.

### Modified Capabilities
- `client-panel-auth`: the login matches the email case-insensitively (normalized to lowercase).

## Approach
Mirror the agent-token routes (`src/agentes-rutas.ts`, DEC-121): a pure module generates the password (`randomBytes` in base64url) and validates the body; the routes live in a new `src/usuarios-panel.ts`, tenant-scoped by the header through the isolation extension (`Usuario` and `SesionPanel` are scoped models), so another tenant's id answers like an unknown one. The global uniqueness of `correo` is enforced by the database: a create that hits `P2002` is the `409`. Session deletion and the user write share one interactive transaction, which CH-25 proved keeps the scoping.

## Affected Areas
- `src/usuarios-panel.ts` (new) and its tests; `src/rutas.ts` (registration)
- `src/panel-auth.ts` (lowercase lookup) and `src/panel-auth.test.ts`
- `scripts/smoke.sh`
- `docs/01-decisiones.md` (DEC-155 to DEC-158, done)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A user or session of tenant B read or written from tenant A | Low | Scoped models; every route resolves the id through the scoped client; two-tenant tests on all five routes |
| A generated password reaches a log, a list or an error | Low | Only the create and reset responses carry it, `no-store`; tests assert it never appears in the list, in error bodies, or in the logger |
| A deactivated or reset user keeps a live session | Low | Same transaction as the write; tests count sessions after |
| Case mismatch locks a client out | Medium | Normalize on create and on login; dev data has no mixed-case emails (checked) |
| The 409 for a taken email reveals another tenant | Low | Same answer whatever the tenant; the operator already operates all tenants (DEC-157) |

## Review Workload Forecast
- PR1: pure module, create and list routes, case-insensitive login, tests: ~420 lines
- PR2: reset, deactivate and reactivate, tests, smoke: ~380 lines
Total ~800 lines; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (the session strategy is `single-pr`).
