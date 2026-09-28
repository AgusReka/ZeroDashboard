# Apply Progress: CH-13 — Engine: Scheduling and Execution

Mode: Standard (strict_tdd: false), RED/GREEN order from tasks.md followed. Delivery: auto-chain, stacked-to-main.

## Completed

| Unit | Tasks | Branch | Commits |
|---|---|---|---|
| 1 Schema, isolation, config, dependency | 1.1–1.9 | `ch13/1-esquema-aislamiento-config` (base `master`) | `c12912f`, `c928e9a`, `bbc9100` |

Remaining: Phases 2–7 (units 2–7).

## Unit 1 Evidence

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/aislamiento.test.ts src/config.test.ts`: 37 tests, 37 pass, 0 fail (live-PG describe skipped: no server at localhost:5432) |
| RED observed | 1.4: 2 fail (`PrismaClientKnownRequestError` instead of `ErrorSinTenantActivo`); 1.7: module has no export `DEFAULT_ZONA_HORARIA` |
| Full suite | `npm test`: 299 tests, 299 pass, 0 fail |
| Runtime harness | N/A — schema/config only, no scheduler yet |
| Rollback boundary | `DROP TABLE "Ejecucion"; DROP TABLE "Automatizacion";`; revert the three commits above (dependency, models + `MODELOS_AISLADOS`, `zonaHoraria`) |

## Notes for later units

- `cron-parser` 5.10.1 (CommonJS) API confirmed from `dist/types`: `CronExpressionParser.parse(expr, { currentDate, tz }).next().toDate()`; the ESM named import works. Matches design; no deviation.
- Prisma queries are lazy thenables. Inside `conTenantActivo`, a query must be awaited within `fn`; a bare query returned from a non-`async` `fn` runs after the context is left and throws `ErrorSinTenantActivo`. Relevant to `planificador.ts` (Phase 4). Documented in the `conTenantActivo` comment.
- The migration SQL was generated with `prisma migrate diff --from-schema <base> --to-schema prisma/schema.prisma --script`; it was not applied (Docker/DB unavailable). The Compose entrypoint applies it via `migrate deploy`.
- `prisma format` realigned the `Conexion` model columns after its new back-relation; whitespace only.
- `docker-compose.yml` does not forward `ZONA_HORARIA_AUTOMATIZACIONES`, the same as the other optional variables (`MAX_FILAS_CONSULTA`, timeouts). The app uses `UTC` inside Compose until it is forwarded.
