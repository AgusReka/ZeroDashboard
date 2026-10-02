# Exploration: CH-18 — Engine: duplicate-notification control and cross-tenant failure isolation (X6, X8)

Status: explore done. Not ready for proposal: DEC-107 to DEC-111 below must be registered in `docs/01-decisiones.md`, and Q1 to Q6 answered by the user, before `sdd-propose` (AGENTS.md: no architecture decision is taken by an agent).

Stories (`docs/mapa-historias.md:111,113`):

| Story | Criterion | Release |
|---|---|---|
| X6 | "Control de envío: una ejecución produce como máximo una notificación" | R2 |
| X8 | "Aislamiento de errores en la ejecución; una conexión caída no detiene el planificador" | R2 |

Boundaries: CH-19 (agent connectivity, DEC-94), N3 (per-template HTML), catch-up (DEC-95) and multi-instance (DEC-75, DEC-99) stay out. Rules 2, 5 and 6 of `AGENTS.md` are the live constraints.

## Current state

### Notification send (X6)

- One send per run, by construction. `correr()` (`src/planificador.ts:367-442`) opens an `en-curso` row (391-394), runs the pipeline (404-411), calls `notificar()` once (413), and closes the row with one `update` (417-425). `notificar()` (326-354) calls `notificador.enviar` at most once (350), only when `decidirNotificacion` says so (`src/automatizaciones.ts:316-334`).
- The send is never retried: DEC-97 and the `email-notification` spec. The CH-17b loop wraps only `ejecutarConsulta` (`planificador.ts:271-295`), so a retried dial does not repeat the send (test `CH-17b 2.3`, `planificador.test.ts:1030-1057`).
- Interrupted runs are never re-executed (DEC-99, `barrerInterrumpidas` `planificador.ts:548-579`) and missed fires are never caught up (DEC-95). No code path can send twice for one run today.
- `Notificador.enviar` (`src/notificador.ts:198-224`) never throws and bounds the send with `SMTP_TIMEOUT_MS` (default 10000). When the outer limit wins it returns `tiempo-agotado`, but the server may already have accepted the message (CH-14 bitácora limit).
- Residual gaps (CH-14 bitácora limits, "queda para CH-17/CH-18"):
  1. Crash between send and close: the row is swept as `fallo/interrumpida` with `notificacion` null, so the log cannot say whether the mail left.
  2. A send that times out may still be delivered, yet the row says `fallo-envio` and the console says "el correo no se envió" (`src/consola.ts:217`).
  3. The at-most-once invariant is not stated as a requirement across retry, overlap skip, sweep and shutdown. `email-notification` and `automation-scheduling` Purposes still say duplicate suppression and isolation are out of scope (CH-17, CH-18).
- "Same event" across runs is not covered: two consecutive runs returning the same rows send two mails.

### Tick execution and failure isolation (X8)

- Fully serial. `ejecutarTick` (`planificador.ts:492-507`) sets `anterior = ahora` first, lists active tenants and awaits each in order. The timer re-arms only in `finally` of the previous tick (`disparar`, 523-534).
- Isolation that exists: a per-run catch (478-488) and a per-tenant catch only in the boot sweep (557-571, DEC-102).
- Gap 1 (code): `await conTenantActivo(tenant, () => correrVencidas(desde, ahora))` (505) has no try/catch. A throw outside `correr()` for tenant A aborts the tick; later tenants lose their window (`anterior` already advanced, no catch-up, DEC-95).
- Gap 2 (suspected, unverified): `iniciarConexion` creates `new pg.Client(...)` (`src/db-probe.ts:105-112`) with no `'error'` listener. A connection that dies after login may emit an unhandled `'error'` and terminate the process. Needs a spike (socket-destroying forwarder).
- Latency coupling (accepted by DEC-98): a dead connection blocks the tick ~25 s by default (45 s at the cap). A slow query costs up to `QUERY_TIMEOUT_MS + 2000`; slow SMTP up to `SMTP_TIMEOUT_MS`.
- Shared state assuming serial execution: `cancelarPausa` single slot (`planificador.ts:515`), `enCurso` and `detenido` flags.
- The own-database pool (`PrismaPg`, default settings) is shared with HTTP; size unverified.

