# Tasks: CH-06 — Tenants and Isolation

Derived from `design.md`. Verification tasks map to scenarios in `specs/tenant-management`, `specs/tenant-isolation`, `specs/domain-data-model`, `specs/connection-registration`, `specs/saved-queries`, `specs/query-execution`, `specs/query-console`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1200–1500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Confirms design.md's 4-slice split, with one adjustment: `src/contexto-tenant.test.ts` moves into PR 2 (not PR 3), so the routing threat-matrix's RED tests (header envelope, exemption allowlist) land before their own production code in the same slice, per task-writing rules. PR 2 stays the atomic, unsplittable slice design.md names (existing suites turn red then green together). `stacked-to-main` matches CH-03/04/05's confirmed convention.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migration + tenant CRUD + wiring | PR 1 | `npm run build` (no test file yet) | `docker compose up -d --build`, manual `curl -X POST /tenants` | Revert `prisma/schema.prisma`, the migration, `src/tenants.ts`, the wiring lines in `src/server.ts`, the `prisma/seed.ts` log line |
| 2 | Context primitive + isolation extension + route adoption | PR 2 | `npm test -- src/contexto-tenant.test.ts src/conexiones.test.ts src/consultas.test.ts src/consultas-guardadas.test.ts` | Live PostgreSQL via `TEST_DB_*` env | Revert `src/contexto-tenant.ts(.test.ts)`, `src/aislamiento-prisma.ts`, the retype edits in the four route files, the header/hook edits in three existing test files, and the extend-client/hook-registration lines in `src/server.ts` |
| 3 | Tenant CRUD + two-tenant isolation suites | PR 3 | `npm test -- src/tenants.test.ts src/aislamiento.test.ts` | Live PostgreSQL, skip-not-fail preflight | Revert `src/tenants.test.ts` and `src/aislamiento.test.ts` alone; PR 1/2 code unaffected |
| 4 | Console selector/indicator + smoke + docs | PR 4 | `npm test -- src/aislamiento.test.ts` (regression) | `docker compose up -d --build`, then `npm run smoke` | Revert `src/consola.ts`, the smoke.sh CH-06 section, the `docs/01-decisiones.md` addition, the bitácora entry |

## 1. Migration, Tenant CRUD & Wiring

- [x] 1.1 Modify `prisma/schema.prisma`: add `activo Boolean @default(true)` to `Tenant`
- [x] 1.2 Create additive migration backfilling existing rows `activo: true` — `prisma/migrations/20260917000000_tenant_activo/migration.sql`
- [x] 1.3 Create `src/tenants.ts`: body schema (`nombre` required, `additionalProperties:false`, `propertyNames`), `TenantPublico` select allowlist
- [x] 1.4 Same file: `POST /tenants` → `attachValidation`/`camposInvalidos()` → create `activo:true` → `201`
- [x] 1.5 Same file: `GET /tenants` → active-only default, `?incluirInactivos=true` bypass
- [x] 1.6 Same file: `POST /tenants/:id/baja` → `404 tenant-no-encontrado`, `409 tenant-desactivado` if already inactive, else `200` `activo:false`
- [x] 1.7 Export `registerTenantRoutes(app, prisma)`; wire into `src/server.ts`
- [x] 1.8 Modify `prisma/seed.ts`: log the seeded tenant is selectable, no behavioral dependency

## 2. Request Context, Isolation Extension & Route Adoption (atomic — turns existing suites red then green)

- [x] 2.1 RED: create `src/contexto-tenant.test.ts` — absent header → `400 tenant-no-indicado`; unknown id → `404 tenant-no-encontrado`; deactivated → `409 tenant-desactivado`; exempt routes (`/health`, `/consola`, `/tenants`) pass headerless
- [x] 2.2 RED, same file: `exigirTenantActivo()` outside `conTenantActivo()` throws `ErrorSinTenantActivo`, no query runs
- [x] 2.3 Create `src/contexto-tenant.ts`: `TenantActivo`, `Portador`, `AsyncLocalStorage` store, `ErrorSinTenantActivo`, `exigirTenantActivo`, `tenantActivoOpcional`, `conTenantActivo`
- [x] 2.4 Same file: `registrarContextoTenant(app, prisma)` — two `onRequest` hooks, exemption allowlist on `request.routeOptions.url`, header resolution, 400/404/409 envelopes
- [x] 2.5 GREEN: run 2.1–2.2 against 2.3–2.4 — `npx tsx --test src/contexto-tenant.test.ts` → 15/15 pass
- [x] 2.6 Create `src/aislamiento-prisma.ts`: `MODELOS_AISLADOS`, `aplicarAlcance()` closed operation map, `ErrorAislamientoNoSoportado` for unlisted ops
- [x] 2.7 Same file: `extenderConAislamiento(prisma)` via `$extends`, calling `exigirTenantActivo()` before every query; export `PrismaAislado`
- [x] 2.8 Modify `src/server.ts`: build extended client, call `registrarContextoTenant` **first**, then register tenant/route modules
- [x] 2.9 Modify `src/conexiones.ts`: delete `tenant.findFirst`/`503` block and manual `tenantId` assignment; retype param to `PrismaAislado`
- [x] 2.10 Modify `src/consultas-guardadas.ts`: same deletion, delete stale "no tenant filter" comment, retype
- [x] 2.11 Modify `src/consultas.ts`: retype param only
- [x] 2.12 Modify `src/conexiones.test.ts`: add `registrarContextoTenant` to test app setup, `X-Tenant-Id` header on every `inject()`
- [x] 2.13 Modify `src/consultas-guardadas.test.ts`: same header/hook update; drop the "no seeded tenant → skip" preflight
- [x] 2.14 Modify `src/consultas.test.ts`: same header/hook update
- [x] 2.15 Checkpoint: `npm test` green across all three suites with the header present — `tests 99 / pass 99 / fail 0 / skipped 0`

