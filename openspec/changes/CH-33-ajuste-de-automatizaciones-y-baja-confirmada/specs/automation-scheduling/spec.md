# Automation Scheduling Specification (CH-33 delta)

## Purpose
The operator adjusts an automation in place, as the client panel already does (DEC-174, extending DEC-138): parameter values, schedule and recipient change on the same row, which keeps its id and its run history. Template and connection never change.

## MODIFIED Requirements

### Requirement: Automation Lifecycle Is Create, List, Get, Deactivate — No Edit or Delete (DEC-78, DEC-79)

The system SHALL expose, all scoped to the active tenant: `POST /automatizaciones` (create), `GET /automatizaciones` (list), `GET /automatizaciones/:id` (get), `PUT /automatizaciones/:id/ajustes` (adjust, DEC-174) and `POST /automatizaciones/:id/desactivar` (deactivate). The adjust route SHALL update only `valores`, `cron` and `destinatario` of the same row, and SHALL NOT change `plantillaId`, `conexionId`, `activo` or `tenantId`. It SHALL NOT expose any route that deletes a row or reactivates it. Deactivating sets `activo: false` and no route sets it back to `true`.

The adjust body SHALL be a non-empty subset of `valores`, `cron` and `destinatario`; any other key, including `tenantId`, `plantillaId`, `conexionId` or `activo`, SHALL be refused with `400 solicitud-invalida`, never silently dropped. Each sent field SHALL be checked with the same rules as the create route: `cron` with `cronValido` in the configured zone; `destinatario` trimmed of surrounding spaces and tabs and checked with `direccionValida`, or `null` to clear it; `valores` with `prepararSentencia` against the stored row's template. A sent `valores` SHALL replace the stored map as a whole. Every offending field SHALL be named in `campos`. An unknown id, or another tenant's, SHALL answer `404 automatizacion-no-encontrada`; a deactivated automation SHALL answer `409 automatizacion-desactivada`; in both cases nothing is written. A `200` SHALL carry the updated row (`AutomatizacionCompleta`), `proximaEjecucion` computed from the new schedule and `zonaHoraria`. The scheduler SHALL apply the change from its next tick, with no reprogramming.
(Previously: there was no adjust route; a `PUT`, `PATCH` or `DELETE` on `/automatizaciones/:id` had to be absent and `destinatario` could not be changed after creation, DEC-82.)

#### Scenario: Deactivating an automation

- GIVEN an active `Automatizacion` belonging to the active tenant
- WHEN `POST /automatizaciones/:id/desactivar` is called
- THEN its `activo` SHALL become `false`
- AND no route SHALL exist to set it back to `true`

#### Scenario: Deactivated automation is excluded from future runs but stays listed

- GIVEN a deactivated `Automatizacion` with prior runs
- WHEN `GET /automatizaciones` is called
- THEN the row SHALL still appear
- AND its past `Ejecucion` rows SHALL remain listable

#### Scenario: Adjusting keeps the id and the history

- GIVEN an active automation with prior runs, cron `0 8 * * *` and recipient `a@empresa.com`
- WHEN `PUT /automatizaciones/:id/ajustes` is called with `{ "cron": "30 6 * * 1-5", "destinatario": "b@empresa.com" }`
- THEN the response SHALL be `200` with the same `id`, the new `cron` and `destinatario`, and a `proximaEjecucion` matching the new schedule
- AND its prior `Ejecucion` rows SHALL remain listed under the same id

#### Scenario: Values are checked against the stored template and replaced whole

- GIVEN an active automation whose template declares `umbral` as `numero`
- WHEN the adjust is called with `{ "valores": { "umbral": "diez" } }`
- THEN the response SHALL be `400 solicitud-invalida` naming `umbral`, and the row SHALL be unchanged
- WHEN it is called with `{ "valores": { "umbral": 10 } }`
- THEN the stored `valores` SHALL be exactly `{ "umbral": 10 }`

#### Scenario: Clearing the recipient

- GIVEN an active automation with a recipient
- WHEN the adjust is called with `{ "destinatario": null }`
- THEN its `destinatario` SHALL become `null` and its next runs SHALL send no email

#### Scenario: Template, connection and state cannot be adjusted

- GIVEN an active automation
- WHEN the adjust body carries `plantillaId`, `conexionId`, `activo` or `tenantId`
- THEN the response SHALL be `400 solicitud-invalida` and the row SHALL be unchanged

#### Scenario: Empty body, invalid cron and invalid recipient

- WHEN the adjust body is `{}`
- THEN the response SHALL be `400 solicitud-invalida`
- WHEN it is `{ "cron": "cada día" }` or `{ "destinatario": "a@b.com, c@d.com" }`
- THEN the response SHALL be `400` naming `cron` or `destinatario`, and nothing SHALL be written

#### Scenario: A deactivated automation cannot be adjusted

- GIVEN a deactivated automation
- WHEN the adjust is called with a valid body
- THEN the response SHALL be `409 automatizacion-desactivada` and the row SHALL be unchanged

#### Scenario: Another tenant's automation is not found

- GIVEN tenant A is active and an automation belongs to tenant B
- WHEN the adjust is called with B's automation id
- THEN the response SHALL be `404 automatizacion-no-encontrada`, the same as for an unknown id, and B's row SHALL be unchanged

#### Scenario: Delete and reactivation do not exist

- GIVEN an existing automation
- WHEN a `DELETE` is sent to `/automatizaciones/:id`
- THEN no such route SHALL exist (not-found or method-not-allowed response)
