```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:472afd496568923d6b3c28f61ae9d0a6bc55d60876f157d7ffe57d9e9d9bd37c
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 29/29
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:9c270154bd673a536871a15722f16d7b6db5578f8b9d5901b0bbd9f7df6f81bd
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: CH-18-notificaciones-duplicadas-y-aislamiento
**Version**: N/A (4 delta specs: automation-scheduling, email-notification, execution-log, query-console)
**Mode**: Strict TDD (per the orchestrator; evidence in apply-progress.md)
**Branch / HEAD**: `ch18/motor-duplicados-y-aislamiento` at `04c3b12ce73a39a28d45311572dd108b3ec96dae` (implementation commits f1aa357, 0067077, 04c3b12; the working tree has only the untracked `docs/verificacion-tesis-2026-10-01.md` and `f.estado` of the user, not touched)
**evidence_revision**: sha256 of the HEAD commit id string above.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 30 (1.1-1.8, 2.1-2.14, 3.1-3.5) |
| Tasks complete | 29 |
| Tasks incomplete | 1: 3.5 "Run sdd-verify, then sdd-archive", which is this phase; not a core task |
| Spec counts | 10 requirements (including the RENAMED heading), 29 scenarios |

### Build & Tests Execution
**Build / type-check**: `npx tsc --noEmit` -> exit 0, empty output.

**Tests**: `TEST_DB_PORT=5434 npm test` -> exit 0; tests 687, suites 98, pass 687, fail 0, cancelled 0, skipped 0, todo 0, duration about 22 s (671 baseline plus 16 new, matching apply-progress). Run twice, both green, against the live PostgreSQL on port 5434. `test_output_hash` is the sha256 of the second run full output (durations vary per run, so a rerun hashes differently). Coverage tool and linter: not configured.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Failure does not stop the tick (X8, DEC-109) | One failing run does not block a sibling | existing CH-13/CH-17 per-run tests, unchanged and green | COMPLIANT |
| Same | Tenant-level throw does not stop later tenants | `planificador.test.ts` CH-18 1.1 (A listing throws, B runs to `enviada`; two tenants, not three) | COMPLIANT |
| Same | Tenant failure log carries closed fields only | CH-18 1.1 (exact key set `error,nombreError,tenantId`; secret text and tenant name absent from every line) | COMPLIANT |
| Same | Failed tenant window is not recovered | CH-18 1.2 (A has 0 rows after the healthy tick 2) | COMPLIANT |
| Tick stays serial (DEC-110) | Tenants never run concurrently | CH-18 1.3 (deferred first listing blocks the second tenant; per-tenant context order) | COMPLIANT |
| Dead connection must not end the process (DEC-111, conditional) | Connection dies after login | `db-probe.test.ts` scenarios (a) idle and (b) mid-query; apply-progress records a crash 6/6 per scenario on unchanged code and survival 3/3 with the listener | COMPLIANT |
| Run sends at most one message (X6, DEC-107) | Retried connection sends once | CH-18 2.8 "a retried dial that then connects sends once" | COMPLIANT |
| Same | Overlap skip never sends | CH-18 2.8 "a run stuck in enviando makes the next tick skip as omitida, with no send" | COMPLIANT |
| Same | Sweep never sends | CH-18 2.6 (notifier count stays 1 after the sweep) and 2.7 | COMPLIANT |
| Same | Stopping during a send causes no second send | CH-18 2.8 "detener during a send" (one send, `enviada`, nothing armed) | COMPLIANT |
| Marker written before the send (DEC-108) | Marker visible while send pending | CH-18 2.3 and adjusted CH-14 5.7 (row `en-curso`/`enviando` inside `enviar`) | COMPLIANT |
| Same | No marker when no send happens | CH-18 2.4 (marker list equals exactly the one sending run id across 10 runs; zero rows, no recipient, no notifier, failed query, gate refusal all unmarked) | COMPLIANT |
| Send bounded by timeout (MODIFIED) | Unresponsive SMTP server | existing CH-14 5.9 tests, green | COMPLIANT |
| Same | Timed-out send is not repeated | CH-18 2.8 "a send cut by the outer time limit" (one call) | COMPLIANT |
| Ejecucion records the outcome (DEC-83, DEC-108) | Each outcome recorded; query failure null; legacy null | existing CH-14 tests, green | COMPLIANT |
| Same | A completed run never ends as enviando | `automatizaciones.test.ts` 2.1 (18 outcomes x 2 closes), CH-18 2.3, compile-time `Exclude` in `CierreNotificado` | COMPLIANT |
| Same | Listing shows the new values | No route test lists an `enviando` and an `incierta` row; `automatizaciones-rutas.ts:55` selects `notificacion: true` verbatim and CH-18 2.6 proves the stored values | PARTIAL (composed, see W2) |
| Interrupted runs closed (DEC-99, DEC-108) | Swept row has the interrupted shape | existing CH-17a 1.2 (adjusted to per-call pairs) | COMPLIANT |
| Same | Row interrupted mid-send becomes incierta | CH-18 2.6 (crash simulation; new planner sweeps to `fallo`/`interrumpida`/`incierta`) | COMPLIANT |
| Same | Closed rows untouched | CH-18 2.7 (sweep table; `enviada` untouched; null stays null) | COMPLIANT |
| Runs view labels and copy (DEC-96, DEC-99, DEC-108) | Overlap, interrupted, unknown error legible | existing CH-17a console tests, green | COMPLIANT |
| Same | Interrupted mid-send shows uncertainty | `consola.test.ts` CH-18 2.12 | COMPLIANT |
| Same | Pending send is labelled | CH-18 2.12 (`Envío en curso`) | COMPLIANT |
| Same | Timed-out send does not claim non-delivery | CH-18 2.12 (matches `puede haberse entregado`, no `no se envió`; other four messages unchanged and distinct) | COMPLIANT |
| Same | Console page stays servable | CH-18 2.12 (served document has no backtick) | COMPLIANT |

The remaining scenarios of the 29 restate pre-existing behavior and are covered by passing pre-existing tests. All have code and a passing covering test except the one partial (W2).

### Correctness (source inspection of `git diff master...HEAD`)
| Check | Result |
|-------|--------|
| Per-tenant catch logs closed fields only | `planificador.ts` tick catch logs tenantId, error `error-interno` and nombreError with a constant message; no error text, stack, recipient, or tenant name. `tenantId` comes from the own-database `Tenant` row (rule 2). |
| Marker after compose, before send, never on compose or marker failure | `notificar`: `componerCorreo`, then `prisma.ejecucion.update` with `notificacion` set to `enviando`, then `enviar`, all inside the one `try`; a throw in either becomes `excepcion` with no send (test 2.5). The write goes through the scoped client. |
| At-most-once across retry, overlap, sweep, detener | No loop wraps `notificar`; tests 2.8 (four) plus 2.6. |
| Sweep order | `barrerInterrumpidas`: the `updateMany` for `en-curso` rows marked `enviando` (closing them `incierta`) runs first, then the generic `en-curso` write (null); order asserted by the call-pair list in CH-17a 1.2. Fail-open kept. |
| Closed value set of `notificacion` | `EstadoNotificacion` gains exactly `enviando` and `incierta`; `CierreNotificado` excludes both via `Exclude`. Column stays `String?`. |
| Console labels and copy | `Envío en curso`, `Sin confirmar: puede haberse entregado`, new timeout copy; no backtick in the served page (asserted). |
| No migration, no model change | No `prisma/migrations` file in the diff; `prisma/schema.prisma` diff is 5 added comment lines only (W1). |
| db-probe listener justified | The `error` listener on the client is a no-op that never reads the error (rule 5). The spike test (child process, fixed argv, no shell, credentials via env) crashed 6/6 per scenario on unchanged code per apply-progress and the bitacora. |
| Stale CH-18 pending wording gone from src/ | Grep over `src` finds no pending or todo wording tied to CH-18; the header comment now states the per-tenant catch and serial tick. |
| Adjusted tests legitimate | CH-14 5.7 (`null` becomes `enviando` inside `enviar`) is the intended DEC-108 behavior; CH-17a 1.2 moves to per-call pairs with `incierta` first and still asserts the same closes. Neither weakens an assertion. |
| AGENTS.md rules | 2: tenant ids from `Tenant` rows, marker via the scoped client. 4: no SQL built, only Prisma calls. 5: new log lines carry ids, class name and counts only. 6: no lanes, breaker, concurrency, or new engine surface (DEC-110). 7: no secrets added; the spike test reads credentials from the env defaults the suite already uses. |

### Design Coherence
Matches design.md and DEC-107..DEC-111: serial tick (DEC-110), per-tenant catch modelled on the boot sweep (DEC-102, DEC-109), marker and `incierta` (DEC-108), listener only after proof (DEC-111), same event is one run (DEC-107). No deviation found.

### Issues
**CRITICAL**: none.

**WARNING**
- W1: `prisma/schema.prisma` has a comment-only diff, while tasks 2.14 and 3.4 say no prisma/ diff. No model, column, or migration changed, so the intent holds; mention it in the PR.
- W2: The scenario "Listing shows the new values" has no route-level test listing an `enviando` and an `incierta` row via `GET /automatizaciones/:id/ejecuciones`. The route selects `notificacion` verbatim with no allowlist, so the risk is low, but coverage is by composition only.
- W3: `test_output_hash` comes from one run whose output includes variable durations; a rerun hashes differently by nature.

**SUGGESTION**
- S1: The spec three-tenant scenario (A, B, C with B failing) is tested with two tenants where the first fails; a failing middle tenant is the same code path but is not exercised.
- S2: Add the route test from W2 (one row per new value) when convenient.

### Verdict
**PASS WITH WARNINGS**: 0 CRITICAL, 3 WARNING, 2 SUGGESTION. Ready for `sdd-archive`, which must apply the Purpose wording and the renamed requirement in the four main specs.
