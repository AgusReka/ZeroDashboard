# Apply Progress: CH-13 — Engine: Scheduling and Execution

Mode: Standard (strict_tdd: false), RED/GREEN order from tasks.md followed. Delivery: auto-chain, stacked-to-main.

## Completed

| Unit | Tasks | Branch | Commits |
|---|---|---|---|
| 1 Schema, isolation, config, dependency | 1.1–1.9 | `ch13/1-esquema-aislamiento-config` (base `master`) | `c12912f`, `c928e9a`, `bbc9100` |
| 2a Pure module: cron validity, due window | 2.1, 2.2, 2.4–2.5 (that half) | `ch13/2a-cron-ventana` (base unit 1) | `85e4b87` |
| 2b Pure module: close-of-run mapping | 2.3, 2.4–2.5 (that half) | `ch13/2b-cierre-ejecucion` (base unit 2a) | `b6f7f42`, `52e1e8b` |
| 3a Automation create route + registration | 3.1, 3.2, 3.3, 3.7; 3.6 create half | `ch13/3a-alta-automatizacion` (base unit 2b; renamed from `ch13/3-rutas-automatizacion`) | `9d1f0b1` |
| 3b Automation list, get, `desactivar` | 3.4, 3.5, 3.8; 3.6 list/get/`desactivar` half | `ch13/3b-consulta-desactivar` (base unit 3a) | see `git log 9d1f0b1..ch13/3b-consulta-desactivar` |
| 4a Scheduler tick: due check, tenant context, gate | 4.1–4.4; 4.8 `Reloj`/`ejecutarTick`/run-pipeline half | `ch13/4a-planificador` (base unit 3b) | `42ab413` |
| 4b Timer, per-run catch, run log, server wiring | 4.5–4.7, 4.9, 4.10; 4.8 rest | `ch13/4b-planificador-ciclo` (base unit 4a) | see `git log 42ab413..ch13/4b-planificador-ciclo` |
| 5 Runs route + T2 sweep extension | 5.1–5.4 | `ch13/5-rutas-ejecuciones-t2` (base unit 4b, `4c6a60f`) | `253a11a` (unit 4b bookkeeping, moved out of the 4b slice to keep it under budget), then the unit 5 commit |
| 6a Console: list, deactivate, runs, tenant switch | 6.2–6.4; 6.1 list half; 6.5 all but the create form | `ch13/6a-consola-lectura` (base unit 5, `91c2ca8`; renamed from `ch13/6-consola`) | `fa4ffde` |
| 6b Console: create form | 6.1 create half; 6.5 create form; 6.6 | `ch13/6b-consola-alta` (base unit 6a, `fa4ffde`) | see `git log fa4ffde..ch13/6b-consola-alta` |

Unit 2 was one apply batch, split afterwards by the orchestrator into 2a and 2b with identical
final code. Unit 3 was cut into 3a and 3b to fit the 400-line budget (the whole phase measured 520).

Remaining: Phase 7.

## Unit 1 Evidence

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/aislamiento.test.ts src/config.test.ts`: 37 tests, 37 pass, 0 fail (live-PG describe skipped: no server at localhost:5432) |
| RED observed | 1.4: 2 fail (`PrismaClientKnownRequestError` instead of `ErrorSinTenantActivo`); 1.7: module has no export `DEFAULT_ZONA_HORARIA` |
| Full suite | `npm test`: 299 tests, 299 pass, 0 fail |
| Runtime harness | N/A — schema/config only, no scheduler yet |
| Rollback boundary | `DROP TABLE "Ejecucion"; DROP TABLE "Automatizacion";`; revert the three commits above (dependency, models + `MODELOS_AISLADOS`, `zonaHoraria`) |

## Unit 2 Evidence

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/automatizaciones.test.ts`: 24 tests, 24 pass, 0 fail |
| RED observed | Before `src/automatizaciones.ts` existed: the file failed with `ERR_MODULE_NOT_FOUND` for `./automatizaciones.js` |
| Typecheck / build | `npx tsc --noEmit`: clean; `npm run build`: exit 0 |
| Full suite | `npm test`: exit 1 — 504 tests, 323 pass, 19 fail, 162 cancelled. Environmental and pre-existing: the same 19 fail / 162 cancelled on the base tree without the two new files (299 pass). A PostgreSQL server now accepts connections on the live-PG test port and rejects the test credentials with SQLSTATE `28P01`, so the live-PG suites (`aislamiento`, `vistas-canonicas`, …) run instead of skipping and fail in their setup hooks. In unit 1 no server was listening and those suites skipped. |
| Runtime harness | N/A — pure functions, no database, no process boundary |
| Rollback boundary | Delete `src/automatizaciones.ts` and `src/automatizaciones.test.ts`; nothing consumes them yet |

