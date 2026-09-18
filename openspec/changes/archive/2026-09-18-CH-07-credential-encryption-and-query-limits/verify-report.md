```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:213a20eab1ced1c8b9d85f0f315ede5c962109325a6544dae312885e329bf3ff
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 20/20
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:75a2d510577abdefc801925c8b6f8711a450d2b261a86bb3eddfd17827515474
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:cdab4d00374babb80b5108285b4b859731dcfcb446f462822a095eba9a576a8e
```

## Verification Report

**Change**: CH-07-credential-encryption-and-query-limits
**Version**: N/A (no spec-version scheme in this project)
**Mode**: Standard (Strict TDD not active)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 27 |
| Tasks complete | 27 |
| Tasks incomplete | 0 |

Every task in `tasks.md` (1.1-1.7, 2.1-2.9, 3.1-3.7, 4.1-4.4) is checked `[x]`. Cross-checked against the actual source tree in this session, task by task, not spot-checked:

- **1.1-1.7**: `src/cripto-credencial.ts` (AES-256-GCM via `node:crypto`, random 12-byte IV, `v1:iv:tag:ciphertext` envelope, `ErrorCredencialIlegible`, module-scoped key cache never exported) and `src/config.ts` (`validarClaveMaestra()` called from `loadConfig()` before `src/server.ts`'s `listen`, generalized `enteroPositivoOpcional` helper) read directly and match the task descriptions. `.env.example` carries a `CREDENTIAL_MASTER_KEY` placeholder that is deliberately the wrong length. No call site references `cripto-credencial.ts` outside `config.ts` at this slice.
- **2.1-2.9**: `src/conexion-destino.ts` exports `destinoDeConexion()` as the sole `credencial: true` read, grep-verified in this session (appears exactly once in production code, at `src/conexion-destino.ts:40`). `src/conexiones.ts` encrypts on create (`cifrarCredencial(body.credencial)`) and routes `prueba` through `destinoDeConexion` with a `409 credencial-ilegible` mapping. `src/consultas.ts` routes `ejecutar` the same way. `src/conexiones.test.ts`, `src/consultas.test.ts` and the new `src/conexion-destino.test.ts` all carry CH-07-labeled cases for envelope storage, distinct IVs, legacy-plaintext 409, and corrupted-envelope 409.
- **3.1-3.7**: `src/config.ts` adds `maxFilasPorConsulta` (default 200, sourced from `MAX_FILAS_CONSULTA`, positive-integer validation reused from Phase 1). `src/consulta-ejecucion.ts` adds `limiteEfectivoDe()`, `corteDeEjecucion()`, `CorteEjecucion`, and a top-level `corte` field outside `Paginacion`; the `LIMIT`/`OFFSET` clause binds `limiteEfectivo + 1` and `desplazamiento` as driver parameters (Rule 4, grep-verified, no string interpolation into the SQL text). `src/consultas.ts` drops `maximum: 200` from `ejecucionSchema` (`minimum: 1`, `default: 50` remain) and passes `config.maxFilasPorConsulta` as `topeFilas`. `src/consulta-ejecucion.test.ts` and `src/consultas.test.ts` cover the clamp, the verdict logic (both conditions required), and that `corte` lives outside `paginacion`.
- **4.1-4.4**: `src/consola.ts` renders the cap verdict as a distinct `<strong class="corte">` node, mutually exclusive with the ordinary pagination sentence, disables the next-page control on a capped response, adds a `credencial-ilegible` entry to the error-message table, and drops the row-limit input's old upper-bound attribute. `src/consola.test.ts` (new, `inject()`-based against the real `/consola` route with its extracted inline script executed over a minimal DOM stub) covers all of the above plus a regression case for ordinary CH-04 pagination. `npm test` (full suite) is green.

No discrepancy found between checked-off tasks and code state.

### Build and Tests Execution

**Build**: PASSED (exit 0)
```text
npm run build
tsc -p tsconfig.json
(no errors, exit 0)
```

**Tests**: 223 passed / 0 failed / 0 skipped (re-executed independently in this verify session, live PostgreSQL 16 via Docker, existing zd-ch07-testdb container on localhost:5432, TEST_DB_HOST/TEST_DB_PORT defaults matched the container's actual POSTGRES_USER/POSTGRES_DB)
```text
npm test
tests 223
suites 27
pass 223
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5386.6455
```
This matches the 223/223 figure the apply-progress record reported at the close of slice 4. `npx tsc --noEmit` was also run standalone and produced zero errors.

**Smoke**: PASSED. This closes a gap the apply session explicitly left open: its bitacora states `npm run smoke` was not run because Docker was unavailable in that session, and apply-progress records the same gap and names sdd-verify as the phase to close it. Docker was available in this session; an unrelated container was already running on port 5432 and did not conflict, since `docker-compose.yml`'s `db` service publishes no host port. `npm run smoke` brought up the real Compose stack (fresh app build, fresh db container), waited for /health, and ran the full CH-01/03/04/05/06 regression script end to end, printing SMOKE TEST PASSED with exit 0. Because `docker-compose.yml` now forwards `CREDENTIAL_MASTER_KEY` into the app container and the app booted and served requests successfully, this is live proof the fail-closed boot check (DEC-17) accepts a valid key end to end, not just in the unit suite. The CH-03 reachable-target section of the script registers a connection (going through `cifrarCredencial`), stores it, and dials it via the probe route (going through `destinoDeConexion`/`descifrarCredencial`), getting `resultado: ok` -- a genuine encipher-then-decipher-then-dial round trip against a live target over HTTP, not a unit-level round trip. The two credential-never-logged checks (grepping the app container logs for the submitted plaintext) also passed.

`scripts/smoke.sh` was not extended with CH-07-specific assertions (no corte, tope-de-filas, or credencial-ilegible string appears in it, confirmed by grep). Task 4.3 explicitly named `src/consola.test.ts`'s inject() suite as an allowed alternative to extending `scripts/smoke.sh`, and that alternative was used. The Docker smoke run this session performed is therefore genuine end-to-end regression coverage for the encryption code path, but it does not assert on the row-cap cutoff or the credencial-ilegible response shape specifically -- those are covered by the inject()-based integration tests in `consultas.test.ts`/`conexiones.test.ts` (against the live test database) and the DOM-stub suite in `consola.test.ts`, not by the Docker Compose script. See WARNING 2 below.

**Coverage**: Not applicable. This project has no configured coverage threshold or tool; test evidence is scenario-level (node:test plus app.inject()/real HTTP against live Postgres, no mocking), matching the standing project convention from CH-04/05/06.

### Spec Compliance Matrix

**credential-encryption** (5 requirements / 7 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Versioned Authenticated Envelope Format | Enciphering a credential produces a versioned envelope | cripto-credencial.test.ts: the envelope has the shape v1:iv:tag:ciphertext with base64 components | COMPLIANT |
| Versioned Authenticated Envelope Format | The same credential enciphers differently each time | cripto-credencial.test.ts: the same credential enciphered twice yields two different envelopes | COMPLIANT |
| Credential Is Enciphered Before It Reaches Storage | Registering a connection stores ciphertext, not plaintext | conexiones.test.ts: CH-07 registering stores a v1 envelope, never the submitted plaintext; CH-07 two registrations of the same credential store two different envelopes | COMPLIANT |
| Credential Is Deciphered Only in Memory at a Use Site | A deciphered credential is used to dial and then discarded | conexion-destino.test.ts: a stored envelope is deciphered in memory into a dialable destination; conexiones.test.ts: CH-07 the probe deciphers the stored envelope and still reaches the target; smoke session: real dial via prueba route to resultado ok | COMPLIANT |
| Fail-Closed Master Key Validation at Boot | Startup with no master key configured | cripto-credencial.test.ts: a key that is unset is refused (validarClaveMaestra) | COMPLIANT |
| Fail-Closed Master Key Validation at Boot | Startup with a malformed or too-short master key | cripto-credencial.test.ts: a key that is valid base64 but only 16/31/33 bytes is refused; a key that is not base64 at all is refused | COMPLIANT |
| Master Key and Deciphered Credential Never Exposed | A decipher failure does not leak key material or partial plaintext | cripto-credencial.test.ts: the failure carries neither the plaintext, the ciphertext nor the key; conexion-destino.test.ts: a corrupted envelope throws ErrorCredencialIlegible, never a partial plaintext | COMPLIANT |

**connection-registration** (3 requirements / 8 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Connection Registration Persists Against the Active Tenant | Registering a valid connection | conexiones.test.ts: CH-07 registering stores a v1 envelope (envelope shape); unchanged prior coverage for the row/response shape | COMPLIANT |
| Connection Registration Persists Against the Active Tenant | Rejecting an incomplete registration | conexiones.test.ts: an incomplete registration is rejected and creates no row (unaffected by CH-07, re-run green) | COMPLIANT |
| Connection Registration Persists Against the Active Tenant | No active tenant resolvable | contexto-tenant.test.ts header-envelope rejection (CH-06, unaffected, re-run green) | COMPLIANT |
| Connectivity Test Uses a Fixed PostgreSQL Probe | Testing a reachable PostgreSQL target | conexiones.test.ts: 5.1 a reachable target reports success; CH-07 the probe deciphers the stored envelope and still reaches the target; smoke: reachable-target section | COMPLIANT |
| Connectivity Test Uses a Fixed PostgreSQL Probe | Testing a connection with a non-PostgreSQL engine value | conexiones.test.ts: a non-postgres motor still probes the stored host and port (unaffected by CH-07, re-run green) | COMPLIANT |
| Credential Value Never Exposed | A failed test does not leak the credential | conexiones.test.ts: 5.2 a wrong password is classified as credenciales-invalidas (response/log-safety assertions); smoke: wrong-password section | COMPLIANT |
| Credential Value Never Exposed | A successful test does not leak the credential | conexiones.test.ts: 5.1 a reachable target reports success (response-body credential-absence assertion) | COMPLIANT |
| Credential Value Never Exposed | A database dump never yields a readable credential | conexiones.test.ts: CH-07 registering stores a v1 envelope (raw-row inspection asserts no plaintext); conexion-destino.test.ts: the row itself never holds the plaintext; a legacy plaintext row throws ErrorCredencialIlegible (DEC-20) | COMPLIANT |

**query-execution** (1 requirement / 3 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Row Cap Sourced From Global Configuration, Reported as a Distinct Cutoff Verdict | Execution stays within the row cap | consultas.test.ts: CH-07 a result inside the cap reports corte null and the pagination of CH-04; consulta-ejecucion.test.ts: corteDeEjecucion unit cases with hayMas false and with limiteSolicitado not above topeFilas | COMPLIANT |
| Row Cap Sourced From Global Configuration, Reported as a Distinct Cutoff Verdict | Execution is stopped by the row cap | consultas.test.ts: CH-07 a result cut by the cap reports corte tope-de-filas and the ceiling; CH-07 corte lives outside paginacion, where DEC-18 requires it; consulta-ejecucion.test.ts: corteDeEjecucion(1000,200,true) equals tope-de-filas | COMPLIANT |
| Row Cap Sourced From Global Configuration, Reported as a Distinct Cutoff Verdict | Row cap is configurable without a source change | config.test.ts: MAX_FILAS_CONSULTA overrides the default without a source change; consultas.test.ts: cases parametrized with topeFilas 1 and topeFilas 2 | COMPLIANT |

**query-console** (1 requirement / 2 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Row-Cap Cutoff Is Surfaced Legibly | Viewing a capped result | consola.test.ts: a capped result states the cap and names the configured number; a capped result leaves the next-page control disabled, hayMas notwithstanding | PARTIAL |
| Row-Cap Cutoff Is Surfaced Legibly | A capped result is not mistaken for a partial page | consola.test.ts: the cut sentence is a distinct node, and never sits beside the ordinary pagination sentence | PARTIAL |

**Compliance summary**: 20/20 scenarios have covering evidence and passed. 18/20 via executable node:test assertions re-run live in this session (including 3 exercised end-to-end over real HTTP against a live Docker stack via npm run smoke), 2/20 (the query-console cap-cutoff and distinguishability scenarios) via a documented DOM-stub script execution rather than a real browser -- the same technique and the same disclosed limitation CH-05 and CH-06 already used and flagged. Marked PARTIAL rather than UNTESTED or FAILING because real code (the actual /consola inline script, extracted verbatim via inject()) executes and the claims are verifiably true against the DOM stub, but real HTML parsing, CSS and layout are out of this environment reach -- no browser is available, which is the residual limitation this project prior verify reports already recorded as acceptable.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Single-point credential read (credencial: true in exactly one file) | Implemented | grep for credencial: true across src/ (excluding .test.ts) returns exactly one hit, src/conexion-destino.ts line 40, re-run in this session |
| Master key never on AppConfig, never logged, never returned | Implemented | Read src/cripto-credencial.ts and src/config.ts directly: the key Buffer is module-scoped in cripto-credencial.ts, validarClaveMaestra() returns void, AppConfig has no key field |
| Rule 4, limits bound as driver parameters, never spliced into SQL text | Implemented | src/consulta-ejecucion.ts: LIMIT/OFFSET clause with a values array carrying limiteEfectivo plus 1 and desplazamiento; grep for an interpolated limit pattern across src/ found none |
| Rule 7, no key/credential/plaintext in any response, error, or log | Implemented | app.log.warn call sites in src/conexiones.ts and src/consultas.ts pass only conexionId, categoria/fase, codigo, durationMs; ErrorCredencialIlegible carries a fixed constant message with no cause; smoke session log-grep assertions for submitted credentials passed against real Docker logs |
| corte reported outside Paginacion, never conflated with hayMas | Implemented | EjecucionExitosa.corte is a sibling of paginacion, not a member of it; corteDeEjecucion() requires both limiteSolicitado above topeFilas and hayMas before returning tope-de-filas, matching design stated two-condition verdict |
| 409 credencial-ilegible mapping present on both call sites | Implemented | src/conexiones.ts (prueba route) and src/consultas.ts (ejecutar route) both catch ErrorCredencialIlegible and return 409 with error credencial-ilegible before any decipher/dial side effect |
| No schema/migration change | Confirmed | prisma/schema.prisma unmodified by CH-07 per design.md; no new migration file present under prisma/migrations newer than CH-06 |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| DEC-16 (AES-256-GCM, node:crypto, versioned envelope) | Yes | src/cripto-credencial.ts matches exactly: createCipheriv with aes-256-gcm, random 12-byte IV, v1:iv:tag:ciphertext |
| DEC-17 (one master key per deployment, env var, fail-closed at boot) | Yes | validarClaveMaestra() called from loadConfig(), itself called before listen in src/server.ts; no per-tenant key scoping anywhere |
| DEC-18 (cap is its own verdict, not reused hayMas) | Yes | corte field confirmed outside Paginacion; consultas.test.ts explicitly tests that corte lives outside paginacion, where DEC-18 requires it |
| DEC-19 (global env-var configuration, not per-connection/per-tenant) | Yes | MAX_FILAS_CONSULTA is a single global config value in AppConfig; no new Conexion/Tenant columns, no migration |
| DEC-20 (no backfill migration; legacy plaintext rows answer 409) | Yes | No migration ships; descifrarCredencial treats a legacy plaintext value as an unversioned envelope and throws ErrorCredencialIlegible, confirmed by dedicated tests in conexion-destino.test.ts, conexiones.test.ts, consultas.test.ts |
| Design: explicit calls behind one accessor, not a Prisma extension | Yes | src/conexion-destino.ts is the sole accessor; both routes call it rather than embedding descifrarCredencial calls themselves |
| Design: cap reuses the existing LIMIT+1 probe row, no second ceiling | Yes | correrTransaccion() binds a single LIMIT equal to limiteEfectivo plus 1; no second query or count(*) |
| Design: 200 for cap cut, timeout stays fallo, all three envelope shapes distinguished | Yes | Cap cut is resultado ok with corte tope-de-filas at 200; timeout remains resultado fallo, categoria tiempo-agotado, unchanged from CH-04 |

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. scripts/smoke.sh (the Docker Compose e2e script) was not extended with CH-07-specific assertions -- no corte, tope-de-filas, or credencial-ilegible string appears anywhere in it. This is not a task-completion gap: task 4.3 explicitly named src/consola.test.ts's inject() suite as an allowed alternative, and that alternative genuinely exercises the console-facing behavior. But it does mean the Docker-based end-to-end run (which this verify session ran successfully for the first time on this change) proves the encryption round trip and fail-closed boot over real HTTP/real Postgres, while leaving the row-cap-cutoff and credential-illegible-409 assertions to the node:test suite and the DOM-stub console suite rather than to the Compose script. Recommendation: acceptable for archive; a future change could extend scripts/smoke.sh with a CH-07 section (register with a too-large result set to trigger corte, and a legacy-plaintext-row fixture to trigger credencial-ilegible) for full parity with how CH-01/03/04/05/06 are covered there.
2. The two query-console scenarios (cap-cutoff legibility and distinguishability) are verified via a DOM-stub script execution against the real, verbatim-extracted /consola inline script, not a real browser -- the same disclosed, previously-accepted limitation CH-05 and CH-06 both recorded (no headless-DOM/browser tooling available in this environment). Marked PARTIAL, not a blocker.
3. The apply session bitacora and apply-progress record both explicitly named running npm run smoke as an open verification gap before considering CH-07 fully closed. This verify session closed that gap: npm run smoke was run for real in this session and passed (SMOKE TEST PASSED, exit 0). This is recorded as a WARNING-adjacent note rather than removed silently, so the resolution is traceable against the prior record rather than assumed.

**SUGGESTION**:
1. Consider adding a lightweight headless-DOM dependency (such as jsdom) in a future change, as CH-06's verify report already suggested, so console assertions like the ones in consola.test.ts can run against real HTML parsing/layout rather than a hand-rolled DOM stub.
2. Consider extending scripts/smoke.sh with an explicit CH-07 section (per WARNING 1) so a future full-stack regression run has direct evidence of the cap-cutoff and credential-illegible paths without relying on the unit/integration suite alone.

### Regression Check (CH-01/CH-03/CH-04/CH-05/CH-06)

npm run smoke re-ran every CH-01/CH-03/CH-04/CH-05/CH-06 scenario end to end against the real Docker Compose stack and passed in full: readiness/degrade-recover, migration idempotency, tenant alta/listado/baja, connection registration and the four probe-failure categories, paginated execution, multi-statement and data-modifying-statement rejection, privilege blocking, execution timeout, saved-query creation/listing/retrieval, the T2 cross-tenant sweep, and the console structural checks (one script element, no innerHTML, tenant bar present). All passed unchanged, confirming CH-07's changes (encipher/decipher wiring, cap/verdict, console rendering) did not regress prior behavior. The full node:test suite (223/223) additionally re-ran every prior change's dedicated test file (tenants.test.ts, contexto-tenant.test.ts, consultas-guardadas.test.ts, aislamiento.test.ts) unchanged and green.

### Verdict

PASS WITH WARNINGS

All 10 requirements and 20 scenarios across the 4 CH-07 spec deltas have covering evidence and passed. 223/223 tests pass against live PostgreSQL, independently re-executed in this session; tsc --noEmit and npm run build are both clean; and, closing the one gap the apply session explicitly left open, npm run smoke was run for real against the full Docker Compose stack in this session and passed end to end, including a genuine encipher-then-decipher-then-dial round trip over real HTTP. Zero CRITICAL findings. The three WARNINGs -- scripts/smoke.sh not carrying CH-07-specific assertions (task 4.3's allowed alternative was used instead), the console cap-legibility scenarios remaining DOM-stub-verified rather than browser-verified (the same disclosed CH-05/CH-06 pattern), and an explicit note that the apply session open smoke gap is now closed -- are residual, non-blocking, and do not represent an unmet spec requirement, a failing test, or a code/task mismatch. Recommended for sdd-archive.
