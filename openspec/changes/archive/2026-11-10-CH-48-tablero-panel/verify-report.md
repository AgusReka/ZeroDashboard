```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:02a2fdd730f3f6c47be0abfe91326c792c6629b8481a8c6fe0380eb38e6efb0e
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 17/17
scenarios: 66/67
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1
test_output_hash: sha256:276dfde49731aeb41e3707ef97a7aa7bf42e1f8cee35dbad99d53157f88dfc42
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:7c1e2620b9496a46f07127dae7af97f0979ae3e93a9468ec51b53dca56bfd382
```

# Verify report: CH-48 — Panel dashboard (Tablero)

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 3 WARNING, 6 SUGGESTION). Verified 2026-11-10 on `master` at `dc31163`, after the three chained PRs: CH-48a #250 (server), CH-48b #251 (page), CH-48c #252 (charts), plus the docs-only DEC PR #249. Independent pass: the verifier did not write the code. Mode: Standard (`strict_tdd: false`). Counts follow native status (`### Requirement:` and `#### Scenario:` headings) over the seven delta specs: 17 requirements and 67 scenarios (`client-panel-dashboard` 11/49, `client-panel-telegram` 1/4, `shared-visual-system` 1/5, `tenant-isolation` 1/3, `client-panel-automations` 1/2, `execution-audit` 1/2, `report-catalog` 1/2). `evidence_revision` is the SHA-256 of `git diff f8dc5a9..dc31163` (340,320 bytes; `f8dc5a9` is the merge before the DEC PR, so the base of `fc5dcf2` named in the brief would also pull in CH-47 and the first UX batch). `test_output_hash` and `build_output_hash` are the SHA-256 of the captured stdout and stderr of each command. Admission: as in the CH-46 and CH-47 reports, `gentle-ai sdd-verify-validate` requires `test_exit_code: 0` and N/N scenarios for a passing verdict. Both fields are left truthful here (`test_exit_code: 1` from the 4 known environmental failures plus 1 known intermittent flake that passes alone; `scenarios: 66/67` from the one PARTIAL scenario, W1). The orchestrator decides whether to settle on this report.

## Commands
| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | exit 0 (`tsc -p tsconfig.json`, no diagnostics) |
| `npm run build:agente` | exit 0 |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | exit 1; 2149 tests, 2144 pass, 5 fail, 0 cancelled, 0 skipped. The 5 failures: `conexiones.test.ts` 5.1, 5.3, 5.4 and CH-07 (known, test-password false positives), and `planificador.test.ts` "CH-14 5.7" (known intermittent flake). No other failure. |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres TEST_DB_NAME=zerodashboard_test DATABASE_URL=postgresql://zerodashboard:postgres@localhost:5434/zerodashboard_test npx tsx --test src/automatizaciones/planificador.test.ts` | exit 0; 64 tests, 64 pass, 0 fail (the flake did not repeat) |

The commands ran in the foreground (the long one in the background, but alone), one at a time, on the shared `zerodashboard_test` (port 5434). No second `test:db` was ever started and the dev database `zerodashboard` was never targeted by a test. The verifier wrote no data to the test database; the suites clean up after themselves. Coverage: not available (no coverage tool configured).

Browser check (optional, done): the verifier's own copy of the CDP script, port 9338 and its own profile under `scratchpad/verify48/`, against the running demo at `http://localhost:3000` (panel session logged in; only GET requests followed, no data changed beyond the session row the login creates). Results at 1280 and 390 px: four cards (number, bars, table, line); the two charts carry `role="img"` and a label naming the title and the range ("Lo más vendido: valores de 36 a 58."); the `<details>` are folded when drawn; table columns right-aligned only on numeric ones (`Pedidos#`, `Unidades#`); series `#0f6b5c`, ticks `#4a535c`, grid `#d1d7dc` in light; `data-theme=dark` and the system dark preference both re-tint to `#3ea38e` / `#b2bbc3` / `#22282e`, and back; a period change destroyed the old line chart (2 live charts to 1); with the Chart.js request absent (`chart: undefined`) there is no canvas and both tables are open; no page exceptions.

