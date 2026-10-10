# Proposal: CH-29 — Operator identity in the console (A5, "por quién")

**Status**: ready for spec and design. Inputs: exploration.md, DEC-151 to DEC-154, `docs/02-mapa-de-changes.md` (CH-29).

## Intent
- The console knows who operates it: every console request carries a verified operator, so CH-20 can record "por quién" (story **A5**).
- Nobody reaches the console, or any route it uses, without a session: today anyone who reaches `/consola` operates every tenant.
- The tenant stays explicit per request (DEC-15 unchanged): the session names the operator, never the tenant.

## Scope

### In Scope
- Migration and schema: `Operador` (unique `nombre`, `claveHash`) and `SesionConsola` (`tokenHash`, `operadorId`, `expiraEn`), neither tenant-scoped (DEC-151).
- `POST /consola/ingresar` and `POST /consola/salir`; an `HttpOnly`, `SameSite=Lax`, `Secure` cookie named apart from the panel's.
- A guard registered in `server.ts`, always on, that refuses with 401 every request whose route is not in a closed exemption list, matched unmatched URLs included (DEC-152).
- The route wiring of `server.ts` moved into one function so a test can build the real app and prove every registered route is guarded or exempt.
- `npm run operador:alta -- <nombre>`: creates an operator or resets the password of an existing one, reading the password from stdin without echo, and revokes that operator's sessions on reset (DEC-153).
- `GET /consola` serves a minimal login screen without a valid session and the console with the operator's name in the header with one; a "Salir" action; any 401 seen by the console page sends it back to the login screen (DEC-154).
- `scripts/smoke.sh` creates an operator and logs in before operating.

### Out of Scope
- The audit of who did what (CH-20) and an `autor` for saved-query versions (DEC-148).
- Roles or per-operator permissions, deactivating an operator, managing operators from the UI (DEC-151, DEC-153).
- Panel users' management (CH-28) and the console redesign (CH-30).
- Login rate limiting, password recovery by email, multi-factor authentication (the panel has none either, DEC-133).
- Any change in the engine, the agents or the client panel's behaviour.

## Capabilities

### New Capabilities
- `console-operator-auth`: operators, console sessions, login and logout, the guard and its exemption list, the bootstrap command.

### Modified Capabilities
- `query-console`: the page serves a login screen or the console, shows the operator, logs out, and reacts to a 401.

## Approach
Mirror the panel's mechanism (DEC-133, DEC-134) without its tenant: `scrypt` from `src/crypto-auth.ts`, a random token whose SHA-256 hash is the only thing stored, and the cookie reader shared with `src/panel-auth.ts` (extracted, behaviour-preserving). The guard is an `onRequest` hook registered before the tenant hooks, so an unauthenticated request is a 401 before any tenant check; its exemption list is its own closed set, separate from the tenant header list, because `/tenants*`, `/contrato` and `/plantillas` are exempt from the header but belong to the console. The command is a compiled entry point (`dist/operador-alta.js`) so it runs inside the engine image.

## Affected Areas
- `prisma/schema.prisma`, a new migration, regenerated client
- `src/consola-auth.ts` (new) and its tests; `src/cookies.ts` (new, extracted from `src/panel-auth.ts`)
- `src/rutas.ts` (new, the wiring extracted from `src/server.ts`), `src/server.ts`, a wiring test
- `src/operador-alta.ts` (new), `package.json` (script)
- `src/consola.ts`, `src/consola.test.ts`
- `scripts/smoke.sh`
- `docs/01-decisiones.md` (DEC-151 to DEC-154, done)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A console route left unguarded | Medium | Default-deny hook; wiring test over the real app: every registered route without a cookie is 401 unless listed, and every listed row names a registered route |
| A missing exemption breaks the panel, the stylesheet or health | Medium | Same wiring test asserts each exempt row is reachable without a cookie; panel and stylesheet suites stay green |
| Lock-out (no operator, forgotten password) | Medium | The command creates or resets; documented in the smoke script and the design |
| Cookie collision with the panel on the same origin | Low | Distinct cookie name; test that a panel cookie is not a console session and vice versa |
| CSRF on state-changing console routes | Low | `SameSite=Lax`, JSON bodies, no state-changing `GET` (the same reasoning as the panel) |
| `Secure` cookie over plain `http://localhost` in the smoke | Low | The smoke passes the token as an explicit `Cookie` header taken from `Set-Cookie` |

## Review Workload Forecast
- PR1: schema, migration, shared cookie reader, pure auth module and its tests: ~380 lines
- PR2: login and logout routes, the guard, the wiring extraction and the wiring test: ~420 lines
- PR3: the bootstrap command and its tests, `smoke.sh`: ~260 lines
- PR4: login screen, operator in the header, logout, 401 handling: ~320 lines
Total ~1380 lines; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (the session strategy is `single-pr`).
