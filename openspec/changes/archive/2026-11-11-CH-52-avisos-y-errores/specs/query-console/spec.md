# Query Console Specification (CH-52 delta)

The console screens are specified in `query-console`, so this is the only delta of CH-52. Rule ids (E1, M4, T7…) refer to `.claude/skills/zerodashboard-design/guidelines/admin.md`; the error formula and the HTTP table are in `guidelines/lenguaje.md`.

## ADDED Requirements

### Requirement: One Feedback Component, Placed by Scope (E1, E3)
Every notice in the console SHALL be a `zd-banner` rendered by the server, whose tone (`ok`, `warn`, `error`) the script sets with `data-tono`. The script SHALL NOT assign a class to a notice.

Each notice SHALL go where its scope is:
- the result of an action, next to the control that triggered it;
- the state of a screen, under its page header;
- the global state (no tenant, tenant deactivated), in the tenant bar.

While a pop-up is open, every refusal or result of that pop-up's action SHALL appear inside the pop-up, never behind it.

An action SHALL report success with a success notice or with its result, not both.

#### Scenario: Refusal inside an open pop-up
- **GIVEN** the «Nueva conexión» pop-up is open
- **WHEN** the registration fails with a network error
- **THEN** the sentence appears inside the pop-up, and the page banner stays hidden

#### Scenario: Tone by attribute
- **WHEN** the page banner shows a success
- **THEN** it carries `data-tono="ok"` and its `class` attribute is the one the server rendered

### Requirement: Errors Read as Sentences (E4)
When a console request fails, the console SHALL show:
- what could not be done;
- what to do;
- at the end, the technical code as «Código: HTTP {n}.».

It SHALL NOT show an API path or a bare "HTTP n" sentence. Each message names its action as an infinitive phrase («cargar la lista de tenants», «guardar la plantilla»).

| Failure | Text |
|---|---|
| No answer / network | «No pudimos conectar con el servidor de la consola. Revisá tu conexión y probá de nuevo.» |
| 400, 422 | The console's specific message for that answer when there is one; otherwise «No se pudo {acción}. Revisá los datos y probá de nuevo.» |
| 403 | «Tu sesión no tiene permiso para {acción}. Volvé a ingresar.» |
| 404 | The specific message when there is one; otherwise «No se pudo {acción}: no encontramos lo que pediste. Puede que lo hayan dado de baja.» |
| 409 | The specific message when there is one; otherwise «No se pudo {acción}: algo cambió o está en uso. Recargá la pantalla y probá de nuevo.» |
| 5xx | «La consola tuvo un error interno al {acción}. Probá de nuevo; si se repite, revisá el log del servidor.» |
| An answer it cannot read | «La consola recibió una respuesta que no pudo leer al {acción}. Probá de nuevo; si se repite, revisá el log del servidor.» |

A 401 SHALL keep returning to the login screen (A 401 Returns to the Login Screen). Messages that already exist for a specific code or execution category SHALL keep their text.

Most notices are plain-text lines, so the code is written as text at the end rather than in a mono block. A mono technical detail is part of the query workbench's in-place error (CH-53, W6).

#### Scenario: A list fails to load
- **WHEN** `GET /plantillas` answers 500
- **THEN** the screen says «La consola tuvo un error interno al cargar las plantillas. Probá de nuevo; si se repite, revisá el log del servidor. Código: HTTP 500.», and no text contains `/plantillas`

#### Scenario: No answer
- **WHEN** a request fails before any answer
- **THEN** the screen says «No pudimos conectar con el servidor de la consola. Revisá tu conexión y probá de nuevo.»

### Requirement: Busy Buttons (E2)
While the request a button triggered is pending, that button SHALL be `disabled`, carry `aria-busy="true"` and show a gerund of its verb («Probando…», «Validando…», «Guardando…», «Ejecutando…»). When the request settles, it SHALL return to its label and state. The layout SHALL NOT shift.

#### Scenario: Testing a connection
- **WHEN** the operator presses «Probar» on a connection and the answer has not arrived
- **THEN** that button says «Probando…», is disabled and carries `aria-busy="true"`
- **AND** when the answer arrives it says «Probar» again

### Requirement: Console Copy Uses Voseo and Names Controls (M4, M5)
Every console text addressed to the operator SHALL use voseo. A text that refers to a control SHALL name it exactly as the control is labelled.

#### Scenario: The save hint of Consultas
- **GIVEN** the query has not been executed
- **THEN** the hint next to the save control says «Ejecutá la consulta para poder guardarla.»

### Requirement: Dates State Their Zone (T7)
Every column that shows a date and time SHALL state which zone it uses, in its header:
- Auditoría and the automations list format in the browser zone: «Fecha y hora (hora de tu navegador)» and «Creada (hora de tu navegador)»;
- the runs table shows each instant as stored, in UTC: «Inicio (UTC)» and «Fin (UTC)».

The next-run sentences already name the deployment zone they use («zona horaria …»), and keep doing so. Columns that show only a day (Alta) need no zone. No date SHALL be converted between zones by this rule.

#### Scenario: Audit screen
- **WHEN** the hash becomes `#auditoria` with rows
- **THEN** the date column is headed «Fecha y hora (hora de tu navegador)»

#### Scenario: Runs of an automation
- **WHEN** the operator opens «Ver ejecuciones»
- **THEN** the columns read «Inicio (UTC)» and «Fin (UTC)»
