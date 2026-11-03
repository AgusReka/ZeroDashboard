```yaml
schema: gentle-ai.verify-result/v1
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
warnings: 0
suggestions: 3
requirements: 11/11
scenarios: 85/85 (84 covered, 1 covered by a manual check, 0 missing)
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1 (only the 4 known environmental failures)
build_command: npm run build
build_exit_code: 0
```

# Verify report: CH-41 — Several recipients per automation

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 0 WARNING, 3 SUGGESTION; the label stays "with warnings" only because the suite exits non-zero on the 4 known environmental failures). Date: 2026-11-03. Branch: `ch41/varios-destinatarios`, commits `bc54709` (planning) and `afcd60e` (a map candidate, unrelated to the code), plus the uncommitted implementation; base `master`. DEC-194 on `v2/dec-194` (`894c363`).

One delegated writer implemented tasks 1–8; the parent reviewed its report, reran the commands below, and fixed two things: the non-ASCII spec examples (`dueña@` → `duena@`, which `direccionValida` refuses) and an unverified claim in the migration header about transactions. Verification ran in the same session, not in an independent one (the Claude Code hook refuses `sdd-*` sub-agents). `gentle-ai review assess` rated the diff `medium` (executable change); for that tier the writer's verification plus the parent's spot check are the record, with no separate verifier.

