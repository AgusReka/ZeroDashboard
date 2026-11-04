# Query Console Specification (CH-42 delta)

## Purpose
Each active automation offers «Vista previa»: a pop-up that runs the automation's query once and shows the rows, whether a run would send the message and to whom, the subject, the text part and the HTML part in an isolated frame (X10, DEC-189, DEC-195). It sends nothing and offers no way to send. The audit screen names the new origin.

## ADDED Requirements

### Requirement: Console Previews an Automation's Message (X10, DEC-189, DEC-195)

Each active automation in the list SHALL offer «Vista previa»; a deactivated one SHALL NOT. An active row's actions SHALL be, in this order, «Ver ejecuciones», «Vista previa», «Ajustar», «Desactivar». «Vista previa» SHALL open a pop-up (DEC-173) titled «Vista previa del mensaje» at once, saying «Generando la vista previa…», and send one `POST /automatizaciones/:id/vista-previa` with the active tenant and no body.

On a `200` with `resultado` `ok` the pop-up SHALL show, every value as text:
- the decision line, from `decision`:

| `decision` | Line |
|------------|------|
| `enviar` | «Se enviaría a: » followed by `para` joined by «, » |
| `omitida-sin-filas` | «No se enviaría: la consulta no devolvió filas.» |
| `omitida-bajo-minimo` | «No se enviaría: hay menos filas que el mínimo para avisar.» |
| `sin-destinatario` | «No se enviaría: la automatización no tiene destinatarios.» |
| `no-configurada` | «No se enviaría: el envío de correo no está configurado.» |

- «Para», with `para` joined by «, », or «sin destinatario» when it is empty;
- the rows in a table, rendered as the template test renders them, with the count «N filas.» and, when `paginacion.hayMas` is true, «Se leyó el tope de filas; el correo avisa que hay más.»;
- when `correo` is set: «Asunto» with `correo.asunto`, the text part in a `<pre>` as `textContent`, and the HTML part in the frame. When `correo` is null, the three SHALL be hidden and the pop-up SHALL say «Con este resultado una ejecución no arma un mensaje.»

The frame SHALL be the one `iframe` of the markup, with an empty `sandbox` attribute (no permission token: no scripts, no same origin, no forms, no pop-ups, no top navigation) and a `title`. The script SHALL set only its `srcdoc` property, to `correo.html` exactly as received, and SHALL NOT set its `sandbox`, `src` or any attribute. An emptied pop-up SHALL set `srcdoc` to the empty string.

A refusal or a failure SHALL be shown inside the pop-up as a legible message, never a raw body: `409 vista-canonica-no-aprobada` naming the entities, `400` naming the parameters, `409 credencial-ilegible`, and an engine failure with the console's failure message, all as the template test shows them; `404 automatizacion-no-encontrada` or `409 automatizacion-desactivada` with the automation screen's sentence, and the list SHALL reload; a network failure with «No se pudo contactar con la aplicación.». «Cerrar» and Escape SHALL close the pop-up; a tenant switch SHALL close it, and an answer still in flight SHALL land nowhere. The pop-up SHALL offer no control that sends, saves or schedules anything. Its ids SHALL be in the guarded list, it SHALL start hidden, its buttons SHALL be `type="button"`, and the script SHALL assign no `zd-` class for it.

#### Scenario: Row actions

- **GIVEN** an active and a deactivated automation are listed
- **THEN** the active row SHALL offer «Ver ejecuciones», «Vista previa», «Ajustar» and «Desactivar», in that order
- **AND** the deactivated row SHALL offer «Ver ejecuciones» only

#### Scenario: Previewing an automation that would send

- **GIVEN** an active automation `a-1` and an answer with `resultado` `ok`, two rows, `decision` `enviar`, `para` `["ops@empresa.com", "ventas@empresa.com"]` and a `correo`
- **WHEN** «Vista previa» is used on its row
- **THEN** one `POST /automatizaciones/a-1/vista-previa` SHALL be sent with the active tenant and no body
- **AND** the pop-up SHALL show «Se enviaría a: ops@empresa.com, ventas@empresa.com», the same «Para», the subject, a table with the two rows, «2 filas.», the text part in the `<pre>`, and the frame's `srcdoc` equal to `correo.html`

#### Scenario: Without recipients

