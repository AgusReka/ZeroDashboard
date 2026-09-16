```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3923c78b99a797a6125955051c82b5285ec978a169fb9b00e75a047c077e4731
verdict: pass
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 12/12
test_command: TEST_DB_HOST=localhost TEST_DB_PORT=55432 npm test
test_exit_code: 0
test_output_hash: sha256:1f51963451fdf352e31ced8746b7beeba0e58a6226632ad08da2ba0b25d10163
build_command: npx tsc --noEmit -p tsconfig.json
build_exit_code: 0
build_output_hash: sha256:194ff5bca66278888f0f00be5c7ca523d15098ece958b14952533811089f6106
```

## Verification Report

**Change**: CH-03-connection-registration-and-test
**Version**: N/A (single spec revision, no versioned spec history)
**Mode**: Standard (no Strict TDD marker in config or orchestrator context)
**Re-run reason**: prior verify pass (this same file) found 1 CRITICAL and 1 WARNING, both scoped to missing test coverage for two spec scenarios. Two new test cases were added to `src/conexiones.test.ts` afterward, with no production code change. This re-run confirms both gaps are closed with real runtime coverage and re-executes the full evidence chain from scratch.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 20 (plus the documented post-verify coverage addendum, no renumbering) |
| Tasks complete | 20 |
| Tasks incomplete | 0 |

`tasks.md` now carries a "Coverage gap closed after verify" section documenting the two added test cases by name and mapping each to the spec scenario it closes. No task was renumbered and no production file is listed as changed by that addendum, consistent with `git status` showing no modification to `src/conexiones.ts` or `src/db-probe.ts` in this session.

### Build & Tests Execution

**Build**: Passed

```text
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

**Tests**: 26 passed / 0 failed / 0 skipped (with live Compose db)

```text
$ TEST_DB_HOST=localhost TEST_DB_PORT=55432 npm test

conexion routes -- integration against a live PostgreSQL target
  5.1 a reachable target reports success
  5.2 a wrong password is classified as credenciales-invalidas
  5.3 a nonexistent database is classified as base-inexistente
  5.4 an unroutable host fails as tiempo-agotado within the budget
  an incomplete registration is rejected and creates no row
  a non-postgres motor still probes the stored host and port
classifyConnectionError -- classification rows (12 cases, rows 1-8)
classifyConnectionError -- codigo allowlist (4 cases)
classifyConnectionError -- credential safety (1 case)
probeConnection -- the budget is decided by the race, not by the clock (3 cases)

