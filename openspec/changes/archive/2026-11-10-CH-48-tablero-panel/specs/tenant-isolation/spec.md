# Tenant Isolation Specification (CH-48 delta)

## ADDED Requirements

### Requirement: Panel Dashboard Routes Are Proven Isolated by a Two-Tenant Test (Rule 2, DEC-135, DEC-201)
The panel two-tenant suite SHALL exercise `GET /api/panel/tablero` and `GET /api/panel/tablero/:reporteId/resultado` from each tenant's session, also with the other tenant's `X-Tenant-Id` header, against the live test database. Each tenant SHALL have its own dashboard, connection and approved views, with view SQL that returns distinct literal rows per tenant (a `VALUES` list), so no external replica is needed. One report SHALL be on both dashboards, and one only on B's.

The suite SHALL assert that:
- each configuration lists only its own tenant's reports and its own freshness date;
- the shared report run from A's session returns A's rows only, and from B's session B's rows only;
- B's own report, requested from A's session, answers `404 reporte-no-encontrado` and dials nothing;
- an answer with the other tenant's `X-Tenant-Id` equals the answer without it;
- no answer contains the other tenant's id, rows, report-only title or freshness date;
- the run gate counts each tenant apart: three runs of A in flight do not delay a run of B.

The tenant SHALL come only from the session row. The report id and `dias` are the only client inputs, and both SHALL be checked against the session tenant's own data.

#### Scenario: Two tenants, two dashboards
- **GIVEN** tenants A and B, each with a dashboard on its own connection, sharing report "r-comun", and report "r-b" only on B's
- **WHEN** each session reads `GET /api/panel/tablero`, also sending the other's `X-Tenant-Id`
- **THEN** A reads only its reports and its freshness date, and B reads "r-comun" and "r-b" with its own freshness date

#### Scenario: The shared report returns each tenant's rows
- **WHEN** A and B each request `/api/panel/tablero/r-comun/resultado`
- **THEN** A's answer holds only A's literal rows and B's only B's

#### Scenario: A report of the other tenant's dashboard
- **WHEN** A requests `/api/panel/tablero/r-b/resultado`, with or without `X-Tenant-Id` of B
- **THEN** the answer is 404 `reporte-no-encontrado` and nothing is dialed
