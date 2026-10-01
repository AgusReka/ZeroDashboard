# Design: CH-17b — Bounded Connection Retries (X5)

## Technical Approach

The retry is a loop around the single dial (`ejecutarConsulta`) inside one run. The row is created once before the pipeline and closed once after it, on the existing close path. The pre-dial checks (gate, compose, prepare, `destinoDeConexion`) run once. They are never retried. A pure predicate beside `cierreDeResultado` classifies retryability (DEC-97). An injected `PoliticaReintentos` sets the cap and the pause, and it defaults to "no retry" (DEC-98). The pause is `Reloj.programar` wrapped in a promise, and `detener()` can cancel it (DEC-104). The new nullable `intentos` column counts real dials (DEC-103). The specs in this folder are authoritative on row shapes.

## Decisions (design-level, under DEC-97/98/103/104/105)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Loop scope | Only the `ejecutarConsulta` call. `resultadoDeCorrida` calls `conectarConReintentos` where it now calls `ejecutarConsulta` | Retrying all of `resultadoDeCorrida` | DEC-97 retries only the connection phase. Re-running the gate or decryption could turn a retry into a refusal halfway through |
| Count | A per-run `conteo: { intentos: number \| null }` starts at `null` and is incremented **before** each dial. It is written in the final `update` | Returning the count with the result | A throw mid-loop (for example a pause that fails to schedule) still records the attempts reached. `null` means the run never dialled (refusal, `previo`, a pre-dial throw) |
| Stop condition | Return the last result when `intentos >= politica.intentos`, when the result is not retryable, or when `detenido` is set | — | DEC-104 says no further attempts once stopping. An attempt already dialling when `detener()` is called finishes and is not followed by a pause |
| Pause | `pausar(ms): Promise<boolean>`. It resolves `true` when the timer fires, and `false` at once when `detener()` cancels it or when the planner is already stopped | `setTimeout` directly | DEC-98. The fake `Reloj` drives the pause |
| Shutdown close | A cancelled pause returns the last `ResultadoEjecucion`. The unchanged `cierreDeResultado` path then closes the run `fallo`/`conexion` with that category and the `intentos` reached. `notificacion` is null | A special close constant | DEC-104 adds no new close path |
| Sentinel shapes | `CIERRE_INTERRUMPIDA` and `CIERRE_OMITIDA` gain `intentos: null` | Relying on the column default | This states DEC-103 where the other outcome columns are stated |
| Retry log | One `log.info({ automatizacionId, intentos, error }, 'scheduled run connection retry')` per pause. The final `scheduled run failed` warn adds `intentos` | No log | Closed fields only (rule 5) |
| Env names | `CONNECTION_RETRY_ATTEMPTS` and `CONNECTION_RETRY_PAUSE_MS`, as the spec names them | — | They follow `CONNECTION_TEST_TIMEOUT_MS` |
| Console column | `Intentos` is appended **after** `Error` and rendered with `textoOpcional` | Placing it next to `Estado` | Console tests index cells by position (`hijos[5]`, `celdas[6]`). Appending keeps every one of them valid |

## Interfaces / Contracts

```ts
// src/automatizaciones.ts — beside cierreDeResultado
export function esFalloReintentable(r: ResultadoCorrida): boolean;
// r.resultado==='fallo' && r.fase==='conexion' && r.categoria ∈ {host-inalcanzable, dns-no-resuelve, tiempo-agotado}

// src/planificador.ts
export interface PoliticaReintentos { intentos: number; pausaMs: number } // total attempts, 1 = none
export const SIN_REINTENTOS: PoliticaReintentos = { intentos: 1, pausaMs: 0 };
// DependenciasPlanificador gains: reintentos?: PoliticaReintentos  (default SIN_REINTENTOS)

// src/config.ts — AppConfig gains connectionRetryAttempts, connectionRetryPauseMs
export const DEFAULT_CONNECTION_RETRY_ATTEMPTS = 3;
export const MAX_CONNECTION_RETRY_ATTEMPTS = 5;
export const DEFAULT_CONNECTION_RETRY_PAUSE_MS = 5000;
function enteroEnRangoOpcional(name: string, porDefecto: number, maximo: number): number;
// enteroPositivoOpcional + `> maximo` → throw `${name} must be an integer between 1 and ${maximo}` (never the value)
```

Pause and cancellation: this is the non-obvious pattern.

```ts
let cancelarPausa: (() => void) | null = null; // separate from the tick's `cancelar`
function pausar(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (detenido) return resolve(false);
    const cancelarTemporizador = reloj.programar(ms, () => { cancelarPausa = null; resolve(true); });
    cancelarPausa = () => { cancelarTemporizador(); cancelarPausa = null; resolve(false); };
  });
}
// detener(): detenido = true; cancelar?.(); cancelarPausa?.(); await enCurso;
```

The tick is serial, so at most one pause is pending at a time. If `programar` throws, the promise rejects, the existing catch in `correr` records `error-interno`, and `conteo` keeps the attempts reached.

## Data Flow

```
correr: overlap check → create en-curso (once) → plantilla → gate/compose/prepare/destino (once)
  → loop: conteo++ → ejecutarConsulta
          retryable && conteo<cap && !detenido → pausar(pausaMs) ─ false (detener) → exit loop
  → notificar (unchanged; never retried) → update {...cierre, intentos, finalizadaEn} (once)
```

