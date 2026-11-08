```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b58522cf8b93971e2f3cf90bf4cc5e68e4398a589c9ed4faf07ae8a30972f18c
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 12/12
scenarios: 46/48
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres TEST_DB_NAME=zerodashboard_verify_ch46 npm run test:db
test_exit_code: 1
test_output_hash: sha256:a8a7ca04b6b1f2bc33decc26b08e0a0af19728e58510cc6a4002a2c2ad31852b
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:7c1e2620b9496a46f07127dae7af97f0979ae3e93a9468ec51b53dca56bfd382
```

# Verify report: CH-46 — Tenant dashboard

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 3 WARNING, 6 SUGGESTION). Verified 2026-11-08 on branch `ch46/tablero` at `0567c22` (PR #240), against `origin/master` at `fb99a5a`. Independent pass: the verifier did not write the code. Mode: Standard (`strict_tdd: false`). Counts follow native status (`### Requirement:` and `#### Scenario:` headings): domain-data-model 1/2, query-console 4/23, report-catalog 1/4, tenant-dashboard 4/14, tenant-isolation 2/5; total 12/48. The `gentle-ai sdd-verify-validate` step was not run because the brief forbids calling `gentle-ai`, so this envelope is not admitted by the validator. `evidence_revision` is the SHA-256 of `git diff origin/master...HEAD` (234,949 bytes).

## Commands
| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | exit 0 (`tsc -p tsconfig.json`, no diagnostics) |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres TEST_DB_NAME=zerodashboard_verify_ch46 npm run test:db` | exit 1; 2015 tests, 2011 pass, 4 fail, 0 cancelled, 0 skipped. The 4 failures are exactly the known environmental ones in `src/conexiones/conexiones.test.ts`: 5.1, 5.3, 5.4 and CH-07 («the registration response must not echo the submitted credential»). 26 tests named `CH-46` or inside CH-46 suites pass. |

About the test command. The brief's command is `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. The envelope's run adds `TEST_DB_NAME=zerodashboard_verify_ch46`, a scratch database that `scripts/test-db.mjs` created and migrated on port 5434 and that the verifier dropped afterwards. The reason is in W3 below: two earlier runs of the exact brief command on the shared `zerodashboard_test` were contaminated by the verifier's own stray concurrent run. Evidence of all three runs:

| Run | Database | Result |
|---|---|---|
| 1 | `zerodashboard_test`, concurrent with a stray second `test:db` started by mistake | 2015 tests, 2003 pass, 12 fail: the 4 known plus 8 scheduler-tick cases (`planificador.test.ts`, `aislamiento.test.ts:695` CH-14 5.11). Invalid evidence: two runs shared one database. |
| 2 | `zerodashboard_test`, alone, after killing the stray process | 2015 tests, 2010 pass, 5 fail: the 4 known plus `planificador.test.ts:913` CH-14 5.2 («2 !== 1»). A probe found one leftover automation row with the recipient `ch14-52@example.com` in that database, left by the killed run. The same case fails when run alone on that database. |
| 3 (envelope) | fresh `zerodashboard_verify_ch46` | 2015 tests, 2011 pass, 4 fail (the known four). |

CH-46 touches no file under `src/automatizaciones/`, so the fifth failure in run 2 is contamination, not a regression. Port 5432 was never used and `.env` was never read. Coverage: not available (no coverage tool configured). Not re-run: `npm run build:agente` and `npx prisma migrate status` (tasks 8.1 and 8.2 claim them; run 3 applied all migrations including `20261108000000_tablero` to an empty database, which proves the migration applies cleanly).

## Completeness
| Metric | Value |
|---|---|
| Tasks total | 23 (0.1; 1.1-1.2; 2.1-2.2; 3.1-3.6; 4.1-4.3; 5.1; 6.1-6.5; 7.1-7.2; 8.1-8.2) |
| Tasks complete | 23 |
| Tasks incomplete | 0 |

Each task was checked against the diff, not only the checkbox:
- 0.1: DEC-199 at `docs/01-decisiones.md:4221` (merged as #239, the base of this branch). Its three options, the cap of 8, the lock-free boolean use read and the "firm" status match the specs.
- 1.x: `prisma/schema.prisma:204-211` (`Tablero`, `Tenant.tablero`, `Conexion.tableros`) and `prisma/migrations/20261108000000_tablero/migration.sql` (unique index on `tenantId`, both foreign keys `ON DELETE RESTRICT`, rollback in the header, no DB default on `id`).
- 2.x: `aislamiento-prisma.ts:79-80` (`Tablero` in `MODELOS_AISLADOS`), `:241-278` (the two methods); tests at `aislamiento.test.ts:1349`, `:1517`, `:1978`, `:2003`, `:2021`.
- 3.x: `src/tablero/tablero.ts`, `tablero-rutas.ts`, `rutas.ts:127-132`, and the tests named in the tasks. Task 3.6 is `rutas.test.ts:95` plus `contexto-tenant.test.ts:384-407`.
- 4.x: `reportes-rutas.ts:239-319` (`UsoDeReportes`, `enUso`, 404/409/200), `rutas.ts:106-111`, and the CH-46 blocks of `reportes-rutas.test.ts:419-756`, including the race cases.
- 5.1 and 8.1: re-run above.
- 6.x: `consola.ts` markup (`nav-tablero` 280, `pantalla-tablero` 504, Reportes in-use markup 726-730 and 828), script block 7140-7497, `PANTALLAS` 7461, `mostrarPantalla` 7480, `cambiarTenant` 4391, `verReporte` 6171; both design-skill copies of `consola.md` and `pantallas.md` are byte-identical (`cmp`).
- 7.x: `docs/guia/09-reportes.md:92-128` (dashboard, pending views, report in use, routes) and `docs/02-mapa-de-changes.md:68` (row with DEC-199, `size:exception`, PR #240).
- 8.2: not re-run (see above).

## Spec compliance matrix

Paths are relative to `src/`. "tr" = `tablero/tablero-rutas.test.ts`, "t" = `tablero/tablero.test.ts`, "rr" = `reportes/reportes-rutas.test.ts`, "ais" = `aislamiento/aislamiento.test.ts`, "ct" = `aislamiento/contexto-tenant.test.ts`, "consola" = `consola/consola.test.ts`. All listed tests passed in runs 2 and 3.

### tenant-dashboard (4 requirements, 14 scenarios)
| Requirement | Scenario | Implementation | Test | Result |
|---|---|---|---|---|
| One Dashboard per Tenant | A tenant with no dashboard | `tablero-rutas.ts:99-103` | tr:124 (200, `conexionId` null, `reportes` []) | COMPLIANT |
| One Dashboard per Tenant | An empty dashboard is kept | `tablero-rutas.ts:42-44`, `tablero.ts:25-39` | tr:167 (save and read both answer the connection and []) | COMPLIANT |
| Read the Dashboard | Pending views | `tablero-rutas.ts:41-65`, `tablero.ts:46-49` | tr:130 (`r-2` has `pendientes` ["pedido"]), tr:159 (contract order) | COMPLIANT |
| Read the Dashboard | Nothing is executed | no agent registry, no dial in the module | tr:235 (audit row count unchanged; fixtures carry an unreadable credential, so any dial would fail the 200). See S1 | COMPLIANT |
| Save the Dashboard | Saving an ordered dashboard | `tablero-rutas.ts:76-95, 114-140` | tr:130 (save answers = GET answer, "r-2" before "r-1"), tr:147 | COMPLIANT |
| Save the Dashboard | Too many reports | `tablero.ts:32-37` (`maxItems` 8) | t:47 (9 ids give `/reportes`) | COMPLIANT |
| Save the Dashboard | A repeated report | `tablero.ts:35` (`uniqueItems`) | t:52 | COMPLIANT |
| Save the Dashboard | Another tenant's connection | `tablero-rutas.ts:122-125` (scoped `findUnique`) | tr:174 (B's id and an unknown id both 404, row unchanged, B gets no row); tr:202 (check order) | COMPLIANT |
| Save the Dashboard | An unknown report | `tablero-rutas.ts:79-85, 133-137` | tr:186 (`desconocidos` in body order, row unchanged) | COMPLIANT |
| Save the Dashboard | Unapproved views do not block | no refusal path for views | tr:130 (200 with `pendientes` ["pedido"]), tr:159 | COMPLIANT |
| Report Use Blocks Its Edit | A report on another tenant's dashboard | `reportes-rutas.ts:302-319`, `aislamiento-prisma.ts:263-277` | rr:581 (409 with tenant A and with no tenant; row equals the stored one) | COMPLIANT |
| Report Use Blocks Its Edit | A report that left every dashboard | same | rr:599 (save B with the id, save B with [], then 200) | COMPLIANT |
| Report Use Blocks Its Edit | The flag on read | `reportes-rutas.ts:289-293` | rr:568 (false, then true; no tenant or connection id in the body); rr:453 | COMPLIANT |
| Report Use Blocks Its Edit | An invalid body is refused first | `reportes-rutas.ts:307-310` | rr:616 (400 `/visualizacion` on a report in use); rr:487 (port never reached) | COMPLIANT |

### report-catalog (1 requirement, 4 scenarios)
| Requirement | Scenario | Implementation | Test | Result |
|---|---|---|---|---|
| Catalog Routes | Replace in place | `reportes-rutas.ts:302-319` | rr:362 (same id; the GET answer deep-equals the PUT answer, so `enUso` is false on both) | COMPLIANT |
| Catalog Routes | A report in use is not replaced | same | rr:581 (409, row unchanged); rr:470 (port outcomes map to 404, 409, 200) | COMPLIANT |
| Catalog Routes | No delete | no `DELETE` route | rr:405 (404, report remains) | COMPLIANT |
| Catalog Routes | No operator session | unchanged guard | rr:239 (401 on all routes) | COMPLIANT |

### tenant-isolation (2 requirements, 5 scenarios)
| Requirement | Scenario | Implementation | Test | Result |
|---|---|---|---|---|
| Tablero Is Tenant-Scoped | Two tenants never see each other's dashboard | `aislamiento-prisma.ts:80` | tr:210 (A's answer holds only A's data, no B tenant or connection id, B's row unchanged after A's save); ais:1978 (create takes the tenant from the context, B's row unreachable by id for read and write) | COMPLIANT |
| Tablero Is Tenant-Scoped | Another tenant's connection is refused | `tablero-rutas.ts:122-125` | tr:174 | COMPLIANT |
| Tablero Is Tenant-Scoped | Dashboard routes require a tenant | no exemption row in `contexto-tenant.ts` | tr:255 (400 `tenant-no-indicado` for GET and PUT with the real hooks); ct:384-407 (stub routes); `rutas.test.ts:95` (not in `EXENCIONES_OPERADOR`) | COMPLIANT |
| Report Use Is the Single Audited Unscoped Read | The answer reveals only a boolean | `aislamiento-prisma.ts:249-253` | ais:2003 (`true`, `false`, `false`, with and without a context) | COMPLIANT |
| Report Use Is the Single Audited Unscoped Read | No other unscoped access | raw `prisma.tablero` is touched only at `aislamiento-prisma.ts:249` and `:271` | ais:1517 (every other `Tablero` operation fails closed without a tenant, `upsert` refused); verifier's `rg` over `src/` found no other raw `Tablero` access | COMPLIANT |

### domain-data-model (1 requirement, 2 scenarios)
| Requirement | Scenario | Implementation | Test | Result |
|---|---|---|---|---|
| Tablero Is a Tenant-Scoped Model | One dashboard per tenant | `schema.prisma:206-207`, `migration.sql:22,25` (unique index `Tablero_tenantId_key`, FK to `Tenant`) | tr:147 (one row after two saves), tr:242 (two concurrent first saves leave one row). Neither asserts the constraint directly | PARTIAL |
| Tablero Is a Tenant-Scoped Model | The connection cannot vanish under a dashboard | `schema.prisma:209`, `migration.sql:28` (`ON DELETE RESTRICT`) | none (every `after()` hook deletes dashboards before connections, which is consistent with RESTRICT but does not assert it) | PARTIAL |

### query-console (4 requirements, 23 scenarios)
The console is exercised against the suite's fake DOM, not a real browser.
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Tenant Dashboard Screen | Loading a tenant's dashboard | consola:6285 (one `GET /tablero` with tenant `t-1`, rows in order, "food-store" selected) | COMPLIANT |
| Tenant Dashboard Screen | Reordering and saving | consola:6309 (one `PUT /tablero` with ids in the new order; moving back closes «Guardar») | COMPLIANT |
| Tenant Dashboard Screen | Pending views are shown but do not block | consola:6330 (line text, «Guardar» stays enabled, cleared on connection change) | COMPLIANT |
| Tenant Dashboard Screen | The cap | consola:6353 (select and «Agregar» disabled at 8, text asserted, reopened by «Quitar») | COMPLIANT |
| Tenant Dashboard Screen | No active tenant | consola:6273 (text asserted, no request) | COMPLIANT |
| Tenant Dashboard Screen | Markup in a title is text | consola:6432 (`<b>` verbatim, no element; also the select option) | COMPLIANT |
| Navigation by Hash | Default screen | consola:3999 | COMPLIANT |
| Navigation by Hash | Switching screens | consola:4007 | COMPLIANT |
| Navigation by Hash | Unknown hash | consola:4007 (`#no-existe` at 4013) | COMPLIANT |
| Navigation by Hash | The reports screen | consola:5758 | COMPLIANT |
| Navigation by Hash | The dashboard screen | consola:6269 (`soloVisible(…, 'tablero')`); order in consola:6251 and in `consola.ts:262-285` (conexiones, agentes, mapeo, usuarios, tablero, tiempos) | COMPLIANT |
| Reports Screen | Viewing a report | consola:5775 | COMPLIANT |
| Reports Screen | Testing with a declared period | consola:5819 | COMPLIANT |
| Reports Screen | A column is missing | consola:5851 | COMPLIANT |
| Reports Screen | No active tenant | consola:5883 | COMPLIANT |
| Reports Screen | Markup in a title is text | consola:5833 | COMPLIANT |
| Reports Screen | A report in use offers only duplication | consola:6465 (in use, and a missing `enUso`, show «Duplicar y editar» and the notice and hide «Editar»; a free report shows the opposite) | COMPLIANT |
| Report Pop-Up | Creating a bar report after a passing test | consola:5952 | COMPLIANT |
| Report Pop-Up | Changing the SQL after a test disables saving | consola:6019 | COMPLIANT |
| Report Pop-Up | Changing the visualization keeps saving enabled | consola:6078 | COMPLIANT |
| Report Pop-Up | A table with too many columns | consola:6097 | COMPLIANT |
| Report Pop-Up | Duplicating a report in use | consola:6483 (only `/conexiones` is read on open, name «… (copia)», every field, «Guardar» closed until its own test, then one `POST /reportes`) | COMPLIANT |
| Report Pop-Up | The report became in use while editing | consola:6514 (409 text asserted, pop-up open, «Duplicar y editar» offered) | COMPLIANT |

**Compliance summary**: 46/48 scenarios compliant, 2 partial, 0 untested, 0 failing. Requirements: 12/12 implemented; the two partial scenarios belong to one requirement whose behavior is also covered through the routes.

Behavior in the requirement text without a scenario, also covered: the three reads in request order, the catalog select excluding listed reports (consola:6285); «Guardar» opening for an empty dashboard once a connection is chosen (consola:6380); the 404, 400 `desconocidos`, 400 `campos`, 500 and network messages, with the screen kept as it was (consola:6393); legible read failures (consola:6411); a tenant switch discarding changes and reloading (consola:6443); the nav link, markup, header placement of «Guardar» and `type="button"` on every button (consola:6251).

## Correctness (static evidence)
| Area | Status | Evidence |
|---|---|---|
| Model and migration | Implemented | Additive table, unique `tenantId`, both FKs RESTRICT, rollback in the header, no DB default on `id` (as `Plantilla`) |
| Check order of `PUT /tablero` | Implemented | Shape (AJV, `attachValidation`) at `tablero-rutas.ts:118`, connection at `:122`, reports under lock at `:128`; tr:202 pins the order |
| Strict body | Implemented | `tablero.ts:25-39`: `additionalProperties:false` plus `propertyNames`, so a `tenantId` is refused, not stripped (t:56, tr:228) |
| Dashboard response | Implemented | `respuestaDe` returns `id`, `nombre`, `titulo`, `visualizacion`, `pendientes` and no SQL (tr:144) |
| Report use | Implemented | `GET /reportes/:id` adds a boolean; `PUT` goes through `reemplazarSiLibre`; body checks run first (`reportes-rutas.ts:307-310`) |
| Console | Implemented | Screen, ordering, cap, «Guardar» state, stale-answer token `generacionTablero`, in-use toggles, duplicate mode, 409 path |
| Docs | Implemented | Guide, map row with PR #240, design skill (both copies identical) |

## Rules and decisions
- **Rule 2 (tenant from the header or context, never the body).** `PUT /tablero` accepts only `conexionId` and `reportes`; a `tenantId` is a 400 naming `/tenantId` (t:56) and writes nothing (tr:228). The create takes the tenant from the context through `conTenantInyectado` (`tablero-rutas.ts:89`, ais:1978). `GET /tablero` reads no input. In `tr:174` and `:210` the scoped client is the only path to the dashboard and the connection. The `tx` client inside `$transaction` is scoped as well: tr:242 would otherwise update another tenant's row (count would not be 1).
- **The two unscoped `Tablero` operations.** `reporteEnUso` returns `Promise<boolean>`; `reemplazarReporteLibre` returns `'no-encontrado' | 'en-uso' | ReporteCompletoFila`, and ais:2021 pins the exact key list of the replaced report. The catalog routes reach them only through the `UsoDeReportes` port built at `rutas.ts:108-111`; a tenant-scoped client is never handed to the catalog. A search of `src/` (non-test, non-generated) finds raw `Tablero` access only at `aislamiento-prisma.ts:249` and `:271`.
- **The locks guard the race, with a test that proves it.** `PUT /tablero` takes `FOR KEY SHARE` on the named reports (`tablero-rutas.ts:79-80`); the replace takes `FOR UPDATE` (`aislamiento-prisma.ts:269`). rr:665 holds a hand-written `FOR KEY SHARE` plus an uncommitted dashboard insert, starts the real `PUT /reportes/:id`, asserts it is still pending after 750 ms (an ordinary row update does not conflict with `KEY SHARE`, so this fails if `FOR UPDATE` is removed), then releases and asserts 409 with the report unchanged. rr:693 does the mirror: a hand-written `FOR UPDATE` plus update, the real `PUT /tablero` must wait, then succeed holding the replaced statement (an unlocked `SELECT` would not wait, so this fails if `FOR KEY SHARE` is removed). rr:724 runs both together five times and checks the end state. Each production lock is therefore proven against a hand-written counterpart (see "What remains untested"). The verifier did not repeat the mutation check, because the brief forbids editing source; apply-progress records that removing `FOR KEY SHARE` made rr:693 fail.
- **Rule 4.** Both new `$queryRaw` calls are tagged templates with driver parameters: `WHERE "id" = ${id}` (`aislamiento-prisma.ts:269`) and `WHERE "id" = ANY(${ids})` (`tablero-rutas.ts:79`). No `$queryRawUnsafe`, `$executeRaw` or string concatenation was added.
- **`Tablero` in `MODELOS_AISLADOS`.** Yes (`aislamiento-prisma.ts:80`). The set is module-private, so it is pinned behaviorally: ais:1517 shows `findMany`, `findFirst`, `findUnique`, `create`, `update` and `deleteMany` throw `ErrorSinTenantActivo` with no tenant, and ais:1349 pins the model list.
- **`/tablero` is not exempt.** `contexto-tenant.ts` has no `tablero` entry (search), ct:384-407 and tr:255 show the 400 `tenant-no-indicado`, and `rutas.test.ts:95` shows both routes registered and absent from `EXENCIONES_OPERADOR`.
- **Rule 5 / DEC-93.** The dashboard stores only ids; no row, audit entry or SQL leaves in the answer (tr:144, tr:235).
- **Console guards.** Zero `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` in the added lines of `consola.ts`. Every added `zd-*` token is in markup (lines 280-830); none is in the script block (7140-7497). All 9 ids the CH-46 script looks up with `getElementById`, plus the markup ids `nav-tablero`, `pantalla-tablero`, `reporte-duplicar`, `reporte-en-uso-aviso` and `reporte-dialogo-duplicar`, are in the test's `IDS` list (consola.test.ts:269-312). Text goes through `textContent` and `createElement`; consola:6432 asserts `<b>` stays text.
- **No existing assertion was weakened.** Removed lines in the test diffs are only: imports and call signatures (`registerReporteRoutes` gained its port), the `IDS`/`IDS_OCULTOS`/`PANTALLAS` lists (extended, not shortened), one comment, and `const { id, ...campos } = creado;`, replaced by `const { id, enUso, ...campos } = creado;` plus `assert.equal(enUso, false)` (rr:286), which is stricter. The CH-45 console fixture `REPORTE_CH45` gained `enUso: false` as an addition.
- **Anti-scope.** No engine change, no panel route (DEC-199: CH-46 adds none), no Chart.js.

## Coherence (design) and deviations
| Decision | Followed? | Notes |
|---|---|---|
| Model and migration (§1) | Yes | Matches the design block and the task |
| Isolation, two methods, explicit lock on the dashboard side (§2) | Yes | `FOR KEY SHARE` in the save, `FOR UPDATE` in the replace |
| Find, then update or create; one retry on a unique-constraint race (§2) | Yes | `tablero-rutas.ts:87-92, 127-132`; tr:242 |
| Pure module and strict schema (§3) | Yes | |
| Registrar takes a port, wired in `rutas.ts` (§3) | Yes | |
| Console block, no new `zd-*` token in the script, design skill first (§4) | Yes | |
| Apply deviation U1-1: `ReporteResumen` and `ReporteCompleto` moved to `reportes.ts` | Acceptable | Avoids the import cycle through `plantillas-rutas.ts`; re-exported, as CH-38 did |
| Apply deviation U1-2: `POST` and successful `PUT /reportes` also answer `enUso: false` | Acceptable | Spec fixes `enUso` only for `GET`; the extra field is accurate and mirrors DEC-191. Existing test made stricter, not weaker |
| Apply deviation U1-3: `PUT /tablero` answer built from the saved values | Acceptable | Same body as `GET` (tr:130 deep-equals both) |
| Apply deviation U1-4: shape cases run through Fastify's AJV, so a bare string for `reportes` is wrapped, not refused | Acceptable, see S4 | No scenario depends on it; the spec says "an array of strings" |
| Apply deviation U2-1: «Guardar» in the header as the primary action | Acceptable | Follows the design skill's one-primary-action rule |
| Apply deviation U2-2: the three reads leave together with `Promise.all` | Acceptable | Request order kept (consola:6285 asserts it) |
| Apply deviation U2-3: after `409 reporte-en-uso`, «Duplicar y editar» keeps the passing test | Acceptable with a warning, see W1 | No scenario violated; the spec sentence about a "copy needs its own test" is general |
| Apply deviation U2-4: new id `reporte-dialogo-duplicar` | Acceptable | Registered in `IDS` |
| Apply deviation U2-5: `REPORTE_CH45` gained `enUso: false` | Acceptable | Addition only; needed because a missing `enUso` now reads as in use |

None of the deviations breaks a spec scenario.

## Issues found
**CRITICAL**: None.

**WARNING**
- **W1. The 409 path turns the edit into a copy without a new test, against the literal spec text.** `query-console/spec.md` says the copy "SHALL need its own passing test like a new report", and «Duplicar y editar» after a `409 reporte-en-uso` keeps «Guardar» enabled from the test of the same content (`consola.ts:6520-6530`, consola:6538 asserts `guardarAbiertoCH45` is true). The fingerprint (SQL, period, entities, connection) still matches, so the safety purpose of the test holds, and the template path (CH-38) does the same. No scenario forbids it, but the spec sentence and the code disagree. Reconcile the text at archive (say the rule applies to a copy opened from the side panel).
- **W2. The console has been proven only against the suite's fake DOM.** Layout, focus movement after «Subir», «Bajar» and «Quitar» (`consola.ts:7290-7305`), real `Intl` use and the actual `fetch` path were never run in a browser. This follows the project's choice not to run the manual visual pass, so it is stated as untested, not as a request to add one.
- **W3. The verifier left the shared test database with a stale row.** A stray second `test:db` started by mistake and later killed left at least one automation row (id `32098241-3405-44c0-adf5-74faa67d8b8d`, recipient `ch14-52@example.com`, tenant `be6add52-31e2-46b8-b755-5ce6ddfbaf88`) in `zerodashboard_test` on port 5434. Until it is removed, `planificador.test.ts:913` (CH-14 5.2) fails on that database («2 !== 1»), and other scheduler cases may too. This is not a CH-46 defect (run 3 on a fresh database passes everything except the known four), but the next `test:db` on `zerodashboard_test` will show a fifth failure. The verifier did not delete the row; the orchestrator should clean it or recreate that database.

**SUGGESTION**
- **S1. "Nothing is dialed" is proven by outcome, not by a spy.** tr:235 asserts the status and that no audit row appeared; the fixtures hold a non-envelope credential and the app has no agent registry, so a dial would fail the 200. No test counts connections opened. The same gap exists for CH-45 (S1 of its report).
- **S2. The two schema scenarios have no direct test.** Add one DB case that inserts a second `Tablero` for the same tenant (expects a unique violation) and deletes a `Conexion` that has a dashboard (expects a foreign-key violation). That would move both scenarios to COMPLIANT.
- **S3. A copied name can pass the 80-character cap.** `nombre + ' (copia)'` is assigned programmatically (`consola.ts:6481`), where the input's `maxlength="80"` does not apply; a name of 74 characters or more produces a `400 /nombre` on save, which the pop-up shows as «Revisá estos campos». It is legible, but untested and not mentioned in the spec.
- **S4. A bare string for `reportes` is accepted.** Fastify's AJV coerces `"r-1"` to `["r-1"]` (`coerceTypes: 'array'`), so `{"conexionId":"c","reportes":"r-1"}` saves a one-report dashboard although the spec says the field is an array. Recorded in apply-progress; low risk because the only client is the console.
- **S5. Stray untracked files in the repository root.** `git status` lists `0`, `0)`, `Para`, `[f.texto`, `` ` ``, `p.url` and `tolerancia` (likely shell redirections). They are not in the PR diff, but a `git add -A` would pick them up. Remove them before the next commit.
- **S6. Spec wording to sync at archive.** The `domain-data-model` spec says `id` is "generated" while the schema uses `@default(uuid())` with no database default (as `Plantilla`); the console texts in the spec lack the final period the code adds on some messages.

## What remains untested
- No real browser run of the console (W2).
- Production-lock against production-lock is never forced to interleave: rr:665 and rr:693 pair one production lock with a hand-written counterpart, and rr:724 starts both real routes together but cannot control the interleaving.
- No test asserts the unique index or the RESTRICT keys directly (S2).
- No spy-level proof that reading or saving a dashboard dials nothing (S1).
- `npm run build:agente` and `npx prisma migrate status` (tasks 8.1, 8.2) were not re-run; the migration applied cleanly to the fresh database in run 3.
- The `gentle-ai sdd-verify-validate` admission step was not run (forbidden by the brief).
- The 4 known `conexiones.test.ts` failures were not re-run on master; the brief records that they fail there too.

## Verdict
**PASS WITH WARNINGS.** All 12 requirements are implemented and 46 of 48 scenarios have a passing covering test, the other two being schema-inspection scenarios without a direct constraint test. All 23 tasks are done; the only failing tests on a clean database are the 4 known environmental ones; no existing assertion was weakened; rule 2, rule 4, the isolation boundary, the two unscoped operations, the locks and the console guards hold. The warnings are a spec sentence the 409 path does not follow, the lack of a real-browser run, and a stale row the verification left in the shared test database.

## Key Learnings
1. `FOR UPDATE` on `Reporte` conflicts with `FOR KEY SHARE` but not with the row lock of an ordinary `UPDATE`, so a test that proves the replace lock must hold a `FOR KEY SHARE` and expect the real `PUT /reportes/:id` to stay pending, not just to return 409.
2. Two concurrent `npm run test:db` runs on one database invalidate each other: the scheduler-tick tests count every due automation in the database, and a run killed mid-suite leaves rows that make later runs fail with «2 !== 1».
3. `scripts/test-db.mjs` creates and migrates any database name except `zerodashboard`, so `TEST_DB_NAME=<scratch>` gives a clean run on port 5434 without touching the shared `zerodashboard_test`.
4. The isolation extension's `$transaction` client is scoped too: the two-concurrent-first-saves test in `tablero-rutas.test.ts` asserts a count of 1 for a new tenant, which could not hold if `tx.tablero.findFirst` were unscoped.
5. `MODELOS_AISLADOS` is not exported, so «Tablero is scoped» can only be pinned by behavior: the `ErrorSinTenantActivo` case in `aislamiento.test.ts:1517` plus the model-list assertion.
