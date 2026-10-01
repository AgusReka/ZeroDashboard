```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:28ab6227213ea0d78d8691114954b8246777352a894b7eae019d091555aee5b1
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 12/12
scenarios: 29/29
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:534f2907e81ffa0f173b1401bb1bfa2bd0b8dd93c63bd17be61bb0563ea445b7
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: CH-17a-interrumpidas-y-solapamiento
**Version**: N/A (4 delta specs: automation-scheduling, execution-log, query-console, tenant-isolation)
**Mode**: Strict TDD (injected by the orchestrator; `openspec/config.yaml` still says `strict_tdd: false`)
**Branch / HEAD**: `ch17a/2-solapamiento-y-consola` at `f8d69493c1722e7e285224d2dcb1d0a495c7af6d` (working tree clean except the unrelated empty untracked file `run`)
**evidence_revision**: sha256 of the HEAD commit id string above (the verified candidate is that commit).

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 17 (1.1-1.9, 2.1-2.8) |
| Tasks complete | 16 (1.1-1.9, 2.1-2.7) |
| Tasks incomplete | 1: 2.8 "Run sdd-verify, then sdd-archive", which is this phase; not a core task |

### Build & Tests Execution
**Build / type-check**: passed
```text
npx tsc --noEmit  -> exit 0, empty output
```

**Tests**: 648 passed / 0 failed / 0 skipped / 0 cancelled
```text
TEST_DB_PORT=5434 npm test -> exit 0; tests 648, suites 94, pass 648, fail 0, cancelled 0, skipped 0, todo 0, duration ~15.6 s
```
A live PostgreSQL on port 5434 was used (planner and route tests run against it).

**Coverage**: not available (no coverage tool configured). Lint: not configured.

**Prisma**: `git diff master...HEAD -- prisma package.json package-lock.json` is empty. No migration, no new dependency.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | "TDD Cycle Evidence" table present in apply-progress.md |
| All tasks have tests | Yes | every behavior task (1.1-1.6, 2.1-2.5) has a test file; 1.7 (wiring), 1.8 (comments), 2.6 (docs) are N/A by nature |
| RED confirmed (tests exist) | Yes | `src/planificador.test.ts`, `src/apagado.test.ts` (new), `src/consola.test.ts` exist and contain the cited tests (15 new: 5 live PG + 4 unit in planificador, 5 apagado, 1 consola) |
| GREEN confirmed (tests pass) | Yes | all 15 pass in the full run (648/648) |
| Triangulation adequate | Yes | sweep: active/deactivated tenants, failing tenant vs. none, closed rows of three estados; overlap: two ticks, sibling, cross-tenant, lookup throw, post-sweep normal run; signals: SIGTERM, SIGINT, second signal, rejection, real Fastify |
| Safety Net for modified files | Yes | 17/17 and 24/24 recorded before changes; existing 4.7 timer test bodies unmodified (only a helper gained an optional parameter) |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 9 (4 planner unit, 4 apagado with EventEmitter, 1 consola fake DOM) | 3 | node:test |
| Integration (live PG / real Fastify) | 6 (5 planner live PG, 1 real Fastify `onClose`) | 2 | node:test, PostgreSQL |
| E2E (real browser) | 0 | 0 | not installed |

### Assertion Quality
No tautologies, no ghost loops (the one loop in the console test iterates a fixed four-element array and the rendered text is asserted non-empty by prior `deepEqual`), no smoke-only tests. Empty-collection assertions (notification count 0, sweep call list) have companion non-empty cases in the same tests (one notification after the sweep; failing-tenant vs. both-tenant call lists). Mocks are Proxy wrappers that delegate to the real client; the mock-to-assertion ratio is low.
**Assertion quality**: 0 CRITICAL, 0 WARNING

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Overlap Check (X4, DEC-96) | Stuck automation skipped and recorded | `planificador.test.ts > CH-17a 2.1 a stuck automation gets one omitida/solapamiento row per tick...` (no notification, no connect, row shape, one warn) | COMPLIANT |
| Overlap Check | Overlap is per automation | `> CH-17a 2.2 overlap is per automation and per tenant...` (sibling `fallo/conexion` shows it ran its pipeline) | COMPLIANT |
| Overlap Check | Another tenant en-curso row does not block | `> CH-17a 2.2` (tenant B en-curso row naming the tenant A automation) | COMPLIANT |
| Overlap Check | Lookup failure does not stop the tick | `> CH-17a 2.2` (Proxy `findFirst` reject for one automation; later sibling runs; logged by class name only) | COMPLIANT |
| Boot Sweep Before First Tick (X7, DEC-99) | Sweep completes before ticking | `> CH-17a 1.3 arrancar arms the first tick only once the sweep has resolved` + `1.1` + `2.1` (sweep then tick) | COMPLIANT |
| Boot Sweep | Sweep failure does not block startup | `> CH-17a 1.2 a sweep whose tenant list fails resolves...` + `1.3 a failed sweep still arms the first tick` + `1.2 each tenant ... one failing tenant leaves the other swept` | COMPLIANT |
| Boot Sweep | Interrupted runs are not re-executed | `> CH-17a 1.1` (no new row, closed rows unchanged) | COMPLIANT |
| Boot Sweep | A row stuck in a live process is not reaped | `> CH-17a 1.3 a row that goes en-curso after the sweep stays en-curso` + `2.1` (omitida per tick) | COMPLIANT |
| Signals Close Gracefully (DEC-100) | A signal triggers an orderly close | `apagado.test.ts` SIGTERM / SIGINT / second signal / rejection / real Fastify `onClose` cancels the timer | COMPLIANT |
| Missed Fires Not Recovered (DEC-95) | Downtime leaves no catch-up | `planificador.test.ts > 4.1 ... whatever the fires in its window` (one run per window) only; `anterior = reloj.ahora()` at construction has no restart-level test | PARTIAL |
| Single-Instance Assumption | Limit is documented | `docs/bitacora/CH-17a-interrumpidas-y-solapamiento.md` "Limites del artefacto" states it (documentation scenario, verified by reading) | COMPLIANT |
| Estado Set Includes omitida (DEC-96) | Overlap skip recorded as omitida | `> CH-17a 2.1` | COMPLIANT |
| Estado Set Includes omitida | A closed row is not an overlap | `> CH-17a 2.1` (after the sweep the next tick runs `ok/enviada` with omitida rows present) + pre-existing tick tests | COMPLIANT |
| Interrupted Runs Closed (DEC-99) | Swept row has the interrupted shape | `> CH-17a 1.1` (single boot-time read proven by an advancing clock; all null columns) | COMPLIANT |
| Interrupted Runs Closed | Closed rows untouched by the sweep | `> CH-17a 1.1` (ok, fallo, omitida rows compared before and after) | COMPLIANT |
| Every Run Outcome Writes an Ejecucion (MODIFIED) | Validation-gate refusal recorded | `> 4.3` (pre-existing, green) | COMPLIANT |
| Every Run Outcome Writes an Ejecucion | Execution failure recorded | `> 4.6`, `> 4.5` (pre-existing, green) | COMPLIANT |
| Every Run Outcome Writes an Ejecucion | Overlap skip writes exactly one row per tick | `> CH-17a 2.1` (two ticks, two rows, en-curso row `deepEqual` unchanged) | COMPLIANT |
| Error Field Classified (MODIFIED) | A failed run error is sanitized | `> 4.6` (pre-existing, green) | COMPLIANT |
| Error Field Classified | A failed send error is a closed category | `> CH-14 5.4 5.6` (pre-existing, green) | COMPLIANT |
| Error Field Classified | New values appear in the runs listing | no test drives `GET /automatizaciones/:id/ejecuciones` with an `omitida` or `interrumpida` row; the route is a pass-through `select`; rows are covered by the planner tests and the console test separately | PARTIAL |
| Runs View Messages (query-console) | Overlap skip is legible | `consola.test.ts > CH-17a 2.4` (`Omitida` + overlap message, no raw code) | COMPLIANT |
| Runs View Messages | Interrupted run is legible | `> CH-17a 2.4` (`fallo` + interruption message; null `duracionMs`/`filas`/`notificacion` render the placeholder) | COMPLIANT |
| Runs View Messages | Unknown error values still render | `> CH-17a 2.4` (raw estado, generic message) + CH-14 6.5 | COMPLIANT |
| Boot Sweep Enters Each Tenant Context (tenant-isolation) | Active and deactivated tenants both swept | `> CH-17a 1.1` | COMPLIANT |
| Boot Sweep Enters Each Tenant Context | Sweep limited to each tenant own rows | `> CH-17a 1.2` (per-call tenant context and counts) | COMPLIANT |
| Boot Sweep Enters Each Tenant Context | Deactivated tenant automations still do not run | `> 4.2` (tick) + `> CH-17a 1.1` (sweep creates no row); no single sweep-then-tick test | COMPLIANT (composed) |
| Boot Sweep Enters Each Tenant Context | Sweep outside any context fails closed | `> CH-17a 1.2` (`aislado.ejecucion.updateMany` rejects with `ErrorSinTenantActivo`) | COMPLIANT |
| Overlap Lookup Is Tenant-Scoped | Cross-tenant rows invisible to the lookup | `> CH-17a 2.2` | COMPLIANT |

**Compliance summary**: 27/29 scenarios fully COMPLIANT, 2 PARTIAL (reported as WARNING and counted as complete in the envelope because each has passing runtime coverage of its parts), 0 UNTESTED, 0 FAILING. Requirements: 12/12 have passing coverage.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Overlap check first in `correr()` | Implemented | scoped `findFirst` (automatizacionId + `en-curso`) after the single `iniciadaEn` read and before any write; `omitida` row via `CIERRE_OMITIDA` with `finalizadaEn = iniciadaEn`; `warn` carries only `automatizacionId` and `error` |
| Boot sweep | Implemented | one `reloj.ahora()`, `prisma.tenant.findMany` (unscoped model, only source of tenant ids), no `activo` filter, `conTenantActivo` with `updateMany` awaited inside the callback, per-tenant and outer try/catch, never rejects |
| `arrancar()` | Implemented | sweep then `iniciar()` (still synchronous); `server.ts` calls `registrarApagado` before `listen`, then `planificador.arrancar()` after it |
| Signals | Implemented | `src/apagado.ts`: memoized close, second signal logged and ignored, exit code 0 or 1, logs only the error class name |
| Console | Implemented | two `MENSAJES_CORRIDA` entries, `ETIQUETAS_ESTADO`, `etiquetaEstado()` used for the Estado cell |
| No migration | Confirmed | `prisma/` untouched; `estado` and `error` are free text |
| DEC-95 comment fixes | Confirmed | `planificador.ts` (header and line 166), `automatizaciones.ts` `estaVencida` doc, `contexto-tenant.ts`, `planificador.test.ts` line 314 no longer attribute catch-up to CH-17; `grep` finds no remaining attribution in `src/` |
| AGENTS.md rules | Respected | rule 2: tenant ids come from own `Tenant` rows, writes only inside a tenant context, fail-closed outside one; rules 3-4: no raw SQL, no new query surface, Prisma API only; rule 5: logs carry closed fields only; rule 6: no new engine capability; rule 7: no secrets or env changes |
| Scope creep | None found | no X5 retry (`planificador.ts` mentions retry only in a comment saying CH-17b), no parallelism or per-tenant failure isolation (CH-18), no per-tick reaper |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| DEC-95 no catch-up as artifact limit | Yes | comments corrected, limit in the bitacora |
| DEC-96 overlap via DB query, `omitida` one row per tick | Yes | |
| DEC-99 boot sweep over all tenants, fail-open, no re-execution | Yes | |
| DEC-100 SIGTERM/SIGINT close the app | Yes | |
| DEC-102 `arrancar()`, tolerant per-tenant sweep, `omitida` shape, exit after shutdown | Yes | |
| Deviation 2 (also nulls `corte`/`codigoError`) | Accepted | disclosed in apply-progress; an `en-curso` row never has those set; harmless |
| Deviation 5 (overlap check also runs for a `previo` failure) | Accepted | follows "first in correr()" literally; a stuck automation with a corrupt cron is `omitida` rather than `error-interno` |

### Issues Found
**CRITICAL**: None

**WARNING**:
1. The scenario "New values appear in the runs listing" (execution-log) has no route-level test: nothing calls `GET /automatizaciones/:id/ejecuciones` with an `omitida`/`solapamiento` and a `fallo`/`interrumpida` row. The route is a pass-through `select` with no value filtering, and both halves are covered separately (planner persistence, console rendering from a mocked response), so the risk is low. Marked PARTIAL.
2. The console rows (`Omitida`, the two messages, placeholders) are verified only on the project fake DOM, not in a real browser. The manual browser pass is still pending (also listed in the bitacora "Pendientes"). Real-browser rendering, layout and text wrapping are unverified.

**SUGGESTION**:
1. No test builds a planner across a due fire time to prove "Downtime leaves no catch-up" (only the 4.1 window test covers it); consider one. Likewise there is no single sweep-then-tick test for a deactivated tenant (composed from 4.2 and 1.1).
2. The `server.ts` signal wiring is verified statically only; `server.test.ts` boots the child process but sends no signal. The unit tests exercise `registrarApagado` with an EventEmitter.
3. `openspec/config.yaml` still says `strict_tdd: false` with an empty `testing` section; align it with the real strict-TDD workflow before the next change.
4. `tasks.md` 2.6 cites `docs/bitacora/_plantilla.md`, which does not exist; fix the reference when archiving. The bitacora time-spent line needs the real perceived time before it is cited in the thesis.

### Verdict
PASS WITH WARNINGS
All 648 tests pass, `tsc` is clean, there is no migration, no X5/CH-18 scope creep, and the DEC-95 comments are fixed; 0 CRITICAL, 2 WARNING (listing route scenario untested at route level; console rows not checked in a real browser), 4 SUGGESTION.
