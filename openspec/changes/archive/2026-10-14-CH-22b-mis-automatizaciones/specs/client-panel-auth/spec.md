# Delta for Client Panel Authentication

## ADDED Requirements

### Requirement: Panel Automations Route Resolves Tenant Only From the Session (Rule 2, DEC-135, DEC-137)

`GET /api/panel/automatizaciones` SHALL be an authenticated panel route: it SHALL run behind `levantarSesionPanel` (non-optional mode) and every query it issues SHALL run inside `conTenantActivo` entered with the session's `tenantId` and `tenantNombre`. The route SHALL be listed as the exact row `GET /api/panel/automatizaciones` in the panel exemption allowlist (`RUTAS_PANEL_PUBLICAS`, `src/contexto-tenant.ts`), so the `X-Tenant-Id` header hooks neither require nor read the header on it. The allowlist SHALL NOT use a prefix or pattern match for this row. The authenticated panel shell served by `GET /panel` SHALL host the automations screen, which reads this route with the session cookie and sends no tenant identifier.

#### Scenario: Request without X-Tenant-Id is not rejected by the header hooks

- **GIVEN** an active session cookie and no `X-Tenant-Id` header
- **WHEN** `GET /api/panel/automatizaciones` is called
- **THEN** the response SHALL be `200`, not `400`

#### Scenario: Tenant comes from the session even when a header names another

- **GIVEN** an active session for Tenant A and the header `X-Tenant-Id: <id-de-tenant-b>`
- **WHEN** the route is called
- **THEN** the data returned SHALL belong to Tenant A only

#### Scenario: The exemption is an exact row

- **GIVEN** the panel exemption allowlist
- **WHEN** a request is made to `GET /api/panel/automatizaciones/extra` or `POST /api/panel/automatizaciones` without `X-Tenant-Id`
- **THEN** it SHALL NOT be exempt from the header hooks

#### Scenario: Shell hosts the screen and expires with the session

- **GIVEN** a valid session cookie
- **WHEN** `GET /panel` is requested
- **THEN** the served shell SHALL include the automations screen section and the script that reads `/api/panel/automatizaciones`
- **AND** the script SHALL NOT send a tenant identifier in any header, query or body
