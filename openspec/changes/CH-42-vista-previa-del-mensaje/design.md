# Design: CH-42 — Message preview for an automation, in the console, without sending

Inputs: proposal.md, the five delta specs, DEC-189 (a), DEC-195 (exploration decisions 1–3), DEC-186, DEC-193, DEC-187, DEC-188, DEC-192, DEC-162, DEC-131. Delivered as one PR with `size:exception` (exploration decision 4(a)).

## 0. What this design settles inside DEC-195

DEC-195 fixes the origin, the place and the frame. The rest are implementation choices that need no new decision record:
- **Where the shared steps live**: a new module `src/automatizaciones/corrida.ts` (§2).
- **Where the route lives**: a new module `src/automatizaciones/vista-previa.ts`, registered from inside `registerAutomatizacionRoutes`, so every caller of that registrar gets it (§3).
- **How the route knows SMTP is configured**: the boot notifier's `!== null`, the signal the scheduler already uses, passed down as a boolean (§4).
- **When `correo` is built**: on `enviar`, `sin-destinatario` and `no-configurada`; null on rows 1–3 of the precedence table, where a run builds no message (§3).
- **A deactivated automation**: `409 automatizacion-desactivada`, as the adjust route answers, since the console only offers the preview on active rows.
- **The `srcdoc` guard**: the console test forbids `srcdoc` in both documents today (`consola.test.ts:7373`); it becomes "none in the login document, exactly once in the console document" (§6).

## 1. Technical approach

Extract the planner's two pure-ish steps (everything before the dial, and the renderer input) into exported functions, make the planner call them with no behaviour change, and build the preview route on the same functions plus `decidirNotificacion` and `componerCorreo`. The route dials once (no retry, like every console path), audits like the template test, and never sees a notifier. The console adds one row action and one read-only pop-up that reuses `mostrarResultadoPrueba` for refusals and rows, and shows the HTML part in an `iframe` with an empty `sandbox`.

## 2. Shared steps (`src/automatizaciones/corrida.ts`, new)

Today both steps are closures inside `crearPlanificador`: `resultadoDeCorrida` (`planificador.ts:225`, page at `:262`) and the message glue in `notificar` (`planificador.ts:350`, `mensaje` at `:372`, `respaldoDe` at `:386`).

```ts
/** The automation columns the steps read (a subset of the planner's AutomatizacionACorrer). */
export interface AutomatizacionDeCorrida {
  conexionId: string;
  valores: unknown;
}

/** The template columns the steps read: the planner's PlantillaACorrer, moved here and exported. */
export interface PlantillaDeCorrida {
  sql: string;
  parametros: unknown;
  entidades: unknown;
  nombre: string;
  automatizacion: string;
  encabezadoMensaje: string | null;
  lineaMensaje: string | null;
}

export type PreparacionCorrida =
  | { ok: true; sql: string; destino: DestinoPostgres & { id: string }; sentencia: SentenciaPreparada }
  | { ok: false; rechazo: RechazoPreparacion; problemas: ProblemaParametro[] };

/**
 * DEC-71 gate → componerSentencia → prepararSentencia → destinoDeConexion, in this order, reads
 * through the scoped client. ErrorCredencialIlegible becomes the `credencial-ilegible` refusal;
 * any other throw propagates, as today. `problemas` is non-empty only for `valores-invalidos`.
 */
export async function prepararCorrida(
  prisma: PrismaAislado,
  automatizacion: AutomatizacionDeCorrida,
  plantilla: Pick<PlantillaDeCorrida, 'sql' | 'parametros' | 'entidades'>,
  canales: AbridorDeCanales,
): Promise<PreparacionCorrida>;

/** The run's page: one page of the row cap (DEC-19), from row 0. */
export function peticionDeCorrida(
  preparada: Extract<PreparacionCorrida, { ok: true }>,
  topeFilas: number,
): PeticionEjecucion; // { ...camposDeDestino(destino), sentencia, limite: topeFilas, desplazamiento: 0, topeFilas }

/** The renderer input: the code at planificador.ts:372-385, unchanged. */
export function entradaDeCorreo(
  plantilla: PlantillaDeCorrida,
  resultado: EjecucionExitosa,
  fecha: Date,
  zona: string,
): EntradaCorreo;
```