The row stays `en-curso` through every pause, so the overlap guard (DEC-96) skips a later tick. In a single process the tick is serial, so this only happens with a second instance or a direct `ejecutarTick`. If the process is killed during a pause, the row keeps `intentos` null, and the boot sweep closes it as `interrumpida`/null (DEC-99, DEC-103).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/automatizaciones.ts` (+test) | Modify | `esFalloReintentable` and its closed category set |
| `src/config.ts` (+test) | Modify | Two fields, constants, `enteroEnRangoOpcional` |
| `.env.example`, `docker-compose.yml` | Modify | Commented defaults. Compose forwards `${VAR:-}` |
| `prisma/schema.prisma` | Modify | `intentos Int?` with a CH-17b comment block |
| `prisma/migrations/20261001000000_ejecucion_intentos/migration.sql` | Create | `ALTER TABLE "Ejecucion" ADD COLUMN "intentos" INTEGER;` plus the header comment and the rollback line, as in `20260929000000_notificacion` |
| `src/planificador.ts` (+test) | Modify | Policy, `pausar`, `conectarConReintentos`, `conteo`, `detener`, the sentinels, and the header comment (removes "no retry yet") |
| `src/server.ts` | Modify | `reintentos: { intentos: config.connectionRetryAttempts, pausaMs: config.connectionRetryPauseMs }` |
| `src/automatizaciones-rutas.ts` (+test) | Modify | `EjecucionListada.intentos`. The deepEqual at line 342 gains `intentos: null` (a legacy row) |
| `src/consola.ts` (+test) | Modify | `Intentos` as the last column |
| `docs/bitacora/CH-17b-reintentos-de-conexion.md` | Create | Limits: serial-tick blocking, the cap fixed in code, no notification retry |

## Testing Strategy (strict TDD, `npm test`)

| Layer | What |
|---|---|
| Unit, pure | `esFalloReintentable` truth table: the three connection categories are retryable. Not retryable: `credenciales-invalidas`, `base-inexistente` and `error-desconocido` on connection; `tiempo-agotado` on `ejecucion`; any `permisos` failure; `ok`, `rechazo`, `excepcion` |
| Unit, config | Defaults 3 and 5000. Overrides 5 and 1000. An empty value falls back to the default. Attempts `6`, `0`, `abc`, `12.5` and pause `0`, `abc` throw, naming the variable and not the value |
| Live PG, planner | The tenant list is narrowed by a Proxy (generalizing `clienteDeBarrido`) so other files' due automations do not consume pauses. The fake `Reloj` records each `programar(ms)` call and fires it on demand. Cases: (1) The default policy on a closed port gives `intentos=1`, and `relojFijo` proves no timer was requested. (2) Cap 3 on a closed port gives two 5000 ms pauses, one row `fallo`/`host-inalcanzable`/`intentos=3`, and no fourth dial. (3) Transient then success: the port is free on attempt 1, and the pause callback starts a `net` forwarder to live PG on that port, giving `ok`/`intentos=2`. (4) Last category wins: closed, closed, then a stalling listener with a short `CONNECTION_TEST_TIMEOUT_MS` gives `tiempo-agotado`/3. (5) No retry for wrong credentials, for a query-phase error (`intentos=1`), or for a send failure (one notifier call). A gate refusal gives `null`. (6) During a pause, a second planner's tick writes `omitida` with null `intentos`. (7) `detener()` during a pause on the timer path resolves, and the row is `fallo`/last category/`intentos=2` with no further `programar` |
| Route | The listing shows `intentos` as 2 and null |
| Console (fake DOM) | The `Intentos` header is shown. A row with 3 shows `3`. `null` and `undefined` show `—`. Existing positional asserts are unchanged |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths, Git selection, commit, push, PR commands | N/A: no file classification, VCS or PR automation |
| Shell/subprocess | N/A: the dial is the existing `pg` client. No new process |

## Migration / Rollout

The migration is additive and nullable, with no default and no backfill. Rollback is to revert the code. The applied migration file stays, because reverted code ignores the column. A forward `DROP COLUMN` is optional.

Slices are stacked, and each one is green on its own:

- **Slice 1** (~160 lines): config, env files, migration and schema, and the pure rule, with their tests. Nothing consumes them yet.
- **Slice 2** (~340–380 lines): the loop, wiring, listing, console, planner, route and console tests, and the bitácora.
- **Slice 3, pre-declared:** if the measured slice 2 exceeds 400 lines, listing, console and bitácora (~70) move here.

## Open Questions

- [x] OQ-1 (resolved: relax the spec examples, DEC-106): The spec's "Cap exhausted (last `dns-no-resuelve`)" and "Last category wins (…→`dns-no-resuelve`)" scenarios cannot follow another failure category on a fixed destination with real sockets. The design proves the property with `host-inalcanzable`→`tiempo-agotado`. There are two options: relax the spec examples, or add an injected dial seam (`ejecutar?` in `DependenciasPlanificador`). This is the user's call.
- [x] OQ-2 (resolved: confirmed as intended, DEC-106): `detener()` still awaits the rest of the in-flight tick (CH-13). The remaining due automations make one attempt each, with no retry. DEC-104 covers only the pending pause. Should this be confirmed as intended?
- [x] OQ-3 (resolved: recorded as DEC-106): Should the design-level resolutions above be recorded in `docs/01-decisiones.md` (CH-17a OQ-1 precedent)?
