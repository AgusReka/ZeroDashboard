# Automation Scheduling Specification (CH-44 delta)

## ADDED Requirements

### Requirement: The Automation Chooses One Channel (DEC-185, DEC-197)
Every `Automatizacion` row SHALL have a non-null text `canal`, either `correo` or `telegram`, defaulting to `correo`, with its allowed values in code. Rows created before this column SHALL read `correo`. `POST /automatizaciones` and the operator's adjust route SHALL accept an optional `canal`; absent on create means `correo`, and absent on adjust leaves it unchanged. Any other value SHALL answer `400 solicitud-invalida` with `campos` containing `/canal`, and nothing SHALL be stored. `GET /automatizaciones/:id`, the create response and the adjust response SHALL include `canal`. These routes SHALL NOT refuse `telegram` for lacking a link or a token: the run records that state. `destinatarios` SHALL be stored and validated as before whatever the channel, and SHALL be ignored at send time under `telegram`.

#### Scenario: Default channel
- **WHEN** an automation is created with no `canal`
- **THEN** the row SHALL persist with `canal: "correo"`

#### Scenario: Existing rows
- **GIVEN** a row created before this column existed
- **WHEN** it is read after the migration
- **THEN** `canal` SHALL be `correo`, and its `destinatarios` SHALL be unchanged

#### Scenario: Creating a Telegram automation with no link
- **GIVEN** a tenant with no link
- **WHEN** an automation is created with `canal: "telegram"`
- **THEN** the response SHALL be `201` and the row SHALL have `canal: "telegram"`

#### Scenario: Unknown channel
- **WHEN** a create or adjust body sends `canal: "sms"`
- **THEN** the response SHALL be `400 solicitud-invalida` with `campos` containing `/canal`, and nothing SHALL be stored

#### Scenario: Switching keeps the recipients
- **GIVEN** an automation with `canal: "correo"` and `destinatarios` `["a@b.com"]`
- **WHEN** an adjust sends `canal: "telegram"`, and a later one sends `canal: "correo"`
- **THEN** `destinatarios` SHALL still be `["a@b.com"]`

### Requirement: The Run Notifies Through Its Channel (X3, N1, N4)
The notification step SHALL use the automation's `canal` as read for that run, following `email-notification` for `correo` and `telegram-notification` for `telegram`. It SHALL remain one step per run, before the `Ejecucion` row closes. A run SHALL use exactly one channel.

#### Scenario: A channel changed before the run
- **GIVEN** a due automation adjusted from `correo` to `telegram` before its run
- **WHEN** it runs
- **THEN** the run SHALL use Telegram, and no email SHALL be sent

#### Scenario: One run, one row, one send
- **GIVEN** a due Telegram automation whose query returns rows reaching its minimum, with a link and a token
- **WHEN** the scheduler runs it
- **THEN** exactly one `Ejecucion` row SHALL persist with `notificacion` set, and one message SHALL have been sent

### Requirement: The Preview Reads the Automation's Channel (X10, DEC-195)
`POST /automatizaciones/:id/vista-previa` SHALL read `canal`, and its `200` SHALL carry `canal` and `telegram` as defined by `email-notification` and `telegram-notification`. The refusal steps and their order SHALL NOT change.

#### Scenario: A gate refusal on the Telegram channel dials nothing
- **GIVEN** an active Telegram automation whose template declares an entity with no approved view
- **WHEN** the preview is called
- **THEN** the response SHALL be `409 vista-canonica-no-aprobada`, nothing SHALL be dialled and no link read SHALL be made
