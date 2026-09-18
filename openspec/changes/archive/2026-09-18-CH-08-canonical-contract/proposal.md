# Proposal: CH-08 — Canonical Contract

## Source

- `docs/02-mapa-de-changes.md`, R1, CH-08: "Definición de entidades obligatorias y opcionales, y qué automatización depende de cada una. Excluir campos personales innecesarios."
- `docs/mapa-historias.md`: **M1** ("listado con obligatorios y opcionales, y qué automatización depende de cada uno") and **M5** ("las vistas no exponen domicilio, teléfono ni correo salvo que una plantilla lo requiera"), both R1.
- `docs/01-decisiones.md`: **DEC-21, DEC-22, DEC-23** — confirmed by the user on 2026-09-18, firm. Not re-opened here.
- Code read: `src/server.ts`, `src/tenants.ts`, `src/contexto-tenant.ts`, `src/aislamiento-prisma.ts`, `openspec/specs/domain-data-model/spec.md`.

## Why

`docs/00-contexto.md` §1 names the canonical contract as **the** contribution of the thesis — "el conjunto mínimo de entidades y campos que una plataforma de e-commerce debe exponer para que automatizaciones genéricas funcionen sin reescribirse por cliente" — and nothing in the repository enumerates it today. CH-09 (mapeo por tenant) and CH-10 (validación) have nothing to map or validate against until it exists, and CH-16's genericity test measures a second schema against a catalog that does not yet exist. Rule 5 (`§5`, minimización de datos) is currently unenforced because there is no catalog in which to enforce it.

## What Changes

- A static TypeScript module becomes the **source of truth** for the catalog: entities, fields, required/optional at both levels, and a free-text automation label per field (DEC-21, DEC-22). No Prisma model, no migration, no `MODELOS_AISLADOS` registration — the contract is identical for every tenant and is not tenant data.
- A read-only `GET /contrato` endpoint projects that module, following the existing `register*Routes(app, prisma)` pattern, closing M1's "ver" criterion.
- Personal fields (domicilio, teléfono, correo) — and any customer entity that would carry them — are **never modeled** (DEC-23). M5's base exclusion is closed structurally; there is nothing to filter.

## Proposed Catalog — rationale required by `§9`

Derived from the three validated automation cases (`docs/mapa-historias.md` D3): `stock-fisico`, `stock-producible`, `reporte-diario`.

| Entity | Required? | Fields (required) | Fields (optional) | Automations |
|---|---|---|---|---|
| `producto` | required | `id`, `nombre`, `stockDisponible` | `sku`, `activo` | stock-fisico, stock-producible, reporte-diario |
| `pedido` | required | `id`, `fechaCreacion`, `estado`, `total` | `numero`, `moneda` | reporte-diario |
| `item_pedido` | required | `id`, `pedidoId`, `productoId`, `cantidad` | `precioUnitario` | reporte-diario |
| `insumo` | optional | `id`, `nombre`, `stockDisponible`, `unidadMedida` | `codigo` | stock-producible |
| `receta_componente` | optional | `productoId`, `insumoId`, `cantidadPorUnidad` | — | stock-producible |

Two rationales are load-bearing and must survive into the spec:

1. **Entity-level optionality is not decoration.** `insumo` and `receta_componente` are optional precisely because D-5 already warns that a candidate platform may not model insumos or recetas, and records that outcome as "esperado y reportable". Their absence is what CH-10/M4 will report as `stock-producible` inapplicable. Optionality at the entity level is therefore the mechanism M4 consumes, not a hedge.
2. **No `cliente` entity at all.** Rule 5 excludes personal fields "que ninguna automatización necesite"; none of the three cases needs a buyer identity, aggregated or otherwise. Omitting the entity — rather than modeling it and dropping three columns — is the structural reading DEC-23 chose.

## Proposed Decision — user confirmation required before apply

| # | Proposal | Rejected |
|---|---|---|
| DEC-24 | `GET /contrato` joins the closed exemption allowlist in `src/contexto-tenant.ts` (`esExenta`), like `GET /health` and `GET /consola` | Requiring `x-tenant-id` to read it — that would present a tenant-agnostic design artifact as tenant-scoped data, the exact misrepresentation DEC-21 rejected when it ruled out a DB table |

Widening a fail-closed allowlist is a security-surface change, so it is surfaced rather than assumed. The route reads no database and touches no scoped model, so the exemption leaks nothing; `GET` only, matching the existing entries' discipline.