Planner after the extraction:
- `resultadoDeCorrida`: `const p = await prepararCorrida(prisma, automatizacion, plantilla, canales); if (!p.ok) return p.rechazo; return conectarConReintentos(automatizacion.id, peticionDeCorrida(p, loadConfig().maxFilasPorConsulta), conteo);`. `loadConfig()` is still read after `destinoDeConexion`, as today, so even a throw from it lands at the same point.
- `notificar`: inside the existing `try`, after the unreachable guard, `const entrada = entradaDeCorreo(plantilla, resultado, iniciadaEn, zonaHoraria); const correo = componerCorreo(entrada); respaldo = respaldoDe(entrada.mensaje, resultado.columnas);`. The `enviando` write, `notificador.enviar` and the catch stay where they are.
- `PlantillaACorrer` becomes an alias of `PlantillaDeCorrida`; the select at `correr` is unchanged.

**Why a new module.** `planificador.ts` imports `loadConfig` and owns the timer; a route importing it would pull the scheduler into the HTTP layer. `automatizaciones.ts` holds pure functions only, and `prepararCorrida` reads the database. `corrida.ts` sits between them and imports neither the notifier nor the planner.

Rejected: exporting the closures from `planificador.ts` (couples the route to the scheduler module); duplicating the four steps in the route (the drift DEC-195 asks to avoid); one function that also dials (the planner retries and the console must not, `server.ts` CH-17b comment).

## 3. The route (`src/automatizaciones/vista-previa.ts`, new)

```ts
export type DecisionVistaPrevia = 'enviar' | OmisionNotificacion | null;

export interface CorreoVistaPrevia { asunto: string; texto: string; html: string }

/** The template test's 200 body, plus the three preview fields. */
export type RespuestaVistaPrevia = ResultadoEjecucion & {
  decision: DecisionVistaPrevia;
  para: string[];
  correo: CorreoVistaPrevia | null;
};

/** Pure: steps 7-9 below, unit-tested without a database. */
export function respuestaDeVistaPrevia(
  ejecucion: ResultadoEjecucion,
  automatizacion: { destinatarios: readonly string[]; minimoFilas: number },
  plantilla: PlantillaDeCorrida,
  correoConfigurado: boolean,
  fecha: Date,
  zona: string,
): RespuestaVistaPrevia;

export interface OpcionesVistaPrevia {
  /** CH-19c1: the agent session registry. Absent means SIN_AGENTES, which fails closed. */
  canales?: AbridorDeCanales;
  /** Whether the boot notifier exists (SMTP_HOST set). Absent means false. */
  correoConfigurado?: boolean;
}

export function registerVistaPreviaRoute(
  app: FastifyInstance,
  prisma: PrismaAislado,
  zonaHoraria: string,
  topeFilas: number,
  opciones: OpcionesVistaPrevia,
): void;
```

`POST /automatizaciones/:id/vista-previa`, no body schema (like `/desactivar`):

1. `prisma.automatizacion.findUnique({ where: { id }, select: { activo, plantillaId, conexionId, valores, destinatarios, minimoFilas } })` → `404 automatizacion-no-encontrada` / `409 automatizacion-desactivada`.
2. `prisma.plantilla.findUnique` with the planner's seven columns → `404 plantilla-no-encontrada`.
3. `prepararCorrida`; a refusal maps to the template test's bodies (`plantilla-prueba.ts:117-142` and `:211-215`):

| `rechazo.categoria` | Reply |
|---|---|
| `vista-canonica-no-aprobada` | `409 { error, entidades }` |
| `valores-invalidos` | `400 { error: 'solicitud-invalida', campos: unique problemas[].campo, problemas }` |
| `credencial-ilegible` | `409 { error: 'credencial-ilegible' }` |
| `conexion-no-encontrada` | `404 { error: 'conexion-no-encontrada' }` |

