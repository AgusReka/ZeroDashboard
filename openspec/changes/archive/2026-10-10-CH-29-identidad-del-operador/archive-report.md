# Archive Report: CH-29

**Change**: CH-29 — Operator identity in the console (A5, "por quién")
**Archived at**: 2026-10-10
**Destination**: `openspec/changes/archive/2026-10-10-CH-29-identidad-del-operador/`
**Main specs synced**: `openspec/specs/console-operator-auth/spec.md` (new capability) and `openspec/specs/query-console/spec.md` ("Console Page Is Servable" replaced by its modified version; "Console Login Screen", "Operator Shown in the Header" and "A 401 Returns to the Login Screen" appended)

## Artifacts

exploration.md, proposal.md, specs/console-operator-auth/spec.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions registered (`docs/01-decisiones.md`)

- DEC-151: operators and console sessions live in their own tables, `Operador` and `SesionConsola`, with no tenant. DEC-15 is unchanged: the session names the operator, never the tenant.
- DEC-152: console authentication is mandatory and cannot be turned off; a closed exemption list of its own, checked by a test over the real route table.
- DEC-153: the first operator is created, and any password reset, with a bootstrap command reading the password from stdin.
- DEC-154: scope includes a minimal login screen and the operator in the header; the audit of who did what stays in CH-20.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, 1198 of 1202 tests pass and the other four are the known `conexiones` false positives caused by the database password; every spec scenario has an automated test; the smoke script passes its CH-29 section in Docker and stops later at CH-03 on that same pre-existing false positive. Independent read-only verifiers reviewed PR1 to PR3; their findings were fixed in #136 and #140.

## Final state

- Migration `20261010000000_operador_sesion_consola`: tables `Operador` (unique `nombre`, `claveHash`) and `SesionConsola` (unique `tokenHash`, `operadorId` with CASCADE, `expiraEn`), outside `MODELOS_AISLADOS`.
- `src/consola-auth.ts`: cookie `zd_consola_session` (12 h), `EXENCIONES_OPERADOR`, `requiereOperador`, `resolverSesionConsola`, the guard `registrarGuardOperador`, `POST /consola/ingresar` and `POST /consola/salir`. `src/cookies.ts` holds the cookie reader shared with the panel.
- `src/rutas.ts`: the whole route table, moved out of `src/server.ts`, with the guard first; `src/rutas.test.ts` proves every route is guarded or listed.
- `src/operador-alta.ts` and `npm run operador:alta -- <nombre>`.
- `src/consola.ts`: login screen without a session, operator and "Salir" in the tenant bar, a 401 reloads into the login screen.
- `scripts/smoke.sh` creates its own operator and sends the session cookie on every console call.
- No change in the engine, the agents or the client panel's behaviour.

## Open items

- Task 4.3: the manual visual pass of the login screen and the tenant bar (360 px and 1280 px, light and dark) is pending. It is the user's.
- The pre-existing `postgres` password false positive (verify-report W2) still stops the smoke at CH-03; fixing it is outside CH-29.
- The chain #133 to #141 merges as a whole: from #137 on, the console needs a session, which only #138 (bootstrap) and #141 (login screen) make usable.
- Next on the map: CH-28 (panel users from the console) and CH-20 (audit), both waiting for this change.
