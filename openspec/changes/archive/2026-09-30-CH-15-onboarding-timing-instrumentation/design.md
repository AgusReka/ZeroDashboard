# Design: CH-15 — Onboarding (alta) Timing Instrumentation (G1)

## Technical Approach

One checked-in, SELECT-only SQL file derives the DEC-89 marks from existing columns (DEC-87, DEC-88). It returns one row per `Conexion`. No migration, route, console panel, engine or scheduler change is made. The same bytes run in two places:

- **P4, out of band**, through the established precedent: `docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on" <db> psql -X -v ON_ERROR_STOP=1 -P pager=off < scripts/marcas-alta.sql`.
- **A live-DB fixture test**, which reads the file and sends it unchanged through `pg`.

Items B1–B3 below are architecture-level. **They are flagged, not decided**, and must be registered in `docs/01-decisiones.md` before tasks and apply. The CH-14 precedent is a "Resoluciones de nivel diseño bajo DEC-87 (CH-15)" block, or a DEC-90 if the user prefers.

## Decisions Pending Registration (BLOCKING)

| # | Topic | Options | Recommendation | Consequences |
|---|---|---|---|---|
| B1 | Tenant scope | (a) No parameter: lists every tenant's connections, including deactivated ones. (b) `WHERE t.id = $1` bound by the driver | **(a)** | Rule 4 is trivially met because no value enters the query. psql cannot bind `$1` from a redirected file (`\bind` needs the statement without its `;`), so (b) would need a runner script, which is more surface. Rule 2 governs panel queries: this raw SQL bypasses `extenderConAislamiento` on purpose, like CH-16b and DEC-14 reads. It is acceptable **only** because no `src/*.ts` module references it (guarded by a static test). The output is cross-tenant: ids, timestamps and closed state strings only (D-1, rule 5) |
| B2 | Script location | (a) `openspec/changes/CH-15-…/sql/` (CH-16b precedent). (b) A repo directory | **(b) `scripts/marcas-alta.sql`** | Archiving moves the change folder, which would break the test path and bitácora links, so (a) does not work for a durable tool. `scripts/` already holds operator tooling (`smoke.sh`). This is the first durable non-migration SQL in the repo, so it sets a convention |
| B3 | Read-only guarantee (rule 3) on the app's own DB | See the next row | **Test**: a throwaway SELECT-only role with column-level grants, inside `BEGIN READ ONLY`. **P4**: `default_transaction_read_only=on` plus a file that is SELECT-only and reviewed | Rule 3 literally targets P2 queries against the tenant replica. The own DB has no read-only login and creating one is out of scope (it would be an infra/migration change). In production the P4 run therefore has one DB-enforced layer, not two. This interpretation must be recorded |

Options for B3: (a) a read-only transaction only; (b) that plus a SELECT-only role in the test; (c) a durable read-only role on the own DB.

## Design-Level Resolutions (no registration needed)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Aggregation | Per-source CTEs keyed by `conexionId`, `LEFT JOIN`ed to `Conexion`, with `DISTINCT ON` for "latest/first + its state" | Plain joins with `GROUP BY` | Avoids multiplying rows. Unreached stages stay `null` |
| Tie-breaks | Latest validation: `validadaEn DESC, entidad, id`. First run: `iniciadaEn ASC, id` | Leaving ties unspecified | Deterministic output for the bitácora |
| First run's connection | `Ejecucion → Automatizacion.conexionId` | Using `Ejecucion.tenantId` | `Ejecucion` has no `conexionId` |
| Timestamps | Raw `timestamp(3)` columns, read as UTC | Formatting in SQL | psql prints stored UTC values. The test sets a UTC parser for OID 1114 on its own client (node-pg would otherwise read them as local time) |
| Single statement | The test runs a named query (`{name, text}`), which forces the extended protocol, so a second statement is rejected | Simple protocol | The simple protocol would run `SELECT …; DELETE …`. **Verify at apply**: node-pg `requiresPreparation` when `name` is set |
| Bitácora | `docs/bitacora/CH-15-instrumentacion-de-tiempos-del-alta.md` from `_plantilla.md`, in Spanish | One file per run | See the list below |

