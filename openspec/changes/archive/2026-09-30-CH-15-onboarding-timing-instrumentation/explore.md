# Exploration: CH-15 — Onboarding (alta) timing instrumentation (G1)

Status: exploration complete; proposal blocked on product decisions 1-4 (see bottom).

## Scope
- G1: "Como P4, quiero medir cuánto llevó cada etapa del alta de un tenant". Criterion: marks for connection, mapping, validation and first execution (R1).
- Out of scope: G2/G3 (documentary practice), C3 (R2), any new engine capability such as "run now" (rule 6), a console panel for P4.

## Gates
- AGENTS.md is stale: D-4 and D-5 are closed (DEC-25, DEC-26). Open: D-1, D-2, D-6. None blocks CH-15 (R1).
- D-1: store timestamps and closed state strings only (no SQL text, diagnostics, error text, rows).
- D-2: keep the connection mark generic (CH-19 may change what "connected" means).
- Latest decision is DEC-86; next free is DEC-87.

## Current state per stage
| Stage | Persisted | Where | Caveat |
|---|---|---|---|
| Alta start | Yes | `Tenant.creadoEn` (DB clock) | Food Store value = seed time |
| Connection | Registration only | `Conexion.creadaEn` | `POST /conexiones/:id/prueba` persists nothing; no "connected OK" mark |
| Mapping | Yes | `VistaCanonica.creadaEn` / `actualizadaEn` | PUT replaces in place (DEC-34); `actualizadaEn` = last SQL change |
| Validation | Latest only | `VistaCanonica.validadaEn`, `estadoValidacion` | App clock; set even on `invalida`; nulled on re-register (DEC-41), overwritten on re-validate (DEC-44) |
| First execution | Yes | `Ejecucion.iniciadaEn` / `finalizadaEn` | Gate refusals (DEC-71) also write rows (`fallo`/`preparacion`) |
| Automation created | Yes | `Automatizacion.creadaEn` | Extra informational mark |

Prior decisions presuppose derivation from these columns: DEC-40, DEC-30, DEC-31, CH-10 design.
No scheduler "run now" exists: the first run waits for the first cron fire (widening = rule 6, DEC-75).
CH-16/16b/16c/16d ran off-system with self-reported hours; CH-15 cannot retro-measure them. Its consumer is prospective (R1 closing run).

## Affected areas
- New spec (or delta) for the timing marks; `docs/01-decisiones.md` (DEC-87+); `docs/bitacora/CH-15-*.md` incl. "Consultas ejecutadas" (G3).
- Only if approaches 2/4/5/6: `prisma/schema.prisma` + migration later than `20260929000000_notificacion`.
- Only if approach 3: `src/server.ts`, new read module, T2 sweep in `src/aislamiento.test.ts`, `tenant-isolation` delta.
- `domain-data-model` "No Premature Modeling" delta only if a model is added (approach 5).

## Conventions
Branches `chNN/N-slug`; additive migrations with DEC refs and rollback SQL; node:test with `app.inject()`, live-DB suites skip when unreachable; every scoped route joins the T2 sweep; openspec artifacts in English, docs/ in Spanish; dated SQL + outputs as in CH-16b.

## Isolation / route pitfalls
- Never place a route under `/tenants/…` (exempt from the `x-tenant-id` hook); use e.g. `GET /alta/…`.
- `Tenant` is unscoped: read by the id from `exigirTenantActivo()`, never from the request.
- Deactivated tenants (409, DEC-14) are readable only via SQL.
- Raw SQL/views bypass the Prisma extension: acceptable out-of-band (like CH-16b), never exposed by a route.

## Semantic issues
1. Registration is not "connected". 2. Mapping has a start and an end. 3. Validation mark is mutable and set on `invalida` too. 4. First execution: any status vs first `ok`. 5. Per-Conexion multiplicity (DEC-33). 6. Marks are elapsed time, not effort (idle, off-system SQL, cron wait). 7. Clock mix (DB vs app): do not assert strict monotonicity. 8. No backfill (pre-CH-13, pre-CH-07 data not comparable).

## Approaches
| # | Approach | Effort | 400-line risk |
|---|---|---|---|
| 1 | Checked-in SQL script over existing columns + dated outputs + fixture-based test | Low | Low |
| 2 | DB view `v_alta_marcas` via migration | Low-Med | Low-Med |
| 3 | Tenant-scoped read route + pure derivation module | Medium | Medium |
| 4 | Write-once mark columns (touches scheduler hot path) | Medium | Medium-High |
| 5 | Append-only `EventoAlta` table (contradicts DEC-44) | High | High |
| 6 | Persist only the connection-test result (`probadaEn`/`probadaOk`) | Low-Med | Low-Med |

Recommendation: approach 1 as primary; escalate to 3 only if in-app visibility is wanted; approach 6 (or documented limit) for the connection mark; avoid 4/5.

Branching: `master` is at CH-13; the unpublished ch14 stack carries DEC-81..86 and spec changes. Base CH-15 on `ch14/7-verify-archivo` (or wait for the CH-14 merge) to avoid collisions in `docs/01-decisiones.md`, `openspec/specs`, `prisma/schema.prisma`. Do not commit untracked `0` and `run`.

## Pending decisions (become DEC-87+)
1. Mark source (approach 1/2/3/4/5). Rec: 1.
2. Connection mark: registration vs first successful test (approach 6). 
3. Other mark definitions: mapping (start/end/both), validation (latest vs approved), first run (any/first ok/both), automation-created as fifth mark. Rec: mapping start+end, latest validation with state, first run with estado/fase plus first ok, include automation-created.
4. Multi-connection aggregation: per Conexion vs per tenant. Rec: per Conexion.
5. Read surface (console panel? deactivated tenants?). Rec: no panel.
6. Mutable validation mark: accept as documented limit vs persist. Rec: accept.
7. Prospective use only, no backfill, no retro-measure of CH-16.

## Risks
Cron wait; elapsed-time overstatement; clock mix; mutable validation mark; route placement; cross-tenant listing; size vs 400 lines; stale docs (AGENTS.md gates, openspec/config.yaml, 02-mapa pending list, mapa-historias "four gates open").