4. `ejecutarConsulta(peticionDeCorrida(p, topeFilas))`, once.
5. On `fallo`: the template test's sanitized `log.warn` (closed fields only), message `'automation preview execution failed'`.
6. `registrarEjecucion(prisma, app.log, request, { origen: 'automatizacion-vista-previa', conexionId: p.destino.id, sql: p.sql, consulta: null, plantillaId: fila.plantillaId }, veredictoDeEjecucion(ejecucion))`. It already swallows and logs a write failure (DEC-162).
7. `decision = decidirNotificacion(ejecucion, destinatarios, correoConfigurado, minimoFilas)`, projected to `'enviar'` or `decision.notificacion`.
8. `correo = componerCorreo(entradaDeCorreo(plantilla, ejecucion, fecha, zona))` when `ejecucion.resultado === 'ok'` and the projected decision is `enviar`, `sin-destinatario` or `no-configurada`; else `null`. `fecha` is `new Date()` and `zona` is `zonaHoraria`, as the planner passes its run's start and the deployment zone.
9. `200 { ...ejecucion, decision, para: [...destinatarios], correo }`.

**Why the flat body.** The console's `mostrarResultadoPrueba` (`consola.ts:4901`) already renders a template test's body: refusals, engine failures and rows. Spreading the engine result keeps that function reusable unchanged; a nested `{ resultado: {...} }` would need a second renderer.

**Why register it from `registerAutomatizacionRoutes`.** The isolation matrix (`aislamiento.test.ts:175`) and the route table test (`app/rutas.test.ts:44`) build the app through that registrar, so the new route is in both without a second registration to forget. The handler lives in its own file so the audit write and the dial are visible to grep, as `plantilla-prueba.ts` argues for itself.

Signature change: `registerAutomatizacionRoutes(app, prisma, zonaHoraria, topeFilas, opciones: OpcionesVistaPrevia = {})`. The three existing test callers compile unchanged.

## 4. Wiring the SMTP signal and the agent registry

- `src/server.ts` builds `notificador` (`:31`) before `registrarRutas` (`:54`). It passes `correoConfigurado: notificador !== null` in the deps. This is the same value the planner hands to `decidirNotificacion` as `notificador !== null` (`planificador.ts`, `notificar`); `decidirNotificacion`'s comment already defines `configurado` as "exactly whether `SMTP_HOST` is set".
- `src/app/rutas.ts`: `DependenciasRutas.correoConfigurado: boolean` (required, so the entry point must decide), and `registerAutomatizacionRoutes(app, prisma, zonaHoraria, topeFilas, { canales: registro, correoConfigurado })`. `topeFilas` and `zonaHoraria` already arrive from the one `loadConfig()` in `server.ts`, the same values the scheduler reads with.
- `src/app/rutas.test.ts:44` adds `correoConfigurado: false`.

Rejected: calling `leerSmtp(process.env)` in the route (a second read of the environment that can disagree with the boot notifier and can throw); passing the notifier itself (the route would hold a sender, which the specs forbid).

## 5. Audit (`src/auditoria/auditoria.ts`)

`OrigenEjecucion` (`:21`) gains `'automatizacion-vista-previa'`. `origen` is a free `String` in `RegistroEjecucion`, so no migration. The file's header comment lists the audited paths and gains the preview.

## 6. Console (`src/consola/consola.ts`)

**Row action.** In `listarAutomatizaciones` (`:2814`), inside `if (fila.activo === true)`, before «Ajustar»: `boton('Vista previa', 'vista-previa', function () { abrirVistaPrevia(String(fila.id)); })`. The class is not a `zd-` class, like `ajustar`.

**Markup**, after `#auto-ajuste` (`:949`), following its pattern (backdrop, `zd-dialog`, title, status line, actions) and the confirmation dialogs' empty `confirmar` span (`#tb-confirmar`, `:308`):