## Completeness
| Metric | Value |
|---|---|
| Tasks total | 32 (0.1; 1.1-1.5; 2.1-2.3; 3.1-3.5; 4.1-4.2; 5.1-5.4; 6.1-6.4; 7.1; 8.1-8.4; 9.1-9.2; 10.1) |
| Tasks complete | 32 |
| Tasks incomplete | 0 |

Checked against the diff, not only the checkbox. Task 9.2 was open at the end of CH-48c and was closed by `c169a46` (the map row now reads "PRs #250, #251 y #252"). 5.4: `diff -rq .claude/skills/zerodashboard-design .agents/skills/zerodashboard-design` is empty. 3.2: the two rows sit in `RUTAS_PANEL_PUBLICAS` with a CH-48 comment and the route is registered in `src/app/rutas.ts` after the Telegram routes.

## Spec compliance matrix
Paths are relative to `src/`. "t" = `panel/panel-tablero.test.ts`, "r" = `panel/panel-tablero-rutas.test.ts`, "p" = `panel/panel-tablero-pagina.test.ts`, "pn" = `panel/panel.test.ts`, "i" = `aislamiento/aislamiento-panel.test.ts`, "e" = `reportes/reporte-ejecucion.test.ts`. All listed tests passed in the `test:db` run.

### client-panel-dashboard (11 requirements, 49 scenarios)
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Dashboard Routes Are Session-Locked | No session | r `no cookie is 401 sesion-invalida on both routes, with no-store` | COMPLIANT |
| | The rows are exact | `aislamiento/contexto-tenant.test.ts` `CH-48 POST /api/panel/tablero`, `POST .../resultado` and `GET .../resultado/extra with no header is refused 400 tenant-no-indicado`; `app/rutas.test.ts` `CH-48 the two panel dashboard routes are registered and exempt`; `consola/consola-auth.test.ts` `CH-48 the two panel dashboard rows are exempt, and only they` | COMPLIANT |
| | Nothing is cached | r `the configuration lists the reports in dashboard order...` (no-store on 200), r `ok answers only the assigned columns...` (no-store), r `a full gate is 429...` | COMPLIANT |
| Read the Dashboard Configuration | Reports in dashboard order | r `the configuration lists the reports in dashboard order, with no technical field`; i `CH-48 each configuration lists only its own reports and freshness` | COMPLIANT |
| | No dashboard | r `no dashboard and an empty dashboard both answer no reports; a null freshness stays null` (tenant with none, tenant with an empty one) | COMPLIANT |
| | No technical field | r `the configuration lists the reports...` (checks `"nombre"`, `"sql"`, `"entidades"`, `"columnas"`, `"conexionId"`, assigned column names, view name, tenant id) | COMPLIANT |
| | Freshness never declared | r `no dashboard and an empty dashboard...` (`actualizadosEn: null`) | COMPLIANT |
| | Reading runs nothing | r `reading the configuration runs nothing: no run line` (see S1) | COMPLIANT |
| Run One Report | Another tenant's report | i `CH-48 B's own report requested from A's session is 404 and dials nothing` (with and without B's `X-Tenant-Id`) | COMPLIANT |
| | A report of the catalog not on the dashboard | r `a catalog report not on the dashboard, and an unknown id, are 404 reporte-no-encontrado` | COMPLIANT |
| | An undeclared period | r `an undeclared, malformed or extra query value is 400 /dias, and nothing runs` (15, 7.0, -7, repeated key, extra key); t `leerDiasDeConsulta` cases | COMPLIANT |
| | The default period | r `ok answers only the assigned columns, in order, with the default period` (30 when declared [30, 7]); e `no requested days is the first declared value...` | COMPLIANT |
| | A period on a report without one | r same 400 test (`stock?dias=7`) | COMPLIANT |
| Closed Result States | Unapproved views | r `unapproved views and a missing column are no-disponible, naming nothing` (`pedidos`) | COMPLIANT |
| | A renamed column | same test (`renombrada`) plus t `a missing assigned column is no-disponible, and the answer does not name it` | COMPLIANT |
| | A slow store | t `failures: tiempo-agotado in any phase, sin-conexion in the connection phase, else error` | COMPLIANT |
| | The store cannot be reached | same t test | COMPLIANT |
| | Zero rows | r `a table answers its rows; zero rows is sin-datos`; t `zero rows with every column present is sin-datos` | COMPLIANT |
| | A corrupt stored report | r `a corrupt stored report is no-disponible, logs one error line and runs nothing` | COMPLIANT |
| Projection to the Assigned Columns | Unassigned columns never leave | r `ok answers only the assigned columns...` (view returns `email`; `@correo.test` absent from the body); t `ok projects to the assigned columns in assignment order; an email column never leaves` | COMPLIANT |
| | A numeric string becomes a number | t `a numeric string value becomes a number; a non-numeric value is no-disponible` | COMPLIANT |
| | A non-numeric value in a chart | same t test | COMPLIANT |
| | A date label | t `a date label at midnight UTC is YYYY-MM-DD` | COMPLIANT |
| | The cap | e `the console audit and the panel null audit bind the same date and the same ceiling` (30 rows to 20, `corte: tope-de-filas`) plus t `corte is true when the engine cut at the cap`. No test runs 35 rows through the panel route to a 20-row answer with `corte: true` | PARTIAL (W1) |
| Per-Tenant Run Gate and Single-Flight | A fourth run waits | t `a fourth run of a tenant waits until one of the three ends; another tenant does not wait`; i `the run gate counts each tenant apart` (real routes, `pg_sleep`) | COMPLIANT |
| | Another tenant is not delayed | same two tests | COMPLIANT |
| | Beyond the queue | t `beyond three in flight and eight queued, a distinct run is lleno and never runs`; r `a full gate is 429 demasiadas-solicitudes, after every refusal` (injected gate) | COMPLIANT |
| | Identical requests share one run | t `identical requests share one run and one answer, and take no extra place` | COMPLIANT |
| | Nothing is kept after a run | t `nothing is kept after a run: the same request afterwards runs again`; t `an idle tenant leaves no record and no shared entry` | COMPLIANT |
| | A closed request is dropped | t `a queued run whose every request closed is dropped and never runs`; t `a run kept by one open request of two still runs` | COMPLIANT |
| | A failing run frees its slot | t `a run that throws frees its slot, rejects its waiters and the next queued run starts` | COMPLIANT |
| Panel Runs Leave a Closed Log Line | One closed line per run | r `a run writes no audit row and no error line, and one info line with the six closed fields` (exact key set, `filas` 2, no SQL, value, view or computed date in the log) | COMPLIANT |
| | No missing-operator error | same r test (`level >= 50` absent); `auditoria/auditoria-registro.test.ts` `CH-48 auditoria null writes no row and logs no error` | COMPLIANT |
| Freshness Line Is Information Only | A known update | p `freshness` cases (3 h, 25 min, under 1 min, 3 days, 47 h) and the assertion that the line delays no run | COMPLIANT |
| | An unknown update | p `freshness` case `null` | COMPLIANT |
| Dashboard Section of the Panel Page | Navigation appears only with reports | p `with no reports there is no nav and «Avisos» shows, as before`; p `a failing configuration (5xx or network) shows «Avisos» only` | COMPLIANT |
| | Default section | p `with reports «Tablero» is the default, and the hash switches the view and aria-current` | COMPLIANT |
| | At most three runs at a time | p `five reports: three requests at a time, in dashboard order; one ending lets the next start` | COMPLIANT |
| | One slow card does not block the others | p `a slow card does not block the others...` | COMPLIANT |
| | A failing card | p `«tiempo-agotado» shows its copy and «Reintentar»` (other card keeps `aria-busy`); p `«Reintentar» re-runs only its card` | COMPLIANT |
| | A number card | p `a number card shows the value in es-AR with the column title as label` (`1.520,5`) | COMPLIANT |
| | Markup in a value is text | p `markup in titles, descriptions and values stays text` | COMPLIANT |
| | No automatic refresh | p `there is no timer: once every card answered, nothing else is requested` | COMPLIANT |
| Period Select per Report | Changing the period re-runs one card | p `the select lists the declared days in order, starts on the default, and a change re-runs one card with dias` | COMPLIANT |
| | A report without a period | p `a report without a period has no select and sends no dias` | COMPLIANT |
| Charts and Their Accessible Table | A bar chart with its table | p `a bar card draws on a canvas with role img and a label, above a folded table of the same rows` | COMPLIANT |
| | The library did not load | p `without Chart.js a bar or line card shows its table open, under «Ver los datos en una tabla», and no canvas` | COMPLIANT |
| | Theme change | p `a theme change, from data-theme or from the system, re-reads the tokens and updates the chart`; p `the colors are the token values, trimmed, never a library palette` | COMPLIANT |
| | Re-running destroys the old chart | p `a period change destroys the chart before the new one is drawn, and a destroyed chart is not updated`; p `«Actualizar» destroys the charts of the cards it replaces` | COMPLIANT |