### Unit 2 implementation notes

- `cronValido(cron, zona)`: exactly five whitespace-separated fields; per-field allowlist of digits, `*`, `,`, `-`, `/`, plus three-letter month names (month field only) and day names (day-of-week field only). This refuses `@aliases`, a seconds field, and the library's non-standard extensions (`H`, `L`, `#`, `?`) that `cron-parser` 5.10.1 otherwise accepts. The library then rejects out-of-range values, `*/0`, inverted ranges, and impossible dates (`0 0 30 2 *`). An unknown `zona` makes every expression invalid. Probed empirically against 5.10.1: `""` and `H * * * *` parse successfully in the library, which is why the shape check runs first.
- `estaVencida(cron, desde, hasta, zona)`: due when `next(desde) <= hasta`; `next()` is strictly after `currentDate` (verified: a fire exactly at `desde` is excluded), so the window is `(desde, hasta]`. The caller passes `desde = max(window start, creadaEn)` as the design states. A stored expression that fails the shape check throws (fail closed, like `leerEntidades` in `plantillas.ts`); the scheduler will record it as `error-interno`.
- `cierreDeResultado` takes `ResultadoCorrida = ResultadoEjecucion | RechazoPreparacion | FalloInesperado`, not only `ResultadoEjecucion` as the design's signature line shows, because task 2.3 requires gate refusal, `valores-invalidos`, and unexpected throws to be mapped too. It returns `CierreEjecucion` = `{estado, filas, corte, fase, error, codigoError}`; timestamps and `duracionMs` stay with the scheduler's injected clock.
- Mapping: ok → `estado ok`, `filas` = row count, `corte`, `fase ejecucion`; execution failure → its `fase`, its closed `categoria` as `error`, `codigoError` = `codigoPublicable(codigo)` (re-gated); pre-dial refusal → `fase preparacion` with `vista-canonica-no-aprobada` | `valores-invalidos` | `conexion-no-encontrada` | `credencial-ilegible`; unexpected throw → `fase null`, `error-interno`, the thrown value is never read. Every branch builds a fresh object and never spreads its input.
- Spec `execution-log` requires a gate refusal to name the ungated entity, and `Ejecucion` only has `error`/`codigoError`. The entity names go in `codigoError` (comma-joined, contract order as `evaluarVistas` returns them), filtered against `CONTRATO_CANONICO` names, so only closed text reaches the row. Units 4 and 6 should read `codigoError` that way for `vista-canonica-no-aprobada` rows.

## Unit 3a Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/automatizaciones-rutas.test.ts`: 5 tests, 5 pass, 0 fail, 0 skipped |
| RED observed | Before `src/automatizaciones-rutas.ts` existed: `ERR_MODULE_NOT_FOUND` for `./automatizaciones-rutas.js` |
| Typecheck | `npx tsc --noEmit`: clean |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0 — 509 tests, 509 pass, 0 fail, 0 skipped (baseline 504 + 5), three runs. One earlier run showed 506: under full-suite load the 1000 ms TCP probe timed out and skipped this file's live describe as a suite (pre-existing probe pattern) |
| Runtime harness | `app.inject()` against the live test PostgreSQL on port 5434: two tenants, a template with one required `texto` parameter, one connection per tenant |
| Rollback boundary | Delete `src/automatizaciones-rutas.ts` and its test; remove the import and the `registerAutomatizacionRoutes` call in `src/server.ts` |

### Unit 3a implementation notes