```
#auto-vista-previa   div.zd-dialog-backdrop[hidden]
  div.zd-dialog[role=dialog][aria-modal=true][aria-labelledby=vp-titulo]
    h2#vp-titulo.zd-dialog__title       «Vista previa del mensaje»
    p#vp-aviso.ayuda[role=status]        loading / refusal / «N filas.»
    p#vp-decision                        decision line
    p#vp-para                            «Para: …»
    div.zd-table-wrap.zd-table-scroll > table#vp-tabla.zd-table
    div#vp-mensaje[hidden]
      p#vp-asunto                        «Asunto: …»
      pre#vp-texto
      iframe#vp-html[sandbox=""][title="Mensaje en HTML"]
    div.zd-dialog__actions
      span#vp-confirmar[hidden]
      button#vp-cerrar.zd-btn.zd-btn--secondary[type=button]  «Cerrar»
```

Only classes the console already uses. The frame's and the `<pre>`'s size go in the document's existing `<style>` block (`:68-198`) as id rules with existing tokens, as `#mapeo-entidades pre` does (`:189`): `#vp-texto { white-space: pre-wrap; overflow-wrap: anywhere; }` and `#vp-html { width: 100%; min-height: …; border: … var(--…) }`. No new token, no new `zd-` class. No comment in the markup or the script may contain the word `srcdoc` or a backtick.

**Script** (new block after the adjust block, ~`:3075`):
- `dialogoVistaPrevia = crearDialogo({ fondo, primerCampo: botonCerrar, cancelar: botonCerrar, confirmar: vp-confirmar, hayCambios: function () { return false; }, alCerrar: limpiarVistaPrevia })`. No `descartar`/`seguir`, like the tenant baja.
- `limpiarVistaPrevia()` bumps `generacionVistaPrevia`, empties the texts, `vaciar(tabla)`, hides `#vp-mensaje`, and calls `mostrarHtmlVistaPrevia('')`.
- `mostrarHtmlVistaPrevia(html)` is the only place that names the property: `marcoVistaPrevia.srcdoc = String(html);`. One occurrence in the document, as the guard requires.
- `abrirVistaPrevia(id)`: `ocultarBanner()`, `limpiarVistaPrevia()`, `aviso = 'Generando la vista previa…'`, `dialogoVistaPrevia.abrir()`, then `leerPrueba('/automatizaciones/' + encodeURIComponent(id) + '/vista-previa', { method: 'POST' })` (`:4849`). A null answer or a stale generation returns. `404`/`409` whose `error` is in `MENSAJES_AUTOMATIZACION` (`:1138`): that sentence in `#vp-aviso`, then `listarAutomatizaciones()`. Otherwise `mostrarResultadoPrueba({ aviso, tabla }, leido)`; on `true`, the count line is rewritten for the preview (`hayMas` → «Se leyó el tope de filas; el correo avisa que hay más.»), then the decision line from a closed map (`DECISIONES_VISTA_PREVIA`; an unknown value shows nothing), «Para», and, when `correo` is an object with string fields, `#vp-asunto`, `#vp-texto.textContent` and `mostrarHtmlVistaPrevia(correo.html)`, unhiding `#vp-mensaje`; else «Con este resultado una ejecución no arma un mensaje.».
- `ORIGENES_AUDITORIA` (`:5714`) gains `'automatizacion-vista-previa': 'Vista previa de automatización'`. The Consulta cell already shows «Plantilla <id>» when `plantillaId` is set (`:5767`).

**Why the frame is safe.** The empty `sandbox` gives the document an opaque origin with scripts, forms, pop-ups and top navigation off; `srcdoc` is set as a property on that frame's node, so the console's own document never parses the message. The console's rule "values reach the page through `textContent`" (header comment, `consola.ts:14-19`) still holds for the console document; the header comment gains a CH-42 paragraph naming the frame as the one exception, set as a property and sandboxed. DEC-131 (c) rejected server HTML in the console because it broke that rule; DEC-195 places it in an isolated frame instead. The HTML is `componerCorreo`'s output, already escaped cell by cell (`escaparHtml`).

**Copy** (voseo, `guidelines/lenguaje.md`): the spec's table of decision lines, «Vista previa», «Vista previa del mensaje», «Generando la vista previa…», «Para», «Asunto», «Cerrar», «sin destinatario». The C-09 guideline lists the row actions and gains «Vista previa» (both copies).

## 7. Data flow

