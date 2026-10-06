# Tasks: CH-22a — Panel Authentication, Client User, Session and Strict Tenant Derivation (T3)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~220, PR2 ~310, PR3 ~280 authored (docs excluded) |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR0 (docs) -> PR1 (schema, migration, crypto) -> PR2 (auth routes, session hook, isolation tests) -> PR3 (panel page UI & login) |
| Delivery strategy | single-pr (`size:exception` aprobado por el maintainer, 2026-10-06) |
| Chain strategy | n/a — un solo PR de código |

> **Decisión de entrega (2026-10-06).** El preflight de sesión eligió `single-pr` y el maintainer aprobó
> `size:exception` para un único PR de código. **Ampliado el mismo día por decisión del maintainer
> (`gentle-ai sdd-attempt reset` auditado, actor `user (AgusReka)`):** los tests reales duplicaron el
> forecast (~810 estimado; PR1 533 + PR2 1018 = 1551 líneas reales del ledger), el presupuesto
> autorizado sube a ~1.700 líneas y PR3 continúa dentro del mismo único PR. Los docs ya se entregan en el
> PR0 (#99). Los grupos PR1/PR2/PR3 de este plan se conservan como unidades de trabajo y commits
> revisables, no como PR separados.

## PR0: Docs

- [x] 0.1 Exploration and DEC-133 to DEC-136 in `docs/01-decisiones.md` on `ch22a/exploracion`.
- [x] 0.2 `proposal.md`, delta specs under `specs/` and `design.md` written.
- [x] 0.3 `tasks.md` written (this file).
- [x] 0.4 Docs commit and PR0 opened on `ch22a/exploracion`.


## PR1: Data Model, Migration & Crypto Module (~220 authored)

Branch `ch22a/modelo-y-crypto`.

- [x] 1.1 RED tests for `src/crypto-auth.ts`: scrypt hashing, salt random generation, verification with correct and incorrect password, timing-safe equality, session token generator.
- [x] 1.2 GREEN `src/crypto-auth.ts`: implement `hashearClave`, `verificarClave`, `generarTokenSesion`.
- [x] 1.3 `prisma/schema.prisma`: add `Usuario` and `SesionPanel` models and reverse relations on `Tenant`. Generate additive migration.
- [x] 1.4 Update `MODELOS_AISLADOS` in `src/contexto-tenant.ts` and pin test.
- [x] 1.5 Verification: `npx tsc --noEmit`, `npm test` focused on crypto-auth and model pin.

## PR2: Auth Routes, Session Hook & Two-Tenant Isolation (~310 authored)

Branch `ch22a/rutas-autenticacion`. Depends on PR1.

- [x] 2.1 RED tests for auth routes (`src/panel-auth.test.ts`): login with valid credentials (cookie set, 200 response), invalid password (401), unknown email (401), deactivated user (401), deactivated tenant (409/401), logout (cookie cleared, session deleted), session read endpoint (`GET /api/panel/auth/sesion`).
- [x] 2.2 RED two-tenant isolation test (`src/aislamiento-panel.test.ts`): User A logs in, access is strictly limited to Tenant A; sending `X-Tenant-Id: <tenant-b>` is ignored and does not leak or switch to Tenant B; cross-tenant session token fails.
- [x] 2.3 GREEN `src/panel-auth.ts`: implement login, logout, session info endpoints, cookie parsing/serialization, and panel route pre-handler hook.
- [x] 2.4 Update exemption list in `src/contexto-tenant.ts` for public panel auth routes.
- [x] 2.5 Verification: `npx tsc --noEmit`, full `TEST_DB_PORT=5434 npm test`.

## PR3: Servable Panel Page & Login Screen (~280 authored)

Branch `ch22a/panel-ingreso`. Depends on PR2.

- [x] 3.1 RED tests for `src/panel.ts` / `src/panel.test.ts`: `GET /panel` without session renders login screen (P-01) with email and password fields, submit action, stylesheet link; `GET /panel` with active session renders panel shell and tenant store name.
- [x] 3.2 GREEN `src/panel.ts`: implement panel page HTML/script serving login form and initial shell.
- [x] 3.3 Verification: `npx tsc --noEmit`, full `TEST_DB_PORT=5434 npm test`, `npm run build`.
- [x] 3.4 Manual visual review (human only): login screen, error state, successful login transition to shell; 360 and 1280 px, light/dark themes in browser. Maintainer confirmó los 4 puntos OK el 2026-10-06 (stack HTTPS local, ver apply-progress).

## Closure

- [x] 4.1 Verify per PR (`sdd-verify`): check all scenarios and tests against requirements.
- [ ] 4.2 Archive (`sdd-archive`) after PR3 merges: sync delta specs to `openspec/specs/` and move folder to `openspec/changes/archive/2026-10-06-CH-22a-autenticacion-panel/`.
