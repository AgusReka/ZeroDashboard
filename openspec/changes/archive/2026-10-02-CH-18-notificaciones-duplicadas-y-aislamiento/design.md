# Design: CH-18 — At-Most-Once Notification and Per-Tenant Failure Isolation (X6, X8)

## Technical Approach

The change has three units, all inside the existing serial engine (DEC-110). No new modules, no migration, no parallelism.

- **Unit 1 (X8-A):** `ejecutarTick` gets a per-tenant catch modelled on the boot sweep (DEC-102, DEC-109). The `'error'` listener on `pg.Client` is added only if a socket-destroying test proves that the process crashes (DEC-111).
- **Unit 2 (X6-B):** a write-ahead `notificacion='enviando'` is written immediately before `notificador.enviar`. The close path is unchanged. The boot sweep closes a marked row as `incierta` (DEC-107, DEC-108). The console shows that a timed-out send may have been delivered.
- **Unit 3:** removes the "CH-18 pending" wording and adds the bitácora.

## Decisions (design-level, under DEC-107..DEC-111)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Tenant catch | Wrap `planificador.ts:505` in try/catch. Log `log.error({ tenantId, error: 'error-interno', nombreError }, 'scheduled tick failed for a tenant')` and continue | Logging at `warn`, which is the level the sweep uses | Same fields as the sweep (`:567-570`). `error` level because the log is the only record of a lost window (DEC-109) |
| Window | `anterior = ahora` stays first (`:493-494`). A failed tenant does not recover its window | Rewinding per tenant | DEC-95 and DEC-109 |
| Marker position | Inside `notificar`'s `try`, after `componerCorreo` (`:341-349`) and before `enviar` (`:350`) | Placing it in `correr` before `notificar` | No send can happen without the marker. A compose throw writes no marker. A marker-write throw becomes `excepcion`, which takes the existing CH-14 path and calls no notifier |
| Marker write | `prisma.ejecucion.update({ where: { id }, data: { notificacion: 'enviando' }, select: { id: true } })`. `notificar` gains `id` | A raw SQL statement | Scoped client (rule 2). This is the same write form as the close (`:417`) |
| Marker types | `EstadoNotificacion` gains `'enviando' \| 'incierta'`. `CierreNotificado.notificacion` excludes both | Letting a close carry them | The compiler then rules out closing a row as `enviando`. `cierreConNotificacion`'s body is unchanged |
| Sweep | Two `updateMany` calls per tenant, in the same callback. The first targets `{ estado:'en-curso', notificacion:'enviando' }` and writes `{...CIERRE_INTERRUMPIDA, notificacion:'incierta'}`. The second keeps the existing call | One conditional SQL `UPDATE`, which bypasses the scoped client. Also a `$transaction` | The order matters: the second call would set the marker to null. If the pair fails halfway, the rows already closed stay closed and the rest stay `en-curso` until the next boot (DEC-102 fail-open). `cerradas` is the sum, and the log adds `inciertas` |
| Timeout | The row is unchanged (`fallo-envio`/`tiempo-agotado`). Only the console copy changes | Writing `incierta` on timeout | DEC-108 says it is *shown* as "puede haberse entregado". `tiempo-agotado` also covers nodemailer `ETIMEDOUT` (`notificador.ts:138`), so the conservative copy fits both |
| Listener | `cliente.on('error', () => {})` right after `new pg.Client` (`db-probe.ts:105-112`). The error is never read | Logging the error | The failure already reaches the caller through the rejected connect or query. `db-probe.ts` has no logger, and rule 5 forbids reading raw driver text |

No decision outside DEC-107..DEC-111 was needed.

## Notify Flow with the Marker

```
correr            Ejecucion (scoped)      notificar              Notificador
  |-- findFirst en-curso? -->|  (overlap: omitida, return; no send)
  |-- create en-curso ------>|
  |-- pipeline (dial retry loop only; never the send)
  |-- notificar(id) ------------------------>|
  |                          |  decidir: !enviar -> return omission (no marker)
  |                          |  componerCorreo (throw -> excepcion, no marker)
  |                          |<- update notificacion='enviando'  (throw -> excepcion, no send)
  |                          |              |-- enviar ------------->|  (once; never throws;
  |                          |              |<- enviada|fallo -------|   outer limit -> tiempo-agotado)
  |<-- salida ---------------------------------|
  |-- update {...cierre, intentos, finalizadaEn} -> notificacion = enviada | fallo-envio
crash after the marker  =>  boot sweep: en-curso+enviando -> fallo/interrumpida/incierta
crash before the marker =>  boot sweep: en-curso          -> fallo/interrumpida/null
```