## Inherited open items

| # | Item | Source |
|---|---|---|
| 1 | DEC-96 race window: reopens if CH-18 introduces parallelism | DEC-96 |
| 2 | Dead connection blocks the serial tick (~3 x (timeout + 5 s)) | DEC-98 |
| 3 | "Reintento o reporte de fallas de notificación" (retry half contradicts DEC-97) | CH-17b bitácora |
| 4 | Crash between send and close; timed-out send may deliver | CH-14 bitácora |
| 5 | Slow SMTP delays other runs | CH-14 bitácora |
| 6 | Single-instance assumption | DEC-75, DEC-99 |
| 7 | No catch-up: fires lost when a tenant lane fails | DEC-95 |
| 8 | Spec/comment text naming CH-18 as pending: `planificador.ts:43-45`, `446-448`, `automation-scheduling` and `email-notification` Purposes | specs, code |

## Approaches

### X6

| Option | Description | Cons | Effort |
|---|---|---|---|
| X6-A | Explicit invariant: spec requirement + tests of at-most-once across retry, overlap skip, sweep, shutdown; fix console copy. No schema change. | Leaves crash ambiguity undocumented in the log | ~80 lines |
| X6-B | X6-A + write-ahead marker `notificacion='enviando'` before `enviar`; boot sweep closes it as `fallo/interrumpida` with `notificacion='incierta'`; timed-out send shown as "puede haberse entregado". `notificacion` is TEXT, no migration. | One extra UPDATE per notifying run; two new closed values; changes `execution-log` sweep requirement and console labels | ~260 lines |
| X6-C | Persisted notification record with unique key, inserted before send. | New entity + migration; edges toward an outbox (rule 6) | ~400 lines |
| X6-D | Content/cooldown dedupe across runs. | Persisted fingerprint (DEC-93, rule 5), per-template config (DEC-64/65), widens condition engine (rule 6) | High |

### X8

| Option | Description | Cons | Effort |
|---|---|---|---|
| X8-A | Per-tenant try/catch in `ejecutarTick`, closed-field log, continue; `'error'` listener on `pg.Client` if the spike confirms the crash. Serial. | Dead connection still delays others by the DEC-98 bound | ~170-200 lines |
| X8-B | A + one serial lane per tenant, at most K lanes (`TENANT_CONCURRENCY`, injected, default 1), tick barrier kept; `cancelarPausa` becomes a set. | Tick still ends with slowest lane; pool pressure; test determinism | ~320 lines |
| X8-C | Independent per-tenant loops, no barrier. | Orchestrator-like (rule 6); reopens overlap | ~450+ |
| X8-D | Per-connection circuit breaker (`omitida`). | New states with no story behind it | Medium |

## Effect on earlier decisions

- DEC-75: unchanged by any option.
- DEC-96: with X8-A/X8-B the window stays closed (lanes per tenant, ticks barrier-serial). Only X8-C, same-automation parallelism or a second instance reopen it. Partial unique index needs Prisma `partialIndexes` preview (7.4+), with a spike.
- DEC-98: with X8-B the worst case blocks the lane, not the whole tick; the barrier still delays the next tick.
- DEC-99/104/106: X6-B changes the sweep; X8-B requires `detener()` to cancel every pending pause.
- DEC-93, rule 5: no option persists result rows.
- DEC-83/DEC-97: X6-B extends `EstadoNotificacion`, no retry.

## Decisions not yet registered (DEC-107 to DEC-111, drafts)

