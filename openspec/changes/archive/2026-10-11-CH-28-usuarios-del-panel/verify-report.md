# Verify Report: CH-28 — Panel users managed from the console

**Date**: 2026-10-11. **Branches**: `ch28/alta`, `ch28/estado`, stacked on `ch28/exploracion` (PRs #143 to #145). Verified at `94e7e0b`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch. An independent read-only verifier (general-purpose agent) reviewed the whole implementation during apply; its findings and the fix are on #145.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | ok |
| `npm test` against the dev database (`TEST_DB_PORT=5434`, password `postgres`) | 1219 tests, 1215 pass, 4 fail: the known `conexiones` false positives (W2). No suite skipped by the reachability probe |
| `scripts/smoke.sh` (Docker, 2026-10-10) | the CH-28 section passed (user created with `no-store`, password not in the list, panel login 200, deactivated, panel login 401); the run stops later at CH-03 (W2). The `grep -F --` fix (`94e7e0b`) was not re-run in Docker (W3) |

## Spec coverage — `specs/panel-user-management/spec.md`

| Requirement / scenario | Evidence |
|---|---|
| Generated password: length, uniqueness, stored hashed, only in its response, never logged | `usuarios-panel.test.ts` "a generated password is 24 base64url characters and two are never equal"; `usuarios-panel-rutas.test.ts` "create answers 201 … once and no-store" (hash ≠ password, `verificarClave` true), "no generated password ever reached the log"; `usuarios-panel-estado.test.ts` reset case asserts the log too |
| Create | "create answers 201 with the normalized email and a password, once and no-store"; "the generated password logs into the panel, whatever case the email is typed in"; "a blank or absent name is stored as null" |
| Email taken in another tenant | "an email taken in another tenant is 409 correo-en-uso, names no tenant, and creates nothing" |
| Strict body | "the body is strict: a tenantId, a clave, a bad email or a long name is a 400 and creates nothing"; `correoValido` cases |
| List: only the tenant's users, never a hash; cap | "the list holds only the tenant users, by email, never a hash nor a password"; "the list is capped at the listing limit and says so" |
| Reset revokes and replaces | "reset answers a new password once, no-store; the old password and session die, the new one logs in"; "reset works on an inactive user, which stays inactive" |
| Deactivate and reactivate | "deactivate deletes every session and refuses login; a second time is 409 usuario-inactivo"; "reactivate restores access with the same password; on an active user it is 409 usuario-activo" |
| Tenant isolation of user routes | "an unknown id is 404 usuario-no-encontrado on all three routes"; "tenant A cannot reset, deactivate or reactivate a user of tenant B, and B is untouched" (hash, `activo`, session count and a live cookie checked) |
| Routes behind the operator guard | `rutas.test.ts`: every registered route, the five new ones included, is 401 without an operator session |
| Smoke creates a panel user | `scripts/smoke.sh` CH-28 section, passed in Docker |

## Spec coverage — `specs/client-panel-auth/spec.md` (delta)

| Requirement / scenario | Evidence |
|---|---|
| Email matched case-insensitively at login | `usuarios-panel-rutas.test.ts` "the generated password logs into the panel, whatever case the email is typed in" (padded, uppercased); `panel-auth.test.ts` unchanged and green |

## Design deviations (accepted)

- The mixed-case login case lives in `usuarios-panel-rutas.test.ts` instead of `panel-auth.test.ts`: it needs a user created through the new route.
- Reset uses a scoped `updateMany` as the existence check inside the transaction instead of a `findUnique` first; same 404 for an unknown or foreign id, one query less.

## Warnings

- **W1** — Accepted risk, documented on #145: a panel login that verifies the old password just before a reset commits can still insert a session that outlives the reset (a window of one `scrypt`). Closing it needs a row lock in the panel login, which predates CH-28.
- **W2** — Pre-existing, not caused by CH-28: with `POSTGRES_PASSWORD=postgres` four `conexiones` tests fail and `scripts/smoke.sh` stops at CH-03.
- **W3** — The last smoke fix (`grep -qF --`, removing the temporary file with the plaintext password) was checked with `sh -n` and by hand, not by a new Docker run.
- **W4** — No console screen: CH-30 designs it. Until then the API and the smoke script are the only clients.
