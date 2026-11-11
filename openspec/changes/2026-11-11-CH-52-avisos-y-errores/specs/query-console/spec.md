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
- at the end, in mono, the technical code.

It SHALL NOT show an API path or a bare "HTTP n".

| Failure | Text |
|---|---|
| No answer / network | «No pudimos conectar con el servidor de la consola. Revisá tu conexión y probá de nuevo.» |
| 400, 422 | The server's validation message, next to the field when it names one |
| 403 | «Tu sesión no tiene permiso para esto. Volvé a ingresar.» |
| 404 | «No encontramos {objeto}. Puede que lo hayan dado de baja.» |
| 409 | The console's specific message for that code when there is one; otherwise «{Objeto} cambió o está en uso.» |
| 5xx | «La consola tuvo un error interno al {acción}. Probá de nuevo; si se repite, revisá el log del servidor.» followed by the code |

A 401 SHALL keep returning to the login screen (A 401 Returns to the Login Screen). Messages that already exist for a specific code or execution category SHALL keep their text.

#### Scenario: A list fails to load
- **WHEN** `GET /plantillas` answers 500
- **THEN** the screen says «La consola tuvo un error interno al cargar las plantillas. Probá de nuevo; si se repite, revisá el log del servidor.» with `HTTP 500` in mono, and no text contains `/plantillas`

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
Every date column or date line SHALL state which zone it uses, once per screen:
- lists, Auditoría and versions, which format in the browser's zone: «Hora de tu navegador»;
- automations and runs, which use the deployment's zone: «Hora del servidor».

No date SHALL be converted between zones by this rule.

#### Scenario: Audit screen
- **WHEN** the hash becomes `#auditoria` with rows
- **THEN** the date column states «Hora de tu navegador»
