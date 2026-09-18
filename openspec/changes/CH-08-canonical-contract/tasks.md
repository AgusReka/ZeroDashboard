# Tasks: CH-08 — Canonical Contract

Derived from `design.md`. Verification tasks map to scenarios in `specs/canonical-contract/spec.md`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~355 total (`contrato.ts` ~120, `contrato-rutas.ts` ~25, `server.ts` +2, `contexto-tenant.ts` ~6, `contrato.test.ts` ~90, `contrato-rutas.test.ts` ~70, `contexto-tenant.test.ts` +40) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR — no chain |
| Delivery strategy | auto-chain |
| Chain strategy | N/A — one PR fits the budget, no chain strategy needed |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

The proposal's own estimate ("well inside the 400-line budget... first change since CH-02 that plausibly is")
is confirmed at task granularity: two new small files (catalog + route), two edits of one line and roughly six
lines respectively, and four test files, none individually or collectively approaching 400 changed lines. No
slicing is required; `auto-chain` resolves to a single PR with no chain-strategy decision to make.

Threat Matrix is mostly `N/A` per design.md (no VCS/shell/subprocess/PR-automation surface). Its three
applicable rows — route-pattern spoofing (`/contrato-falso`), method widening (`POST`/`DELETE /contrato`),
and tenant leakage through the exemption — are carried below as explicit RED tests in Phase 3 (allowlist
mechanism) and Phase 2 (route registration), rather than as separate threat-matrix tasks.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Catalog module (`src/contrato.ts`) + unit tests: entity/field invariants, personal-field absence sweep | PR 1 (base: `main`) | `npm test -- src/contrato.test.ts` | N/A — pure unit, no DB, no server | Delete `src/contrato.ts` and `src/contrato.test.ts` |
| 1 | Route module (`src/contrato-rutas.ts`), `server.ts` registration, route tests | same PR | `npm test -- src/contrato-rutas.test.ts` | Fastify `inject()`, no live DB needed (handler takes no `prisma`) | Delete `src/contrato-rutas.ts` and `src/contrato-rutas.test.ts`; revert `server.ts` import + registration line |
| 1 | `esExenta` allowlist edit + doc comment, `contexto-tenant.test.ts` additions | same PR | `npm test -- src/contexto-tenant.test.ts` | Fastify `inject()` against `registrarContextoTenant` (DB reachability already gated by the file's existing skip) | Revert `src/contexto-tenant.ts` and its test additions — `esExenta` returns to its two-entry `/health`/`/consola` form |

All three units land in one PR (see Review Workload Forecast above); they are listed separately here only
because they map to independent rollback boundaries, not because a chain is expected.

## 1. Catalog Module & Unit Tests (`src/contrato.ts`, `src/contrato.test.ts`)

- [x] 1.1 RED: create `src/contrato.test.ts` — `CONTRATO_CANONICO` contains exactly the five entities `producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`, no more and no fewer (spec `canonical-contract` Requirement "Static Catalog Is the Source of Truth", scenario "Inspecting the catalog module")
- [x] 1.2 RED: extend `src/contrato.test.ts` — `producto`, `pedido`, `item_pedido` are each marked `obligatoriedad: 'obligatorio'` at the entity level; `insumo`, `receta_componente` are each marked `'opcional'` (same requirement/scenario as 1.1)
- [x] 1.3 RED: extend `src/contrato.test.ts` — every field across every entity is marked `'obligatorio'` or `'opcional'` and carries a non-empty `automatizaciones` array whose every value is a member of `AUTOMATIZACIONES` (spec Requirement "Each Field Is Marked Required or Optional and Names Its Automation", both scenarios: "A required entity's required field", "An optional field on a required entity")
- [x] 1.4 RED: extend `src/contrato.test.ts` — `producto.id`/`nombre`/`stockDisponible` are each `'obligatorio'` with ≥1 automation named; `producto.sku`/`activo` are each `'opcional'` with ≥1 automation named (spec Requirement "Each Field Is Marked Required or Optional...", scenarios "A required entity's required field" and "An optional field on a required entity", literal cases)
- [x] 1.5 RED: extend `src/contrato.test.ts` — a regex sweep over every entity `nombre`, every field `nombre` (and any field description, if one is ever added) across the whole catalog asserts none matches domicilio/teléfono/correo variants (Spanish and common misspellings), and no entity name is reasonably interpretable as a customer/buyer entity (spec Requirement "Personal Fields Are Structurally Absent", scenario "Automated absence check over the catalog"; DEC-23)
- [x] 1.6 Create `src/contrato.ts`: `AUTOMATIZACIONES` as-const object (`STOCK_FISICO`, `STOCK_PRODUCIBLE`, `REPORTE_DIARIO`), derived `Automatizacion` union type, `Obligatoriedad` union, `CampoCanonico`/`EntidadCanonica` interfaces, and the frozen `CONTRATO_CANONICO` literal for the five entities per the proposal's table (satisfies 1.1–1.5; design Interfaces/Contracts, DEC-21, DEC-22)
- [x] 1.7 Verify by inspection: no catalog entry references an automation string literal directly — every `automatizaciones` entry is an `AUTOMATIZACIONES.*` reference, never an inline `'stock-fisico'`-style literal (design "Automation labels as exported constants, never inline literals")
- [x] 1.8 Checkpoint: `npm test -- src/contrato.test.ts` green

## 2. Route Module & Server Registration (`src/contrato-rutas.ts`, `server.ts`)

- [x] 2.1 RED: create `src/contrato-rutas.test.ts` — `GET /contrato` on an app with only `registerContratoRoutes(app)` registered returns `200` with body `{ contrato: { entidades: [...] } }`, and `entidades` deep-equals `CONTRATO_CANONICO` (spec Requirement "Read-Only Endpoint Projects the Catalog", scenario "Retrieving the full catalog")
- [x] 2.2 RED: extend `src/contrato-rutas.test.ts` — the response lists all five entities, each entity is marked required/optional, and each entity's fields are each marked required/optional and each carry an automation label (same requirement/scenario as 2.1, literal shape assertions)
- [x] 2.3 RED: extend `src/contrato-rutas.test.ts` — `POST /contrato` is not routed (`404`); no other method is registered for `/contrato` (spec Requirement "Read-Only Endpoint Projects the Catalog", "SHALL be read-only"; design Threat Matrix row "Method widening")
- [x] 2.4 Create `src/contrato-rutas.ts`: `registerContratoRoutes(app: FastifyInstance): void` registering only `app.get('/contrato', ...)`, handler body `reply.code(200).send({ contrato: { entidades: CONTRATO_CANONICO } })`, no body/params schema, no `prisma` parameter in the function signature (satisfies 2.1–2.3; design "Route signature takes `app` only", Interfaces/Contracts)
- [x] 2.5 Modify `src/server.ts`: add `import { registerContratoRoutes } from './contrato-rutas.js';` and `registerContratoRoutes(app);` immediately after the existing `registerConsolaRoute(app);` line (design File Changes, Data Flow)
- [x] 2.6 Verify by inspection: `src/contrato-rutas.ts` imports nothing from `./aislamiento-prisma.js` or `./generated/prisma/client.js`, and its exported function's parameter list has no `PrismaAislado`/`PrismaClient` type anywhere — the structural proof the handler reads no database (design Threat Matrix row "Tenant leakage through the exemption"; DEC-24's "the handler reads no database" premise)
- [x] 2.7 Checkpoint: `npm test -- src/contrato-rutas.test.ts` green

