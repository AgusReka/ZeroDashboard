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
| 4a Scheduler tick: due check, tenant context, gate | 4.1–4.4; 4.8 `Reloj`/`ejecutarTick`/run-pipeline half | `ch13/4a-planificador` (base unit 3b) | see `git log 0a8f987..ch13/4a-planificador` |

Unit 2 was one apply batch, split afterwards by the orchestrator into 2a and 2b with identical
final code. Unit 3 was cut into 3a and 3b to fit the 400-line budget (the whole phase measured 520).

Remaining: 4.5–4.7, the rest of 4.8 (`iniciar`, `detener`, timer, per-run catch), 4.9, 4.10 (unit 4b); Phases 5–7.

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
| Review budget | 422 changed lines of code and tests vs `0a8f987` (plus these artifact updates); over the 400 budget with no cohesive further cut: 4.1–4.4 need the whole run pipeline (4.3 needs the gate and the `Ejecucion` write). `size:exception` recommended for this slice |

### Unit 4a implementation notes

- `crearPlanificador({prisma, zonaHoraria, log, reloj?})` returns only `ejecutarTick` for now; 4b adds `iniciar`/`detener`. The window's lower edge is initialised from `reloj.ahora()` when the scheduler is built (no catch-up, DEC-75) and moved to `ahora` at the start of each tick.
- Tick: `tenant.findMany({activo: true})` (unscoped model) → per tenant `conTenantActivo({id, nombre}, …)` with the tenant built only from that row → scoped `automatizacion.findMany({activo: true})` → `estaVencida(cron, max(desde, creadaEn), ahora, zona)` → sequential runs. Every query is awaited inside the callback.
- Run: `ejecucion.create` `en-curso` with `iniciadaEn` from the clock (`conTenantInyectado`, no `tenantId` written) → global `plantilla.findUniqueOrThrow` → scoped `vistaCanonica.findMany({conexionId})` → `evaluarVistas` → `componerSentencia` → `prepararSentencia` (values re-checked every run) → `destinoDeConexion` (`ErrorCredencialIlegible` → `credencial-ilegible`, `null` → `conexion-no-encontrada`) → `ejecutarConsulta` with `limite = topeFilas = loadConfig().maxFilasPorConsulta`, `desplazamiento = 0` → `ejecucion.update` with `cierreDeResultado`, `finalizadaEn`, `duracionMs`. A failure logs `{automatizacionId, fase, error, codigoError}` only.
- Not yet: an unexpected throw (e.g. `findUniqueOrThrow`, a corrupt cron, a DB error) propagates out of `ejecutarTick`, leaves the row `en-curso` and stops the tick. The per-run catch closing it as `error-interno` is task 4.5 (RED in 4b).
- `docker-compose.yml` still does not forward `ZONA_HORARIA_AUTOMATIZACIONES`; that belongs with the 4.9 wiring in 4b.
- Test isolation: `tenant.findMany` sees every active tenant in the shared test DB, including other files' fixtures. Their automations have a real `creadaEn`, so `max(desde, creadaEn)` is after every 2021 window and they are never due in these ticks.

## Notes for later units

- `cron-parser` 5.10.1 (CommonJS) API confirmed from `dist/types`: `CronExpressionParser.parse(expr, { currentDate, tz }).next().toDate()`; the ESM named import works. Matches design; no deviation.
- Prisma queries are lazy thenables. Inside `conTenantActivo`, a query must be awaited within `fn`; a bare query returned from a non-`async` `fn` runs after the context is left and throws `ErrorSinTenantActivo`. Relevant to `planificador.ts` (Phase 4). Documented in the `conTenantActivo` comment.
- The migration SQL was generated with `prisma migrate diff --from-schema <base> --to-schema prisma/schema.prisma --script`; it was not applied (Docker/DB unavailable). The Compose entrypoint applies it via `migrate deploy`.
- `prisma format` realigned the `Conexion` model columns after its new back-relation; whitespace only.
- `docker-compose.yml` does not forward `ZONA_HORARIA_AUTOMATIZACIONES`, the same as the other optional variables (`MAX_FILAS_CONSULTA`, timeouts). The app uses `UTC` inside Compose until it is forwarded.