The bitácora holds:

- "Consultas ejecutadas": the script path and commit, the exact psql command, and one dated block per run (`-- ejecutada AAAA-MM-DD sobre la base propia; universo: todas las conexiones`) with the raw output.
- A "Límites del artefacto" section with the six limits, including that the Food Store `creadoEn` is the seed time.

Later alta closes paste their dated output into their own change's bitácora and cite the script path and commit (G3).

## Data Flow

```
P4 ──psql (read-only tx)──▶ scripts/marcas-alta.sql ──▶ own DB (unscoped) ──▶ stdout ──▶ bitácora
test ──readFile──▶ same bytes ──pg (ch15_lector, READ ONLY, named)──▶ fixture DB ──▶ rows filtered by fixture tenant ids
```

## Interfaces / Contracts

Output columns (the spec is authoritative on names):

- `tenant_id`, `tenant_activo`, `conexion_id`
- `alta_inicio` (`Tenant.creadoEn`), `conexion_registrada` (`Conexion.creadaEn`)
- `mapeo_inicio` (min `creadaEn`), `mapeo_fin` (max `actualizadaEn`)
- `validacion_ultima`, `validacion_estado`
- `automatizacion_creada` (min `Automatizacion.creadaEn`)
- `primera_ejecucion`, `primera_ejecucion_estado`, `primera_ejecucion_fase`
- `primera_ejecucion_ok`

The file has no `$n` placeholders, no psql meta-commands (`\`) and ends with `;`.

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/marcas-alta.sql` (pending B2) | Create | Header comment (DEC-87..89, limits, how to run), one SELECT |
| `src/marcas-alta.test.ts` | Create | Static guards and a live fixture suite |
| `docs/bitacora/CH-15-instrumentacion-de-tiempos-del-alta.md` | Create | Bitácora |
| `docs/01-decisiones.md` | Modify (by the user) | B1–B3 |

## Testing Strategy (`npm test`; live suite skips when PG is unreachable; migrations applied)

| Layer | What |
|---|---|
| Static | No non-test `src/*.ts` references `marcas-alta.sql`. The file has no `$n` or `\` lines |
| Isolation of the read | `ch15_lector` gets `GRANT SELECT (col, …)` on exactly the columns read, never `credencial`, `host` or `sql`. Reading any other column fails the test. `SQL_LIMPIEZA` (`DROP OWNED BY`, `DROP ROLE`) runs in `before` and `after` |
| Fixture (raw Prisma, explicit fixed 2020 timestamps, `marca` prefix) | See the list below |
| Assertions | Rows are indexed by `conexion_id`, never by position. Values and nulls are asserted per mark. Nothing asserts order between marks (clock mix) |
| Cleanup (`after`) | Per tenant: `ejecucion`, `automatizacion`, `vistaCanonica`, `conexion`, `tenant`. Then plantillas by `marca`, then the role (RESTRICT FK order) |

The fixture has three tenants:

- **Tenant A**, connection A1:
  - two views: `producto` validated `valida`, then re-validated later; `insumo` validated `invalida` earlier;
  - two automations;
  - runs `fallo/preparacion` (gate refusal), then `fallo/ejecucion`, then `ok`.
- **Tenant A**, connection A2 is bare: only the tenant and registration marks are set, everything else is null.
- **Tenant B** is deactivated and has one connection. It still appears (DEC-14). Its rows are its own.

**Verify at apply**: that explicit `actualizadaEn` survives `@updatedAt` on create. The fallback is an admin `UPDATE` in the setup.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Data-exposure guarantees are covered by the static and column-grant tests.

## Migration / Rollout

No migration required. Single PR, `400-line budget risk: Low` (~250 lines).

## Open Questions

- [ ] **B1, B2, B3: register in `docs/01-decisiones.md` before tasks.** If B1 resolves to (b), revise the test binding and add a runner.
- [ ] Verify node-pg named-query behaviour and `@updatedAt` override at apply.
