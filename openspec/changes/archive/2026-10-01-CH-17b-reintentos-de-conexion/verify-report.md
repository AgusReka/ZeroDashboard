```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:7a39599b1f8c81cb201c2404ffec912129e205dc7e6cfe725e3a09ee77d1ed1b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 27/27
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:98291e725fb60b9d3de0b82d7d034a482a12c686f1b4b9546b1c96a3fe387025
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: CH-17b-reintentos-de-conexion
**Version**: N/A (4 delta specs: automation-scheduling, execution-log, project-environment, query-console)
**Mode**: Strict TDD (injected by the orchestrator; `openspec/config.yaml` still says `strict_tdd: false`)
**Branch / HEAD**: `ch17b/5-listado-consola-bitacora` at `5bab131745921a4448029502a2a7cdb886716918` (working tree clean except the user's untracked `docs/verificacion-tesis-2026-10-01.md`, which was not touched)
**evidence_revision**: sha256 of the HEAD commit id string above.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 21 (1.1-1.7, 2.1-2.7, 3.1-3.7) |
| Tasks complete | 20 |
| Tasks incomplete | 1: 3.7 "Run sdd-verify, then sdd-archive", which is this phase; not a core task |

### Build & Tests Execution
**Build / type-check**: passed (`npx tsc --noEmit` -> exit 0, empty output)

**Tests**: 671 passed / 0 failed / 0 skipped / 0 cancelled
```text
TEST_DB_PORT=5434 npm test -> exit 0; tests 671, suites 96, pass 671, fail 0, cancelled 0, skipped 0, todo 0, duration ~14.9 s
```
Live PostgreSQL on port 5434 was used. Coverage tool and linter: not configured.

**Prisma**: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` with `DATABASE_URL` pointed at the test DB (port 5434) returned "No difference detected." (the bare command fails with P1001 because the config default host `db` is unreachable from the host; not a defect). Migration `20261001000000_ejecucion_intentos` is one `ALTER TABLE "Ejecucion" ADD COLUMN "intentos" INTEGER;`: additive, nullable, no default, no backfill, rollback documented in its header.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | "TDD Cycle Evidence" table in apply-progress.md |
| All tasks have tests | Yes | every behavior task has a test; 1.5 (env/compose), 2.6 (server wiring), 3.5 (bitacora) are N/A by nature and disclosed |
| RED confirmed (tests exist) | Yes | `src/automatizaciones.test.ts`, `src/config.test.ts`, `src/planificador.test.ts` (7 `CH-17b` tests), `src/automatizaciones-rutas.test.ts`, `src/consola.test.ts` (1 `CH-17b 3.3` test) exist with the cited failures recorded |
| GREEN confirmed (tests pass) | Yes | 671/671 on execution |
| Triangulation adequate | Yes | retry off vs cap 3; refused-then-ok vs last-category-wins; four non-retryable outcomes; overlap mid-pause; stop mid-pause; sweep sentinel; listing 2/null/1; console 3/1/null/absent |
| Safety Net for modified files | Yes | baselines recorded (71/71, 26/26, 36/36); two existing assertions touched with justification (column allowlist, console full-row trailing placeholder) |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Tools |
|-------|-------|-------|
| Unit (pure rule, config, fake DOM) | about 16 | node:test |
| Integration (live PG, fake Reloj, real sockets, Fastify inject) | 8 (7 planner, 1 route) | node:test, PostgreSQL |
| E2E (real browser) | 0 | not installed |

