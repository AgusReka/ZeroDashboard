# Query Console Specification (CH-29 delta)

## Purpose
The console page requires an operator (DEC-152, DEC-154): it serves a login screen without a session, shows the operator in the header with one, and returns to the login screen on any 401.

## MODIFIED Requirements

### Requirement: Console Page Is Servable
The system SHALL serve a console page at `GET /consola`, without a session and without `X-Tenant-Id`. With a valid console session the page SHALL present a SQL input control and a way to trigger execution of the entered statement against a registered connection. Without a valid session it SHALL instead present the login screen and SHALL NOT contain the SQL input control. Both documents MUST link the shared stylesheet `/ui/styles.css` and MUST NOT carry the former inline `<style>` block of the full console styling. Both MUST contain exactly one closing script tag, no backtick, and no markup-assigning properties (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc`) in their scripts. The console document MUST keep every guarded element id. The scripts MAY use `zd-` class names. The exact markup is otherwise a design-level concern.
(Previously: the page was served the same way to every request, with no session.)

#### Scenario: Requesting the console page with a session
- **GIVEN** a valid console session
- **WHEN** the console page is requested
- **THEN** the response SHALL be a page containing a SQL input control and a way to trigger execution

#### Scenario: Requesting the console page without a session
- **GIVEN** no cookie, or an expired or unknown session
- **WHEN** the console page is requested
- **THEN** the response SHALL be 200 with the login screen and SHALL NOT contain `<textarea id="sql"`

#### Scenario: Page links the shared stylesheet
- **WHEN** the console page is requested, with or without a session
- **THEN** it SHALL contain a `<link rel="stylesheet" href="/ui/styles.css">`
- **AND** it SHALL NOT contain the former inline full-console `<style>` rules

#### Scenario: Script hazards stay out of the page
- **WHEN** either document and its script are scanned
- **THEN** each SHALL contain exactly one closing script tag and no backtick
- **AND** neither SHALL contain `innerHTML`

#### Scenario: Script may reference the shared classes
- **WHEN** the script text is scanned for `zd-`
- **THEN** the scan SHALL NOT fail the page

## ADDED Requirements

### Requirement: Console Login Screen
The login screen SHALL ask for the operator's name and password, send them to `POST /consola/ingresar`, and reload the page on 200. On 401 it SHALL say "Nombre o clave incorrectos." and keep the name typed; on any other failure it SHALL say the console could not be reached. It SHALL follow the project design skill.

#### Scenario: Wrong password
- **WHEN** the operator submits a wrong password
- **THEN** the screen shows "Nombre o clave incorrectos." and does not reload

### Requirement: Operator Shown in the Header
With a session, the console header SHALL show the operator's name, inserted as text (escaped by the server), next to a "Salir" action that calls `POST /consola/salir` and reloads the page.

#### Scenario: A name with markup is shown as text
- **GIVEN** an operator named `<b>ana</b>`
- **WHEN** the console page is served
- **THEN** the header contains `&lt;b&gt;ana&lt;/b&gt;` and no `<b>` element

### Requirement: A 401 Returns to the Login Screen
Every API call the console page makes, the tenant list included, SHALL reload the page when the answer is 401, so the server serves the login screen.

#### Scenario: Session expires while working
- **GIVEN** the console is open and the session expires
- **WHEN** the operator runs any action
- **THEN** the page reloads and shows the login screen
