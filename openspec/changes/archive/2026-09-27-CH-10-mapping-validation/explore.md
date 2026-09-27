## Exploration: CH-10 — Mapping Validation (M3/M4)

> Mirror of Engram `sdd/CH-10-mapping-validation/explore` (obs #141). Written by the orchestrator because the explore agent had no file-write tool.

### Current State

**Contract (`src/contrato.ts`, DEC-21):** static `CONTRATO_CANONICO` array. Each `EntidadCanonica` has `nombre`, `obligatoriedad` ('obligatorio'|'opcional'), `campos: CampoCanonico[]`. Each `CampoCanonico` has `nombre`, `obligatoriedad`, `automatizaciones: Automatizacion[]` (free-text labels, DEC-22). **There is no type field anywhere in the contract** — nothing to validate a column's type against. This is the biggest gap for M3.

**Mapping (`src/vistas-canonicas.ts`, CH-09/DEC-30..35):** `VistaCanonica` model — one row per (`conexionId`, `entidad`), unique constraint, tenant-isolated via `MODELOS_AISLADOS`. Stores operator-authored SQL as inert text, never executed (DEC-31 pure-persistence scope). `entidad` validated only against `CONTRATO_CANONICO` names; SQL columns/shape never checked. Re-registration replaces in place, no history (DEC-34). CH-09's proposal explicitly named "Column/type validation and inapplicable automations" as out of scope → CH-10, and excluded the "zero-row preview" because executing unvalidated definitions could surface personal columns before CH-10 exists.

**Read-only execution pipeline (`src/consulta-ejecucion.ts`, `src/db-probe.ts`):** `ejecutarConsulta()` already implements budgeted connect, `BEGIN TRANSACTION READ ONLY`, `statement_timeout`, `verificarPermisosRol()` (DEC-08), and a parameterized wrapper `SELECT * FROM (<sql>) AS _consulta_usuario LIMIT $1 OFFSET $2`. Returns `columnas: string[]` but never reads `field.dataTypeID` — no OID→type mapping exists today. `pg.types.builtins` exposes OIDs without a new dependency. Calling `ejecutarConsulta` with `limite: 0` still binds `LIMIT 1` (it requests `limiteEfectivo + 1` for `hayMas`), so it is **not** a zero-row probe — a dedicated probe (`SELECT * FROM (<sql>) AS _validacion LIMIT 0`) would match DEC-31's "vista previa opcional de cero filas" and rule 5 (data minimization), reusing `correrTransaccion`'s READ-ONLY + permission-check machinery.

**Tenant/connection plumbing:** `destinoDeConexion()` (only place that decrypts `credencial`), `conexionPropia()` pattern in `vistas-canonicas.ts`. CH-10 should reuse both.

**Instrumentation hint (CH-15/G1):** "Marcas de tiempo de conexión, mapeo, **validación** y primera ejecución" — implies validation leaves a timestamp, i.e. something persisted.

**`domain-data-model` spec** pins the model list to exactly `Tenant`, `Conexion`, `ConsultaGuardada`, `VistaCanonica` — any persisted validation result needs an explicit spec delta.

M4's "visible también en el panel" cannot be built now — the panel (CH-22) is R2.

### Affected Areas

- `src/contrato.ts` — needs a type field per `CampoCanonico` if type validation is kept.
- `src/vistas-canonicas.ts` — mapped entities/SQL per (`conexionId`, `entidad`).
- `src/consulta-ejecucion.ts`, `src/db-probe.ts` — reusable READ ONLY + permission-check + parameterized wrapper; new zero-row probe belongs alongside.
- `src/conexion-destino.ts` — reuse `destinoDeConexion`.
- `src/aislamiento-prisma.ts` / `prisma/schema.prisma` — only if results are persisted.
- `openspec/specs/canonical-contract/spec.md`, `openspec/specs/tenant-schema-mapping/spec.md`, `openspec/specs/domain-data-model/spec.md` — deltas.

### Approaches

1. **Compute-on-read, no persistence** — live probes on every call. Pros: no migration, no staleness. Cons: every read needs tenant connectivity; nothing for CH-15/G1 to timestamp. Effort: Medium.
2. **Validate-and-persist (snapshot + timestamp)** — explicit "validar" action persists status, per-field diagnostics and timestamp; reads serve the snapshot. Re-registering SQL (DEC-34) resets it. Pros: matches M3's "validar antes de activar"; G1 timestamp; panel-friendly. Cons: spec delta + migration; needs invalidation rule. Effort: Medium-High.
3. **Hybrid** — (2) plus forced live probe on demand. Cons: two code paths. Effort: High.

### Recommendation

Approach 2, with: (a) a type axis on `CampoCanonico` with a documented liberal Postgres-OID mapping; (b) a dedicated zero-row probe reusing `correrTransaccion`; (c) a persisted validation-result shape with a `domain-data-model` delta; (d) a reverse index from per-field `automatizaciones` labels to derive per-automation blocking reasons — unmapped **optional** entities (`insumo`, `receta_componente`) are "inapplicable, entity not modeled", not a validation failure.

### Open Decisions (escalated to the user)

- **OD-1** — Per-field type in the contract: (a) coarse semantic enum with liberal OID mapping; (b) strict Postgres type names; (c) drop type validation (presence only). Rec: (a).
- **OD-2** — When validation runs / persistence: approaches 1/2/3. Rec: 2.
- **OD-3** — Does replacing SQL (DEC-34) invalidate the snapshot: (a) yes, reset to "no validado"; (b) stale until revalidated, documented limit. Rec: (a).
- **OD-4** — Structural only (zero rows) vs structural + bounded sample (catches DEC-36 NULL `activo`). Rec: structural only, gap documented.
- **OD-5** (informational) — whether CH-12/CH-21 must consult validation state before running an automation; deferred to those changes.

### Risks

- Adding a type to `contrato.ts` edits the file DEC-21 calls central to the thesis contribution.
- Persisted snapshot requires a `domain-data-model` delta ("No Premature Modeling").
- New probe must reuse `correrTransaccion` without duplicating READ-ONLY/permission logic.
- M4 panel visibility deferred to CH-22.
- AGENTS.md lists D-4/D-5 as open but `01-decisiones.md` shows them closed (DEC-25, DEC-26) — hygiene note.

### Ready for Proposal

No — OD-1..OD-4 must be decided by the user and registered in `docs/01-decisiones.md` first.