`detener()` (`:591-597`) awaits the in-flight tick. A send that has already started finishes and closes. The overlap check skips a row that is still `en-curso`/`enviando`. A close write that fails after a send leaves `enviando`, and the next boot records it as `incierta`.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/planificador.ts` | Modify | Tenant catch (`:502-506`). `notificar(…, id)` with the marker (`:326-354`, call `:413`). Two-step sweep (`:559-564`, log `:578`). Wording `:43-45`, `:444-448` |
| `src/automatizaciones.ts` | Modify | `EstadoNotificacion` (`:289-294`), `MarcaNotificacion`, `CierreNotificado` (`:376`) |
| `src/consola.ts` | Modify | `MENSAJES['notificacion:tiempo-agotado']` (`:217`) and its comment (`:216`). `ETIQUETAS_NOTIFICACION` (`:293-299`) |
| `src/db-probe.ts` | Conditional | Listener (`:105-112`), only if the spike test proves the crash |
| `*.test.ts` (planificador, automatizaciones, consola, db-probe) | Modify | See below |
| `docs/bitacora/CH-18-notificaciones-duplicadas-y-aislamiento.md` | Create | Spike evidence, limits (X8-B/C/D, X6-C/D, content dedupe) |

Console copy (neutral Spanish, no backtick anywhere in the document):

- `'enviando': 'Envío en curso'`, `'incierta': 'Sin confirmar: puede haberse entregado'`. The raw tokens never appear on the page.
- `'notificacion:tiempo-agotado': 'El servidor de correo no respondió dentro del tiempo permitido. La consulta se ejecutó, pero no se confirmó el envío: el correo puede haberse entregado.'` The other four messages are unchanged.

## Testing Strategy (strict TDD, `node:test`, live PG, fake `Reloj`, `notificadorFalso` counts)

| Unit | Test (RED first) |
|---|---|
| 1 | **1.1** Generalize `clienteDeBarrido` (`planificador.test.ts:259-282`) with `fallaListadoEn`, so that `automatizacion.findMany` throws in one tenant's context. Use two tenants and make the failing one the lower id. Assert: the other tenant's run is `ok`/`enviada` and its notifier is called once; the failing tenant has 0 rows; there is exactly one log line `{msg, tenantId, error:'error-interno', nombreError:'Error'}`; `'base caida secreta'` and the tenant name are absent. RED today because `ejecutarTick` rejects. **1.2** On the same planner, tick 1 fails for A and tick 2 runs A healthy over the next window with cron `0 9 * * *`. A has 0 rows (window lost). **1.3** The Proxy records `tenantActivoOpcional()` for each listing as `[A, B]`, and every row carries its own `tenantId` |
| 1 spike | In `db-probe.test.ts`, skipped without PG. A child process `spawn(process.execPath, ['--import','tsx','--input-type=module','--eval', SCRIPT])` follows the `server.test.ts:55` pattern: a fixed argv with no shell, credentials passed through env, and a 15 s kill. The child starts a `net` forwarder (`planificador.test.ts:348-365`) and connects through `iniciarConexion`. It then destroys every forwarder socket in two scenarios: (a) idle after login, (b) during `SELECT pg_sleep(5)` with the rejection handled. It prints `SOBREVIVIO` and exits 0. The parent asserts exit 0 and the marker. The crash happens only in the child, so the runner never dies. **RED on unchanged code (non-zero exit) proves the crash:** add the listener and record the evidence in the bitácora. If a scenario is green on unchanged code, it is refuted and dropped. If every scenario is refuted, or the result is inconclusive or flaky, there is no test and no listener (DEC-111) |
| 2 | **2.1** Inside `enviar`, the fake reads the row as `en-curso`/`enviando`; it closes as `enviada`. Update `CH-14 5.7` (`:734`) from `notificacion: null` to `'enviando'`. **2.2** A Proxy on `ejecucion.update` counts marker writes. The count is 0 for zero rows, no recipient, no notifier, a failed query or a refusal. **2.3** When the marker write throws, the notifier is not called, the row is `fallo`/`notificacion`/`error-interno`/`fallo-envio`, and only the name is logged. **2.4** Crash: the notifier never resolves and the tick is left pending. `esperarA` waits for `enviando`. A new planner then runs `barrerInterrumpidas([t])`, which gives `fallo`/`interrumpida`/`incierta` with the other outcome columns null. The notifier count is 1. **2.5** Sweep: `enviando` becomes `incierta`, `null` stays `null`, and closed rows (including `enviada`) are untouched. Update `CH-17a 1.2` (`:817`, `:831-833`) to per-call pairs, with the `incierta` call first. **2.6** Each path calls the notifier at most once: a retried dial that then succeeds (`intentos` 2) gives 1 call; an overlap with a stuck `enviando` row gives `omitida` and 0 calls; `detener()` during a deferred send on the timer path gives 1 call, `enviada`, and no timer armed; a timeout (`5.9`) gives 1 call. **2.7** A pure table over every `SalidaNotificacion` checks that `cierreConNotificacion` never yields `enviando` or `incierta`. **2.8** Console (fake DOM, extending `consola.test.ts:861-908`): the two labels are shown; the timeout message matches `/puede haberse entregado/` and contains no `no se envió`; messages stay distinct; raw tokens are absent |
| 3 | `npm test` (last baseline 671/671) and `npx tsc --noEmit` |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation paths, Git selection, commit, push, PR commands | N/A: no file classification or VCS/PR automation |
| Subprocess | N/A for the product: no new production process. The spike's test-only child reuses the `server.test.ts` pattern, with a fixed argv and no shell |

## Risks

| Risk | Mitigation |
|---|---|
| The spike is flaky because the socket closes in a non-deterministic way | Destroy both forwarder sides. Inconclusive means no test and no listener |
| `--eval` with the tsx loader fails to resolve `.ts` | Fall back to the `tsx` CLI `--eval`. A fixture file is not used |
| The Prisma `PrismaPg` pool is outside the listener's scope | Recorded as a bitácora limit |
| `enviando` is shown for a send that never started (crash between the marker and `enviar`) | Conservative by design (DEC-108) |
| Two existing tests change (`5.7`, `CH-17a 1.2`) | Intended by DEC-108. Called out in the PR |

## Migration / Rollout

No migration (`notificacion` is TEXT). Single PR, `size:exception`. Rollback means reverting the PR. The reverted sweep sets `enviando` to null, and `incierta` rows show the placeholder `—`.

## Open Questions

None.
