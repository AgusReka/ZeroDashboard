# Client Panel Authentication Specification (CH-28 delta)

## Purpose
Panel users are now created from the console with a normalized email (CH-28, DEC-157), so the panel login matches the email whatever case the client types.

## ADDED Requirements

### Requirement: Email Matched Case-Insensitively at Login
`POST /api/panel/auth/ingresar` SHALL trim and lowercase the submitted `correo` before looking the user up. Emails are stored lowercase by the creation route.

#### Scenario: Mixed-case login
- **GIVEN** a user created as "ana@negocio.com"
- **WHEN** the login sends `correo` " Ana@Negocio.COM " with the right password
- **THEN** the answer is 200 and a session is created