- `registerAutomatizacionRoutes(app, prisma, zonaHoraria)`: the zone comes from `server.ts`'s one `loadConfig()`, so the create-time cron check uses the zone the scheduler will use. The design left the registrar signature open; this is an implementation detail, not a new decision.
- Create order: strict AJV (`propertyNames`; `tenantId` or `activo` in the body is `400`) → `cronValido` (`400 campos ['/cron']`, before any read) → global `plantilla.findUnique` (`404 plantilla-no-encontrada`) → scoped `conexion.findUnique` (`404 conexion-no-encontrada`) → `prepararSentencia(sanearSql(plantilla.sql), plantilla.parametros, valores)` (`400 {campos, problemas}`, the test route's envelope) → `create` with `conTenantInyectado`; `activo` is left to the schema default.
- `valores` is cast to `Prisma.InputJsonObject` on create; sound because `prepararSentencia` has just accepted every key as declared and every value as a string, finite number or boolean.
- `AutomatizacionResumen` (no `valores`) and `AutomatizacionCompleta` are already exported for 3b's list and get/`desactivar`.
- 3b plan (delivered in unit 3b below): list, get and `desactivar`, taken from the batch that had written and passed them once before the cut.

## Unit 3b Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/automatizaciones-rutas.test.ts`: 7 tests, 7 pass, 0 fail, 0 skipped |
| RED observed | With the tests extended and the handlers absent: 3 fail, 4 pass — `hasRoute` false for `GET /automatizaciones`; `GET /automatizaciones/:id` answered Fastify's `404 Route ... not found` instead of `200` / `404 automatizacion-no-encontrada` |
| Typecheck | `npx tsc --noEmit`: clean |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0 — 511 tests, 511 pass, 0 fail (baseline 509 + 2 new tests; the 3.1 no-header test was extended in place), runs 1 and 3. Run 2 reported 501/501: the pre-existing 1000 ms TCP probe timed out under load and skipped the two CH-12 `plantilla-prueba` live describes (`# no PostgreSQL server at localhost:5434`), not this file |
| Runtime harness | `app.inject()` against the live test PostgreSQL on port 5434: two tenants, one template, one connection per tenant; create, get, deactivate twice, list from A and from B, foreign and unknown ids from B |
| Rollback boundary | Remove the three handlers, `AutomatizacionParams` and the `LIMITE_LISTADO` import from `src/automatizaciones-rutas.ts`, and the two 3.4/3.5 tests plus the three extra 3.1 rows from its test; the create route and its registration stay |

### Unit 3b implementation notes

- `GET /automatizaciones`: `AutomatizacionResumen` (no `valores`), `orderBy [creadaEn desc, id asc]`, `take LIMITE_LISTADO + 1` to decide `truncado` in one query; deactivated rows included (DEC-79).
- `GET /automatizaciones/:id`: `AutomatizacionCompleta`; scoped `findUnique`, so a foreign id is `404 automatizacion-no-encontrada`, the same as an unknown one.
- `POST /automatizaciones/:id/desactivar`: mirrors `/tenants/:id/baja` — read first (`404`), `409 automatizacion-desactivada` when already inactive, then `update {activo: false}` returning `AutomatizacionCompleta`. No route writes `activo: true`.
- Tests assert, via `hasRoute`, that all four routes exist and that no `PUT`/`PATCH`/`DELETE /automatizaciones/:id` or `POST /automatizaciones/:id/activar` exists; a foreign id is `404` for tenant B on get and `desactivar` and A's row stays active.
- No deviation from design; no new architecture decision.

## Unit 4a Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts`: 4 tests, 4 pass, 0 fail, 0 skipped |
| RED observed | Before `src/planificador.ts` existed: `ERR_MODULE_NOT_FOUND` for `./planificador.js` |
| Typecheck | `npx tsc --noEmit`: clean |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0 — 515 tests, 515 pass, 0 fail, 0 skipped (baseline 511 + 4), two runs, no probe skips |
| Runtime harness | `ejecutarTick` with a fake `Reloj` against the live test PostgreSQL on port 5434: two active tenants and one inactive, fixture automations "created" in 2020 and ticked over 2021 windows; every fixture connection points at `127.0.0.1:1`, so a run that reached the driver closes as a `conexion` failure |
| Rollback boundary | Delete `src/planificador.ts` and `src/planificador.test.ts`; nothing imports them yet (`server.ts` wiring is 4.9, unit 4b) |
| Review budget | 422 changed lines of code and tests vs `0a8f987`; no cohesive further cut (4.3 needs the gate and the `Ejecucion` write). The user accepted the slice as `size:exception` at 458 changed lines |

### Unit 4a implementation notes

- `crearPlanificador({prisma, zonaHoraria, log, reloj?})` returns only `ejecutarTick` for now; 4b adds `iniciar`/`detener`. The window's lower edge is initialised from `reloj.ahora()` when the scheduler is built (no catch-up, DEC-75) and moved to `ahora` at the start of each tick.
- Tick: `tenant.findMany({activo: true})` (unscoped model) → per tenant `conTenantActivo({id, nombre}, …)` with the tenant built only from that row → scoped `automatizacion.findMany({activo: true})` → `estaVencida(cron, max(desde, creadaEn), ahora, zona)` → sequential runs. Every query is awaited inside the callback.
- Run: `ejecucion.create` `en-curso` with `iniciadaEn` from the clock (`conTenantInyectado`, no `tenantId` written) → global `plantilla.findUniqueOrThrow` → scoped `vistaCanonica.findMany({conexionId})` → `evaluarVistas` → `componerSentencia` → `prepararSentencia` (values re-checked every run) → `destinoDeConexion` (`ErrorCredencialIlegible` → `credencial-ilegible`, `null` → `conexion-no-encontrada`) → `ejecutarConsulta` with `limite = topeFilas = loadConfig().maxFilasPorConsulta`, `desplazamiento = 0` → `ejecucion.update` with `cierreDeResultado`, `finalizadaEn`, `duracionMs`. A failure logs `{automatizacionId, fase, error, codigoError}` only.
- An unexpected throw left the row `en-curso` and stopped the tick in 4a; unit 4b adds the per-run catch.
- Test isolation: `tenant.findMany` sees every active tenant in the shared test DB, including other files' fixtures. Their automations have a real `creadaEn`, so `max(desde, creadaEn)` is after every 2021 window and they are never due in these ticks.

## Unit 4b Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts`: 10 tests, 10 pass, 0 fail, 0 skipped |
| RED observed | With the tests extended and the code absent: 6 fail, 4 pass — 4.5/4.6 threw `estaVencida: horario almacenado fuera de cron estándar` out of the tick; 4.7 `iniciar is not a function` |
| Typecheck / build | `npx tsc --noEmit`: clean; `npm run build`: exit 0 |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0 — 521 tests, 521 pass, 0 fail, 0 skipped (baseline 515 + 6), two runs; the process exits on its own (~9 s). No test imports `server.ts`, and the 4.7 tests use a fake `Reloj`, so no real timer is armed |
| Runtime harness | Live PG on 5434: one tenant with four automations (read-only role `ch13_lector` on the live server → `ok`; gate refusal; closed port; corrupt template entities → `error-interno`) and one with a corrupt cron ahead of a sibling; timer over a fake client and a fake `Reloj` |
| Rollback boundary | Remove the `crearPlanificador`/`onClose`/`iniciar()` lines in `src/server.ts` (stops every run) and the Compose variable; then revert the 4b part of `src/planificador.ts` and its tests |
| Review budget | 379 changed lines of code, tests and Compose vs `42ab413`, plus these artifact updates |

### Unit 4b implementation notes

- Timer: `iniciar` arms `reloj.programar` for the next `hh:mm:01` (`hastaElProximoTick`); `disparar` runs `ejecutarTick(reloj.ahora())`, logs a tick-level throw by class name only, and re-arms in `finally` unless stopped. `detener` sets `detenido`, cancels the pending timer, awaits the in-flight tick. `iniciar` after `detener` is a no-op.
- Per-run catch: a pipeline throw closes the open row as `error-interno` (`fase null`, `codigoError null`) and siblings continue. A stored cron that `estaVencida` cannot read is treated as due and recorded the same way, as `automatizaciones.ts` documents; such an automation writes one `error-interno` row per tick (creation refuses such crons, so only corruption reaches it). If the row writes themselves throw, the run is logged (`error-interno`, class name) and the loop continues.
- `server.ts`: the scheduler is built next to `prisma` with `config.zonaHoraria` and `app.log`; `onClose` awaits `detener()`; `iniciar()` runs in `listen().then`.
- `docker-compose.yml` forwards `ZONA_HORARIA_AUTOMATIZACIONES: ${ZONA_HORARIA_AUTOMATIZACIONES:-}`; empty falls back to `UTC` in `config.ts`.
- No deviation from design; no new architecture decision.

## Unit 5 Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/aislamiento.test.ts src/automatizaciones-rutas.test.ts`: 59 tests, 59 pass, 0 fail, 0 skipped |
| RED observed | With the tests extended and the handler absent: route file 2 fail (3.1 `hasRoute` false for `GET /automatizaciones/:id/ejecuciones`; 5.1); `aislamiento` 2 fail of 51 (both `GET /automatizaciones/:id/ejecuciones` sweep rows) |
| Typecheck | `npx tsc --noEmit`: clean |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0 — 532 tests, 532 pass, 0 fail, 0 skipped (baseline 521 + 11), two runs; the process exits on its own (~8 s) |
| Runtime harness | `app.inject()` against the live test PostgreSQL on port 5434: the T2 fixture tenants each create an automation through the API and own one run; a real `ejecutarTick` over both tenants |
| Rollback boundary | Remove the `/automatizaciones/:id/ejecuciones` handler and `EjecucionListada` from `src/automatizaciones-rutas.ts`, the 5.1 test and table row in its test, and the CH-13 additions to `src/aislamiento.test.ts`; prior units unaffected |
| Review budget | 308 changed lines vs `4c6a60f` before this bookkeeping, including the 44 lines of `253a11a` |

### Unit 5 implementation notes

- `GET /automatizaciones/:id/ejecuciones`: scoped `automatizacion.findUnique` (`404 automatizacion-no-encontrada` for a foreign or unknown id, before any run is read), then scoped `ejecucion.findMany` with `EjecucionListada` (every column except `tenantId` and `automatizacionId`), `orderBy [iniciadaEn desc, id asc]`, `take LIMITE_LISTADO + 1` → `200 {ejecuciones, truncado}`. A deactivated automation's runs stay listed (DEC-79).
- T2: the fixture gains an API-created `Automatizacion` and one `Ejecucion` per tenant. New sweep rows: `POST /automatizaciones` naming the other tenant's connection (`404 conexion-no-encontrada`), `GET /automatizaciones/:id`, `GET .../ejecuciones`, `POST .../desactivar` (`404 automatizacion-no-encontrada`), with the owner's automation and run ids added to the leak checks. The `desactivar` row is last because its owner control deactivates the fixture automation.
- A listing test proves each side sees only its own automations and that the refused create filed nothing. A tick test runs `ejecutarTick` over A and B and checks every `Ejecucion.tenantId` against its owner.
- The tick test dates its automations 2019 and ticks a 2019 window, before every other suite's 2020 scheduler fixtures, so it runs only its own two. A parallel 2021 tick from `planificador.test.ts` may run them while active; the test counts only rows started at its own instant, checks the owner on every row, and deactivates both automations in `finally`. The template names `pedido`, which has no fixture view, so the gate refuses without a dial.
- The "scoped read outside the context throws" row of the design's T2 line is already covered by the CH-13 1.4 tests and 3.6 in the same file; not duplicated.
- No deviation from design; no new architecture decision.

## Unit 6a Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/consola.test.ts`: 20 tests, 20 pass, 0 fail |
| RED observed | New tests against the base `src/consola.ts`: all fail (no `#auto-lista` rows, no automations request) |
| Typecheck / build | `npx tsc --noEmit`: clean; `npm run build`: exit 0 |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0 — 535 tests, 535 pass, 0 fail, 0 skipped (baseline 532 + 3) |
| Runtime harness | The served `/consola` document's inline script run over the stub DOM with a stubbed `fetch` that records the `X-Tenant-Id` of every call. Manual browser check not run |
| Rollback boundary | Revert the `#automatizaciones` section, `MENSAJES_AUTOMATIZACION`/`MENSAJES_CORRIDA`, the automations block, and the `limpiarAutomatizaciones`/`listarAutomatizaciones` calls in `src/consola.ts`, plus the CH-13 tests and fetch-stub header capture in its test |
| Review budget | Full phase 6 measured 530 changed lines before bookkeeping, so it was cut: 6a is 351 lines of code and tests vs `91c2ca8`, plus these artifact updates |

### Unit 6a implementation notes

- Every call goes through `pedir()` via `pedirAutomatizacion`, which reuses `manejarFalloDeTenant`. The list shows `plantillaId`, `conexionId`, `cron`, `activa`/`desactivada`, `creadaEn`; the only buttons are "Ver ejecuciones" and, while active, "Desactivar" (DEC-79). Deactivate and a `404`/`409` both reload the list.
- Runs: start, end, duration, rows (plus the row-cap cut), `estado`, error. A failed run's error is the `MENSAJES` sentence for `fase:error`, else a `MENSAJES_CORRIDA` sentence for the pre-dial categories, plus `(SQLSTATE …)`; a gate refusal names the entities from `codigoError`. Category codes never reach the page as text.
- Switching tenant wipes both tables before reloading; a stale-tenant refusal wipes them too.
- 6b plan (delivered in unit 6b below): plantilla `<select>` from `GET /plantillas` (also names each plantilla in the list), value controls from `GET /plantillas/:id` built with `controlDeValor`, a connection-id text input (no connection-listing route exists, as with `#conexion`), a cron input, and `POST /automatizaciones`; `valoresActuales` is generalised to `valoresDe(entradas)` for both forms. A `400` naming `/cron` gets its own sentence.
- Deviation: design says "connection select"; there is no route listing connections, so 6b uses a text input like the query editor's.

## Unit 6b Evidence

| Evidence | Value |
|---|---|
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/consola.test.ts`: 21 tests, 21 pass, 0 fail |
| RED observed | Test changes against the 6a `src/consola.ts`: 12 fail, 9 pass — no `/plantillas` request, so every queued response after the saved-query list shifted by one; no `#auto-plantilla` value controls and no `POST /automatizaciones` |
| Typecheck / build | `npx tsc --noEmit`: clean; `npm run build`: exit 0 |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0 — 536 tests, 536 pass, 0 fail, 0 skipped (baseline 535 + 1) |
| Runtime harness | The served `/consola` document's inline script run over the stub DOM with a stubbed `fetch` recording each call's `X-Tenant-Id`: choose a template, fill its value controls, connection id and cron, submit, and see the new row listed. Manual browser check not run |
| Rollback boundary | Revert the create-form markup, `selectorPlantilla`…`botonCrearAuto`, `nombresPlantilla`/`filasValoresAuto`, `cargarCatalogoPlantillas`, `elegirPlantilla`, `cargarAutomatizaciones`, `crearAutomatizacion`, their listeners and the two extra `MENSAJES_AUTOMATIZACION` entries in `src/consola.ts`; restore `valoresActuales` as the sole values reader; revert the create test and the catalog response in `elegirTenant`. The 6a list, deactivate and runs views stay |
| Review budget | 195 changed lines of code and tests vs `fa4ffde`, plus these artifact updates |

### Unit 6b implementation notes

- Switching tenant (and first load) now calls `cargarAutomatizaciones`: `GET /plantillas` fills `#auto-plantilla` and `nombresPlantilla`, then `GET /automatizaciones`; the list shows the template name, falling back to its id. The catalog is global but still requested through `pedir()`: the section has nothing to show without a tenant.
- Choosing a template calls `GET /plantillas/:id` and builds one control per declared parameter with `controlDeValor`, labelled by `rotular`; a later choice made while a request is in flight wins.
- `valoresActuales` is generalised to `valoresDe(entradas)` (`{nombre, tipo, valor}` with `valor` the control) and shared by the query editor and the create form; editor behaviour is unchanged (every earlier editor test still passes).
- `POST /automatizaciones` body is `{plantillaId, conexionId, valores, cron}` with no `tenantId`; the tenant travels only in the header (rule 2, DEC-15). A `400` whose `campos` includes `/cron` gets its own sentence; other `400`s reuse `mensajeDeSolicitudInvalida`; `404 plantilla-no-encontrada`/`conexion-no-encontrada` have sentences in `MENSAJES_AUTOMATIZACION`. Success shows a confirmation and reloads the list.
- Deviation from design: the design names a connection select, but no route lists connections, so the connection is a free-text id input (`#auto-conexion`), the same as the query editor's `#conexion`. Adding a connection-listing route would widen the API beyond this change; not done, no new architecture decision.

## Notes for later units

- `cron-parser` 5.10.1 (CommonJS) API confirmed from `dist/types`: `CronExpressionParser.parse(expr, { currentDate, tz }).next().toDate()`; the ESM named import works. Matches design; no deviation.
- Prisma queries are lazy thenables. Inside `conTenantActivo`, a query must be awaited within `fn`; a bare query returned from a non-`async` `fn` runs after the context is left and throws `ErrorSinTenantActivo`. Relevant to `planificador.ts` (Phase 4). Documented in the `conTenantActivo` comment.
- The migration SQL was generated with `prisma migrate diff --from-schema <base> --to-schema prisma/schema.prisma --script`; it was not applied (Docker/DB unavailable). The Compose entrypoint applies it via `migrate deploy`.
- `prisma format` realigned the `Conexion` model columns after its new back-relation; whitespace only.
- `docker-compose.yml` forwards `ZONA_HORARIA_AUTOMATIZACIONES` since unit 4b; the other optional variables (`MAX_FILAS_CONSULTA`, timeouts) are still not forwarded.
