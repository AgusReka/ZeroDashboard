# Tasks: CH-29 — Operator identity in the console

Branch base: `master` (after PR #132). Strict TDD: each task pair writes the failing test first, against `npm test` (`TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres` for the live-database files).

## Review Workload Forecast
- Estimated changed lines: ~1380 (PR1 ~380, PR2 ~420, PR3 ~260, PR4 ~320)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR0 — Planning
- [ ] 0.1 DEC-151 to DEC-154, exploration marked decided, proposal, specs, design and tasks (this branch, `ch29/exploracion`).

## PR1 — Schema and the session layer
- [ ] 1.1 `prisma/schema.prisma` + migration for `Operador` and `SesionConsola` (generated with `prisma migrate diff`, rollback in the header, no drift after applying); client regenerated; applied to the dev database.
- [ ] 1.2 Move `leerCookie` to `src/cookies.ts` and `escaparHtml` to `src/escapar-html.ts`; the panel imports them; panel suites green unchanged (parity proof).
- [ ] 1.3 RED: `src/consola-auth.test.ts` (cookie attributes, `requiereOperador` incl. look-alikes and `undefined`, exemption set derived from the panel and stylesheet sets).
- [ ] 1.4 GREEN: `src/consola-auth.ts` constants, serializers, `EXENCIONES_OPERADOR`, `requiereOperador`, `resolverSesionConsola`; export the panel's public rows from `src/contexto-tenant.ts` read-only.

## PR2 — Guard, routes and wiring
- [ ] 2.1 RED: `src/consola-auth-rutas.test.ts` on the live DB: login 200/401/400, hashed token, logout revokes, expired session deleted on use, cookies do not cross, 401 before the tenant check.
- [ ] 2.2 GREEN: `registrarGuardOperador`, `registerConsolaAuthRoutes` (`ingresar` with the dummy-hash comparison, `salir`), two exact tenant-header rows in `src/contexto-tenant.ts`.
- [ ] 2.3 Move the wiring to `src/rutas.ts` (`registrarRutas`, guard first, order and comments kept); `src/server.ts` calls it.
- [ ] 2.4 `src/rutas.test.ts`: every registered route is 401 without a cookie unless exempt; every exempt row is registered and not answered by the guard.

## PR3 — Bootstrap command and smoke
- [ ] 3.1 RED: `src/operador-alta.test.ts` (validators, `leerClave` with fake streams, `altaOReposicion` create and reset-revokes on the live DB).
- [ ] 3.2 GREEN: `src/operador-alta.ts`, exit codes, `package.json` script, built into `dist/`.
- [ ] 3.3 `scripts/smoke.sh`: create the operator in the container (`docker compose exec -T app node dist/operador-alta.js …` with the password on stdin), log in, send `Cookie:` on every console call; assert 401 without it on `/tenants`; the console page checks run with the cookie.

## PR4 — Console
- [ ] 4.1 RED: `src/consola.test.ts` cases for the login document vs the console document, the escaped operator name, the hazard scan over both documents.
- [ ] 4.2 GREEN: `registerConsolaRoute(app, prisma)`, `documentoIngreso()` with the design skill, header name and "Salir", 401 reload in `pedir()` and the tenant list.
- [ ] 4.3 Manual visual review of the login screen and the header at 360 px and 1280 px, light and dark.

## Close
- [ ] 5.1 Full suite, `tsc --noEmit`, `npm run build`, smoke.
- [ ] 5.2 Verify against the specs, archive, sync `console-operator-auth` and `query-console` into `openspec/specs/`, mark CH-29 in `docs/02-mapa-de-changes.md`.