Not in the original list, required to compile and therefore done in this slice:
`src/health.ts` and `src/tenants.ts` retyped to `PrismaAislado` (`src/server.ts` no longer holds a raw
client to hand them), and `conTenantInyectado()` added to `src/aislamiento-prisma.ts` — a Prisma Client
Extension rewrites arguments at runtime but cannot rewrite the generated `create` input types, which still
demand the `tenant` relation. See "Deviations" in the apply-progress record.

## 3. Tenant CRUD & Two-Tenant Isolation Suites

- [x] 3.1 Create `src/tenants.test.ts`: alta (valid + missing `nombre`), listado (active-only + `incluirInactivos`), baja (existing/unknown/already-inactive), no route reactivates
- [x] 3.2 Create `src/aislamiento.test.ts`: two-tenant fixture, each with a `Conexion` and a `ConsultaGuardada`
- [x] 3.3 Same file: T2 sweep table — from A against B's ids: list excludes, get-by-id/`prueba`/`ejecutar` all `404`; symmetric from B
- [x] 3.4 Same file: create binds the header's tenant, not "first tenant ever created"
- [x] 3.5 Same file: rule-2 regression — body `tenantId` still `400` on both create routes
- [x] 3.6 Same file: unit-test `aplicarAlcance` per operation and its throw on an unlisted op (e.g. `upsert`); TCP skip-not-fail preflight
- [x] 3.7 Checkpoint: `npm test` green; CH-03/04/05 scenarios pass unchanged for a single active tenant — `tests 129 / pass 129 / fail 0 / skipped 0`

Defect found and fixed inside this slice: task 3.5 failed on `POST /conexiones`, which answered `201`
to a body carrying `tenantId`. `registroConexionSchema` never received CH-05's `propertyNames` guard, so
Fastify's default `removeAdditional: true` silently dropped the key instead of rejecting it — the rule-2
hole CH-05 closed on the saved-query route and not on this one. `src/conexiones.ts` now carries the same
`propertyNames` enum.

## 4. Console, Smoke & Docs

- [x] 4.1 Modify `src/consola.ts`: sticky `<header id="barra-tenant">` with `<select id="tenant">` + `<strong id="tenant-activo">` above `<h1>`
- [x] 4.2 Same file: `tenantActivo` module state persisted to `localStorage`, re-validated against `GET /tenants` on load
- [x] 4.3 Same file: `pedir(url, opciones)` wrapper merging `X-Tenant-Id`; route the five existing `fetch` call sites through it — there are four such sites (`ejecutar`, `listarGuardadas`, `guardar`, `cargarGuardada`); design.md's fifth was "the connection test if added", and no connection test exists in the console. The new `GET /tenants` call deliberately does **not** go through the wrapper: that route is exempt, and gating it on a selection would deadlock the first selection
- [x] 4.4 Same file: banner-only (no request) when no tenant selected; add `tenant-no-encontrado`/`tenant-desactivado` messages, drop `tenant-no-inicializado`
- [x] 4.5 Same file: switching the selector clears the results table and saved-queries list
- [x] 4.6 Modify `scripts/smoke.sh`: create a tenant, send `X-Tenant-Id` on every call, assert a second tenant sees nothing — `npm run smoke` → `SMOKE TEST PASSED`
- [x] 4.7 Modify `docs/01-decisiones.md`: record design decisions 1, 3, 6 as resolutions under DEC-13/14/15
- [x] 4.8 Manual: indicator always visible, switching clears state, a `<script>alert(1)</script>` tenant name renders as text — **no browser exists in this environment**, so this was verified the way CH-05 verified the same requirement: `/consola` was served from the real route, its inline script extracted byte for byte, and that exact code executed against a minimal DOM. All three claims hold. It does **not** cover real HTML parsing or layout; recorded as friction 6 in the bitácora rather than reported as a browser test
- [x] 4.9 Add bitácora entry at `docs/bitacora/` using `docs/_plantilla.md` (read-only) per `docs/02-mapa-de-changes.md` (read-only) — `docs/bitacora/CH-06-tenants-y-aislamiento.md`