### Assertion Quality
No tautologies, no ghost loops, no smoke-only tests. Planner tests assert full row shapes with deepEqual (estado, fase, error, intentos, notificacion), the exact pause list (`[5000, 5000]`), the exact retry log lines, and use a control (the no-policy clock throws on any timer, so a stray pause would fail the run). Mocks are Proxy wrappers over the real Prisma client; real sockets are used for the dial. **Assertion quality**: 0 CRITICAL, 0 WARNING.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Retry Only Transient Connection Failures (DEC-97) | Transient failure is retried | `planificador > CH-17b 2.1/2.2` (`host-inalcanzable`, `tiempo-agotado` retried live); `automatizaciones > esFalloReintentable` truth table covers `dns-no-resuelve` (live DNS case relaxed per DEC-106) | COMPLIANT (composed for DNS) |
| Same | Non-retryable failures make exactly one attempt | `> CH-17b 2.3` (`credenciales-invalidas`, `intentos=1`, no pause) end to end; remaining categories by the exhaustive truth table | COMPLIANT (composed) |
| Same | Query-phase timeout is not retried | `> CH-17b 2.3` (`pg_sleep` with `QUERY_TIMEOUT_MS=100`, `fallo`/`ejecucion`/`tiempo-agotado`, `intentos=1`) | COMPLIANT |
| Same | Notification failure is not retried | `> CH-17b 2.3` (failed send, one notifier call, `intentos=1`) | COMPLIANT |
| Bounded In-Run Loop (DEC-98) | Transient failure then success | `> CH-17b 2.2` (refused, then forwarder started in the pause: `ok`, `intentos=2`, one row) | COMPLIANT |
| Same | Cap exhausted | `> CH-17b 2.1` (closed port, cap 3, one row, `intentos=3`, two pauses, no fourth dial) and `2.2` (refused, refused, stall: `tiempo-agotado`/3) | COMPLIANT |
| Same | Pause is fixed and clock-driven | `> CH-17b 2.1` (`pausas` deepEqual `[5000, 5000]` via the fake Reloj) and `2.4` (no second attempt before the pause fires) | COMPLIANT |
| Same | Default policy performs no retry | `> CH-17b 2.1` (no policy, throwing clock, `intentos=1` for ok and for closed port) | COMPLIANT |
| Overlap Guard Covers a Mid-Retry Run | Tick during a pause is skipped | `> CH-17b 2.4` (held pause keeps `en-curso`; second planner writes `omitida`/`solapamiento`/null) | COMPLIANT |
| Stop Cancels a Pending Pause (DEC-104) | Stop during a pause | `> CH-17b 2.4 detener during a pause` (timer cancelled, resolves, `fallo`/`tiempo-agotado`/`intentos=2`) | COMPLIANT |
| Same | Stop with no run in a pause | existing CH-17a `apagado.test.ts` and planner detener tests, unchanged and green | COMPLIANT |
| Ejecucion Records Attempts (DEC-103) | First-try success and failure with retry off | `> CH-17b 2.1` (both rows `intentos=1` under the default policy) | COMPLIANT |
| Same | Retried run counts attempts | `> CH-17b 2.2` (`intentos=2`) and `2.1` (`intentos=3` at the cap); the third-attempt connect is the same loop | COMPLIANT (composed) |
| Same | Runs that never dialled have null intentos | `> CH-17b 2.3` (gate refusal null), `2.4` (omitida null), `2.4 boot sweep` (interrumpida null, overriding a held 2) | COMPLIANT |
| Same | Legacy rows read as null | `automatizaciones-rutas > 5.1` (legacy row listed with `intentos: null`, full-row deepEqual) | COMPLIANT |
| Same | Non-retryable failure after connecting | `> CH-17b 2.3` (query-phase failure, `intentos=1`) | COMPLIANT |
| Runs Listing Exposes intentos | Listing shows intentos | `automatizaciones-rutas > 5.1` (live PG, Fastify inject: 2, null, 1 newest first, tenant-scoped route) | COMPLIANT |
| Exhausted Cap Closes With Last Category | Last category wins | `> CH-17b 2.2 at the cap` (refused, refused, timed out: `tiempo-agotado`/3; relaxed from the DNS example per DEC-106) | COMPLIANT |
| Retry Configuration From Env (DEC-105) | Defaults apply when unset | `config.test` defaults 3 and 5000 | COMPLIANT |
| Same | Valid values override the defaults | `config.test` 5 and 1000 | COMPLIANT |
| Same | Attempts of 1 disables retry | `config.test` accepts `1`; the loop is exercised with `SIN_REINTENTOS` (attempts 1), the identical value, in 2.1; no test builds a planner with 1 attempt, a 5000 ms pause and a transient failure | COMPLIANT (composed) |
| Same | Out-of-range or malformed value fails startup | `config.test` `6`, `0`, `abc`, `12.5`; pause `0`, `abc`; each error names the variable and never quotes the value | COMPLIANT |
| Placeholders Only | Inspecting example and Compose files | read: `.env.example` lines 72-81 carry empty values, `docker-compose.yml` forwards both variables with an empty default; `docker compose config --quiet` recorded green in apply-progress | COMPLIANT (documentation scenario, verified by reading) |
| Console Displays Runs (DEC-80) | Viewing runs of an automation | `consola.test` runs-view test (full-row deepEqual with trailing placeholder) and `CH-17b 3.3` | COMPLIANT |
| Same | Notification outcomes are legible | existing CH-14 console tests, unchanged and green | COMPLIANT |
| Same | Send failure visible as failure | existing CH-14 console tests, unchanged and green | COMPLIANT |
| Same | Attempts are shown, null is a placeholder | `consola.test > CH-17b 3.3` (Intentos header last; `3`, `1`; null and absent render the dash; no `null`/`undefined` text) | COMPLIANT |

