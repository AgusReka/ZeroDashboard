# Client Panel Authentication Specification

## Purpose

Providing secure authentication and session management for the client panel (P2, business administrator), fulfilling user story **T3** and strictly enforcing **Rule 2** (tenant identity derived exclusively from the session, never from client input).

## Requirements

### Requirement: Client User Credential Validation (DEC-133)

The system SHALL validate client user credentials against stored `Usuario` records. Passwords MUST be hashed using `scrypt` (`node:crypto.scrypt`) with a random salt. Unmatched credentials or deactivated user accounts MUST fail closed with a generic authentication error ("correo o clave incorrectos") without disclosing whether the email exists.

#### Scenario: Successful login with valid credentials

- **GIVEN** an active `Usuario` with an encrypted password for an active tenant
- **WHEN** valid email and password are submitted to `POST /api/panel/auth/ingresar`
- **THEN** the response SHALL be `200` with the user's details and tenant name
- **AND** a secure `HttpOnly` session cookie SHALL be set

#### Scenario: Invalid password rejected

- **GIVEN** an existing `Usuario`
- **WHEN** an incorrect password is submitted to `POST /api/panel/auth/ingresar`
- **THEN** the response SHALL be `401` with an error message
- **AND** no session cookie SHALL be created

#### Scenario: Nonexistent email rejected

- **GIVEN** an email that does not exist in the system
- **WHEN** submitted to `POST /api/panel/auth/ingresar`
- **THEN** the response SHALL be `401` with the same generic error message

#### Scenario: Deactivated user rejected

- **GIVEN** a `Usuario` whose `activo` is `false`
- **WHEN** correct credentials are submitted
- **THEN** the response SHALL be `401` and no session SHALL be created

#### Scenario: Deactivated tenant user rejected

- **GIVEN** a `Usuario` belonging to a `Tenant` whose `activo` is `false`
- **WHEN** correct credentials are submitted
- **THEN** the response SHALL be `409 tenant-desactivado` or `401` and no session SHALL be created

### Requirement: Session Management via HttpOnly Cookie (DEC-134)

The system SHALL persist active sessions in `SesionPanel` referenced by a 256-bit cryptographically secure random token set in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie.

#### Scenario: Session token set on cookie

- **GIVEN** a successful login
- **WHEN** the response is returned
- **THEN** the `Set-Cookie` header SHALL contain the session token with `HttpOnly`, `Path=/`, and `SameSite=Lax`

#### Scenario: Reading active session state

- **GIVEN** an active session cookie
- **WHEN** `GET /api/panel/auth/sesion` is called
- **THEN** the response SHALL return `200` with `{ usuario: { id, correo, nombre }, tenant: { id, nombre } }`

#### Scenario: Logging out terminates session

- **GIVEN** an active session cookie
- **WHEN** `POST /api/panel/auth/salir` is called
- **THEN** the session row SHALL be deleted or invalidated in `SesionPanel`
- **AND** the session cookie SHALL be cleared
- **AND** subsequent calls with that token SHALL be `401`

#### Scenario: Expired session is rejected

- **GIVEN** a session whose `expiraEn` has passed
- **WHEN** a request is made with its cookie
- **THEN** the request SHALL be rejected with `401` and the expired row cleaned up

### Requirement: Panel Surface Servable (DEC-04, DEC-136)

The system SHALL serve the client panel page at `GET /panel`. If unauthenticated, it SHALL display the login form (P-01). If authenticated, it SHALL display the authenticated panel shell with the business name.

#### Scenario: Unauthenticated request serves login form

- **GIVEN** no session cookie
- **WHEN** `GET /panel` is requested
- **THEN** the served HTML SHALL display the login form with email and password inputs

#### Scenario: Authenticated request serves panel shell

- **GIVEN** a valid session cookie
- **WHEN** `GET /panel` is requested
- **THEN** the served HTML SHALL display the panel shell with the tenant's business name

### Requirement: Email Matched Case-Insensitively at Login
`POST /api/panel/auth/ingresar` SHALL trim and lowercase the submitted `correo` before looking the user up. Emails are stored lowercase by the creation route.

#### Scenario: Mixed-case login
- **GIVEN** a user created as "ana@negocio.com"
- **WHEN** the login sends `correo` " Ana@Negocio.COM " with the right password
- **THEN** the answer is 200 and a session is created