## Commands
| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npx prisma validate` | "The schema at prisma\schema.prisma is valid" |
| `npx tsx --test` on `automatizaciones`, `consola`, `notificador`, `correo` | 482 tests, 482 pass |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` (parent's run) | Applied `20261104000000_automatizacion_destinatarios`. 1678 tests, 1674 pass, 4 fail, 0 skipped. The 4 failures are the known false positives in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07: "the registration response must not echo the submitted credential"). Same totals as the writer's run. |
| Task 9.3, development database (with the user's go-ahead) | `prisma migrate deploy` applied the 4 pending migrations (CH-37, CH-39, CH-40, CH-41). Its one automation with an address had `destinatarios` holding exactly that address afterwards (snapshot before and after compared, identical); `destinatario` no longer exists. |
| Task 9.3, running app against Mailpit | One message at 18:41 with both addresses of a two-address list in «Para»; the run closed `ok`/`enviada`. The user then confirmed delivery through their own SMTP to both mailboxes. |

Size against `master`, without the SDD artifacts and the map note: 30 files, 884 insertions, 320 deletions (~1204 changed lines): tests ~820, code and docs ~384. The forecast was ~690: the test churn from `destinatario` to `destinatarios` was larger than estimated. `size:exception` accepted by the user on 2026-11-03, before apply.

## Tasks
All 22 task lines are ticked after this report.

| Task | Evidence |
|---|---|
| 0.1 | DEC-194 committed on `v2/dec-194` before any code |
| 1.1, 1.2 | `schema.prisma` (`destinatarios String[] @default([])`), migration with add, copy, drop and the rollback in its header |
| 2.1, 2.2 | `automatizaciones-rutas.ts`: `MAX_DESTINATARIOS`, `destinatariosDe`, create, projection and adjust; `automatizaciones-rutas.test.ts`: 7 pure rule cases, 8 DB cases, old key refused |
| 3.1, 3.2 | `panel-ajustes.ts` with the "at least one" check; `panel-ajustes.test.ts` (5 cases), `panel-ajustes-rutas.test.ts` (3 cases) |
| 4.1, 4.2 | `decidirNotificacion`, `Correo.para`, notifier `to: [...c.para]`, scheduler; `notificador.test.ts` 4.3 and 4.4, `planificador.test.ts` 2 DB cases, the T2 tick in `aislamiento.test.ts` with A's two addresses |
| 5.1, 5.2 | `consola.ts` (text inputs with `inputmode="email"`, `direccionesDe`, 400 messages, preview); `consola.test.ts` (7 CH-41 cases, exact bodies) |
| 6.1, 6.2 | `panel.ts` («Enviar a», `direccionesDe`, body diff, `ERRORES_CAMPO.destinatarios`); `panel.test.ts` one case |
| 7.1–7.3 | Demo seed, fixtures; `git grep "destinatario\b"` leaves only `sin-destinatario`, the contract guard, the DOM ids, the old-key tests and comments about the former column |
| 8.1, 8.2 | `docs/guia/01`, `06` and `08` (the last one not listed in tasks; it documented the old error fields); both copies of `guidelines/consola.md` and `pantallas.md`, identical |
| 9.1–9.4 | Commands above; this report |

## Spec scenarios → evidence

Abbreviations: AR `automatizaciones-rutas.test.ts`, AU `automatizaciones.test.ts`, NO `notificador.test.ts`, PL `planificador.test.ts`, AI `aislamiento.test.ts`, PA `panel-ajustes.test.ts`, PAR `panel-ajustes-rutas.test.ts`, PN `panel.test.ts`, CO `consola.test.ts`. "Pre-existing" means the scenario's behaviour is unchanged and its existing test stayed green with the renamed fixtures.

### automation-scheduling (21)
| Scenario | Test | Status |
|---|---|---|
| Creating with valid values (`destinatarios: []`) | AR "CH-41 without recipients the row persists an empty list" | covered |
| Parameter values; connection of another tenant | AR pre-existing | covered (2) |
| Creating with several recipients (trimmed, in order) | AR "CH-41 a valid list persists trimmed, in order, and is returned by create and get" | covered |
| Creating without recipients | AR "CH-41 without recipients…" | covered |
| Invalid recipient rejected (`/destinatarios/1`) | AR "CH-41 an invalid second recipient or a sixth one is a 400 naming it" | covered |
| Existing rows read the default minimum | PL CH-40 case (pre-existing) | covered |
| Existing recipients become a list | Task 9.3 on the development database (before/after identical); the copy SQL also checked by the writer on a throwaway database | covered by a manual check |
| Deactivate; deactivated stays listed | AR pre-existing | covered (2) |
| Adjusting keeps the id and the history (new list) | AR "CH-41 an adjust replaces the list as a whole…" | covered |
| Values checked and replaced whole | AR pre-existing | covered |
| Emptying the recipients (`[]`) | AR CH-33 valores case now sending `destinatarios: []`; pure resolver case | covered |
| Template, connection, state and the former key cannot be adjusted | AR "CH-41 the former destinatario key is refused on adjust…" + pre-existing | covered |
| Empty body, invalid cron, invalid second recipient | AR no-read table + CH-33 cases | covered |
| Deactivated → 409; another tenant → 404 | AR pre-existing + "CH-41 another tenant's automation is 404 for a list adjust" | covered (2) |
| Delete and reactivation do not exist | AR pre-existing | covered |
| One run, one send, with both addresses | PL "CH-41 a run sends one message to every address of its list, in order, and records one outcome" | covered |
| A run below the minimum | PL CH-40 case | covered |
| Automation without recipients keeps running | PL "CH-41 a run whose list is empty records sin-destinatario…" | covered |

### email-notification (18)
| Scenario | Test | Status |
|---|---|---|
| Rows 1–3 and the minimum cases (8 scenarios) | AU pre-existing and CH-40 cases, now passing lists | covered (8) |
| The minimum wins over an empty list | AU CH-40 case with `[]` | covered |
| Empty list vs unset SMTP; SMTP unset with a recipient | AU pre-existing, with lists | covered (2) |
| One message to all addresses, in order | PL "CH-41 a run sends one message…"; Mailpit check of 9.3 | covered |
| One address rejected among accepted ones | NO "4.3 CH-41 an address the server rejects among accepted ones still reports enviada" | covered |
| Every address rejected | NO "4.4 CH-41 every address rejected is envio-rechazado" | covered |
| Invalid recipient by position; CRLF or two addresses in one element | AR pure rule cases + no-read table | covered (2) |
| Duplicates kept once, ignoring case | AR "CH-41 destinatariosDe removes duplicates ignoring case…" + DB case | covered |
| More than five refused; five after a duplicate accepted | AR "caps the list at 5 after removing duplicates" + DB case | covered (2) |

### client-panel-automations (13)
| Scenario | Test | Status |
|---|---|---|
| Preset schedule; custom cron hides it | PAR / PA pre-existing | covered (2) |
| The recipients are returned as a list | PAR "CH-41 GET returns the stored list in order, and [] when none is stored"; PA "the stored list is returned as it is" | covered |
| Valid update stored (two addresses) | PAR pre-existing case with the list + "CH-41 PUT with only the list replaces it…" | covered |
| Only the sent fields change | PAR pre-existing | covered |
| Invalid values name the field | PA "CH-41 recipients that are not a list, hold a bad element or carry a line break are refused" | covered |
| The panel cannot empty the list | PA "CH-41 the panel cannot empty the list…"; PAR "CH-41 PUT refuses [] and a list of blanks…" | covered |
| More than five refused | PA "more than five distinct addresses are refused…"; PAR same test | covered |
| Forbidden keys, the former key and `minimoFilas` refused | PAR pre-existing table, extended | covered |
| Foreign id; paused; custom cron; umbral without declaration | PAR pre-existing | covered (4) |

### query-console (26)
| Scenario | Test | Status |
|---|---|---|
| List, schedule in words, unknown connection | CO pre-existing | covered (3) |
| Creating from the console | CO pre-existing, bodies updated | covered |
| Creating with several recipients (three separators, preview) | CO "CH-41 the recipients are sent as the list destinatarios only when at least one is entered" | covered |
| Creating without recipients (no key) | same test | covered |
| Creating with a minimum; default minimum | CO CH-40 cases | covered (2) |
| Invalid recipient names the typed address | CO CH-14 6.4 case updated to `/destinatarios/1` | covered |
| Invalid minimum shown legibly | CO CH-40 case + "CH-41 a 400 for the minimum keeps its own sentence…" | covered |
| Wizard steps, parameters, body keys, banner, server 400, no connections, fetch fails | CO pre-existing, key lists updated | covered (8) |
| Adjust opens prefilled («a, b») | CO CH-33 prefill case updated | covered |
| Only the changed fields are sent | CO pre-existing + "CH-41 only the recipients are sent when only they changed…" | covered |
| Changing only the minimum | CO CH-40 case | covered |
| Emptying the recipients clears them (`[]`) | CO CH-33 case updated | covered |
| Only a changed list is sent (separator is no change) | CO "CH-41 only a changed list is sent: another separator is no change, a new address is" | covered |
| Custom cron; refusal stays inside (incl. over the cap); deactivated rows | CO pre-existing + "CH-41 an adjust 400 over the cap says there are more than 5…" | covered (3) |

### tenant-isolation (7)
| Scenario | Test | Status |
|---|---|---|
| Full sweep; connection listing; database unreachable; panel route sweep | AI pre-existing | covered (4) |
| Two-tenant tick, A with two addresses | AI "CH-14 5.11 a tick over A and B mails each tenant's rows only to its own recipient" (A's list holds two addresses, B's one) | covered |
| Recipients come from the run's own automation | AI 5.11 and PL CH-41 case | covered |
| No global fallback (empty list) | PL "CH-41 a run whose list is empty…"; AI 5.11's recipient-less A automation | covered |

## Rules and decisions
- **Rule 2.** Recipients come only from the scoped row (AI 5.11 with an extra recipient-less automation in A that never borrows one).
- **Rule 7.** No address reaches a log or a run row; the failure paths keep their closed categories.
- **CH-14 Threat Matrix, per element.** A CR or LF in any element is refused before it is stored (AR rule cases), so `to` only ever holds checked values.
- **DEC-194.** Single field (1(a)), the panel keeps at least one (2(a)), case-insensitive deduplication keeping the first spelling (3(a)).
- **G3'.** No `zd-*` token in the console script; the full console suite passes.

## Suggestions
1. **`panel.test.ts` is a database test.** Run without the `TEST_DB_*` variables it dials `localhost:5432`, which belongs to another project on this machine; during apply that attempt was refused by authentication and touched nothing. A skip guard like the other DB suites, or a clear name, would prevent it.
2. **Partial rejection is silent.** As DEC-187 resigns, an address the server refuses among accepted ones leaves no trace. If an operator ever needs it, `info.rejected` is where it would come from.
3. **One field per address** (DEC-194 1(b)) stays possible without an API change, if per-address errors in the panel turn out to matter.
