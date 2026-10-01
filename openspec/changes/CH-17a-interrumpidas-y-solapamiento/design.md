# Design: CH-17a — Interrupted Runs and Overlap (X7, X4)

## Technical Approach

This change adds three mechanisms on the existing scoped client and the existing `Reloj`. It adds no schema, no raw SQL and no new dependency:

- **Boot sweep (DEC-99).** It is a planner method, awaited before `iniciar()`.
- **Overlap guard (DEC-96).** It is the first step of `correr()`.
- **Signal handler (DEC-100).** It lives in a new importable module, because `server.ts` cannot be imported by tests (it calls `listen` at import time).

The specs in this folder are authoritative on row shapes.

## Decisions (design-level, under DEC-95/96/99/100)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Sweep entry | New `arrancar()` runs `await barrerInterrumpidas()`, then `iniciar()`. `iniciar()` stays sync and unchanged | Make `iniciar()` async. Inject the sweep as a dependency | The 4.7 timer tests call `iniciar()` synchronously and stay untouched. No injected no-op default is needed |
| Sweep placement | In `listen().then(() => planificador.arrancar())` | Before `listen` | HTTP never writes `Ejecucion`, so serving during the sweep is safe. The tick is armed only after the sweep finishes |
| Sweep failure | Never rejects. A per-tenant `try/catch` lets one tenant's failure leave the others swept. An outer catch handles a failed `tenant.findMany`. Both log closed fields only (`error`, `nombreError`, `tenantId`) | Rethrow | DEC-99 fail-open. A rejection would reach `server.ts`'s `.catch`, which calls `process.exit(1)` |
| Sweep tenants | `tenant.findMany` with **no** `activo` filter, then `conTenantActivo` for each tenant | Active tenants only. Raw SQL | DEC-99. Spec `tenant-isolation` |
| Boot time | One `reloj.ahora()` read at the start of the sweep, used by every tenant | One read per tenant | One "hora de arranque" |
| Overlap row | `create` with `estado:'omitida'`, `error:'solapamiento'`, `iniciadaEn = finalizadaEn =` one `reloj.ahora()` read. Every other outcome column is null | `duracionMs: 0` | Nothing ran. This matches the interrupted shape. **Confirm (OQ-2)** |
| Overlap failure | No new catch: the existing per-run catch in `correrVencidas` logs `scheduled run could not be recorded`, and the run does not start (fail closed) | A dedicated catch | This is spec scenario "lookup failure does not stop the tick" |
| Signals | `on` (not `once`) plus a memoized close promise. A second signal is logged and ignored. After close: `salir(0)`. On rejection: log, then `salir(1)` | `once` (the second signal kills via the Node default) | Installing a listener removes Node's default exit, so an explicit exit is required. **Confirm (OQ-3)** |
| `omitida` label | `ETIQUETAS_ESTADO = { omitida: 'Omitida' }`. Any other value is rendered raw, as today | Label every `estado` | Test CH-14 6.5 asserts a raw `fallo` |

## Interfaces / Contracts

```ts
// src/planificador.ts — Planificador gains two members
arrancar(): Promise<void>;            // barrerInterrumpidas() then iniciar(); never rejects
barrerInterrumpidas(): Promise<void>; // logs { cerradas } once; never rejects

// src/apagado.ts (new)
export interface ProcesoConSenales { on(senal: 'SIGTERM' | 'SIGINT', fn: () => void): unknown }
export function registrarApagado(deps: {
  proceso: ProcesoConSenales;        // server.ts: process
  cerrar: () => Promise<void>;       // server.ts: () => app.close()
  log: FastifyBaseLogger;
  salir?: (codigo: number) => void;  // default: process.exit
}): void;
```

Gotcha: the sweep callback must be `async () => await prisma.ejecucion.updateMany(...)`. A bare thenable runs outside the context and fails closed (`contexto-tenant.ts`).

## Data Flow

