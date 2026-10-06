# Delta for Connection Registration

## ADDED Requirements

### Requirement: Listing the Active Tenant's Connections (DEC-132)

The system SHALL expose `GET /conexiones`, scoped to the active tenant, returning only the tenant's connections, each with exactly `id` and `nombre`. The route MUST require `X-Tenant-Id` and MUST NOT be added to the tenant-context exemption allowlist. The result SHALL be capped to a fixed maximum number of rows, with cap value and ordering fixed by design. No other field, including `credencial`, MUST appear in the response.

#### Scenario: Listing own connections

- **GIVEN** tenant A with two connections
- **WHEN** `GET /conexiones` is sent with A's `X-Tenant-Id`
- **THEN** the response SHALL list exactly those two, each with only `id` and `nombre`

#### Scenario: Two tenants

- **GIVEN** tenants A and B, each with connections
- **WHEN** A requests the listing
- **THEN** no row of B SHALL appear

#### Scenario: Missing tenant

- **GIVEN** a request with no `X-Tenant-Id`
- **WHEN** `GET /conexiones` is handled
- **THEN** the response SHALL be `400 tenant-no-indicado`

#### Scenario: Tenant without connections

- **GIVEN** an active tenant with no connections
- **WHEN** the listing is requested
- **THEN** the response SHALL be successful with an empty list

#### Scenario: Row cap

- **GIVEN** a tenant with more connections than the cap
- **WHEN** the listing is requested
- **THEN** no more than the cap SHALL be returned

## MODIFIED Requirements

### Requirement: Credential Value Never Exposed

The system MUST NOT include the submitted credential value, the stored enciphered envelope's deciphered plaintext, the stored envelope, or the master key in any test response body, listing response body, error message, or log line, regardless of outcome.
(Previously: covered only test responses, errors and logs; now also covers the `GET /conexiones` listing.)

#### Scenario: A failed test does not leak the credential

- **GIVEN** a registered connection tested with an incorrect credential value
- **WHEN** the test fails due to bad credentials
- **THEN** the response body SHALL NOT contain the submitted credential value
- **AND** any log line produced during the attempt SHALL NOT contain the submitted credential value

#### Scenario: A successful test does not leak the credential

- **GIVEN** a registered connection tested with the correct credential value
- **WHEN** the test succeeds
- **THEN** the response body SHALL NOT contain the credential value

#### Scenario: A database dump never yields a readable credential

- **GIVEN** a dump of the application's own database containing a registered `Conexion` row
- **WHEN** the dump is inspected without the master key
- **THEN** no credential in it SHALL be decipherable

#### Scenario: The listing never exposes the credential

- **GIVEN** a registered connection with a known credential value
- **WHEN** `GET /conexiones` is requested for its tenant
- **THEN** the response body SHALL NOT contain a `credencial` key, the credential value or its envelope