- **GIVEN** an answer with `decision` `sin-destinatario`, `para` `[]` and a `correo`
- **WHEN** it is shown
- **THEN** the pop-up SHALL say «No se enviaría: la automatización no tiene destinatarios.», «Para» SHALL read «sin destinatario», and the subject, text and frame SHALL be shown

#### Scenario: Below the minimum

- **GIVEN** an answer with `decision` `omitida-bajo-minimo` and `correo` null
- **WHEN** it is shown
- **THEN** the decision line and the rows SHALL be shown, the subject, text and frame SHALL be hidden, and the pop-up SHALL say «Con este resultado una ejecución no arma un mensaje.»

#### Scenario: A gate refusal stays inside the pop-up

- **GIVEN** the preview is answered `409 vista-canonica-no-aprobada` naming `producto`
- **WHEN** the console handles it
- **THEN** the pop-up SHALL say that the view of `producto` is not approved on this connection, as the template test does, and SHALL show no rows and no message

#### Scenario: A failed query

- **GIVEN** the preview is answered `200` with `resultado` `fallo`
- **WHEN** the console handles it
- **THEN** the pop-up SHALL show the console's failure message for its `fase` and `categoria` and no message

#### Scenario: The automation is gone

- **GIVEN** the preview is answered `404 automatizacion-no-encontrada`
- **WHEN** the console handles it
- **THEN** the pop-up SHALL say «Esa automatización ya no existe para el tenant activo. Se actualizó la lista.» and the list SHALL reload

#### Scenario: The frame is isolated

- **GIVEN** the served console page
- **WHEN** the preview frame's markup is inspected
- **THEN** it SHALL be one `iframe` whose `sandbox` attribute is present and empty
- **AND** the script SHALL contain exactly one `srcdoc`, the property assignment on that frame, and SHALL NOT contain `sandbox`

#### Scenario: Markup in the message stays in the frame

- **GIVEN** an answer whose `correo.html` contains `<b>alerta</b>` and whose `correo.texto` contains `<b>alerta</b>`
- **WHEN** it is shown
- **THEN** the frame's `srcdoc` SHALL be that HTML unchanged, and the `<pre>` SHALL show the text verbatim with no element created from it

#### Scenario: A tenant switch closes the preview

- **GIVEN** the pop-up is open and its answer has not arrived
- **WHEN** the active tenant changes and the answer then arrives
- **THEN** the pop-up SHALL be closed and nothing of that answer SHALL be shown

#### Scenario: Nothing to send from the pop-up

- **GIVEN** the pop-up is open with an answer
- **WHEN** its controls are listed
- **THEN** «Cerrar» SHALL be the only button

## MODIFIED Requirements

### Requirement: Console Page Is Servable
The system SHALL serve a console page at `GET /consola`, without a session and without `X-Tenant-Id`. With a valid console session the page SHALL present a SQL input control and a way to trigger execution of the entered statement against a registered connection. Without a valid session it SHALL instead present the login screen and SHALL NOT contain the SQL input control. Both documents MUST link the shared stylesheet `/ui/styles.css` and MUST NOT carry the former inline `<style>` block of the full console styling. Both MUST contain exactly one closing script tag, no backtick, and no markup-assigning properties (`innerHTML`, `outerHTML`, `insertAdjacentHTML`) in their scripts. The login document MUST NOT contain `srcdoc`. The console document MUST contain `srcdoc` exactly once: the script's assignment to the message preview's frame, whose markup carries an empty `sandbox` attribute (DEC-195). The console document MUST keep every guarded element id. The scripts MAY use `zd-` class names. The exact markup is otherwise a design-level concern.
(Previously: `srcdoc` was forbidden in both documents.)

#### Scenario: Requesting the console page with a session
- **GIVEN** a valid console session
- **WHEN** the console page is requested
- **THEN** the response SHALL be a page containing a SQL input control and a way to trigger execution

#### Scenario: Requesting the console page without a session
- **GIVEN** no cookie, or an expired or unknown session
- **WHEN** the console page is requested
- **THEN** the response SHALL be 200 with the login screen and SHALL NOT contain `<textarea id="sql"`

#### Scenario: Page links the shared stylesheet
- **WHEN** the console page is requested, with or without a session
- **THEN** it SHALL contain a `<link rel="stylesheet" href="/ui/styles.css">`
- **AND** it SHALL NOT contain the former inline full-console `<style>` rules

