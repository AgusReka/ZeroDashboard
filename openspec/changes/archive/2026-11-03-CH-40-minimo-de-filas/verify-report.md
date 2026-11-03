```yaml
schema: gentle-ai.verify-result/v1
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
warnings: 0
suggestions: 3
requirements: 9/9
scenarios: 64/64 (62 covered, 2 weak, 0 missing)
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1 (only the 4 known environmental failures)
build_command: npx tsc --noEmit
build_exit_code: 0
```

# Verify report: CH-40 — Minimum rows per automation

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 0 WARNING, 3 SUGGESTION; the label stays "with warnings" only because the suite exits non-zero on the 4 known environmental failures). Date: 2026-11-03. Branch: `ch40/minimo-filas`, commits `4b02897` (planning), `6526ab0` (feature), `87d9f96` (tasks and refinements), `c4df112` (panel test fix); base `master`. DEC-193 on `v2/dec-193` (`4842ab3`).

Verification ran inline in the same session that applied the change (the Claude Code hook refuses `sdd-*` sub-agents), so it is not independent: it reads the code and the test names against the specs, and reruns the commands.

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npx prisma validate` | "The schema at prisma\schema.prisma is valid" |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | Applied `20261103000000_automatizacion_minimo_filas`. 1645 tests, 1641 pass, 4 fail, 0 skipped, 0 cancelled. The 4 failures are the known false positives in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, "CH-07 the probe deciphers…": "the registration response must not echo the submitted credential", because the password `postgres` appears in `"motor":"postgres"`). `src/conexiones` is unchanged by this branch. |

A first full run had 2 more failures in `panel-ajustes-rutas.test.ts`: the row snapshot gained `minimoFilas` and two literal expectations did not. Fixed in `c4df112` (both now also assert the panel leaves the minimum at 1).

Size against `master`, without the SDD artifacts: 19 files, 554 insertions, 63 deletions (~617 changed lines): code ~190, tests ~400, docs ~30. `size:exception` accepted by the user on 2026-11-03 for one PR.

## Tasks
All 20 task lines are ticked after this report.

| Task | Evidence |
|---|---|
| 1.1, 1.2 | `prisma/schema.prisma` (`Automatizacion.minimoFilas Int @default(1)`, CH-40 comments on both models); migration with the rollback in its header |
| 2.1 | `automatizaciones.ts`: `'omitida-bajo-minimo'` in `EstadoNotificacion` and `OmisionNotificacion`, `MINIMO_FILAS_POR_DEFECTO`, `decidirNotificacion(..., minimoFilas)` with the row after zero rows and the `hayMas` rule |
| 2.2 | `automatizaciones.test.ts`: six CH-40 cases; existing callers pass 1; the closed sets of 3.2 and CH-18 2.1 include the value |
| 3.1 | `automatizaciones-rutas.ts`: `minimoFilasValido`, schema keys in create and adjust, pure create check, `AutomatizacionCompleta.minimoFilas`, `resolverAjusteOperador(..., tope)`, the spread in the update; `topeFilas` from `server.ts` through `DependenciasRutas` (design §4.1, apply-time refinement) |
| 3.2 | `automatizaciones-rutas.test.ts`: 2 pure, 1 registrar-cap, 8 no-read rows, 5 DB cases; the 201 key list |
| 3.3 | `panel-ajustes-rutas.test.ts`: two refused bodies with `minimoFilas`; the snapshot includes it |
| 4.1, 4.2 | `planificador.ts` (type, select, call); `planificador.test.ts` two DB cases |
| 5.1–5.4 | `consola.ts` (markup, refs, reset, dirty check, body, `numeroDeMinimo`, `textoDeMinimo`, 400 branch, adjust state and diff, label); `consola.test.ts` (3 ids in `IDS`, 8 exact bodies updated, 6 CH-40 cases) |
| 6.1–6.4 | `docs/guia/06-automatizaciones.md`; both `guidelines/consola.md` copies identical (`diff -q`); `docs/02-mapa-de-changes.md` PR numbers; DEC-193 on `v2/dec-193` |
| 7.1–7.3 | Commands above; this report |

## Spec scenarios → evidence

Abbreviations: AU `automatizaciones.test.ts`, AR `automatizaciones-rutas.test.ts`, PL `planificador.test.ts`, PA `panel-ajustes-rutas.test.ts`, CO `consola.test.ts`. "Pre-existing" means the scenario text is unchanged from the main spec and its existing test stayed green with the change.

### email-notification (11)
| Scenario | Test | Status |
|---|---|---|
| Query failed records null | AU "3.1 a run that did not succeed…" (pre-existing, now with minimum 1) | covered |
| Zero rows never sends | AU "3.1 zero rows never sends…"; PL "CH-14 5.1…" | covered |
| Zero rows wins over the minimum | AU "2.2 zero rows wins over the minimum" | covered |
| Rows below the minimum never send | AU "2.2 rows below the minimum never send"; PL "CH-40 4.2 rows below the minimum…" (DB, notifier not called, `filas: 2`) | covered |
| Reaching the minimum sends | AU "2.2 reaching the minimum exactly sends"; PL "CH-40 4.2…" (`minimoFilas` 2 with 2 rows → `enviada`) | covered |
| A result cut by the row cap reaches the minimum | AU "2.2 a result cut by the row cap reaches the minimum" (`hayMas`, 20 rows, minimum 50) | weak: unit level only, no scheduler run with a lowered cap |
| The minimum wins over a missing recipient | AU "2.2 the minimum wins over a missing recipient and unset SMTP" | covered |
| Default minimum keeps today's behavior | AU "2.2 the default minimum keeps the behaviour before CH-40" | covered |
| Missing recipient vs unset SMTP | AU "3.1 a missing recipient wins over unset SMTP" (pre-existing) | covered |
| SMTP unset with a recipient | AU "3.1 unset SMTP with a recipient…" (pre-existing) | covered |
| Rows, recipient, SMTP: send once | AU "3.1 rows, a recipient and SMTP configured…"; PL "CH-14 5.1…" (pre-existing) | covered |

### execution-log (8)
| Scenario | Test | Status |
|---|---|---|
| Each outcome is recorded | AU "3.2 every non-send outcome…" (loop includes `omitida-bajo-minimo`); PL CH-14 and CH-40 DB cases | covered |
| A run below the minimum is recorded | PL "CH-40 4.2 rows below the minimum…" (`estado ok`, `filas 2`, `notificacion`) | covered |
| Query failure leaves notificacion null | AU "3.2 a query that did not succeed…" (pre-existing) | covered |
| Legacy rows read as null | AR "5.1 an automation's runs are listed…" (pre-existing) | covered |
| A completed run never ends as enviando | AU "CH-18 2.1…" (closed set extended) | covered |
| Listing shows the new values (CH-18) | AR / PL CH-18 cases (pre-existing) | covered |
| Listing shows notificacion, `omitida-bajo-minimo` included | AR "CH-40 an adjust changes the minimum on the same row and keeps its runs" (lists the run with the new value) | covered |
| Listing shows the fallback | AR "5.1…" (pre-existing) | covered |

### automation-scheduling (17)
| Scenario | Test | Status |
|---|---|---|
| Creating with a minimum | AR "CH-40 a minimum persists and is returned by create and get…" | covered |
| Creating without a minimum | same test (`minimoFilas` 1) | covered |
| Out-of-range minimum refused (0, 201, 2.5) | AR no-read rows (0, −3, 2.5, `'cinco'`, null, cap + 1) and "CH-40 the cap itself is accepted; one above it is a 400 and nothing persists" | covered |
| The cap is the configured one (50 / 51) | AR "CH-40 the routes bound the minimum by the cap they were registered with" (registrar at 50, 51 refused); AU `minimoFilasValido(51, 50)`; `server.ts` passes `config.maxFilasPorConsulta` (typecheck only) | weak: the env-to-registrar wiring has no runtime test |
| Adjusting the minimum in place | AR "CH-40 an adjust changes the minimum on the same row and keeps its runs" | covered |
| Invalid minimum in the adjust | AR "CH-40 an adjust minimum out of range…" (0, cap + 1, 2.5); no-read adjust rows (0, 2.5) | covered |
| Adjust stays tenant-scoped | AR "CH-40 another tenant's automation is 404 for a minimum adjust…" | covered |
| Creating with valid values (`minimoFilas: 1`) | AR "3.2 a valid create…" (pre-existing) + "CH-40 a minimum persists…" | covered |
| Parameter values validated like CH-11 | AR "3.2 a missing or ill-typed parameter…" (pre-existing) | covered |
| Connection must belong to the same tenant | AR "3.2 another tenant's connection…" (pre-existing) | covered |
| Creating with a valid recipient | AR "CH-14 6.1 a valid recipient…" (pre-existing) | covered |
| Creating without a recipient | AR "CH-14 6.1 without a recipient…" (pre-existing) | covered |
| Invalid recipient rejected | AR no-read rows (pre-existing) | covered |
| Existing rows read the default minimum | PL "CH-40 4.2 a row written without the column reads the code default"; the migration applied to the test database with `DEFAULT 1` | covered |
| One run, one row, one send | PL "CH-14 5.1…" (pre-existing) | covered |
| A run below the minimum closes without sending | PL "CH-40 4.2 rows below the minimum…" | covered |
| Existing automation without recipient keeps running | PL "CH-14 5.2…" (pre-existing) | covered |

### query-console (28)
| Scenario | Test | Status |
|---|---|---|
| Viewing the list; connection and schedule in words; custom schedule and unknown connection | CO list tests (pre-existing) | covered (3) |
| Creating an automation from the console | CO "create builds value controls…" (body now with `minimoFilas: 1`) | covered |
| Creating with a recipient | CO "CH-14 6.4 the recipient is sent…" (body updated) | covered |
| Creating with a minimum (5, preview «5 filas o más») | CO "CH-40 5.4 the minimum starts at 1, is sent as a number and the email preview states it" | covered |
| Default minimum (`minimoFilas: 1`) | same test, plus the 8 updated exact-body tests | covered |
| Invalid recipient shown legibly | CO "CH-14 6.4 a rejected recipient…" (pre-existing) | covered |
| Invalid minimum shown legibly | CO "CH-40 5.4 a rejected minimum is one legible sentence inside the pop-up, which stays open" | covered |
| Wizard opens on step 1; step navigation; parameters of the chosen template | CO CH-21c W-cases (pre-existing) | covered (3) |
| POST body keys | CO "CH-21c H1…" key list now includes `minimoFilas` | covered |
| Success banner; server 400 inside the pop-up; no connections; connections fetch fails | CO CH-21c / CH-32b cases (pre-existing) | covered (4) |
| Adjust opens prefilled (minimum 3) | CO "CH-40 5.4 the adjust opens on the stored minimum and sends only it…" | covered |
| Only the changed fields are sent | CO "CH-33 only the schedule is sent…" + "CH-40 5.4 an automation read without a minimum opens on 1, and an unchanged one is not sent" | covered |
| Changing only the minimum (`{ "minimoFilas": 10 }`) | CO "CH-40 5.4 the adjust opens on the stored minimum…" | covered |
| Emptying the recipient; custom cron on Personalizado; refusal stays inside; deactivated rows | CO CH-33 cases (pre-existing; the refusal message for `/minimoFilas` shares `mensajeDe400DeAutomatizacion`, exercised by the create case) | covered (4) |
| Viewing runs; send failure visible; attempts and placeholder | CO CH-13 / CH-14 6.5 / CH-17b cases (pre-existing) | covered (3) |
| Notification outcomes are legible (`omitida-bajo-minimo` label) | CO "CH-40 5.4 the runs view labels a run skipped below the minimum" | covered |

## Rules and decisions
- **Rule 2 (tenant isolation).** The adjust keeps the scoped `findUnique` before any write; the cross-tenant case is a DB test. No new unscoped read.
- **Rule 6 (engine only runs the pattern).** One integer compared with the row count of the page already read; no new capability (DEC-186, DEC-193).
- **DEC-60.** Coercion is allowed for `minimoFilas` only; `valores` keeps its container-only schema.
- **DEC-186.** The panel schema still refuses `minimoFilas` (PA).
- **G3'.** No `zd-*` token in the console script; the full console suite passes, guard included.

## Suggestions
1. **Lowered cap end to end.** A scheduler test with `MAX_FILAS_CONSULTA` below an automation's minimum would turn the two weak scenarios into covered ones. It needs the scheduler to take its cap from the test, which it reads from `loadConfig()` today.
2. **Adjust refusal for the minimum in the console.** The CH-33 refusal test uses `destinatario`; a `/minimoFilas` variant on the adjust pop-up would pin that path too (the message function is shared and covered on create).
3. **CH-42 preview.** When CH-42 reads `minimoFilas`, reuse `decidirNotificacion` rather than a second comparison, so the `hayMas` rule stays in one place.
