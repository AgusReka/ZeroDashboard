# Console Operator Authentication Specification

## Purpose
Every console request carries a verified operator, so "por quién" in story **A5** can be answered. Decisions: DEC-151 to DEC-154. DEC-15 is unchanged: the tenant still arrives explicitly on each request; the session names the operator and never a tenant.

## Requirements

### Requirement: Operator and Console Session Tables
The system SHALL store operators in a table `Operador` with a unique `nombre` and a `claveHash` produced by the same `scrypt` routine the panel uses (DEC-133), and console sessions in a table `SesionConsola` with a unique `tokenHash`, the `operadorId` and an `expiraEn`. Neither table SHALL have a tenant column, and neither SHALL be registered in the isolation extension. Only the SHA-256 hash of a session token SHALL be stored. Deleting an operator SHALL delete its sessions.

#### Scenario: The plain token never reaches the database
- **GIVEN** an operator logs in
- **WHEN** the `SesionConsola` row is read
- **THEN** its `tokenHash` differs from the cookie value and equals the SHA-256 hash of it

### Requirement: Console Login
`POST /consola/ingresar` SHALL accept a strict JSON body `{ nombre, clave }` with no other key. With a matching operator and password it SHALL create a session lasting 12 hours, answer 200 `{ operador: { id, nombre } }` and set a cookie named `zd_consola_session` with `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` and a `Max-Age` equal to the session lifetime. An unknown name or a wrong password SHALL both answer 401 `nombre-o-clave-incorrectos`, with no cookie. A malformed body SHALL answer 400 `solicitud-invalida` with `campos`. The route SHALL require neither a session nor `X-Tenant-Id`.

#### Scenario: Successful login
- **GIVEN** an operator "ana" with password P
- **WHEN** `POST /consola/ingresar` sends `{ "nombre": "ana", "clave": P }`
- **THEN** the answer is 200 with `operador.nombre` "ana", a `zd_consola_session` cookie with every attribute above, and one new `SesionConsola` row

#### Scenario: Unknown name and wrong password look the same
- **WHEN** the body names an operator that does not exist, or the right operator with a wrong password
- **THEN** both answers are 401 `nombre-o-clave-incorrectos`, with no `Set-Cookie` and no new row

#### Scenario: Strict body
- **WHEN** the body adds a `tenantId`, or omits `clave`
- **THEN** the answer is 400 `solicitud-invalida` and no session is created

### Requirement: Console Logout
`POST /consola/salir` SHALL require a valid console session, delete that session's row, answer 200 `{ ok: true }` and set the cookie empty with `Max-Age=0`. The same token SHALL be refused from then on.

#### Scenario: Logout revokes the token
- **GIVEN** a logged-in operator
- **WHEN** it calls `POST /consola/salir` and then any guarded route with the same cookie
- **THEN** the first answer is 200 and the second is 401

### Requirement: Operator Guard
The system SHALL register, in the application entry point, a guard that runs on every request before the tenant header hooks and that cannot be disabled by configuration. A request whose method and route pattern are not in the closed exemption list SHALL be answered 401 before any handler or tenant check unless it carries a valid console session: 401 `sesion-expirada` when the session exists but has expired (its row is deleted on use), 401 `sesion-invalida` in every other case (no cookie, unknown token). A request matching no route SHALL be treated as not exempt. A valid session SHALL attach `{ id, nombre }` of the operator to the request.

The exemption list SHALL be exactly: `GET /health`; `GET /consola`; `POST /consola/ingresar`; each `GET` row of the shared stylesheet; `GET /panel`; and each row of the panel's public routes (`/api/panel/*`). The agents' WebSocket upgrade is outside the routing and SHALL keep working without a console session. `GET /contrato`, `/plantillas`, `/tenants` and every other console route SHALL be guarded.

#### Scenario: An unauthenticated console call is refused before the tenant check
- **GIVEN** no cookie
- **WHEN** `GET /consultas-guardadas` is called with a valid `X-Tenant-Id`, or with none
- **THEN** both answers are 401 `sesion-invalida`, never 400 `tenant-no-indicado`

#### Scenario: Bootstrap routes are guarded too
- **WHEN** `GET /tenants`, `GET /contrato` or `GET /plantillas` is called without a cookie
- **THEN** the answer is 401

#### Scenario: Exempt routes need no session
- **WHEN** `GET /health`, `GET /ui/styles.css`, `GET /panel` or `POST /api/panel/auth/ingresar` is called without a console cookie
- **THEN** none of them answers 401 `sesion-invalida`

#### Scenario: An unmatched URL is refused
- **WHEN** `GET /no-existe` is called without a cookie
- **THEN** the answer is 401, not 404

#### Scenario: Expired session
- **GIVEN** a session whose `expiraEn` has passed
- **WHEN** it is used on a guarded route
- **THEN** the answer is 401 `sesion-expirada` and the row no longer exists

#### Scenario: Panel and console cookies do not cross
- **WHEN** a guarded console route receives only a valid `zd_panel_session` cookie
- **THEN** the answer is 401
- **WHEN** a panel route receives only a valid `zd_consola_session` cookie
- **THEN** the panel answers as it does without its own cookie

### Requirement: Every Registered Route Is Guarded or Listed
A test SHALL build the application with the same wiring function the entry point uses and SHALL assert that every registered route, called without a cookie, answers 401 unless its method and pattern are in the exemption list, and that every row of the exemption list names a registered route.

#### Scenario: A new route is guarded by default
- **GIVEN** a route added to the wiring without touching the exemption list
- **WHEN** the wiring test runs
- **THEN** that route is checked and answers 401 without a cookie

### Requirement: Operator Bootstrap Command
`npm run operador:alta -- <nombre>` SHALL create the operator `nombre` or, when it exists, replace its password and delete all its sessions. It SHALL read the password from standard input: with a terminal, twice and without echo, refusing a mismatch; without a terminal, the first line. The password SHALL never be accepted as an argument or an environment variable. A name SHALL be 1 to 64 characters after trimming, with no whitespace inside; a password SHALL be at least 12 characters. The command SHALL exit 0 on success, saying whether it created or reset; 1 on an invalid name or password, writing nothing; 2 when the database is unreachable. It SHALL never print the password or its hash.

#### Scenario: Create, then reset
- **WHEN** the command runs with a new name and a valid password
- **THEN** it exits 0, one `Operador` exists with that name, and logging in with that password works
- **WHEN** it runs again with the same name and another password
- **THEN** it exits 0, the old password no longer logs in, the new one does, and the operator's earlier sessions are refused

#### Scenario: A short password writes nothing
- **WHEN** the password has 11 characters
- **THEN** the command exits 1 and no row is created or changed

### Requirement: Smoke Script Logs In
`scripts/smoke.sh` SHALL create an operator with the bootstrap command inside the running engine container, log in, and send the session cookie on every console call.

#### Scenario: Smoke without a session
- **WHEN** the smoke script calls `GET /tenants` without the cookie
- **THEN** it expects 401, and with the cookie it expects 200