### tenant-isolation (1 requirement, 3 scenarios)
| Scenario | Test | Result |
|---|---|---|
| Two tenants, two dashboards | i `CH-48 each configuration lists only its own reports and freshness, whatever X-Tenant-Id says` | COMPLIANT |
| The shared report returns each tenant's rows | i `CH-48 the shared report returns each tenant's own rows, whatever X-Tenant-Id says` | COMPLIANT |
| A report of the other tenant's dashboard | i `CH-48 B's own report requested from A's session is 404 and dials nothing` | COMPLIANT |

### execution-audit (1 requirement, 2 scenarios)
| Scenario | Test | Result |
|---|---|---|
| A panel run writes no row | r `a run writes no audit row...` (A's `RegistroEjecucion` count unchanged); `auditoria-registro.test.ts` `CH-48 auditoria null...` | COMPLIANT |
| The console test still records | `reportes/reporte-prueba.test.ts` (unchanged file; asserts `origen` `reporte-prueba` rows); `auditoria-registro.test.ts` (console path still writes one row) | COMPLIANT |

### report-catalog (1 requirement, 2 scenarios)
| Scenario | Test | Result |
|---|---|---|
| The console test is unchanged | `reportes/reporte-prueba.test.ts` not in the diff and passing; `reportes/reportes-rutas.test.ts` untouched | COMPLIANT |
| The same date on both paths | e `the console audit and the panel null audit bind the same date and the same ceiling` (fixed clock, 7 days, `2026-11-02`, 20 rows plus the extra) | COMPLIANT |

### shared-visual-system (1 requirement, 5 scenarios)
| Scenario | Test | Result |
|---|---|---|
| The bytes are the pinned release | `compartido/estilos-rutas.test.ts` V1 (unchanged by CH-48; sha256 and banner) | COMPLIANT |
| The file is the loadable UMD build | same file, V2 | COMPLIANT |
| Line endings cannot rewrite the file | same file, V4 | COMPLIANT |
| The license travels with the copy | same file, V3 | COMPLIANT |
| Only the authenticated panel shell loads it | pn `CH-48c Chart.js: only the authenticated shell loads it, once, right before the dashboard script` (asserts one occurrence, before the dashboard script, no other external script after it, and the login page does not carry it) | COMPLIANT |

### client-panel-telegram (1 requirement, 4 scenarios)
| Scenario | Test | Result |
|---|---|---|
| Linking from the card | pn `CH-43 P-07: creating a code shows it through textContent, a 409 repaints as unavailable, and unlinking asks first` | COMPLIANT |
| Unlinking asks first | same test (`DELETE` absent until the confirm button) | COMPLIANT |
| The card fails without breaking the list | pn `CH-43 P-07: a failing card shows its own error with «Reintentar» and the list still loads` | COMPLIANT |
| The card follows the list | pn `CH-43 P-07: the «Avisos por Telegram» card sits below the list (CH-48)...` (changed in this diff, see "Existing assertions") | COMPLIANT |

### client-panel-automations (1 requirement, 2 scenarios)
| Scenario | Test | Result |
|---|---|---|
| Copy and page contain no glossary-forbidden term | pn `the P-02 screen has no glossary-forbidden term in visible text or script string literals (CH-22b)` (now also scans `SCRIPT_TABLERO` literals); p `the script is safe to embed in the page template and its literals pass the glossary`; p `card states` (each copy runs through `terminosProhibidosEn`) | COMPLIANT |
| Automations never show a stored result | `panel/panel-automatizaciones.test.ts` (item keys limited to `fecha`, `resultado`); pn assertion on the card text «Se completó — 05/11, 08:00» (date and business text only) | COMPLIANT |

**Compliance summary**: 66/67 scenarios compliant, 1 partial (W1), 0 untested, 0 failing. Requirements: 17/17 implemented.

## Rules and decisions
- **Rule 2 (tenant only from the session).** The two routes read the tenant from `request.sesionPanel` and nowhere else; `rg` over `panel-tablero*.ts` and `reporte-ejecucion.ts` finds no use of `request.headers`, `x-tenant`, `request.body` or a tenant in the query. The only client inputs are `:reporteId` and `dias`; the id is checked against the session tenant's scoped `Tablero` (`findFirst`), and the connection is the dashboard's `conexionId`. `Reporte` and `Tenant` are global tables read by an id taken from the scoped dashboard or from the session. The page script names no tenant (verified by the `no request carries a tenant identifier, a header or a body` test).
- **The automated two-tenant test is real.** Read critically: `i` (`aislamiento-panel.test.ts`, 250 added lines) builds two real tenants, users and panel sessions in the live test DB, each with its own connection and its own approved view of distinct literal `VALUES` rows (`a-uno, a-dos` against `b-uno`), one shared report, one B-only report titled with a random token, and different freshness dates. It mounts the real `registrarContextoTenant` hooks and the real isolated Prisma client, and sends every request from each session also with the other tenant's `X-Tenant-Id`, asserting the body is byte-identical to the answer without it. It asserts the rows, the freshness date, absence of the other tenant's id, rows, title and date, a 404 for B's report from A (with and without B's header) with no `panel report run` line, and a gate test with real 2 s `pg_sleep` runs showing three A runs in flight do not delay B while A's fourth waits. A route that took the tenant from the header would fail the `conCabecera.body === base.body` and rows assertions, so the test can fail for the right reason. Limits noted as S2 and S3.
- **Rule 5 (only assigned columns leave).** `respuestaDeEjecucion` builds each row from the assigned indexes only; the full rows never leave the function. The route test returns an `email` column and asserts `@correo.test` is absent; the unit test asserts the same and the exact two-value rows.
- **DEC-93 (nothing persisted).** No `localStorage`, `sessionStorage`, `indexedDB`, `setInterval`, `setTimeout` or cookie write in the page script; no `create/update/delete/upsert` and no `registrarEjecucion` in the new server files; the single-flight entry is deleted when its run settles (`ocupacion()` test shows no record left); `Cache-Control: no-store` is set in an `onRequest` hook, so the session hook's 401 carries it too (tested).
- **DEC-202.** `auditoria: null` skips `registrarEjecucion` and the "audit skipped" line (the `auditoria-registro` test checks no row and no `audit skipped: no operator` line); the route test checks A's `RegistroEjecucion` count is unchanged. The `info` line has exactly `tenantId`, `reporteId`, `conexionId`, `estado`, `filas`, `duracionMs` (the test compares the key set after removing pino's own keys) and the log text holds no row value, view name or computed date.
- **Exempt route rows are exact.** `RUTAS_PANEL_PUBLICAS` gains exactly `GET /api/panel/tablero` and `GET /api/panel/tablero/:reporteId/resultado`. A `POST` on either and a longer path stay `400 tenant-no-indicado` (contexto-tenant test) and stay operator-guarded (consola-auth test); the derived count `4 + ESTILOS_EXENTOS.size + RUTAS_PANEL_PUBLICAS.size` still holds.
- **The per-tenant gate is tested** at three levels: pure (`t`, 3 in flight, 8 queued, `'lleno'`, join, drop, throw, idle cleanup), through the route with an injected gate (`r`, 429 `demasiadas-solicitudes` after every refusal), and end to end with real timing (`i`). The 429 on the real default gate (3 in flight, 8 queued, one more distinct request) is not driven through the route; the unit test covers that bound.
- **Panel copy has no technical terms.** The glossary regex of `panel.test.ts` now scans `SCRIPT_TABLERO`'s string literals; `p` runs every state copy, the freshness lines and the static markup through `terminosProhibidosEn`. A manual `rg` of `panel-tablero-pagina.ts` for `tenant|cron|sql|consulta|query|ejecuci|réplica|parámetro|timeout|plantilla` finds only the word "tenant" in a header comment.
- **Data reaches the DOM only through `textContent` or canvas.** `rg` for `innerHTML|outerHTML|insertAdjacent|document.write|eval|new Function` in `panel-tablero-pagina.ts` and `panel.ts` finds nothing. Text is set by `nodo(...)` (`textContent`), `setAttribute` (labels, `scope`, `for`) and Chart.js (canvas). Server links are not built. The only `.value` writes are the select's own `value` and option values from numbers.
- **No SQL, no engine change** (rules 1, 3, 4, 6). The panel sends no SQL; the date is computed by the server and bound as a driver parameter in the shared `ejecutarReporte`, which also keeps `topeEfectivo` and `limite = tope + 1`. The engine path gains only the `auditoria: null` branch.
- **Existing assertions.** No test assertion was weakened. The diff removes three assertion lines, all justified by the specs: (1) `panel.test.ts` "Salir is the only static control outside the Telegram card" now removes «Actualizar» as well as «Salir» before the same `!/<button/` check (the spec adds one static control); (2) the P-07 assertion "the card goes above the list" is replaced by "below the list", inside «Avisos» and inside `<main>`, as the modified Telegram requirement says; (3) the glossary scan's literal list is extended with `SCRIPT_TABLERO` (stricter). `reporte-prueba.test.ts` is unchanged.

## Correctness (static evidence)
| Area | Status | Evidence |
|---|---|---|
| Shared run | Implemented | `reporte-ejecucion.ts` (`diasDelPedido`, `ejecutarReporte`); `probarReporte` calls it with the `reporte-prueba` audit and keeps its answers |
| Gate | Implemented | `crearCompuerta`: join by key `tenant|report|days`, FIFO queue, `lleno`, drop of closed runs, slot released in `finally`, empty tenant record deleted |
| Routes | Implemented | Hook order `onRequest` no-store, then session hook; refusals before the gate; connection from the dashboard |
| Projection | Implemented | Index-based, `valor` through `aNumero`, dates and `bigint` normalized |
| Page | Implemented | Queue of 3, generation counter drops stale answers, `descartada` cards ignored after «Actualizar», no timer |
| Charts | Implemented | One series, token colors via `getComputedStyle`, `matchMedia` and `MutationObserver` re-tint, `destroy` in `vaciar`, folded `<details>` or open table without `Chart` |
| Docs | Implemented | Guide section, P-08 in both skill copies (identical), map row with #250, #251, #252 |

## Coherence (design) and deviations
Apply-progress lists the deviations; each was checked against the code.
| Decision | Followed? | Notes |
|---|---|---|
| §1.4 `sigueAbierto` on the request | Changed, acceptable | Uses `reply.raw` because `request.raw.destroyed` is already true once a GET body is read (verified by the author on Node 24); the dropped-run test exercises the gate, the route passes the response check |
| `Compuerta.pedir` resolves `DESCARTADO` | Acceptable | Answers `{ estado: 'error' }` to a request that already closed |
| Single-flight key uses resolved days | Acceptable | A request with no `dias` and one with the default share a run, which is the intent |
| 400 for a malformed `dias` before the 404 | Deviation from the spec text | See W2 |
| `no-disponible` copy | Matches design §2.4 and the guide, differs from the spec wording | See W3 |
| Script wrapped in its own function | Acceptable | Two classic scripts share one global scope; the automations script stays last (tested) |
| Cut line uses the rows received as N | Acceptable | See S4 |
| `Chart` failure or non-number value falls back to the open table | Acceptable | Tested (`a value that is not a number, or a Chart.js that throws, leaves the table open`) |

## Issues

### CRITICAL
None.

### WARNING
- **W1. The "cap" scenario has no single covering test.** "A `barras` report whose statement returns 35 rows: the answer holds 20 rows and `corte` true" is covered only by composition: the live engine run in `reporte-ejecucion.test.ts` (30 rows asked for, 20 returned, `corte: 'tope-de-filas'`) and a unit test of `respuestaDeEjecucion` with one row and `corte` set. No route-level test sends a 35-row view through the panel route and reads 20 rows plus `corte: true`. Marked PARTIAL; behaviorally sound.
- **W2. The refusal order differs from the spec in one combined case.** The spec says the 404 check comes first and the `dias` check second. The route runs `leerDiasDeConsulta` (digits only, no extra key) before the 404, so an unknown or foreign report id sent with a malformed `dias` (for example `?dias=abc`) answers 400, not 404. Both answer before anything is dialed, and the 400 is the same for existing and non-existing ids, so there is no existence leak and rule 2 holds. Documented in apply-progress, matches design §1.5 step 1, untested. Align the spec text or the code.
- **W3. The `no-disponible` copy and the spec disagree.** The spec says the card tells the client that "the team is told, with no action for the client". The shipped copy (design §2.4, the guide and the page test agree with each other) is «No podemos mostrar este reporte por ahora.» / «Si sigue así, avisale a quien te dio acceso.», which asks the client to tell someone. Nothing tells the team: only a corrupt stored report logs an `error` line; unapproved views and a missing column leave only the `info` line with `estado: 'no-disponible'`. Reconcile the spec with the copy, or decide whether the team should be told.

### SUGGESTION
- **S1. "Nothing is dialed" is proved indirectly.** The 401, 404 and 400 tests check the answer and the absence of a `panel report run` line, not a spy on the engine; the order in the code makes it true. "Reading runs nothing" does not assert the `RegistroEjecucion` count on the configuration route either.
- **S2. The gate isolation test depends on wall-clock thresholds** (`msB < 1500`, fourth run `>= 3000` ms, four 2 s `pg_sleep` runs, about 6 s of test time). It passed here; on a loaded machine B's bound could flake.
- **S3. The isolation test shares one database server and role between the tenants.** Each tenant has its own connection row and view rows, and the literal `VALUES` make the rows distinct, which is enough to prove the application's scoping; it does not prove isolation of a real external replica (out of scope by design).
- **S4. Spec and code differ on N in «Mostramos solo los primeros N resultados.»** The spec says N is the cap of the visualization; the page uses the number of rows received, which equals the effective cap when `corte` holds and is lower only when `maxFilasPorConsulta` is below the visualization's cap. Update the spec wording (documented deviation in apply-progress).
- **S5. The `warn` line of a failed panel run is untested.** The requirement says a failed run also logs the sanitized `warn` line of the engine path; the code does it through `ejecutarSobreVistas` with the message `panel report execution failed`, but no panel test asserts it, nor that it carries no SQL.
- **S6. `docs/guia/09-reportes.md` line 5 is stale.** It still says "La pantalla del panel es CH-48: hasta entonces, ningún cliente ve un reporte.", while the new section below describes what the client sees. Edit it to the past tense.
