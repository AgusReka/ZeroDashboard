# Tasks: CH-17a — Interrupted Runs and Overlap (X7, X4)

Derived from `design.md` and `specs/**`. DEC-95, 96, 99, 100, 102 are registered in `docs/01-decisiones.md` (no task edits it). No migration, no raw SQL. Strict TDD: RED then GREEN. Test command: `TEST_DB_PORT=5434 npm test`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice 1 ~230-280, slice 2 ~170-220 (total ~400-500) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR; if the diff passes 400, split slice 1 then slice 2 inside CH-17a (DEC-101) |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Sweep, `arrancar`, shutdown, comments | PR 1 (`ch17a/1-barrido-y-solapamiento`) | `TEST_DB_PORT=5434 npm test -- src/planificador.test.ts src/apagado.test.ts` | Live PG: stuck rows swept; `app.close()` cancels timer | Revert `apagado.ts`, `server.ts`, sweep code |
| 2 | Overlap guard, console, bitácora | PR 2 (base: PR 1 branch) | `TEST_DB_PORT=5434 npm test -- src/planificador.test.ts src/consola.test.ts` | Live PG: two ticks give two `omitida` rows | Revert guard, console, bitácora; slice 1 stays |

## Slice 1: Sweep and Shutdown

- [x] 1.1 RED `src/planificador.test.ts`: test-only Proxy narrows `tenant.findMany` to own tenants; active and deactivated tenants swept to `fallo`/`interrumpida`, `finalizadaEn` = fake boot time, other columns null; closed rows unchanged; swept automation gets no new row (spec "Interrupted runs are not re-executed")
- [x] 1.2 RED same file: one tenant's `updateMany` throwing still sweeps the other; failed `tenant.findMany` resolves and logs; each call runs inside a tenant context; `aislado.ejecucion.updateMany` outside a context throws `ErrorSinTenantActivo`
- [x] 1.3 RED same file (`relojManual`, `clienteControlado`): `arrancar` arms no timer until the sweep resolves; a failed sweep still arms; `detener()` during the sweep leaves no timer; a row created after the sweep is not reaped
- [x] 1.4 GREEN `src/planificador.ts`: add `barrerInterrumpidas()` (one `reloj.ahora()`, no `activo` filter, `conTenantActivo` + `async () => await prisma.ejecucion.updateMany`, per-tenant try/catch, logs `{ cerradas }`) and `arrancar()`; `iniciar()` unchanged
- [x] 1.5 RED `src/apagado.test.ts` (new, `EventEmitter` as process): SIGTERM and SIGINT call `cerrar` once, even across two signals, then `salir(0)`; a rejection gives `salir(1)`; a real Fastify app with `onClose` calling `detener()` cancels the timer
- [x] 1.6 GREEN `src/apagado.ts` (new): `registrarApagado` with `on`, memoized close promise, ignored and logged second signal
- [x] 1.7 `src/server.ts`: call `registrarApagado` before `listen`; replace `iniciar()` with `arrancar()` in the `listen` callback
- [x] 1.8 Comments only: fix DEC-95 attribution in `src/planificador.ts` (lines 33-35, 124, `correrVencidas` catch), `src/automatizaciones.ts` (line 86), `src/contexto-tenant.ts` (sweep enters deactivated tenants), `src/planificador.test.ts` (line 271)
- [x] 1.9 Checkpoint: `TEST_DB_PORT=5434 npm test` green, `npx tsc --noEmit` clean, existing 4.7 timer tests unmodified

## Slice 2: Overlap and Console

- [ ] 2.1 RED `src/planificador.test.ts`: stuck automation gets two `omitida`/`solapamiento` rows over two ticks (`iniciadaEn = finalizadaEn`, other columns null), `en-curso` row unchanged, no query, notifier not called
- [ ] 2.2 RED same file: sibling automation runs normally; tenant B's `en-curso` row does not block A; Proxy `findFirst` throw for one automation still lets the sibling run (existing per-run catch)
- [ ] 2.3 GREEN `src/planificador.ts`: scoped `findFirst` (automatizacionId, `en-curso`) before `ejecucion.create` in `correr()`; if found, create the `omitida` row, `warn`, return
- [ ] 2.4 RED `src/consola.test.ts` (existing fake DOM): `omitida` renders `Omitida`; `solapamiento` and `interrumpida` messages legible; nulls render `—`; unknown `estado` renders raw (CH-14 6.5 stays green)
- [ ] 2.5 GREEN `src/consola.ts`: add both `MENSAJES_CORRIDA` entries, `ETIQUETAS_ESTADO = { omitida: 'Omitida' }`, `etiquetaEstado()`
- [ ] 2.6 Create `docs/bitacora/CH-17a-interrumpidas-y-solapamiento.md` (Spanish, from `docs/bitacora/_plantilla.md` (read-only)): limits no catch-up, single instance (second sweep closes live runs), live-stuck row until next boot, second signal ignored
- [ ] 2.7 Checkpoint: `TEST_DB_PORT=5434 npm test` green, `npx tsc --noEmit` clean, no `prisma/` diff
- [ ] 2.8 Run `sdd-verify`, then `sdd-archive`

## Traceability

- Boot sweep, fail-open, no re-execution → 1.1-1.4
- Signals → 1.5-1.7
- No catch-up, single instance → 1.8, 2.6
- Overlap guard → 2.1-2.3
- Readable messages → 2.4-2.5
