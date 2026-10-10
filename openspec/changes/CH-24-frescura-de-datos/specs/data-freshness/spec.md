# Data Freshness Specification (CH-24)

## Purpose
Declare, per tenant, the replica's refresh window and its last refresh, and compare the window with each template's stored tolerance in the console. Fulfils stories **F1** and **F2**. Declare and show only (DEC-142). Decisions: DEC-142 to DEC-145.

## ADDED Requirements

### Requirement: Tenant Freshness Columns
`Tenant` SHALL carry `ventanaDesactualizacionMinutos` (integer, null) and `replicaActualizadaEn` (timestamp, null). A new tenant SHALL have both null, and null SHALL mean "sin declarar", never "fresh".

#### Scenario: A new tenant has no declaration
- **WHEN** a tenant is created
- **THEN** both fields are null in `POST /tenants` and in `GET /tenants`

### Requirement: Declare the Window and the Last Refresh
`PUT /tenants/:id/frescura` SHALL accept a strict JSON body `{ ventanaMinutos?, actualizadaAhora? }` with at least one key and no other key. `ventanaMinutos` SHALL be an integer from 0 to 525600, or `null` to clear it. `actualizadaAhora: true` SHALL set `replicaActualizadaEn` to the server clock; `false` SHALL leave it untouched. The answer SHALL be 200 `{ tenant }` with the public projection including both fields.

#### Scenario: Declare a window
- **WHEN** `PUT` sends `{ ventanaMinutos: 180 }` for an active tenant
- **THEN** the answer is 200 and `tenant.ventanaDesactualizacionMinutos` is 180

#### Scenario: Clear the window
- **GIVEN** a tenant with a declared window
- **WHEN** `PUT` sends `{ ventanaMinutos: null }`
- **THEN** the stored window is null

#### Scenario: Mark the replica refreshed now
- **WHEN** `PUT` sends `{ actualizadaAhora: true }`
- **THEN** `replicaActualizadaEn` equals the server time of the request, not a client-supplied value

#### Scenario: Only the sent fields change
- **GIVEN** a tenant with a window and a last refresh
- **WHEN** `PUT` sends `{ ventanaMinutos: 60 }`
- **THEN** `replicaActualizadaEn` is unchanged

#### Scenario: Invalid values are refused and nothing is stored
- **WHEN** `PUT` sends a negative number, a decimal, a string such as `"5"`, a value above 525600, or `actualizadaAhora: "true"`
- **THEN** the answer is 400 `solicitud-invalida` with the offending field in `campos`

#### Scenario: Forbidden keys are refused
- **WHEN** `PUT` sends `nombre`, `activo`, `tenantId`, `replicaActualizadaEn`, an unknown key, or an empty body
- **THEN** the answer is 400 and the tenant is unchanged

#### Scenario: Unknown or deactivated tenant
- **WHEN** `PUT` targets an unknown id
- **THEN** the answer is 404 `tenant-no-encontrado`
- **WHEN** it targets a deactivated tenant
- **THEN** the answer is 409 `tenant-desactivado` and nothing is stored

#### Scenario: Another tenant is untouched
- **WHEN** `PUT` updates tenant A
- **THEN** tenant B's two fields are unchanged

### Requirement: Freshness Evaluation
The system SHALL evaluate a tenant window against a template tolerance as: `sin-declarar` when the window is null; `desactualizada` when the window is greater than the tolerance; `al-dia` otherwise (equal is `al-dia`). The server helper and the console SHALL apply the same rule and share their test vectors.

#### Scenario: Vectors
- **GIVEN** these (window, tolerance) pairs
- **THEN** `(null, 60)` is `sin-declarar`; `(0, 0)` is `al-dia`; `(60, 60)` is `al-dia`; `(61, 60)` is `desactualizada`; `(180, 120)` is `desactualizada`; `(30, 120)` is `al-dia`

### Requirement: Console Freshness Section (C-22)
The console SHALL show a "Frescura de datos" section for the active tenant with: the declared window in minutes or "Sin declarar"; the last refresh as relative text such as "hace 3 h 10 min" or "Sin declarar"; a numeric field and a button to save the window; a button "Marcar réplica actualizada ahora"; and a table of every template with its tolerance in minutes and a status that uses an icon and text (never color alone): "Al día", "Desactualizada" or "Sin declarar". Values SHALL be written as text nodes. With no active tenant the section SHALL say so and offer no action.

#### Scenario: Stale badge
- **GIVEN** an active tenant with a window of 180 and a template with tolerance 120
- **THEN** that template's row shows "Desactualizada"

#### Scenario: Saving sends only the chosen fields
- **WHEN** the operator saves a window of 90
- **THEN** the request body is exactly `{ ventanaMinutos: 90 }`
- **WHEN** the operator marks the replica refreshed
- **THEN** the request body is exactly `{ actualizadaAhora: true }`

#### Scenario: Server error
- **WHEN** the server answers 400 or 409
- **THEN** the section shows the reason in plain text and keeps the previous values

### Requirement: The Engine Is Not Affected
A stale or undeclared window SHALL NOT block, reject, delay or alter any automation run (DEC-142, rule 6).

#### Scenario: A stale tenant still runs
- **GIVEN** a tenant whose window exceeds the tolerance of its template
- **WHEN** the scheduler tick finds the automation due
- **THEN** the run happens and is recorded as for any other tenant
