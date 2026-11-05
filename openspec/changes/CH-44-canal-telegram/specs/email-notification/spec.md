# Email Notification Specification (CH-44 delta)

## ADDED Requirements

### Requirement: This Capability Applies to the correo Channel (DEC-185, DEC-197)
The outcome precedence, the recipients, the transport and the message of this capability SHALL apply to automations with `canal='correo'`, which is the default, and their behavior SHALL NOT change. An automation with `canal='telegram'` follows `telegram-notification` and SHALL NOT call the email notifier. The body-building rules of "Message Built From the Template's Texts" SHALL remain the source of the text part that `telegram-notification` reuses.

#### Scenario: A correo automation behaves as before
- **GIVEN** an automation with `canal='correo'`, two recipients and SMTP configured, on a tenant with a linked Telegram chat
- **WHEN** its run returns rows
- **THEN** the email notifier SHALL be called once with both addresses, and no request to Telegram SHALL be made

#### Scenario: A Telegram automation sends no email
- **GIVEN** an automation with `canal='telegram'`, two stored recipients and SMTP configured
- **WHEN** its run returns rows
- **THEN** the email notifier SHALL NOT be called

### Requirement: The Preview Names the Channel (DEC-195, DEC-197)
The message preview's answer for an automation with `canal='correo'` SHALL carry, besides the fields defined in "Preview Builds the Run's Message and Never Sends It", `canal: "correo"` and `telegram: null`.

#### Scenario: A correo preview
- **GIVEN** an automation with `canal='correo'`
- **WHEN** it is previewed
- **THEN** the answer SHALL carry `canal` `correo`, `telegram` null, and the same `decision`, `para` and `correo` as before
