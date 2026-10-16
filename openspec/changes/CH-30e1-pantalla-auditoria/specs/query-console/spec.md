# Query Console Specification (CH-30e1 delta)

## Purpose
The console shows the active tenant's execution audit (A5) over `GET /auditoria` (DEC-163), read-only (DEC-162).

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL link, in this order, a "Global" group with `#tenants`, `#plantillas` and `#contrato`, a "Puesta en marcha" group with `#conexiones`, `#agentes`, `#mapeo` and `#usuarios`, and a "Trabajo diario" group with `#consultas`, `#automatizaciones`, `#frescura` and `#auditoria`. On load and on every `hashchange`, exactly one screen SHALL be visible: the one named by the hash, or Consultas when the hash is empty or names no screen. The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL.
(Previously: "Trabajo diario" ended with `#frescura`.)

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#auditoria`
- **THEN** only Auditoría is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** Consultas is visible

## ADDED Requirements

### Requirement: Audit Screen
The Auditoría screen SHALL be scoped to the active tenant. Each time it is shown, and when the active tenant changes while it is shown, it SHALL read `GET /auditoria` with the current filters and list the rows newest first. With no active tenant it SHALL say «Elegí un tenant para ver su auditoría.» and send nothing.

The filters SHALL be «Desde» and «Hasta» (dates) and «Resultado» (Todos, OK, Falló); «Filtrar» SHALL reload the list with them. A date SHALL mean the operator's local day: «Desde» is sent as the instant the local day starts, «Hasta» as the last millisecond of the local day, both in ISO form. An empty filter SHALL not be sent. «Desde» later than «Hasta» SHALL be refused on screen with nothing sent.

Each row SHALL show, as text:

| Column | Content |
|---|---|
| Fecha y hora | `creadoEn`, local date and time to the second |
| Operador | `operadorNombre` |
| Origen | Consulta, Prueba de plantilla, Validación de mapeo or Prueba de conexión |
| Conexión | The connection's name from `GET /conexiones`; an unknown id shows its first eight characters |
| Consulta | The saved query's name and version («Stock v3»), the template id for a template test, else «Ad hoc» |
| SQL | The statement cut to 80 characters, with the full statement available on demand |
| Filas | `filas`, or empty when null |
| Duración | `duracionMs`, in ms below one second and in seconds above |
| Resultado | «OK», or «Falló» followed by the console's failure message for `fase`, `categoria` and `codigo` |

The screen SHALL offer no way to change or delete a row. When the answer says `truncado`, the screen SHALL say that only the most recent 200 rows are shown and suggest narrowing the dates. An empty list SHALL say «No hay ejecuciones registradas con estos filtros.». A `400` SHALL say to check the dates; network, tenant and other HTTP failures SHALL be legible.

#### Scenario: Listing the audit
- **GIVEN** an active tenant whose audit holds one failed run of the saved query "Stock" version 3 on connection "food-store" by operator "Ana"
- **WHEN** the hash becomes `#auditoria`
- **THEN** one `GET /auditoria` is sent with the active tenant
- **AND** the row shows "Ana", "Consulta", "food-store", "Stock v3" and "Falló" with the failure message, all as text

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
</content>
</invoke>
