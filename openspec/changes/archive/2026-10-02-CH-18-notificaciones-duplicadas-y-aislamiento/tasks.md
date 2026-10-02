# Tasks: CH-18 — At-Most-Once Notification and Per-Tenant Failure Isolation (X6, X8)

From `design.md` and `specs/**`. DEC-107..DEC-111 are already in `docs/01-decisiones.md` (no task edits it). Strict TDD: RED then GREEN. Test command: `npm test`; type check: `npx tsc --noEmit`. Baseline: 671/671. Main-spec wording in `openspec/specs/**` is applied by `sdd-archive`, not by apply.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Unit 1 ~110-150, unit 2 ~280-340, unit 3 ~60-80 (total ~450-570 with a ~40% undercount margin) |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR, three commits (one per unit) |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

`size:exception` is accepted by the maintainer, so no decision is needed. Commits are the work units: tests and docs travel with their code. Most of the volume is test code. Unit 1 may shrink by ~25 lines if the spike refutes the crash (no listener, no spike test).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Per-tenant catch; spike for the pg `error` crash; listener only if proven | Commit 1 of the single PR | `npm test -- src/planificador.test.ts src/db-probe.test.ts` | Live PG: tenant A throws in listing, tenant B still runs; child process destroys forwarder sockets | Revert `planificador.ts` tick, `db-probe.ts` and their tests |
| 2 | At-most-once tests, `enviando` marker, sweep to `incierta`, console copy | Commit 2 | `npm test -- src/planificador.test.ts src/automatizaciones.test.ts src/consola.test.ts` | Live PG: stalled notifier leaves `en-curso`/`enviando`; new planner sweeps to `fallo`/`interrumpida`/`incierta` | Revert `planificador.ts` notify/sweep, `automatizaciones.ts` types, `consola.ts` and tests; no migration |
| 3 | Stale wording removal, bitácora, DEC cross-refs | Commit 3 | `npm test` | N/A: comments and docs only | Revert comment edits and the bitácora file |

## Unit 1: Per-Tenant Catch (X8-A, DEC-109/110/111)

- [x] 1.1 RED `src/planificador.test.ts`: generalize `clienteDeBarrido` (`:259-282`) with `fallaListadoEn`; two tenants, failing one is the lower id; other tenant is `ok`/`enviada` with one notifier call; failing tenant has 0 rows; exactly one log line `{tenantId, error:'error-interno', nombreError:'Error'}`; `'base caida secreta'` and tenant name absent
- [x] 1.2 RED same file: tick 1 fails for A, tick 2 runs A healthy with cron `0 9 * * *`; A has 0 rows (window lost, DEC-95)
- [x] 1.3 RED same file: Proxy records `tenantActivoOpcional()` per listing as `[A, B]`; every row carries its own `tenantId`; tenants never run concurrently (deferred first query blocks second tenant)
- [x] 1.4 GREEN `src/planificador.ts`: wrap the per-tenant step in `ejecutarTick` (`:502-506`) in try/catch; `log.error` with closed fields only; `anterior = ahora` stays first
- [x] 1.5 Spike RED `src/db-probe.test.ts` (skip without PG): child via `spawn(process.execPath, ['--import','tsx','--input-type=module','--eval', SCRIPT])`, fixed argv, no shell, credentials via env, 15 s kill; `net` forwarder; destroy sockets (a) idle after login, (b) during `SELECT pg_sleep(5)` with rejection handled; child prints `SOBREVIVIO`; parent asserts exit 0 and marker
- [x] 1.6 Run the spike on unchanged `src/db-probe.ts`; record per-scenario outcome. Non-zero exit proves the crash; a green scenario is refuted and dropped. If `--eval` cannot resolve `.ts`, fall back to the `tsx` CLI `--eval` (no fixture file)
- [x] 1.7 GREEN conditional `src/db-probe.ts`: only if 1.6 proved a crash, add `cliente.on('error', () => {})` after `new pg.Client` (`:105-112`), error never read. If every scenario is refuted or the result is flaky or inconclusive: remove the spike test, add no listener (DEC-111)
- [x] 1.8 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; commit "fix(ch18): aislamiento de fallos por tenant en el tick" (spike evidence kept for unit 3)

## Unit 2: At-Most-Once and the `enviando` Marker (X6-B, DEC-107/108)