## Capability Boundary — exploration's Open Question 5

**Decision: a new capability, `canonical-contract`.** `domain-data-model` describes ZeroDashboard's own persisted tables, and its "No Premature Modeling" requirement pins the model list to exactly `Tenant`, `Conexion`, `ConsultaGuardada`. CH-08 adds no Prisma model, so that requirement is untouched and `domain-data-model` needs no delta. The canonical contract describes the shape a *tenant's replica* must expose — conceptually CH-09's `mapeo` target, not our schema. Folding it in would blur the one boundary that spec exists to state.

## Impact

### New Capabilities

- `canonical-contract`: the catalog of canonical entities and fields with required/optional status and per-field automation dependency, defined statically in code and exposed read-only, with personal fields structurally absent.

### Modified Capabilities

- None. `domain-data-model` is unchanged (no new Prisma model). `query-console` is unchanged (see Out of Scope).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/contrato.ts` (new) | New | Static catalog + exported types |
| `src/contrato-rutas.ts` (new) | New | `registerContratoRoutes(app)`, `GET /contrato` |
| `src/server.ts` | Modified | One import + one registration line |
| `src/contexto-tenant.ts` | Modified | `esExenta` gains `GET /contrato` (DEC-24) |
| `prisma/schema.prisma` | None | No migration (DEC-21) |
| `src/aislamiento-prisma.ts` | None | No tenant-scoped table introduced |
| `docs/01-decisiones.md` | Modified | Register DEC-24 |

## Out of Scope

- **M2, M3, M4** — mapeo por tenant, validación, and the inapplicable-automations list are CH-09 and CH-10.
- **M5's plantilla override** ("salvo que una plantilla lo requiera") — deferred to CH-12 per DEC-23; CH-08 closes the base exclusion only.
- **Reconciling automation labels with real `Plantilla` rows** — manual, at CH-12, per DEC-22.
- **A console page for the catalog.** DEC-21 names an API de lectura as M1's surface. Adding a `/consola` view would be a new decision (DEC-07/DEC-12 precedent), not an implementation detail of this one.
- Mutating the contract at runtime; per-tenant contract variants; versioning/migration of the catalog itself.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| The catalog is wrong and is only discovered at CH-16 (genericity test), forcing expensive rework | Med | Every entity and field above traces to a named automation; anything that traces to none is not admitted. Fields are deliberately few, since adding is cheaper than removing once CH-09 maps against them |
| Automation labels are free text and drift from CH-12's real `Plantilla` names | Med | Accepted by DEC-22. Mitigation: labels are exported constants in one module, not inline string literals, so CH-12's reconciliation is a single-file change |
| `GET /contrato` widens the tenant-context allowlist | Low | DEC-24 is explicit, `GET`-only, matched on the route pattern by the existing `esExenta` mechanism; the handler reads no database |
| Field naming (Spanish, camelCase) locks in a convention CH-09's mapeo must live with | Med | Follows the existing codebase convention (`stockDisponible` reads like `baseDeDatos`, `consultaGuardada`); `sdd-design` states it once, explicitly |

## Rollback Plan

Revert the commit. There is no migration and no persisted state, so revert is total: the module and the route disappear, `esExenta` returns to its three-entry form, and no row anywhere in the own database was written, read, or reshaped by this change. This is the cleanest rollback profile of any change since CH-01, and it is a direct consequence of DEC-21.

## Review Workload

Static catalog + one route module + registration + allowlist line + tests is well inside the 400-line budget — the first change since CH-02 that plausibly is. **Chained PRs not expected**; strategy `auto-chain` still applies, so `sdd-tasks` owns the binding forecast and may still slice if the catalog's documentation grows.

## Success Criteria

- [ ] `GET /contrato` returns every canonical entity with its fields, each field marked required or optional, and each field naming the automation(s) that depend on it.
- [ ] The response contains no field named or meaning domicilio, teléfono, or correo, and no customer entity — verified by an automated test, not by reading.
- [ ] `prisma/schema.prisma` is byte-identical to its pre-CH-08 state, and no migration is added.
- [ ] `MODELOS_AISLADOS` is unchanged.
- [ ] `GET /contrato` answers identically with and without an `x-tenant-id` header.
- [ ] Every entity and field in the catalog is traceable to at least one of `stock-fisico`, `stock-producible`, `reporte-diario`.
