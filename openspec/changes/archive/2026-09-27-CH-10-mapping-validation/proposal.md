# Proposal: CH-10 — Mapping Validation

## Source

- `docs/02-mapa-de-changes.md` R1 CH-10; `docs/mapa-historias.md` **M3, M4**.
- `docs/01-decisiones.md`: **DEC-39..44** (firm, user, 2026-09-26). OD-5 deferred to CH-12/CH-21.
- Exploration: `openspec/changes/CH-10-mapping-validation/explore.md`.

## Intent

CH-09 stores mapping SQL as inert text; nothing checks that a view exposes the contract's columns and types. Broken mappings fail silently (the DEC-36 case). CH-10 adds explicit, loud, persisted validation, and reports which automations are inapplicable and why.

## Scope

### In Scope

- Semantic type (`texto`/`numero`/`booleano`/`fecha`/`identificador`) on each `CampoCanonico`, plus a documented tolerant Postgres OID → category mapping (DEC-39). `identificador` accepts integer, `uuid` and text columns.
- View columns not defined by the contract make the entity invalid, and the diagnostic names them (DEC-43).
- Explicit validate action on the tenant's own connection. It runs a zero-row `LIMIT 0` probe per mapped entity inside the existing read-only transaction with the DEC-08 permission check (DEC-42).
- Persisted result: status, per-field diagnostics (JSON), timestamp, stored as columns on `VistaCanonica` (DEC-40, DEC-44). Reads serve it without touching the tenant DB. Unmapped entities have no row; their state is derived from the contract on read.
- Re-registering an entity's SQL resets it to "not validated" (DEC-41).
- Automation applicability report derived from DEC-22 labels. An unmapped optional entity is "inapplicable, entity not mapped". A missing or failing required entity or field blocks each dependent automation, with its reason.
- Migration adding the columns; T2 sweep over the new routes. No new isolated model.

### Out of Scope

- Data sampling and NULL detection (documented artifact limit, DEC-42).
- Gating automations on validation state (OD-5 → CH-12/CH-21).
- Panel visibility (CH-22, R2). Output is shaped for later consumption.
- Console UI; validation history (DEC-44 keeps only the last result); engine changes (rule 6).

## Capabilities

### New Capabilities

- `mapping-validation`: explicit structural validation, persisted results, automation applicability report.

### Modified Capabilities

- `canonical-contract`: each field declares a semantic type; `GET /contrato` projects it.
- `tenant-schema-mapping`: re-registration resets validation (DEC-41). "Never Executed" narrows to register/list/read, since only the validate action probes.
- `domain-data-model`: `VistaCanonica` gains validation columns (destructive-delta warning at archive). The model list is unchanged.
- `tenant-isolation`: T2 sweep extended to the new routes.

## Approach

- The zero-row probe reuses the private `correrTransaccion` machinery. Wrapping follows the existing `_consulta_usuario` precedent, with no new concatenation (rule 4). The probe reads only `fields` (name, `dataTypeID`) and never reads rows (rule 5).
- Tenant id comes from context (DEC-15). The connection is resolved through the scoped delegate and decrypted only via `destinoDeConexion`.

Left open for `sdd-design`: route naming, action granularity, the OID table for enums/domains, and the diagnostic JSON shape.

## Resolved Questions

Raised during proposal, decided by the user and registered on 2026-09-26:

- **OQ-1** → DEC-39 amended: a fifth category `identificador` for `id`, `pedidoId`, `productoId`, `insumoId`.
- **OQ-2** → DEC-43: columns outside the contract fail validation.
- **OQ-3** → DEC-44: validation result stored as columns on `VistaCanonica`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/contrato.ts` (+ test) | Modified | Type per field |
| `src/consulta-ejecucion.ts` | Modified | Expose transaction for probe |
| `src/<validation-module>.ts` (+ test) | New | OID mapping, probe, routes, report |
| `src/vistas-canonicas.ts` | Modified | Reset on re-register |
| `prisma/`, `src/aislamiento.test.ts`, `src/server.ts` | Modified/New | Validation columns, T2 sweep, wiring |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Case-folded unquoted aliases (`stockdisponible`) | Med | Report a clear per-field diagnostic |
| Refactor alters query-execution behavior | Med | Existing tests unchanged and green |
| ~700 lines, over budget | High | `auto-chain` slices; `sdd-tasks` forecasts |

## Rollback Plan

Revert the commits. Apply a migration that drops the validation columns from `VistaCanonica` (additive, so no existing data changes). Remove the type field, which restores `GET /contrato`. No consumer exists yet (OD-5).

## Success Criteria

- [ ] A view missing a required column, or with a wrong-category type, fails with a per-field diagnostic.
- [ ] The probe fetches zero rows inside a READ ONLY transaction.
- [ ] Reads open no `pg` connection.
- [ ] Re-registration yields "not validated".
- [ ] A view exposing a column outside the contract fails and names it.
- [ ] Unmapped `insumo` marks `stock-producible` inapplicable, not failed.
- [ ] T2 sweep: another tenant's connection returns `404`.
