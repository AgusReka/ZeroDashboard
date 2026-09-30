```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:947d4ad0238179e00d0d960f988f209edee853cf35673f481f8e6970587e7aa3
verdict: fail
blockers: 1
critical_findings: 1
requirements: 24/26
scenarios: 55/58
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:f996be417c323ef5e1b83ca4e577bcfed66d5bf6cdee8e9eaf9cc91df227fe1d
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

> **Remediation at close (orchestrator, 2026-09-29).** The only CRITICAL (C-1: task 7.1 bitácora missing) was resolved after this report by writing `docs/bitacora/CH-14-motor-condicion-y-notificacion.md` and ticking 7.1 on branch `ch14/7-verify-archivo`. The fix is documentation-only: no source, test or spec file changed after the evidence above, so the test and build evidence still applies. Effective verdict at close: **PASS WITH WARNINGS** (0 CRITICAL, 4 WARNING, 4 SUGGESTION). D4 was also addressed: task 4.8's text now names ports 1026/8026. The envelope above is kept verbatim as the snapshot the verifier produced.

## Verification Report

**Change**: CH-14-engine-condition-email-notification
**Version**: N/A (delta specs, 6 capabilities)
**Mode**: Strict TDD (orchestrator-injected; `openspec/config.yaml` still says `strict_tdd: false`)
**Branch / HEAD**: `ch14/7-verify-archivo` @ `f6d9026` (stack tip, 27 commits over `master`)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 46 (1.1-1.9, 2.1-2.8, 3.1-3.6, 4.1-4.9, 5.1-5.12, 6.1-6.7, 7.1-7.4) |
| Tasks complete | 42 (all of phases 1-6) |
| Tasks incomplete | 4: 7.1 (bitacora, not written), 7.2 (evidence produced by this run), 7.3 (this report), 7.4 (archive, next phase) |

`docs/bitacora/CH-14-motor-condicion-y-notificacion.md` does not exist. 7.2 is satisfied by the evidence below; 7.3 by this report; 7.4 is the archive phase.

### Build & Tests Execution
**Build (typecheck)**: PASSED
```text
npx tsc --noEmit  -> exit 0, no output
```
**Schema**: PASSED
```text
npx prisma validate -> "The schema at prisma\schema.prisma is valid", exit 0
```
**Compose**: `docker compose config --quiet` exit 0 (services db, app); `docker compose --profile correo config --quiet` exit 0.

**Tests**: 620 passed / 0 failed / 0 skipped
```text
TEST_DB_PORT=5434 npm test
tests 620 | suites 91 | pass 620 | fail 0 | cancelled 0 | skipped 0 | todo 0   (exit 0)
```
Count check: matches apply-progress unit 6 (613 baseline + 7 = 620). Skip audit: `skipped 0` is misleading. `src/notificador-mailpit.test.ts` is skipped at suite level ("no Mailpit API at http://127.0.0.1:8026"), and a skipped suite is not counted in `tests` or `skipped`. Every live-PostgreSQL suite ran (none skipped). The Mailpit test was then run live: `docker compose --profile correo up -d mailpit` (mailpit v1.31.2 on 127.0.0.1:1026/8026), `npx tsx --test src/notificador-mailpit.test.ts` -> `4.8 one message arrives with its sender, recipient, both parts and no attachment` pass 1, fail 0. The container was removed afterwards. With Mailpit up the total is 621. An unrelated Mailpit (saleor-platform) owns 1025/8025 on this host, so the test's refusal of port 1025 is justified.

**Coverage**: not available (no coverage tool configured); skipped, not a failure.
**Linter**: not configured. **Type checker**: clean.
**sdd-verify-validate**: available; envelope totals counted from spec headings (26 requirements, 58 scenarios); `valid: true`.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | OK | "TDD Cycle Evidence" tables for units 1, 2, 3, 4, 5a, 5b, 6 in apply-progress |
| All tasks have tests | OK | every behavioral task (1.5, 2.1-2.6, 3.1-3.3, 4.1-4.8, 5.1-5.11, 6.1-6.5) names an existing test file |
| RED confirmed | WARNING | 8 rows record "passed on first run" (5.2, 5.3, 5.4, 5.6, 5.7, 5.9, 5.11, 6.1 invalid-address cases) because the behavior was built in earlier units; each was compensated by a recorded production-code mutation that made the test fail |
| GREEN confirmed | OK | all cited test files pass in the full run above |
| Triangulation adequate | OK | multiple cases everywhere except 5.9 and 4.8 (declared single scenario) |
| Safety net for modified files | OK | Safety net column present for every modified file |

**TDD Compliance**: 5/6 checks fully passed, 1 warning.

### Test Layer Distribution
| Layer | Tests (approx.) | Files | Tools |
|-------|-----------------|-------|-------|
| Unit | ~100 (correo 25, automatizaciones +14, config +8, notificador 19, consola +6) | 5 | node:test + tsx |
| Integration (live PostgreSQL, fake notifier, app.inject) | ~17 (planificador +8, aislamiento +2, rutas +7) | 3 | node:test + Fastify inject |
| Process / Live | 3 (server boot child process) + 1 (Mailpit) | 2 | child process, Mailpit |
| E2E browser | 0 | 0 | not installed (see W-3) |

### Changed File Coverage
Coverage analysis skipped - no coverage tool detected.

### Assertion Quality
Sampled `correo.test.ts`, `notificador.test.ts`, the CH-14 blocks of `planificador.test.ts`, `automatizaciones-rutas.test.ts`, `consola.test.ts` and `notificador-mailpit.test.ts`. No tautologies, orphan-empty assertions or ghost loops found. The "notifier not called" assertions have positive companions in the same tick (5.1 covers 0 rows and 1 row together), so they cannot pass vacuously. The 5.6 no-secrets check asserts a marker cell is present in the message but absent from every log line, proving it can fail.
**Assertion quality**: 0 CRITICAL, 0 WARNING (sample-based, not an exhaustive line audit).

### Spec Compliance Matrix
COMPLIANT = covering test exists and passed at runtime.

**email-notification (12 requirements, 21 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Outcome precedence | Query failed records null, sends nothing | `planificador.test.ts > CH-14 5.3 a query failure or a gate refusal records notificacion null and never calls the notifier` | COMPLIANT |
| | Zero rows never sends | `planificador.test.ts > CH-14 5.1 a run with 0 rows never calls the notifier...`; `automatizaciones.test.ts > 3.1 zero rows never sends, even with a recipient and SMTP configured` | COMPLIANT |
| | Missing recipient vs unset SMTP | `automatizaciones.test.ts > 3.1 a missing recipient wins over unset SMTP`; `planificador > CH-14 5.2` | COMPLIANT |
| | SMTP unset with a recipient | `automatizaciones.test.ts > 3.1 unset SMTP with a recipient records no-configurada`; `planificador > CH-14 5.2` | COMPLIANT |
| | Rows + recipient + SMTP send exactly once | `automatizaciones.test.ts > 3.1 rows, a recipient and SMTP configured: send once, to that recipient`; `planificador > CH-14 5.1` | COMPLIANT |
| Send failure fails run, tick survives | SMTP rejects the message | `notificador.test.ts > 4.4 each nodemailer code maps to its category`, `> 4.4 a bare 4xx/5xx reply...`; `automatizaciones.test.ts > 3.2 a failed send fails the run in phase notificacion and keeps filas and corte`, `> 3.3`; `planificador > CH-14 5.4 5.6` | COMPLIANT |
| | Failed send does not block a sibling | `planificador.test.ts > CH-14 5.4 5.6 a failed send closes fallo/notificacion keeping filas, logs no secrets, and a sibling still runs` | COMPLIANT |
| Send bounded by timeout | Unresponsive SMTP server | `notificador.test.ts > 4.6 a transport that never answers ends as tiempo-agotado and is closed`; `> 4.7 a closed port is servidor-inalcanzable`; `planificador > CH-14 5.9 a hanging send is cut by the outer limit and the next automation still runs` | COMPLIANT |
| Recipient validated, header-safe | Invalid recipient rejected | `automatizaciones-rutas.test.ts > 3.1/3.3 a malformed body or an invalid cron is rejected naming the field, before any read` (CH-14 cases: not an address, empty, spaces, 262 chars -> `/destinatario`); `correo.test.ts > 2.1 rejects malformed local parts, domains, and lengths` | COMPLIANT |
| | Header injection / multiple addresses | same route test (CRLF, trailing CRLF, `,`, `;`); `correo.test.ts > 2.1 rejects header injection, lists, and separators` | COMPLIANT |
| Body only result columns (rule 5) | Body excludes internals | `correo.test.ts > 2.6 the message holds no SQL, parameter, connection or recipient data` | COMPLIANT |
| Renderer escapes | Markup in a cell neutralized | `correo.test.ts > 2.3 markup in a cell, a column name and the template name is escaped text`; `> 2.3 escaparHtml covers the five significant characters` | COMPLIANT |
| Degraded rendering (N2) | Null/undefined/empty cells | `correo.test.ts > 2.2 null, undefined and empty cells render as the placeholder; short rows are padded`; `> 2.2 missing values become the placeholder; zero stays 0` | COMPLIANT |
| | Aggregate row of zeros | `correo.test.ts > 2.2 an aggregate row of zeros renders every 0 inside a well-formed table` | COMPLIANT |
| Truncation notice | Truncation notice | `correo.test.ts > 2.4 a truncated result states how many rows are shown, in both parts` | COMPLIANT |
| | No notice for complete result | `correo.test.ts > 2.4 a complete result shows no truncation notice and no empty-cell notice` | COMPLIANT |
| Subject header-safe, themed | CR/LF stripped | `correo.test.ts > 2.5 CR, LF and other control characters never reach the subject` | COMPLIANT |
| | Label selects accent/emoji | `correo.test.ts > 2.5 each known label uses its own accent and subject emoji, and no other accent`; `> 2.5 an unknown label falls back to the neutral accent, never a throw` | COMPLIANT |
| text/plain alternative | Both parts present | `notificador.test.ts > 4.3 builds to/from/subject/html/text and reports enviada`; `correo.test.ts > 2.4 ... in both parts`; live `notificador-mailpit.test.ts > 4.8` (HTML and Text present, no attachment) | COMPLIANT |
| SMTP secrets out of logs (rule 7) | Failure log carries no secrets | `planificador > CH-14 5.4 5.6` (recipient, marker cell, SMTP text absent from every pino line); `notificador > 4.2 every invalid or partial setting stops the boot naming the variable, never a value`; `server.test.ts > valid SMTP settings: boots, logs correo configurado, and prints no SMTP value`; `automatizaciones > 3.3` | COMPLIANT (see S-2) |
| Injectable notifier | Scheduler runs with a fake notifier | `planificador > CH-14 5.1` (recording fake, exactly one message); `aislamiento > CH-14 5.11` | COMPLIANT |

**automation-scheduling (3 requirements, 11 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Automatizacion binds ... | Creating with valid values; Parameter values validated; Connection must belong to same tenant | CH-13 tests `3.2 a valid create persists activo: true, scoped to the header tenant`, `3.2 a missing or ill-typed parameter value is 400 naming it; nothing persists`, `3.2 another tenant's connection, or an unknown template, is 404; nothing persists` (pass) | COMPLIANT |
| | Creating with a valid recipient | `automatizaciones-rutas.test.ts > CH-14 6.1 a valid recipient persists trimmed and is returned by create and get` | COMPLIANT |
| | Creating without a recipient | `> CH-14 6.1 without a recipient the row persists destinatario null` | COMPLIANT |
| | Invalid recipient rejected | `> 3.1/3.3 a malformed body or an invalid cron is rejected naming the field, before any read` | COMPLIANT |
| Lifecycle: no edit/delete | Deactivating; Deactivated stays listed | `3.4/3.5 list, get, deactivate once, and the deactivated row stays listed`; `5.1 an automation's runs are listed newest first, even deactivated` | COMPLIANT |
| | Recipient cannot be edited | `3.4/3.5 an unknown or foreign id is 404; no route edits, deletes or reactivates` (loops PUT/PATCH/DELETE) | COMPLIANT |
| Run pipeline notifies after query | One run, one row, one send | `planificador > CH-14 5.1` + `CH-14 5.7 the send is inside the duration and the row closes once, after it` | COMPLIANT |
| | Existing automation without recipient keeps running | `planificador > CH-14 5.2 no recipient records sin-destinatario; an absent or null notifier records no-configurada` | COMPLIANT |

