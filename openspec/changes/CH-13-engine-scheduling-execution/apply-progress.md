# Apply Progress: CH-13 — Engine: Scheduling and Execution

Mode: Standard (strict_tdd: false), RED/GREEN order from tasks.md followed. Delivery: auto-chain, stacked-to-main.

## Completed

| Unit | Tasks | Branch | Commits |
|---|---|---|---|
| 1 Schema, isolation, config, dependency | 1.1–1.9 | `ch13/1-esquema-aislamiento-config` (base `master`) | `c12912f`, `c928e9a`, `bbc9100` |
| 2 Pure `src/automatizaciones.ts` | 2.1–2.5 | `ch13/2-automatizaciones-puro` (base unit 1) | see `git log ch13/1-esquema-aislamiento-config..ch13/2-automatizaciones-puro` |

Remaining: Phases 3–7 (units 3–7).

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

## Notes for later units

- `cron-parser` 5.10.1 (CommonJS) API confirmed from `dist/types`: `CronExpressionParser.parse(expr, { currentDate, tz }).next().toDate()`; the ESM named import works. Matches design; no deviation.
- Prisma queries are lazy thenables. Inside `conTenantActivo`, a query must be awaited within `fn`; a bare query returned from a non-`async` `fn` runs after the context is left and throws `ErrorSinTenantActivo`. Relevant to `planificador.ts` (Phase 4). Documented in the `conTenantActivo` comment.
- The migration SQL was generated with `prisma migrate diff --from-schema <base> --to-schema prisma/schema.prisma --script`; it was not applied (Docker/DB unavailable). The Compose entrypoint applies it via `migrate deploy`.
- `prisma format` realigned the `Conexion` model columns after its new back-relation; whitespace only.
- `docker-compose.yml` does not forward `ZONA_HORARIA_AUTOMATIZACIONES`, the same as the other optional variables (`MAX_FILAS_CONSULTA`, timeouts). The app uses `UTC` inside Compose until it is forwarded.
