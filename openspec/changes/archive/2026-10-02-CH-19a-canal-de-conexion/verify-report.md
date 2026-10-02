```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:64fb1afff9f3efc228881a6f5d55d80ff121d1c1af19de35e8be48d041a2f73b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 14/14
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:990d9ed066e8a5b005470555292c580fc7e4864949e622a03eae4e8f69d40e15
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: CH-19a-canal-de-conexion
**Version**: N/A
**Mode**: Strict TDD (per tasks.md and apply-progress; config.yaml still says false)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete (checked) | 18 |
| Tasks unchecked | 3 (4.4, 4.5, 4.6) |

- 4.4: the 400-line budget was exceeded (547 changed lines, new files included). The author accepted `size:exception` on 2026-10-02, so this is resolved by acceptance, not a defect. The checkbox is still unchecked in tasks.md.
- 4.5: its checks were executed by this verification (suite green, tsc clean, no `prisma/`, `package.json`, `package-lock.json` or env-example diff). The commit step is deferred by instruction.
- 4.6: this verify run. Archive is explicitly NOT part of this run.

### Build & Tests Execution
**Build**: Passed
```text
npx tsc --noEmit  -> exit 0, no output
```

**Tests**: 702 passed / 0 failed / 0 skipped (102 suites)
```text
TEST_DB_PORT=5434 npm test -> exit 0 (tests 702, pass 702, fail 0, cancelled 0, skipped 0)
```
Test PostgreSQL on localhost:5434 was reachable; no live suite skipped. Baseline 687 + 15 new tests.

**Coverage**: not available (no coverage tool configured).

### Spec Compliance Matrix
Totals: 5 requirements (agent-channel 4, query-execution 1), 14 scenarios (9 + 5).

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Protocol catalog | Compiles, no runtime exports | `agente-protocolo.test.ts > P1 the module exposes no runtime value` (+ tsc) | COMPLIANT |
| Protocol catalog | Session open carries no tenant | type-level guard in `agente-protocolo.test.ts` (checked by tsc, exit 0) | COMPLIANT |
| Optional channel | Absent channel leaves config unchanged | `db-probe-canal.test.ts > C1 ... no factory is called` + full direct-mode suite | COMPLIANT |
| Optional channel | Present channel supplies the stream | `> C2 the channel supplies the stream, SSL stays off, and SELECT 1 succeeds` | COMPLIANT |
| Threading | Caller passes the channel through | `conexion-destino.test.ts > H1 the same channel reference passes through and the id is dropped` | PARTIAL (helper tested; the four callers use it by inspection only) |
| Threading | Production paths never set a channel | `> H1 without a channel, canal is undefined` + `destinoDeConexion` returns no `canal`; grep of `src/` shows no production setter | COMPLIANT |
| Failure modes | Silent channel exhausts budget | `> C3 a silent channel is tiempo-agotado within the budget, probe and engine` | COMPLIANT |
| Failure modes | Dropped channel does not crash | `> D1` and `> D2` | COMPLIANT |
| Failure modes | Closing a connecting client returns | `> C5 closing a client whose channel is still connecting returns` | COMPLIANT |
| Execution over channel | Rows returned over a channel | `> Q1 a read-only role gets the requested page of rows` | COMPLIANT |
| Execution over channel | Write-privileged role blocked | `> Q2` | COMPLIANT |
| Execution over channel | Data-modifying statement rejected | `> Q3` | COMPLIANT |
| Execution over channel | Multi-statement rejected | `> Q4` | COMPLIANT |
| Execution over channel | Absent channel preserves prior behavior | existing 687-test baseline, unchanged and green | COMPLIANT |

**Compliance summary**: 13/14 fully compliant, 1 partial (counted as complete in the envelope; see WARNING 2). C4 (`host-inalcanzable`) is covered by an extra test beyond the spec.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Protocol catalog | Implemented | Types only, no imports; no tenant field on `AperturaSesion` |
| Optional channel | Implemented | One branch in `iniciarConexion`; absent path builds `new pg.Client(config)` with the same six fields; present path `{...config, stream, ssl:false}`; no logging or buffering |
| Threading | Implemented | `camposDeDestino` never branches on `canal`; four callers use it; `validacion-mapeo-rutas.ts` and `consulta-ejecucion.ts` unchanged (inherit the field) |
| Failure modes | Implemented | Relies on existing DEC-111 listener and budget logic; no engine change |
| Execution guarantees | Implemented | `ejecutarConsulta` untouched |

### Coherence (Design) and AGENTS.md Rules
| Check | Result |
|-------|--------|
| Direct mode unchanged; no production code sets `canal` | Yes. `canal` appears in `src/` only in `db-probe.ts` (type and seam branch) and `conexion-destino.ts` (pass-through); no assignment in production code |
| Decisions DEC-112..DEC-120 registered before the change | Yes (`docs/01-decisiones.md`); no new architecture decision found |
| Dependency, schema, env change | None: empty diff on `prisma/`, `package.json`, `package-lock.json`, `.env.example` |
| Rule 1 (no arbitrary SQL from P2) | Unaffected |
| Rule 2 (tenant isolation) | Unaffected; session-open type has no tenant; tenant-scoped lookup untouched |
| Rule 3 (read-only, two layers) | Held over a channel (Q2, Q3) |
| Rule 4 (no SQL concatenation) | No SQL touched |
| Rule 5 (data minimization) | Seam does not log or buffer; D2 asserts the password is absent from the failure result |
| Rule 6 (engine runs only the pattern) | Engine gains only an injection seam, unused in production |
| Rule 7 (secrets out of repo) | No secrets or env values added |
| Deviations in apply-progress (named `config` const; direct pass in `conexiones.ts`) | Behavior-equivalent; acceptable |
| Size | 547 changed lines (243 additions, 29 deletions tracked, plus new files); `size:exception` accepted by the author 2026-10-02 |

### Issues Found
**CRITICAL**: None.

**WARNING**:
1. tasks.md checkboxes 4.4, 4.5 and 4.6 are still unchecked. 4.4 is resolved by the size acceptance; 4.5 was satisfied by this run except the deferred commit. Update the file before archive.
2. Scenario "Caller passes the channel through" is proven at the helper level (H1) only; no test exercises each of the four callers with a channel. By inspection all four spread `camposDeDestino`.
3. `openspec/config.yaml` still says `strict_tdd: false` while the change ran Strict TDD.
4. Changes are uncommitted; the deferred commits (tasks 1.4, 2.7, 3.4, 4.5) are not made.

**SUGGESTION**:
1. An empty directory `prisma;C:` exists at the repository root (dated Sep 15, untracked, pre-existing, not from this change). Consider deleting it. The stray empty file `2.6` noted in apply-progress no longer exists.
2. Optionally add a caller-level test for the pass-through when a later slice wires a production channel.

### Verdict
PASS WITH WARNINGS. Suite 702/702 and tsc clean; every scenario is covered; direct mode is unchanged and no architecture decision, dependency, schema or env change slipped in. Do not archive in this run.