- **DEC-107** — X6: "mismo evento" = una ejecución; envío como máximo una vez. Recomendado (a) una corrida; (b) mismo contenido y (c) enfriamiento quedan como límite del artefacto.
- **DEC-108** — X6: marca previa `enviando` y resultado `incierta` (recomendado b); alternativas: solo documentar (a), tabla de notificaciones (c).
- **DEC-109** — X8: aislamiento de errores por tenant dentro del tick (captura por tenant, log de campos cerrados; el listado fallido no recupera su ventana).
- **DEC-110** — X8: modelo de ejecución del tick: X8-A obligatorio; X8-B solo si se quiere aislamiento de latencia.
- **DEC-111** — la ventana de carrera de DEC-96 sigue cerrada; sin índice único parcial (si X8-A/B).
- Aparte: `'error'` listener en `src/db-probe.ts` (compartido con rutas de CH-03/CH-04), requiere aprobación explícita.

## Recommendation

1. Slice 1 (X8-A): per-tenant isolation, `pg.Client` listener if spike confirms, spec deltas.
2. Slice 2 (X6-B, or X6-A if marker declined): invariant + tests, marker, `incierta`, console copy.
3. Slice 3 (X8-B): only if latency isolation is wanted; cuttable.
4. Reject X6-C, X6-D, X8-C, X8-D (rule 6).

## Affected areas

`src/planificador.ts`, `src/db-probe.ts`, `src/automatizaciones.ts` (`EstadoNotificacion`, `cierreConNotificacion`), `src/consola.ts` (labels, line 217; no backtick in the template literal), `src/config.ts`/`src/server.ts`/`.env.example`/`docker-compose.yml` only for X8-B. Specs: `automation-scheduling`, `email-notification`, `execution-log`, `tenant-isolation`, `query-console`. No migration for X6-A/B or X8-A/B. New `docs/bitacora/CH-18-*.md`.

## Test strategy

Strict TDD against live PostgreSQL (`node:test`, fake `Reloj`, `notificadorFalso`, tenants per test). X8-A: Proxy that throws in one tenant's context (pattern `clienteDeBarrido`), socket-destroying forwarder spike. X6: notifier call-count across retry, overlap skip, sweep, `detener()`; for X6-B a stuck notifier + simulated crash yields `fallo/interrumpida/incierta`. X8-B: deferred-promise lanes, per-lane tenant-id assertions, cap respected, default 1 = serial. Final: `npm test` and `npx tsc --noEmit` (last recorded 671/671).

## Size and delivery

| Work unit | Content | Changed lines |
|---|---|---|
| 1 | X8-A | 170-200 |
| 2 | X6-B | 240-290 |
| 3 (optional) | X8-B | 300-360 |

Without unit 3: ~410-490 lines (budget risk Medium). With unit 3: ~710-850 (High). Single PR within 400 lines: unit 1 + X6-A (~250-300). History shows forecasts undercount ~40%.

## Product questions (Q1-Q6)

1. Q1 "mismo evento": (a) una corrida [rec.]; (b) mismo contenido; (c) enfriamiento.
2. Q2 crash/timeout: (a) documentar y corregir copy; (b) marca `enviando`/`incierta` [rec.]; (c) registro persistido. Confirmar: no se reintenta (DEC-97), interrumpidas no se re-ejecutan (DEC-99), "reporte de fallas" ya cubierto por `fallo-envio` + listado.
3. Q3 modelo X8: (a) serial con aislamiento; (b) carriles por tenant acotados; (c) lazos independientes; (d) cortacircuitos. Rec.: (a), (b) solo si hace falta para la tesis.
4. Q4 `'error'` listener en `db-probe.ts` tras confirmar el crash con spike: incluir [rec.] o solo documentar.
5. Q5 DEC-96: seguir cerrada sin índice único parcial [rec.], o adoptar el índice.
6. Q6 entrega: confirmar fallo de tenant solo en log y ventana perdida aceptada (DEC-95); tamaño: PR único con `size:exception` o recorte.

## Risks

Rule 6 pressure (X8-B, X6-B); two unverified points (pg `'error'` crash, pool size) need a spike; spec drift if console labels are missed; shared single-slot state with X8-B; "reporte de fallas de notificación" must not become a retry; `docs/bitacora/_plantilla.md` does not exist (follow CH-17b bitácora).