```
server.ts: registrarApagado(process) → listen → arrancar()
 arrancar → barrerInterrumpidas: Tenant(all) → conTenantActivo(t) → updateMany(en-curso → fallo/interrumpida)
          → iniciar → tick → correr: findFirst(automatizacionId, en-curso)
                found → create omitida/solapamiento, warn, return
                none  → create en-curso → pipeline → notify → update (unchanged)
SIGTERM|SIGINT → cerrar() once → app.close → onClose: detener() → salir(0)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/planificador.ts` | Modify | Add `barrerInterrumpidas`, `arrancar`, the overlap guard and the local `as const` row shapes. Fix DEC-95 comments (lines 33–35 and 124). Update the comment on the `correrVencidas` catch |
| `src/apagado.ts` | Create | `registrarApagado` |
| `src/server.ts` | Modify | `registrarApagado` before `listen`. Replace `iniciar()` with `arrancar()` |
| `src/automatizaciones.ts` | Comment | Line 86: no catch-up (DEC-95). The scheduler checks overlap (DEC-96) |
| `src/contexto-tenant.ts` | Comment | The scheduler's sweep also enters deactivated tenants (DEC-99) |
| `src/consola.ts` | Modify | `MENSAJES_CORRIDA` gains `solapamiento` and `interrumpida`. Add `ETIQUETAS_ESTADO` and `etiquetaEstado()` |
| `src/planificador.test.ts`, `src/apagado.test.ts`, `src/consola.test.ts` | Modify / Create | See Testing Strategy. Fix the line 271 comment |
| `docs/bitacora/CH-17a-*.md` | Create | Limits: no catch-up, single instance, live-stuck row |

New `MENSAJES_CORRIDA` entries (Spanish UI copy, matching the existing entries):

- `'solapamiento'`: `'No se ejecutó: la corrida anterior de esta automatización seguía en curso.'`
- `'interrumpida'`: `'La corrida se interrumpió por un reinicio del servicio y no se volvió a ejecutar.'`

These are reached through the `fase:null` fallback in `errorDeCorrida`.

## Testing Strategy (strict TDD, `npm test`)

| Layer | What |
|---|---|
| Live PG, sweep | The planner gets a test-only Proxy whose `tenant.findMany` is narrowed to the test's own tenants, because node:test runs files in parallel and the real sweep would touch other files' rows. Cases: active and deactivated tenants swept, with the exact interrupted shape and `finalizadaEn` equal to the fake boot time. Closed rows are unchanged. Each `updateMany` call records `tenantActivoOpcional()` and its count. A throw for one tenant still sweeps the other. The swept automation gets no new row. `aislado.ejecucion.updateMany` outside a context throws `ErrorSinTenantActivo` |
| Live PG, overlap | Stuck automation: two ticks, two `omitida` rows, the `en-curso` row unchanged, the notifier not called. A sibling runs normally. Tenant B's `en-curso` row does not block A. A Proxy `findFirst` throw for one automation still lets the sibling run. A row created after the sweep is not reaped |
| Unit, timer (`relojManual`, `clienteControlado`) | `arrancar` arms nothing until the sweep's `tenant.findMany` resolves. A failed sweep logs and still arms. `detener()` during the sweep leads to no timer |
| Unit, signals (`EventEmitter` as the process) | SIGTERM and SIGINT call `cerrar` once, even across two signals, then `salir(0)`. A rejection leads to `salir(1)`. Integration: a real Fastify app with an `onClose` that calls `detener()` cancels the planner's timer |
| Console (existing fake DOM) | `omitida` shows `Omitida`. Both messages are legible. Nulls render as `—`. An unknown value renders generically |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: there is no file classification or execution |
| Git repository selection | N/A: there is no VCS automation |
| Commit state | N/A: there is no VCS automation |
| Push state | N/A: there is no VCS automation |
| PR commands | N/A: there is no PR automation |

Signal handling is the only process boundary. It is covered by the signal tests above.

## Migration / Rollout

No migration is required.

Size forecast is about 450–520 changed lines, which exceeds 400. DEC-101 allows this split:

- **Slice 1**: sweep, `arrancar`, `apagado.ts`, `server.ts` and the comments.
- **Slice 2**: overlap guard, console and bitácora.

Each slice is green on its own.

## Open Questions

- [ ] OQ-1: Should these design-level resolutions be recorded in `docs/01-decisiones.md` as a CH-13-style "Resoluciones de nivel diseño" block? This is the user's call (AGENTS.md).
- [ ] OQ-2: In the `omitida` row, `duracionMs` is null and `finalizadaEn = iniciadaEn`. The spec does not define either.
- [ ] OQ-3: Exit after close, and ignore a second signal (no forced exit). The Docker SIGKILL grace period is the backstop, and the sweep then cleans up.
