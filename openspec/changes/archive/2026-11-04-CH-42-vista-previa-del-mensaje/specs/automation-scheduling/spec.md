# Automation Scheduling Specification (CH-42 delta)

## Purpose
The operator sees what an active automation would send without waiting for its schedule (X10, DEC-189, DEC-195). One route runs the automation's query the way a run does, with the same gates and the same page, and answers with the rows, whether a run would notify and the message. It creates no run and sends nothing: every send is still scheduled. The run's steps up to the dial are shared with the preview, with no change to the run.

## ADDED Requirements

### Requirement: Message Preview Runs the Automation's Query Without a Run or a Send (X10, DEC-189, DEC-195)

The system SHALL expose `POST /automatizaciones/:id/vista-previa`, scoped to the active tenant and behind the operator guard like every other automation route. It SHALL read nothing from the request body. It SHALL handle a request in this order, answering at the first step that refuses:

| # | Step | Refusal |
|---|------|---------|
| 1 | Read the automation through the tenant-scoped client | `404 automatizacion-no-encontrada` for an unknown id or another tenant's; `409 automatizacion-desactivada` for a deactivated one |
| 2 | Read its template | `404 plantilla-no-encontrada` |
| 3 | The run's DEC-71 gate on the automation's connection | `409 vista-canonica-no-aprobada` with `entidades`, as the template test |
| 4 | `componerSentencia` and `prepararSentencia` with the stored `valores` | `400 solicitud-invalida` with `campos` and `problemas`, as the template test |
| 5 | `destinoDeConexion` | `409 credencial-ilegible`, or `404 conexion-no-encontrada`, as the template test |
| 6 | One read-only execution with the run's page: `limite` = the row cap, `desplazamiento` 0, no retry | none: a failed query is a `200` carrying the engine's failure, as the template test |

Nothing SHALL be dialled before steps 1 to 5 pass. A `200` SHALL carry the engine's verdict fields exactly as the template test returns them, plus `decision`, `para` and `correo` as defined by `email-notification`. The route SHALL NOT create or update an `Ejecucion` row, SHALL NOT call the notifier, and SHALL NOT change the automation. No route SHALL run an automation outside its schedule or send its message on demand (DEC-189 (b) rejected).

#### Scenario: Previewing an automation whose run would send

- GIVEN an active automation with `destinatarios` `["ops@empresa.com"]`, `minimoFilas` 1, an approved view and SMTP configured, whose query returns 3 rows
- WHEN `POST /automatizaciones/:id/vista-previa` is called
- THEN the response SHALL be `200` with `resultado` `ok`, the 3 rows, `decision` `enviar`, `para` `["ops@empresa.com"]` and a non-null `correo`
- AND no `Ejecucion` row SHALL exist for the automation and the notifier SHALL NOT have been called

#### Scenario: The preview reads the run's page

- GIVEN an active automation with `minimoFilas` 50 and a row cap of 20, whose query has more than 20 rows
- WHEN the preview is called
- THEN the response SHALL carry 20 rows with `paginacion.hayMas` true and `decision` `enviar`, as a run reading the same rows would decide

#### Scenario: A gate refusal dials nothing

- GIVEN an active automation whose template declares an entity with no approved view on its connection
- WHEN the preview is called
- THEN the response SHALL be `409 vista-canonica-no-aprobada` naming that entity, and nothing SHALL be dialled

#### Scenario: Stored values no longer valid

- GIVEN an active automation whose stored `valores` no longer satisfy its template's declaration
- WHEN the preview is called
- THEN the response SHALL be `400 solicitud-invalida` naming the parameter, and nothing SHALL be dialled

#### Scenario: A failed query is the engine's answer

- GIVEN an active automation whose query fails at execution
- WHEN the preview is called
- THEN the response SHALL be `200` with `resultado` `fallo`, its `fase` and `categoria`, `decision` null and `correo` null

#### Scenario: Deactivated and foreign automations

- GIVEN a deactivated automation of the active tenant, and an automation of another tenant
- WHEN the preview is called with each id
- THEN the first SHALL answer `409 automatizacion-desactivada` and the second `404 automatizacion-no-encontrada`, the same as an unknown id
- AND neither SHALL dial a connection

#### Scenario: Previewing twice changes nothing

- GIVEN an active automation with prior runs
- WHEN the preview is called twice
- THEN the automation's row and its `Ejecucion` rows SHALL be exactly as before
- AND its next scheduled run SHALL be unaffected

## MODIFIED Requirements

### Requirement: Run Pipeline Reuses the Existing Read-Only Composition and Execution Chain (rule 5, DEC-71)

A run SHALL compose the automation's `Plantilla` exactly as the CH-12 test endpoint does (`evaluarVistas`, `componerSentencia`), requiring a passing saved validation for every declared entity on the automation's `Conexion` (DEC-71); it SHALL then execute the composed statement through the existing read-only pipeline (`ejecutarConsulta`). No new execution surface SHALL be introduced. The steps before the dial (the DEC-71 gate, `componerSentencia`, `prepararSentencia`, `destinoDeConexion`) and the run's page (`limite` = the row cap, `desplazamiento` 0) SHALL be one function shared by the scheduler and the message preview, so both read the same rows for the same automation. Sharing it SHALL NOT change a run: the same reads in the same order, the same refusals, and the retry, the `enviando` marker, the notifier call and the `Ejecucion` writes staying in the scheduler.
(Previously: these steps lived inside the scheduler only.)

#### Scenario: Missing or failing view validation blocks the run

- GIVEN an `Automatizacion` whose `Plantilla` declares an entity with no passing saved validation on its `Conexion`
- WHEN the scheduler runs it
- THEN the run SHALL NOT execute any query against the tenant's connection
- AND the outcome SHALL be recorded (per `execution-log`) naming the ungated entity

#### Scenario: The run is unchanged by the shared steps

- GIVEN the scheduler's test suite as it was before this change
- WHEN it runs against the shared steps
- THEN it SHALL pass without any edit to it