- [x] 2.1 RED `src/automatizaciones.test.ts`: pure table over every `SalidaNotificacion`; `cierreConNotificacion` never yields `enviando` or `incierta`
- [x] 2.2 GREEN `src/automatizaciones.ts`: `EstadoNotificacion` gains `'enviando' | 'incierta'` (`:289-294`); add `MarcaNotificacion`; `CierreNotificado.notificacion` excludes both (`:376`); `cierreConNotificacion` body unchanged
- [x] 2.3 RED `src/planificador.test.ts`: inside `enviar`, fake reads the row as `en-curso`/`enviando` and the run closes `enviada`
- [x] 2.4 RED same file: Proxy on `ejecucion.update` counts marker writes; 0 for zero rows, no recipient, no notifier, failed query, gate refusal
- [x] 2.5 RED same file: marker write throws; notifier not called; row `fallo`/`notificacion`/`error-interno`/`fallo-envio`; only the error name is logged
- [x] 2.6 RED same file: crash simulation, notifier never resolves; `esperarA` waits for `enviando`; new planner `barrerInterrumpidas([t])` gives `fallo`/`interrumpida`/`incierta`, other outcome columns null, notifier count 1
- [x] 2.7 RED same file: sweep table, `enviando` becomes `incierta`, null stays null, closed rows (including `enviada`) untouched; update CH-17a 1.2 (`:817`, `:831-833`) to per-call pairs, `incierta` call first
- [x] 2.8 RED same file: at-most-once per path; retried dial then success (`intentos` 2) gives 1 call; overlap with stuck `enviando` row gives `omitida`, 0 calls; `detener()` during a deferred send gives 1 call, `enviada`, no timer armed; timeout (CH-14 5.9) gives 1 call
- [x] 2.9 GREEN `src/planificador.ts`: `notificar(…, id)`; after `componerCorreo` and before `enviar` write `ejecucion.update({ where:{id}, data:{ notificacion:'enviando' }, select:{ id:true } })` (`:326-354`, call `:413`)
- [x] 2.10 GREEN same file: sweep (`:559-564`) as two `updateMany` per tenant, `{estado:'en-curso', notificacion:'enviando'}` with `{...CIERRE_INTERRUMPIDA, notificacion:'incierta'}` first, existing call second; `cerradas` is the sum; log adds `inciertas` (`:578`)
- [x] 2.11 Adjust existing CH-14 5.7 (`:734`): `notificacion: null` becomes `'enviando'` inside `enviar` (intended by DEC-108; call out in the PR)
- [x] 2.12 RED `src/consola.test.ts` (fake DOM, extend `:861-908`): labels `Envío en curso` and `Sin confirmar: puede haberse entregado`; timeout message matches `/puede haberse entregado/`, has no `no se envió`; other four messages unchanged and distinct; raw tokens absent; page contains no new backtick
- [x] 2.13 GREEN `src/consola.ts`: `ETIQUETAS_NOTIFICACION` (`:293-299`) gains `enviando` and `incierta`; `MENSAJES['notificacion:tiempo-agotado']` (`:217`) and its comment (`:216`) updated to the design copy, no backtick
- [x] 2.14 Checkpoint: `npm test` green, `npx tsc --noEmit` clean, no `prisma/` diff; commit "feat(ch18): envio como maximo una vez y marca enviando"

## Unit 3: Wording, Bitácora, Cross-References

- [x] 3.1 `src/planificador.ts`: reword header comment (`:43-45`) and `:444-448` to drop "CH-18 pending"; state per-tenant catch, serial tick, DEC-109/110
- [x] 3.2 Create `docs/bitacora/CH-18-notificaciones-duplicadas-y-aislamiento.md` (Spanish, from `docs/bitacora/_plantilla.md` (read-only), following `docs/bitacora/CH-17b-reintentos-de-conexion.md` (read-only)): spike evidence per scenario and the listener outcome (DEC-111); `enviando` honestly shown for a crash between marker and `enviar`; timeout shown as "puede haberse entregado"
- [x] 3.3 Same bitácora, limits table (rule 6) with DEC refs: X8-B lanes, X8-C loops, X8-D circuit breaker (DEC-110); X6-C notification table, X6-D content/cooldown dedupe (DEC-107); pool outside listener scope; two consecutive identical runs may each send; DEC-96 race window stays acceptable while the tick is serial
- [x] 3.4 Final checkpoint: `npm test` green (baseline 671 plus new tests), `npx tsc --noEmit` clean, `git diff --stat` shows no `prisma/` change; commit "docs(ch18): bitacora y limites"
- [ ] 3.5 Run `sdd-verify`, then `sdd-archive` (applies the Purpose wording and the renamed requirement in `openspec/specs/automation-scheduling/spec.md`, `email-notification`, `execution-log`, `query-console`)

## Traceability

- Tenant catch, window, closed log, serial tick, conditional listener -> 1.1-1.7
- Types, marker, at-most-once, sweep -> 2.1-2.11
- Console labels and timeout copy -> 2.12-2.13
- Stale wording, limits, bitácora -> 3.1-3.3
