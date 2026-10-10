# Tasks: CH-29 — Operator identity in the console

Branch base: `master` (after PR #132). Strict TDD: each task pair writes the failing test first, against `npm test` (`TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres` for the live-database files).

## Review Workload Forecast
- Estimated changed lines: ~1380 (PR1 ~380, PR2 ~420, PR3 ~260, PR4 ~320)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`). **Decided 2026-10-10: chained PRs, stacked-to-main**, one PR per section below; a section that comes out over 400 lines is split.

## PR0 — Planning
- [ ] 0.1 DEC-151 to DEC-154, exploration marked decided, proposal, specs, design and tasks (this branch, `ch29/exploracion`).

## PR1a — Schema and the cookie reader (split from the planned PR1, which came out at 475 lines)
- [x] 1.1 `prisma/schema.prisma` + migration for `Operador` and `SesionConsola` (generated with `prisma migrate diff`, rollback in the header, no drift after applying); client regenerated; applied to the dev database.
- [x] 1.2 Move `leerCookie` to `src/cookies.ts`; the panel imports it; panel suites green unchanged (parity proof). The console reuses `escaparHtml` from `src/correo.ts` (no new module).

## PR1b — The session layer
- [x] 1.3 RED: `src/consola-auth.test.ts` (cookie attributes, `requiereOperador` incl. look-alikes and `undefined`, exemption set derived from the panel and stylesheet sets).
- [x] 1.4 GREEN: `src/consola-auth.ts` constants, serializers, `EXENCIONES_OPERADOR`, `requiereOperador`, `resolverSesionConsola`; export the panel's public rows from `src/contexto-tenant.ts` read-only.
- [x] 1.5 `src/consola-auth-apoyo.ts` (shared live-DB setup) and `src/consola-sesion.test.ts`: no cookie, unknown token, live session by hash, expired row deleted on use, cascade on operator delete. Written after `resolverSesionConsola`, not before it (not a true RED).

## PR2a — Guard and the login and logout routes (split from the planned PR2, which came out at ~670 lines)
- [x] 2.1 RED: `src/consola-auth-rutas.test.ts` on the live DB: login 200/401/400, hashed token, logout revokes, expired session deleted on use, cookies do not cross, 401 before the tenant check.
- [x] 2.2 GREEN: `registrarGuardOperador`, `registerConsolaAuthRoutes` (`ingresar` with the dummy-hash comparison, `salir`), two exact tenant-header rows in `src/contexto-tenant.ts`.

## PR2b — The route table moved to `src/rutas.ts`
- [x] 2.3 Move the wiring to `src/rutas.ts` (`registrarRutas`, guard first, order and comments kept); `src/server.ts` calls it.
- [x] 2.4 `src/rutas.test.ts`: every registered route is 401 without a cookie unless exempt; every exempt row is registered and not answered by the guard (a hook registered after the guard marks what got past it, because the panel answers `sesion-invalida` too). Mutation check: with the guard line removed, 2 of 5 fail.

## PR3a — Bootstrap command (split from the planned PR3, which came out at 433 lines)
- [x] 3.1 RED: `src/operador-alta.test.ts` (validators, `leerClave` with fake streams, `altaOReposicion` create and reset-revokes on the live DB).
- [x] 3.2 GREEN: `src/operador-alta.ts`, exit codes, `package.json` script, built into `dist/`.

## PR3b — Smoke script
- [x] 3.3 `scripts/smoke.sh`: create the operator in the container (`docker compose exec -T app node dist/operador-alta.js …` with the password on stdin), log in, send `Cookie:` on every console call; assert 401 without it on `/tenants`; the console page checks run with the cookie. Run on 2026-10-10: the CH-29 section and every section before CH-03 passed with the cookie; the run stopped at CH-03 "reachable target" on the pre-existing false positive of a database password equal to `postgres` (the registration response carries `"motor":"postgres"`), the same one `src/conexiones.test.ts` shows. Not caused by CH-29.

## PR3c — Review fixes of PR3 (independent verifier)
- [x] 3.4 `src/operador-alta.ts`: terminal input that ends, closes or fails before the second Enter rejects and restores raw mode (it hung, exiting 13); control characters and ESC sequences are ignored instead of typed; backspace and the 12-character minimum count code points; a create that loses the unique-name race retries once as a reset. Tests first (RED: three failures and the hang).
- [x] 3.5 `scripts/smoke.sh`: the CH-29 block rewritten (an earlier edit had turned `
` and `
` into literal characters and joined the continued lines); random password from `/dev/urandom`; login bodies through stdin; `fail()` deletes the smoke operator; the `/tenants` comment no longer says "exempt" alone. Re-run in Docker at close (5.1).

## PR4 — Console
- [x] 4.1 RED: `src/consola.test.ts` cases for the login document vs the console document, the escaped operator name, the hazard scan over both documents.
- [x] 4.2 GREEN: `registerConsolaRoute(app, resolverOperador)` (a resolver instead of the client, so the console tests stay database-free; production passes `resolverSesionConsola`), `documentoIngreso()` with the design skill, header name and "Salir", 401 reload in `pedir()` and the tenant list.
- [ ] 4.3 Manual visual review of the login screen and the header at 360 px and 1280 px, light and dark.

## Close
- [ ] 5.1 Full suite, `tsc --noEmit`, `npm run build`, smoke.
- [ ] 5.2 Verify against the specs, archive, sync `console-operator-auth` and `query-console` into `openspec/specs/`, mark CH-29 in `docs/02-mapa-de-changes.md`.