```
console row «Vista previa»
  │ POST /automatizaciones/:id/vista-previa   (operator guard, X-Tenant-Id)
  ▼
vista-previa.ts
  ├─ automatizacion.findUnique (scoped) ──── 404 / 409 desactivada
  ├─ plantilla.findUnique ────────────────── 404
  ├─ corrida.prepararCorrida ─────────────── 409 vista | 400 valores | 409 credencial | 404 conexion
  │     (evaluarVistas → componerSentencia → prepararSentencia → destinoDeConexion)
  ├─ ejecutarConsulta(peticionDeCorrida(p, topeFilas))   one dial, read-only, no retry
  ├─ registrarEjecucion(origen 'automatizacion-vista-previa')   failure swallowed (DEC-162)
  ├─ decidirNotificacion(r, destinatarios, correoConfigurado, minimoFilas)
  ├─ componerCorreo(corrida.entradaDeCorreo(plantilla, r, now, zonaHoraria))   when buildable
  └─ 200 { ...r, decision, para, correo }
        no notifier · no Ejecucion · no row change

planificador.ts (unchanged behaviour)
  correr → resultadoDeCorrida → corrida.prepararCorrida → conectarConReintentos(peticionDeCorrida)
         → notificar → decidirNotificacion → corrida.entradaDeCorreo → componerCorreo
                     → ejecucion.update(enviando) → notificador.enviar
         → ejecucion.update(close)
```

## 8. File changes

| File | Change |
|---|---|
| `src/automatizaciones/corrida.ts` | New: `prepararCorrida`, `peticionDeCorrida`, `entradaDeCorreo`, `PlantillaDeCorrida`, `AutomatizacionDeCorrida`, `PreparacionCorrida` |
| `src/automatizaciones/planificador.ts` | Calls the three functions; `PlantillaACorrer` aliases `PlantillaDeCorrida`; header comment notes CH-42 |
| `src/automatizaciones/vista-previa.ts` | New: the route, `respuestaDeVistaPrevia`, the response types |
| `src/automatizaciones/automatizaciones-rutas.ts` | Optional `opciones` parameter; calls `registerVistaPreviaRoute`; header comment |
| `src/app/rutas.ts`, `src/server.ts` | `correoConfigurado` in the deps; `registro` and the flag reach the registrar |
| `src/auditoria/auditoria.ts` | `OrigenEjecucion` gains the value; header comment |
| `src/consola/consola.ts` | Row action, pop-up markup, two `<style>` id rules, script block, `ORIGENES_AUDITORIA`, header comment |
| `src/automatizaciones/vista-previa.test.ts` | New: pure and DB tests (§9) |
| `src/consola/consola.test.ts` | Ids, hidden ids, button lists (`:1325`), `sinPeligros` (`:7373`), pop-up and audit-label tests |
| `src/aislamiento/aislamiento.test.ts` | One matrix row |
| `src/app/rutas.test.ts` | `correoConfigurado: false` |
| `docs/guia/06-automatizaciones.md` | The preview: what it runs, that it sends nothing, its audit row |
| `.claude/skills/zerodashboard-design/guidelines/consola.md`, `.agents/skills/zerodashboard-design/guidelines/consola.md` | C-09 list actions gain «Vista previa» and one line on the pop-up |
| `docs/02-mapa-de-changes.md` | CH-42 row: a row action and a pop-up, not a detail screen |
| `src/automatizaciones/planificador.test.ts` | **Unchanged** |

## 9. Testing strategy