**Compliance summary**: 27/27 scenarios carry passing runtime or reading evidence; 4 are COMPLIANT by composition (named in the matrix) rather than by one dedicated end-to-end test, reported as WARNING 1. 0 UNTESTED, 0 FAILING. Requirements: 10/10 covered. The first-try `intentos=1` with retry off IS covered (`CH-17b 2.1`, success and failure rows).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Retry loop | Implemented | `conectarConReintentos` wraps only `ejecutarConsulta` (the dial); gate, preparation and checks run once; ends at the cap, on a non-retryable result, or when `detenido`; count raised before each dial |
| Pause | Implemented | `pausar` uses only `reloj.programar`; `detener()` calls `cancelarPausa` |
| Count | Implemented | `ConteoIntentos` null until first dial; both sentinels carry `intentos: null` |
| Notification | No retry | the loop never touches the notifier; send failure stays `intentos=1`, one call |
| Config | Implemented | validated at `loadConfig()`; `server.ts` passes the policy; planner default is `SIN_REINTENTOS` |
| Migration | Additive, nullable | matches the Prisma schema (no difference detected) |
| Listing / console | Implemented | `intentos` in `EjecucionListada` (still tenant-scoped); `Intentos` appended last via `textoOpcional` |
| AGENTS.md | Respected | rule 2: no new query surface, tenant resolved as before; rules 3-4: no raw SQL; rule 5: logs carry `automatizacionId`, `intentos` and category only; rule 6: no engine change (dial retry lives in the scheduler); rule 7: `.env.example` and Compose hold empty placeholders only |
| Scope creep | None | no X6/X8/CH-19 behavior, no notification retry, no retry on console paths, no new engine capability |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| DEC-97 retry only transient connection categories | Yes | closed set in `esFalloReintentable` |
| DEC-98 in-run loop, fixed pause, injected clock, default off | Yes | |
| DEC-103 `intentos` nullable, null means not dialled or legacy | Yes | |
| DEC-104 stop cancels the pause | Yes | |
| DEC-105 env vars, ranges, fail at boot | Yes | |
| DEC-106 injected policy, relaxed DNS examples, stop scope | Yes | rest of the in-flight tick finishes with one attempt per remaining automation |
| Deviations disclosed in apply-progress | Accepted | column allowlist and console full-row assertion updated; slice 2 (488 lines) split into 2a/2b |

### Known Limits
- The tick is serial: a run in a retry pause blocks the tick (up to about 25 s at the maximum 5 attempts and 5 s pause), so other automations wait; documented in the bitacora, parallelism belongs to CH-18.
- Four planner tests use real sockets with `CONNECTION_TEST_TIMEOUT_MS=200`; timing under heavy load could flake (not seen: the file passed in repeated runs).
- The console column is verified only on the project fake DOM, not in a real browser.
- The `server.ts` wiring of the policy has no runtime test (no test observes the planner dependencies from the spawned server); it is one line and the values are validated by the config tests.
- A live `dns-no-resuelve` retry cannot be exercised with a fixed target and real sockets (DEC-106); it is covered by the pure rule only.

### Issues Found
**CRITICAL**: None

**WARNING**:
1. Four scenarios are covered by composition, not by one dedicated end-to-end test: `dns-no-resuelve` retry (rule truth table only, per DEC-106), the full list of non-retryable categories (one end-to-end case plus the truth table), "connects on the third attempt" (2-attempt and cap-3 paths are tested separately), and "Attempts of 1 disables retry" (config accepts 1; loop tested with the identical `SIN_REINTENTOS`).
2. The console `Intentos` column is verified only on a fake DOM; the manual browser pass is still pending.
3. The `server.ts` retry wiring has no runtime test.

**SUGGESTION**:
1. Add one planner test with a policy of 1 attempt, a 5000 ms pause and a transient failure to cover "Attempts of 1" directly.
2. Align `openspec/config.yaml` (`strict_tdd: false`) with the real strict-TDD workflow.
3. Complete the bitacora time-spent section (marked "to be completed") with real perceived time before citing it in the thesis.
4. If the 200 ms real-socket tests ever flake, widen the timeout or inject it per test.

### Verdict
PASS WITH WARNINGS
All 671 tests pass, `tsc` is clean, the migration is additive, nullable and in sync with the schema, there is no notification retry and no X6/X8/CH-19 scope creep; 0 CRITICAL, 3 WARNING, 4 SUGGESTION.
