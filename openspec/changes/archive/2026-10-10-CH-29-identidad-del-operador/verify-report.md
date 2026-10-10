# Verify Report: CH-29 — Operator identity in the console

**Date**: 2026-10-10. **Branches**: `ch29/esquema`, `ch29/sesion`, `ch29/guard`, `ch29/cableado`, `ch29/alta`, `ch29/smoke`, `ch29/alta-arreglos`, `ch29/consola`, stacked on `ch29/exploracion` (PRs #133 to #141). Verified at `b414184`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch. Independent read-only verifiers (general-purpose agents) reviewed PR1, PR2 and PR3 during apply; their findings and fixes are on #135, #136 and #138/#140.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm test` against the dev database (`TEST_DB_PORT=5434`, password `postgres`) | 1202 tests, 1198 pass, 4 fail: the known `conexiones` false positives (W2). No suite skipped by the reachability probe |
| `npm run build` | ok |
| `scripts/smoke.sh` (Docker, 2026-10-10, twice) | CH-29 section and every section before CH-03 pass; the run stops at CH-03 on the same false positive (W2). The second run also proved the new `fail()` deletes the smoke operator |
| Mutation checks | `src/rutas.test.ts` fails 2 of 5 without the guard line; the logout test fails when logout deletes every session of the operator |
| Manual visual pass (task 4.3) | **not done** (W1) |

## Spec coverage — `specs/console-operator-auth/spec.md`

| Requirement / scenario | Evidence |
|---|---|
| Tables; only the hash stored; cascade | migration `20261010000000_operador_sesion_consola`; `aislamiento.test.ts` (model list, no `tenantId`); `consola-sesion.test.ts` "a live session names its operator, found by the hash of the token", "deleting the operator deletes its sessions"; `consola-auth-rutas.test.ts` "a successful login … stores only its hash" (SHA-256 of the real cookie value) |
| Console Login: success, cookie attributes, 12 h | "a successful login answers the operator, sets the cookie and stores only its hash"; `consola-auth.test.ts` cookie and lifetime cases |
| Unknown name and wrong password look the same | "an unknown name and a wrong password look the same and create nothing" (dummy-hash comparison in the route) |
| Strict body | "the login body is strict: a tenantId or a missing clave is a 400" |
| Console Logout revokes the token | "logout deletes the session, clears the cookie, and the same token is refused afterwards"; "logout deletes only the current session…"; "logout itself needs a session" |
| Guard: 401 before the tenant check | "without a cookie a console route is 401 before the tenant check, with or without the header"; "with a session the tenant check still applies" |
| Bootstrap routes guarded | `consola-auth.test.ts` "logout and the routes exempt only from the tenant header stay guarded"; `rutas.test.ts` "every non-exempt route without a cookie is refused by the guard with 401" |
| Exempt routes need no session | `rutas.test.ts` "every exempt route without a cookie gets past the guard"; "every exempt row names a registered route" |
| Unmatched URL refused | "an unmatched URL is refused by the guard, not answered 404"; "an unknown token and an unmatched URL are 401" |
| Expired session | "an expired session is 401 sesion-expirada and its row is gone, at the exact boundary too" |
| Panel and console cookies do not cross | "a panel cookie is not a console session, and a console cookie is not a panel session" |
| Operator attached to the request | "a valid session attaches the operator to the request" |
| Every registered route guarded or listed | `rutas.test.ts`, built with the same `registrarRutas` the entry point calls |
| Bootstrap: create, then reset | `operador-alta.test.ts` "creates the operator, exits 0, and never prints the password or its hash"; "run again with the same name resets the password and deletes every session" (W3) |
| Bootstrap: input rules, exit codes, no secrets in output | "a short password exits 1 and writes nothing…"; "a missing or invalid name exits 1…"; "an unreachable database exits 2 and names neither the URL nor its password"; "a missing database URL exits 2"; terminal and pipe reading cases (no echo, twice, mismatch, Ctrl+C, control characters, end of input) |
| Smoke logs in | `scripts/smoke.sh` CH-29 section, passed in Docker (W2) |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement / scenario | Evidence (`consola.test.ts`) |
|---|---|
| Console Page Is Servable, with and without a session | "without a session it serves the login screen, never the editor"; "with a session it serves the console with the operator in the header"; the existing guarded-id and hazard suites run on the console document; `sinPeligros` runs on both documents |
| Console Login Screen | "the login screen posts the name and password and reloads on 200"; "a wrong password says so, keeps the name, and does not reload"; "any other failure says the console could not be reached" |
| Operator shown in the header, escaped | "a name with markup is shown as text, escaped by the server" |
| A 401 returns to the login screen | "CH-29 a 401 on the tenant list reloads…"; "CH-29 a 401 on a scoped call reloads…"; "CH-29 Salir posts to /consola/salir…"; "CH-29 Salir reloads even when the logout call fails" |

## Design deviations (accepted)

- `registerConsolaRoute(app, resolverOperador)` instead of `(app, prisma)`: the console tests stay database-free; production passes `resolverSesionConsola`, the same resolution path as the guard.
- The operator name is escaped with the tested `escaparHtml` of `src/correo.ts`; no `src/escapar-html.ts` module was created (design updated in PR1a).
- The dummy hash for unknown names is computed when the routes are registered, so even the first unknown-name login costs one `scrypt` (verifier finding on PR2).
- PRs split beyond the plan to stay within 400 lines: PR1a/1b, PR2a/2b, PR3a/3b, plus PR3c with the PR3 verifier fixes.

## Warnings

- **W1** — The manual visual pass of the login screen and the operator in the tenant bar (360 px and 1280 px, light and dark) is not done. Tests do not render.
- **W2** — Pre-existing, not caused by CH-29: with `POSTGRES_PASSWORD=postgres`, the "the response must not echo the credential" checks match `"motor":"postgres"`. Four tests in `src/conexiones.test.ts` fail, and `scripts/smoke.sh` stops at CH-03, so the smoke sections after CH-03 have not been exercised with the session cookie.
- **W3** — The "create, then reset" scenario checks the stored hash with `verificarClave` (the function the login route uses) rather than calling the login route.
- **W4** — Two TDD exceptions are recorded: the `resolverSesionConsola` tests were written after the function (PR1b), and a wrong fixture in a PR3c test was corrected after GREEN.