## 3. Tenant-Context Exemption (`src/contexto-tenant.ts`, `src/contexto-tenant.test.ts`)

- [ ] 3.1 RED: extend `src/contexto-tenant.test.ts` — `GET /contrato` succeeds identically with no `x-tenant-id` header and with a header naming a nonexistent tenant id, on an app with `registrarContextoTenant` and `registerContratoRoutes` both registered (spec Requirement "`GET /contrato` Is Exempt From the Tenant-Context Header", both scenarios: "Requesting the catalog without a tenant header", "Requesting the catalog with an arbitrary tenant header")
- [ ] 3.2 RED: extend `src/contexto-tenant.test.ts` — the two response bodies (no header, arbitrary-tenant header) are byte-for-byte equal (same requirement, "SHALL equal the response body of the same request sent with a valid `x-tenant-id` header")
- [ ] 3.3 RED: extend `src/contexto-tenant.test.ts` — `/contrato-falso` with no `x-tenant-id` header is rejected `400 tenant-no-indicado` (not silently let through), proving `esExenta`'s exact-match discipline holds for the new entry the same way it already holds for `/consola`/`/consola-falsa` (design Threat Matrix row "Route-pattern spoofing"; design's own risk note)
- [ ] 3.4 RED: extend `src/contexto-tenant.test.ts` — `POST /contrato` with no `x-tenant-id` header is rejected `400 tenant-no-indicado` (non-`GET` never inherits the exemption), independent of Phase 2's `404`-for-unrouted-`POST` check — this exercises the allowlist mechanism itself, before routing even applies (design Threat Matrix row "Method widening"; design's own risk note)
- [ ] 3.5 Modify `src/contexto-tenant.ts`: widen the `esExenta` condition to `metodo === 'GET' && (patron === '/health' || patron === '/consola' || patron === '/contrato')` (satisfies 3.1–3.4; design Interfaces/Contracts exact edit; DEC-24)
- [ ] 3.6 Modify `src/contexto-tenant.ts`: update the doc comment immediately above `esExenta` — replace "Only `GET` is exempt for `/health` and `/consola`" with the three-route enumeration, and add that the contract is tenant-agnostic by construction and its handler holds no Prisma client (design: "MUST be updated in the same edit"; this is the second half of the "two coupled edits")
- [ ] 3.7 Checkpoint: `npm test -- src/contexto-tenant.test.ts` green

## 4. Full-Suite Checkpoint

- [ ] 4.1 Verify by inspection: `prisma/schema.prisma` is byte-identical to its pre-CH-08 state (`git diff --stat prisma/schema.prisma` shows no change) — Success Criterion "no migration is added"
- [ ] 4.2 Verify by inspection: `src/aislamiento-prisma.ts`'s `MODELOS_AISLADOS` list is unchanged — Success Criterion "`MODELOS_AISLADOS` is unchanged"
- [ ] 4.3 Full-suite checkpoint: `npm test` green across `src/contrato.test.ts`, `src/contrato-rutas.test.ts`, `src/contexto-tenant.test.ts`, and the pre-existing suite together

## Key Success-Criteria Traceability

- `GET /contrato` returns every entity/field with required/optional status and automation label(s) → Phase 1 (1.1–1.6) and Phase 2 (2.1–2.4)
- No personal field or customer entity, verified by an automated test → Phase 1 (1.5)
- `prisma/schema.prisma` byte-identical, no migration → Phase 4 (4.1)
- `MODELOS_AISLADOS` unchanged → Phase 4 (4.2)
- `GET /contrato` answers identically with and without `x-tenant-id` → Phase 3 (3.1–3.2)
- Every entity/field traceable to ≥1 of the three named automations → Phase 1 (1.3–1.4), by construction of 1.6
