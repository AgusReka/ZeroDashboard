# Tasks: CH-17b — Bounded Connection Retries (X5)

From `design.md` and `specs/**`. DEC-97, 98, 103-106 are already in `docs/01-decisiones.md` (no task edits it). Strict TDD: RED then GREEN. Test command: `TEST_DB_PORT=5434 npm test`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice 1 ~160, slice 2 ~270-310, slice 3 ~70 (total ~500-540) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3, each merged to master in order |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Slice 3 is planned up front: the design puts slice 2 at 340-380 with listing, console and bitácora (~70) inside it, too close to 400. Moving them out leaves slice 2 at ~270-310.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Config, env files, migration, pure rule | PR 1 (`ch17b/1-artefactos`) | `TEST_DB_PORT=5434 npm test -- src/config.test.ts src/automatizaciones.test.ts` | `prisma migrate deploy` on live PG adds nullable `intentos` | Revert code; applied migration stays |
| 2 | Retry loop, pause, count, wiring | PR 2 (`ch17b/2-bucle`, base master after PR 1) | `TEST_DB_PORT=5434 npm test -- src/planificador.test.ts` | Live PG: closed port gives `intentos=3`, two 5000 ms pauses | Revert `planificador.ts`, `server.ts`; slice 1 stays |
| 3 | Listing, console column, bitácora | PR 3 (`ch17b/3-listado-consola`) | `TEST_DB_PORT=5434 npm test -- src/automatizaciones-rutas.test.ts src/consola.test.ts` | Fake DOM: `3` and `—` rendered | Revert route, console, bitácora |

## Slice 1: Config, Env, Migration, Pure Rule

- [x] 1.1 RED `src/automatizaciones.test.ts`: `esFalloReintentable` truth table (3 retryable connection categories; not `credenciales-invalidas`, `base-inexistente`, `error-desconocido` on connection; not `tiempo-agotado` on `ejecucion`; not any `permisos`, `ok`, `rechazo`, `excepcion`)
- [x] 1.2 GREEN `src/automatizaciones.ts`: add `esFalloReintentable` beside `cierreDeResultado`
- [x] 1.3 RED `src/config.test.ts`: defaults 3 and 5000; overrides 5 and 1000; empty falls back; attempts `6`, `0`, `abc`, `12.5` and pause `0`, `abc` throw naming the variable, never the value
- [x] 1.4 GREEN `src/config.ts`: constants, `enteroEnRangoOpcional`, `connectionRetryAttempts`, `connectionRetryPauseMs`
- [x] 1.5 `.env.example` and `docker-compose.yml`: commented defaults; Compose forwards `${VAR:-}`
- [x] 1.6 `prisma/schema.prisma` `intentos Int?` and `prisma/migrations/20261001000000_ejecucion_intentos/migration.sql` (header and rollback line as in `20260929000000_notificacion`); run `npx prisma generate`
- [x] 1.7 Checkpoint: full suite green, `npx tsc --noEmit` clean, existing tests unmodified

## Slice 2: Retry Loop and Wiring

- [x] 2.1 RED `src/planificador.test.ts` (Proxy-narrowed tenants, fake `Reloj` recording `programar`): default policy on a closed port gives `intentos=1`, no timer; cap 3 gives two 5000 ms pauses, one `fallo`/`host-inalcanzable` row, `intentos=3`, no fourth dial
- [x] 2.2 RED same file: transient then success via `net` forwarder started in the pause callback gives `ok`/`intentos=2`; closed, closed, stalling listener gives `tiempo-agotado`/3
- [x] 2.3 RED same file: no retry for wrong credentials, query-phase error (`intentos=1`), or send failure (one notifier call); gate refusal gives null
- [x] 2.4 RED same file: second planner's tick during a pause writes `omitida` with null `intentos`; `detener()` during a pause resolves, row `fallo`/last category/`intentos=2`, no further `programar`; sentinels carry `intentos: null`
- [x] 2.5 GREEN `src/planificador.ts`: `PoliticaReintentos`, `SIN_REINTENTOS`, `reintentos?` dependency, `pausar`, `cancelarPausa`, `conectarConReintentos`, `conteo`, `detener()` cancel, `intentos` in final update and sentinels, retry `info` log, `intentos` on the failure `warn`, header comment
- [x] 2.6 `src/server.ts`: pass `reintentos` from `config`
- [x] 2.7 Checkpoint: full suite green, `npx tsc --noEmit` clean, existing scheduler tests unmodified

## Slice 3: Listing, Console, Bitácora

- [x] 3.1 RED `src/automatizaciones-rutas.test.ts`: listing returns `intentos` 2 and null; update the full-row `deepEqual` (line 342) to include `intentos: null`
- [x] 3.2 GREEN `src/automatizaciones-rutas.ts`: add `intentos` to `EjecucionListada` and the mapping
- [x] 3.3 RED `src/consola.test.ts`: `Intentos` header last; `3` shown; `null` and `undefined` show `—`; existing positional asserts unchanged
- [x] 3.4 GREEN `src/consola.ts`: append `Intentos` after `Error` using `textoOpcional`
- [x] 3.5 Create `docs/bitacora/CH-17b-reintentos-de-conexion.md` (Spanish, from `docs/bitacora/_plantilla.md` (read-only)): serial tick blocked up to ~25 s, cap fixed in code, no notification retry
- [x] 3.6 Checkpoint: full suite green, `npx tsc --noEmit` clean, no `prisma/` diff
- [ ] 3.7 Run `sdd-verify`, then `sdd-archive`

## Traceability

- Retry rule, config, column → 1.1-1.6
- Loop, count, pause, shutdown, overlap → 2.1-2.5
- Listing and console → 3.1-3.4