**execution-log (4 requirements, 8 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Error is a classified category | A failed run's error is sanitized | `planificador > 4.6 every outcome writes exactly one closed Ejecucion with metadata and closed categories only` | COMPLIANT |
| | A failed send's error is a closed category | `automatizaciones.test.ts > 3.3` (category re-gate, code gating); `notificador > 4.4 ...`; `planificador > CH-14 5.4 5.6` | COMPLIANT |
| Ejecucion records notificacion | Each outcome is recorded | `planificador > CH-14 5.1, 5.2, 5.4` (enviada, omitida-sin-filas, sin-destinatario, no-configurada, fallo-envio) | COMPLIANT |
| | Query failure leaves null | `planificador > CH-14 5.3` | COMPLIANT |
| | Legacy rows read as null | `automatizaciones-rutas.test.ts` runs listing (null in the `[enviada, null, omitida-sin-filas]` case); nullable column in migration `20260929000000_notificacion` | COMPLIANT |
| Send failure marks run failed in phase notificacion | Query succeeded, send failed | `automatizaciones.test.ts > 3.2 a failed send fails the run in phase notificacion and keeps filas and corte`; `planificador > CH-14 5.4 5.6` | COMPLIANT |
| | Successful notification leaves run ok | `planificador > CH-14 5.1` (estado ok, enviada); `automatizaciones > 3.2` | COMPLIANT |
| Runs listing exposes notificacion | Listing shows notificacion | `automatizaciones-rutas.test.ts` runs listing (notificacion per entry); `aislamiento > CH-14 6.2 the get and the runs listing show only the caller's own recipient and outcome` | COMPLIANT |

**tenant-isolation (2 requirements, 5 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| T2 automated proof | Full two-tenant route sweep | existing sweep + `aislamiento > CH-14 6.2 ...` (new fields swept) | COMPLIANT |
| | Database unreachable | inherited skip mechanism of the live suites (unchanged; DB was reachable in this run) | COMPLIANT (inherited) |
| | Two-tenant tick delivers each tenant's rows only to own recipient | `aislamiento > CH-14 5.11 a tick over A and B mails each tenant's rows only to its own recipient` | COMPLIANT |
| Recipient only from tenant-scoped row (rule 2) | Recipient from run's own automation | `aislamiento > CH-14 5.11` | COMPLIANT |
| | No global fallback recipient | `aislamiento > CH-14 5.11` (automation without recipient under four recipient-like variables; mutation `?? process.env.SMTP_TO` proven to fail it) | COMPLIANT |

**query-console (2 requirements, 7 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Console automations + create | Viewing list; Creating from console | existing CH-13 console tests (pass; create body unchanged when the field is empty) | COMPLIANT |
| | Creating with a recipient | `consola.test.ts > CH-14 6.4 the recipient is sent as destinatario only when one is entered` | COMPLIANT |
| | Invalid recipient shown legibly | `consola.test.ts > CH-14 6.4 a rejected recipient is one legible sentence naming the field, never a raw error` | COMPLIANT |
| Console shows runs | Viewing runs | CH-13 runs-view test updated with the column | COMPLIANT |
| | Notification outcomes legible | `consola.test.ts > CH-14 6.5 the runs view labels every notification outcome and explains a failed send` | COMPLIANT |
| | Send failure visible as failure | same 6.5 test (5 categories -> 5 distinct messages, failed status, rows kept) | COMPLIANT |

All console scenarios are proven over the stub-DOM harness; no real browser was used (task 6.7, see W-3).

**project-environment (3 requirements, 6 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Optional SMTP config | Application starts with SMTP unset | `server.test.ts > SMTP_HOST empty: boots, listens, and logs only correo no-configurado`; `notificador > 4.1 an absent or empty SMTP_HOST means not configured, whatever else is set` | COMPLIANT |
| | Host present but config invalid | `server.test.ts > SMTP_HOST present with an invalid port: boot fails naming the variable, never its value`; `notificador > 4.2`; `config.test.ts > SMTP_TIMEOUT_MS=0 / =-5 / =12.5 / =lento stops the boot naming the variable, never its value` | COMPLIANT |
| | Changing SMTP settings without code change | `config.test.ts > SMTP_TIMEOUT_MS overrides the default without a source change`; `notificador > 4.1 a host and a sender are enough...` (env-driven) | COMPLIANT |
| Variables ship only as placeholders | Inspecting example file and Compose | no automated test; inspected in this run: `.env.example` lists all 7 SMTP_* variables (plus Mailpit port vars) with empty values; `docker-compose.yml` forwards `${SMTP_*:-}` with no value; no `.env` tracked | PARTIAL (static, no test) |
| Mail catcher under opt-in profile | Default bring-up excludes catcher | no automated test; `docker compose config --services` -> `db`, `app` only | PARTIAL (config parse, default stack not brought up) |
| | Profile bring-up includes catcher | `notificador-mailpit.test.ts > 4.8` passed live after `docker compose --profile correo up -d mailpit`; skipped in the plain `npm test` run | PARTIAL (passes only with the profile up) |

**Compliance summary**: 55/58 scenarios compliant with a passing runtime test; 3 partial (project-environment Compose/example-file scenarios, verified by inspection); 0 failing; 0 untested.

### Correctness (Static Evidence)
| Requirement area | Status | Notes |
|---|---|---|
| `src/correo.ts` pure renderer | Implemented | No Fastify/Prisma/pg/nodemailer imports; accent only from a closed map |
| `src/notificador.ts` | Implemented | `logger:false`, `debug:false`, `disableFileAccess/UrlAccess`, three socket timeouts plus outer `Promise.race`; only `code` and a 3-digit `responseCode` survive |
| `src/planificador.ts` | Implemented | Recipient read from the loaded `Automatizacion` row; single `ejecucion.update` after the send; only the error class name logged for a throw |
| `src/server.ts` | Implemented | Notifier built before `listen`; logs only `correo: configurado / no-configurado` |
| Migration | Implemented | `20260929000000_notificacion` adds two nullable TEXT columns; `prisma validate` clean |
| Routes / console | Implemented | `destinatario` create-only (no edit route), only in `AutomatizacionCompleta` (list stays minimal); console labels and per-category messages |
| Rule 1 (no arbitrary SQL) | Respected | No new SQL path; body carries no SQL (test 2.6) |
| Rule 2 (tenant isolation) | Respected | Recipient never from request/env; T2 tick test plus mutations; 404 bodies never carry the owner's recipient |
| Rule 3 (read-only, two layers) | Not affected | Read path unchanged |
| Rule 4 (no SQL concatenation) | Not affected | No new SQL |
| Rule 5 (minimization) | Respected | Body = returned columns + static text + template name and date; `notificacion` stores the outcome only |
| Rule 6 (engine only runs the pattern) | Respected | Limits documented as artifact limits; engine not extended |
| Rule 7 (secrets out of repo) | Respected | `.env.example` and compose hold empty placeholders only; no tracked `.env`; SMTP settings never on `AppConfig`; config error messages no longer echo values |
| Anti-scope / open gates | Respected | No unregistered architecture decision found outside DEC-81..86 and the CH-14 resolutions |

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| DEC-81 nodemailer + Mailpit profile, injectable `Notificador` | Yes | `nodemailer` 10.0.12 pinned (bundled types), Mailpit `v1.31.2` |
| DEC-82 single validated address, create-only | Yes | `direccionValida` strict; route and console trim spaces/tabs; no edit route |
| DEC-83 `notificacion` column; failed send = `fallo`/`notificacion` keeping `filas` | Yes | Tests 3.2, 5.4 |
| DEC-84 no send on 0 rows; graceful degradation | Yes | |
| DEC-85 generic columns-driven renderer | Yes | |
| DEC-86 unset SMTP -> run continues as `no-configurada`; fail-fast on partial config | Yes | Child-process boot tests |
| Design: `direccionValida` input "trimmed" | Deviated (documented) | Function strict; callers trim; no spec break |
| Design: third `CierreEjecucion` variant `error: CategoriaEnvio` | Deviated (documented) | Widened with `'error-interno'`, consistent with the design's own throw row |

### Adjudication of Known Deviations
| # | Deviation | Severity | Rationale |
|---|-----------|----------|-----------|
| D1 | Slice 4 split 4a/4b/4c (also 2, 3, 5a) | SUGGESTION | tasks.md allows splitting for the 400-line budget; each branch is green and stacked. No spec impact. The chain is longer than forecast (12 branches vs 8) |
| D2 | Task 5.11 marker via per-tenant views instead of "a marker parameter per tenant" | SUGGESTION | The scenario needs distinct identifiable rows per tenant and each message holding only its own; separate targets give stronger isolation evidence. Two production mutations were proven to fail the test |
| D3 | Task 6.7 manual browser check not run | WARNING | Console scenarios pass only over the stub-DOM harness (script served by the real route). Residual risk is visual/DOM integration. Do one manual pass before merging the PR; not a blocker because every scenario has a passing test |
| D4 | Task 4.8 says ports 1025/8025, test uses 1026/8026 | SUGGESTION | Justified: an unrelated Mailpit (saleor-platform) owns 1025/8025 here. Compose maps 1026/8026 by env override, the test refuses 1025, and it passed live in this run. Update the task text or bitacora to say so |
| D5 | `error-interno` when the notify step throws | SUGGESTION | The error is in the existing closed set, gated in `cierreConNotificacion`, and prescribed by the design's error table; the spec's closed-category requirement holds. A real `Notificador` never throws, so this is a defensive path. Consider naming `error-interno` in the spec at archive |

### Issues Found
**CRITICAL**
- C-1: Task 7.1 is unchecked and its deliverable is missing (`docs/bitacora/CH-14-motor-condicion-y-notificacion.md`). An unchecked task is CRITICAL under the verify rules. It is documentation-only (no code or behavior impact) and blocks archive. Fix: write the bitacora mirroring CH-13 (what was built, nodemailer 10.0.12 and Mailpit v1.31.2 from task 1.2, limits, rollback via unset `SMTP_HOST`), tick 7.1, then re-verify. **Resolved at close (see remediation note at the top).**

**WARNING**
- W-1: Plain `npm test` skips the Mailpit live suite silently (a skipped suite is not counted in `skipped`), so `skipped 0` overstates live coverage; two Compose scenarios rest on inspection plus that optional test (3 PARTIAL scenarios).
- W-2: RED was not observed for 8 TDD rows (5.2-5.4, 5.6, 5.7, 5.9, 5.11, 6.1 invalid cases); compensated by recorded mutations, but "test before code" is not demonstrable for them.
- W-3: Console behavior (6.4, 6.5) not exercised in a real browser (task 6.7 manual check).
- W-4: Untracked stray files `0` and `run` remain in the repo root (pre-existing); they must not be staged in any CH-14 commit.

**SUGGESTION**
- S-1: Deviations D1, D2, D4, D5 above.
- S-2: The "Failure log carries no secrets" scenario names the SMTP user and password. At scheduler level the notifier is a fake, so those are covered by config-error tests (4.2), the server boot test and the closed-category re-gate rather than one end-to-end assertion with real credentials. A future test with the real notifier, credentials and a failing port would close it.
- S-3: `openspec/config.yaml` still reads `strict_tdd: false`, "not a git repo" and empty testing projects; refresh with `/gentle-sdd-init`.
- S-4: No coverage tooling; consider `node --experimental-test-coverage`.

### Verdict
FAIL (at verify time) → **PASS WITH WARNINGS at close** after the documentation-only remediation of C-1.

One CRITICAL (task 7.1, the bitacora, is unchecked and missing) blocked archive. All code evidence is green: tsc exit 0, prisma validate valid, 620/620 tests pass (621 with the live Mailpit test), 55/58 scenarios compliant at runtime and 3 partial by inspection, AGENTS.md rules 1-7 respected.