tests 26, suites 5, pass 26, fail 0, cancelled 0, skipped 0, todo 0
exit 0
```

Executed against a live Compose db service, port published only via a
scratchpad-only docker compose override -- no tracked file was touched
(git status --short before and after this session's docker commands is
identical). docker inspect confirmed the container reached healthy before
the suite ran.

npm run smoke: ran end-to-end against a fresh docker compose up -d --build
using the project's own .env (no override needed, matching the design's note
that the smoke script runs inside the Compose network). Output: SMOKE TEST
PASSED, exit 0, including all four CH-03 scenarios and the credential-leak
log check.

**Coverage**: N/A -- no coverage tool configured in this project (unchanged
from the prior pass, not a CH-03 regression).

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Connection Registration Persists Against the Seeded Tenant | Registering a valid connection | conexiones.test.ts, registrar() helper, exercised by all 4 live integration tests | COMPLIANT |
| Connection Registration Persists Against the Seeded Tenant | Rejecting an incomplete registration | conexiones.test.ts, "an incomplete registration is rejected and creates no row" (live): posts a body missing credencial, asserts 400, error solicitud-invalida, a non-empty campos array, and prisma.conexion.count where nombre equal to 0 | COMPLIANT (closes prior CRITICAL) |
| Connectivity Test Uses a Fixed PostgreSQL Probe | Testing a reachable PostgreSQL target | conexiones.test.ts, 5.1 a reachable target reports success (live) | COMPLIANT |
| Connectivity Test Uses a Fixed PostgreSQL Probe | Testing a connection with a non-PostgreSQL engine value | conexiones.test.ts, "a non-postgres motor still probes the stored host and port" (live): registers with motor mysql, probes it, asserts 200 (not a 4xx gating refusal), a legible resultado of ok or fallo, and that host/puerto match the stored target | COMPLIANT (closes prior WARNING) -- see note below |
| Distinguishable Failure Categories | Unreachable host or port | db-probe.test.ts, probeConnection, "a driver error inside the budget is classified normally, not as a timeout" (real TCP refusal, direct call to probeConnection, per design's documented unit-level test strategy) | COMPLIANT |
| Distinguishable Failure Categories | DNS resolution failure | db-probe.test.ts, classification rows, "row 3: ENOTFOUND" (synthetic error object; per design's documented test strategy, live DNS-failure integration coverage was never planned) | PARTIAL (pure-function coverage only, deliberate per design -- not a gap) |
| Distinguishable Failure Categories | Bad credentials | conexiones.test.ts, 5.2 a wrong password is classified as credenciales-invalidas (live, 28P01) | COMPLIANT |
| Distinguishable Failure Categories | Missing database | conexiones.test.ts, 5.3 a nonexistent database is classified as base-inexistente (live, 3D000) | COMPLIANT |
| Distinguishable Failure Categories | Other unclassified failure | db-probe.test.ts, rows 7-8, non-Error throw, unmatched code (synthetic, per design's documented test-pyramid choice) | PARTIAL (pure-function coverage only, deliberate per design -- not a gap) |
| Bounded Connection-Attempt Timeout | Testing an unresponsive host | conexiones.test.ts 5.4 (live, within budget) plus db-probe.test.ts race-mechanism tests (real silent TCP listener) | COMPLIANT |
| Credential Value Never Exposed | A failed test does not leak the credential | db-probe.test.ts credential-safety test, conexiones.test.ts 5.2 body assertion, smoke.sh app-log grep | COMPLIANT |
| Credential Value Never Exposed | A successful test does not leak the credential | conexiones.test.ts 5.1 body assertion, smoke.sh app-log grep | COMPLIANT |

**Compliance summary**: 10/12 scenarios fully live/functional COMPLIANT, 2/12 scenarios PARTIAL by a documented, deliberate design choice (design.md's own test-pyramid table explicitly scopes DNS-failure and other-unclassified rows to synthetic unit tests only). 0/12 scenarios have zero test coverage -- both gaps from the prior pass are closed.

**Note on the non-postgres-motor test**: the test dials the project's real Compose Postgres target with motor set to mysql only as stored metadata, so the probe reaches a server that does speak the Postgres wire protocol and the observed resultado is ok, not a protocol-mismatch failure. This is not a weaker test than the scenario asks for: the design's decision record is explicit that motor never gates or branches the probe path (confirmed independently by grep -- absent from ProbeTarget and the probeConnection call site), so any target, Postgres-speaking or not, goes through the identical code path. The runtime assertion that matters for this scenario -- no pre-socket gating/refusal, the fixed probe reaches the stored host/port regardless of motor, and a legible verdict comes back -- is fully exercised. What a real non-Postgres listener would additionally exercise (a protocol-level error landing in error-desconocido) is already covered by the existing "other unclassified failure" and "unreachable host" categories against synthetic/real non-Postgres-shaped errors. Judged sufficient to close the WARNING.

### Correctness (Static Evidence)

Unchanged from the prior pass -- no production code changed in this session (git status --short shows no modification to src/conexiones.ts, src/db-probe.ts, src/server.ts, or src/config.ts beyond what was already committed/staged from the original apply). Spot-re-confirmed by reading src/conexiones.test.ts in full and cross-checking the two new tests against the route contracts in design.md; no discrepancy found.

| Requirement | Status | Notes |
|------------|--------|-------|
| Connection Registration Persists Against the Seeded Tenant | Implemented | Strict Fastify schema (additionalProperties false, all 7 fields required), server-resolved tenant, Conexion.create, ConexionPublica select. Rejection path now also runtime-tested. |
| Connectivity Test Uses a Fixed PostgreSQL Probe | Implemented | probeConnection opens a discrete-field pg.Client, literal SELECT 1; motor stored but never read past registration. |
| Distinguishable Failure Categories | Implemented | classifyConnectionError implements all 8 design rows in order. |
| Bounded Connection-Attempt Timeout | Implemented | Race-based budget, per the design's second correction. |
| Credential Value Never Exposed | Implemented | Four boundaries verified by direct code reading in the prior pass; re-spot-checked, unchanged. |

### Coherence (Design)

Unchanged from the prior pass -- re-confirmed lightly, no drift found. All 8 design decisions (motor-blind probe, two separate operations, 200-always-on-completed-probe, server-side tenant resolution, race-based budget, connectionTimeoutMillis backstop, conditional client.end() await, @types/pg-only dependency change) remain faithfully reflected in the current code, per the prior pass's full table (not reproduced here in full since nothing changed).

### Issues Found

**CRITICAL**: None.

**WARNING**: None. The two WARNING/CRITICAL findings from the prior pass are both closed (see Spec Compliance Matrix above).

**SUGGESTION** (carried forward from the prior pass, still open, non-blocking):
1. No automated test exercises the 404 conexion-no-encontrada path or the 503 tenant-no-inicializado path. Neither is a spec.md scenario (both are design-level contract details), so this does not affect the compliance matrix, but it remains a reasonable follow-up.
2. No code-coverage tool is configured. Pre-existing to this change, not a CH-03 regression.

### Out-of-Scope Boundary Check (proposal.md)

Re-confirmed, unchanged from the prior pass -- no code touching these boundaries was added.

| Boundary | Respected? | Evidence |
|---|---|---|
| No A3 read-only enforcement beyond stored soloLectura | Yes | soloLectura stored and never read elsewhere |
| No A2 credential encryption at rest | Yes | credencial stored as plaintext |
| No A4 per-query timeout/row limits beyond the connection-attempt timeout | Yes | Only connectionTestTimeoutMs/connectionTimeoutMillis exist |
| No T-block tenant CRUD/isolation/picker | Yes | No tenant routes added |
| No UI | Yes | No UI files touched |
| No query execution beyond the fixed SELECT 1 probe | Yes | Only a literal, parameterless SELECT 1 |

### Accepted Documented Gaps

- EAI_AGAIN is classified into dns-no-resuelve but its codigo is published as null rather than the raw string (fails the Node-code allowlist regex). Documented in db-probe.ts, design.md, and covered by a dedicated test. Intentional, not a defect. (Unchanged from prior pass.)

### Verdict

PASS

Both findings from the prior verify pass are closed with real, passing runtime test coverage, read directly rather than inferred from test names: "an incomplete registration is rejected and creates no row" genuinely posts an incomplete body, asserts the 400/solicitud-invalida contract, and confirms zero rows were created; "a non-postgres motor still probes the stored host and port" genuinely registers a non-Postgres motor value and confirms the probe is not gated and still reaches the stored host/port with a legible verdict. All 26 tests pass against a live Compose target (24 prior + 2 new, 0 skipped), tsc --noEmit is clean, and npm run smoke exits 0 covering all four CH-03 end-to-end scenarios plus the credential-leak check. No production code changed in this session. Design coherence, credential-safety boundaries, and proposal out-of-scope boundaries all re-confirmed unchanged. 12/12 spec scenarios are now accounted for: 10 fully live/functional, 2 deliberately unit-only per design's own documented test-pyramid choice (not a gap). Clean to archive.