#### Scenario: Script hazards stay out of the page
- **WHEN** either document and its script are scanned
- **THEN** each SHALL contain exactly one closing script tag and no backtick
- **AND** neither SHALL contain `innerHTML`

#### Scenario: The only srcdoc is the sandboxed preview frame
- **WHEN** both documents are scanned for `srcdoc`
- **THEN** the login document SHALL contain none
- **AND** the console document SHALL contain exactly one, a property assignment in the script, and its only `iframe` SHALL carry `sandbox=""`

#### Scenario: Script may reference the shared classes
- **WHEN** the script text is scanned for `zd-`
- **THEN** the scan SHALL NOT fail the page

### Requirement: Audit Screen
The Auditoría screen SHALL be scoped to the active tenant. Each time it is shown, and when the active tenant changes while it is shown, it SHALL read `GET /auditoria` with the current filters and list the rows newest first. With no active tenant it SHALL say «Elegí un tenant para ver su auditoría.» and send nothing.

The filters SHALL be «Desde» and «Hasta» (dates) and «Resultado» (Todos, OK, Falló); «Filtrar» SHALL reload the list with them. A date SHALL mean the operator's local day: «Desde» is sent as the instant the local day starts, «Hasta» as the last millisecond of the local day, both in ISO form. An empty filter SHALL not be sent. «Desde» later than «Hasta» SHALL be refused on screen with nothing sent.

Each row SHALL show, as text:

| Column | Content |
|---|---|
| Fecha y hora | `creadoEn`, local date and time to the second |
| Operador | `operadorNombre` |
| Origen | Consulta, Prueba de plantilla, Validación de mapeo, Prueba de conexión or Vista previa de automatización |
| Conexión | The connection's name from `GET /conexiones`; an unknown id shows its first eight characters |
| Consulta | The saved query's name and version («Stock v3»), the template id for a template test or a message preview, else «Ad hoc» |
| SQL | The statement cut to 80 characters, with the full statement available on demand |
| Filas | `filas`, or empty when null |
| Duración | `duracionMs`, in ms below one second and in seconds above |
| Resultado | «OK», or «Falló» followed by the console's failure message for `fase`, `categoria` and `codigo` |

The screen SHALL offer no way to change or delete a row. When the answer says `truncado`, the screen SHALL say that only the most recent 200 rows are shown and suggest narrowing the dates. An empty list SHALL say «No hay ejecuciones registradas con estos filtros.». A `400` SHALL say to check the dates; network, tenant and other HTTP failures SHALL be legible.
(Previously: the Origen column had no «Vista previa de automatización».)

#### Scenario: Listing the audit
- **GIVEN** an active tenant whose audit holds one failed run of the saved query "Stock" version 3 on connection "food-store" by operator "Ana"
- **WHEN** the hash becomes `#auditoria`
- **THEN** one `GET /auditoria` is sent with the active tenant
- **AND** the row shows "Ana", "Consulta", "food-store", "Stock v3" and "Falló" with the failure message, all as text

#### Scenario: A message preview row
- **GIVEN** an audit row with `origen` "automatizacion-vista-previa" and `plantillaId` "p-1"
- **WHEN** the audit is listed
- **THEN** its Origen cell shows «Vista previa de automatización» and its Consulta cell shows «Plantilla p-1»

#### Scenario: Filtering by local day and result
- **WHEN** the operator sets «Desde» and «Hasta» to the same day, «Resultado» to OK, and presses «Filtrar»
- **THEN** the request carries `desde` at that local day's start, `hasta` at its last millisecond, and `resultado=ok`

#### Scenario: Inverted dates
- **WHEN** «Desde» is later than «Hasta» and the operator presses «Filtrar»
- **THEN** the screen says so and no request is sent

#### Scenario: No active tenant
- **GIVEN** no tenant is selected
- **WHEN** the hash becomes `#auditoria`
- **THEN** the screen says «Elegí un tenant para ver su auditoría.» and no request is sent

#### Scenario: Cut list
- **WHEN** the answer has `truncado: true`
- **THEN** the screen says only the most recent 200 rows are shown

#### Scenario: Markup in a statement is text
- **WHEN** a row's `sql` contains `<b>`
- **THEN** it is shown verbatim and no element is created from it