- **Pure** (`vista-previa.test.ts`, no database): `respuestaDeVistaPrevia` for each decision: `enviar` with two addresses (`correo` set, `para` in order), `sin-destinatario` and `no-configurada` (`correo` set), `omitida-bajo-minimo`, `omitida-sin-filas` and a `fallo` (`correo` null, `decision` null for the failure), a `hayMas` result under the minimum (`enviar`). Parity: for the same template, result, instant and zone, `correo` deep-equals `componerCorreo(entradaDeCorreo(...))`; a line naming a missing column gives the table. `entradaDeCorreo` with one text null gives `mensaje: null`.
- **Structural**: a test reads `vista-previa.ts` and `corrida.ts` and asserts neither imports `./notificador.js` nor `./planificador.js` and neither names `ejecucion.` (the `Ejecucion` delegate). This is the static half of "never sends, never records a run".
- **DB** (`vista-previa.test.ts`, live database, skip when unreachable; the fixture copies `auditoria-registro.test.ts`: operator session, a read-only role on a test schema, an approved `producto` view, a template, an automation):
  - a preview reaching the minimum: `200`, rows, `decision`, `para`, `correo`; then zero `Ejecucion` rows for the automation, the automation row deep-equal to before, and exactly one `RegistroEjecucion` with `origen` `automatizacion-vista-previa`, the connection, the composed statement and `plantillaId`, and no recipient, subject or cell in any column;
  - `correoConfigurado: true` vs `false` on two apps: `enviar` vs `no-configurada`, both with `correo`;
  - a row cap of 2 on three rows with `minimoFilas` 5: two rows, `hayMas`, `enviar`;
  - refusals, each with zero audit rows: unknown id `404`, deactivated `409`, unapproved view `409` with `entidades`, stale `valores` `400` with `problemas`;
  - a query failing at execution: `200` `fallo`, `correo` null, one audit row `fallo`;
  - an audit write made to fail (the `auditoria-registro.test.ts:273` technique): the normal `200` and one `error` log line.
- **Planner unchanged**: `planificador.test.ts` is not edited; `git diff --exit-code master -- src/automatizaciones/planificador.test.ts` in the verify step, and the suite passes on the DB run. This is the proof the extraction did not move the run.
- **Isolation** (`aislamiento.test.ts`): a `POST /automatizaciones/:id/vista-previa` row before `/desactivar` (whose owner control deactivates the fixture, which the preview would answer `409 automatizacion-desactivada`). The cross-tenant half expects `404 automatizacion-no-encontrada` with the existing leak checks (statement, credential, tenant id, automation id, recipients). The owner control's expected status is `409`: the fixture's template reads `pedido`, which has no view on either connection (`:150-152`), so the owner reaches the DEC-71 gate, which proves the route resolved the caller's own automation.
- **Console** (`consola.test.ts`): new ids in `IDS` (`auto-vista-previa`, `vp-titulo`, `vp-aviso`, `vp-decision`, `vp-para`, `vp-tabla`, `vp-mensaje`, `vp-asunto`, `vp-texto`, `vp-html`, `vp-confirmar`, `vp-cerrar`) and `auto-vista-previa`, `vp-mensaje`, `vp-confirmar` in `IDS_OCULTOS`; button lists at `:1325` become `['Ver ejecuciones', 'Vista previa', 'Ajustar', 'Desactivar']` (`:1339` stays); `sinPeligros` keeps `innerHTML`, `outerHTML`, `insertAdjacentHTML` forbidden in both documents, forbids `srcdoc` in the login document, and requires exactly one `srcdoc` in the console document, matched as `.srcdoc = `; a markup test that the only `<iframe` is `id="vp-html"` with `sandbox=""` and that the script never contains `sandbox`; G3' stays as is. Behaviour, with queued answers: the `POST` URL, tenant and no body; each decision line; «Para» and «sin destinatario»; `srcdoc` equal to the received HTML; `<pre>` text verbatim; `correo` null hides `#vp-mensaje`; `409` vista, `400`, `fallo`, `404` with list reload; a tenant switch mid-flight closes the pop-up and drops the answer; «Cerrar» is the only button. The audit screen shows «Vista previa de automatización».
- **Commands**: `npm test` for the unit and console suites; `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` for the DB suites (preview, isolation, planner, audit).

## 10. Size forecast

| Area | Lines |
|---|---|
| `corrida.ts` + planner edits | ~70 |
| `vista-previa.ts` + registrar, deps, server | ~110 |
| Audit origin | ~5 |
| Console markup, styles, script, audit label | ~130 |
| Tests (preview pure + DB ~200, console ~90, isolation ~15, rutas ~1) | ~305 |
| Docs | ~25 |
| **Total** | **~645** |

`size:exception` accepted by the user on 2026-11-03.

## 11. Open questions

None.
