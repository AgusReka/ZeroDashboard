# Query Console Specification (CH-44 delta)

The console's existing texts and behavior for `correo` SHALL NOT change. The requirements below add only what `telegram` shows.

## ADDED Requirements

### Requirement: Console Chooses the Channel (DEC-185, DEC-197)
The automation create step and the adjust pop-up SHALL offer a `Canal` select with «Correo» and «Telegram», «Correo» by default on create and the stored value on adjust. With «Telegram» chosen:
- the recipients label, field and help SHALL be hidden, and the create body SHALL NOT send `destinatarios`. An adjust SHALL leave the stored list alone;
- the read-only email schematic (DEC-131) SHALL be hidden on create;
- the minimum's help SHALL read «El mensaje sale solo si la consulta devuelve al menos esta cantidad de filas.»;
- a help SHALL read «Se envía al chat vinculado del tenant. Sin chat vinculado, la ejecución queda como «Sin vínculo».»

The create body SHALL send `canal` only when it is `telegram`. The adjust body SHALL send `canal` only when it changed. Going back to «Correo» SHALL restore the field with what it held. A `400` naming `/canal` SHALL show a legible message. The new ids SHALL be in the guarded list, and the script SHALL assign no `zd-` class for them.

#### Scenario: Creating a Telegram automation
- **GIVEN** the create step with «Telegram» chosen and text left in the recipients field before choosing it
- **WHEN** it is saved
- **THEN** the body SHALL carry `canal: "telegram"` and no `destinatarios`

#### Scenario: Creating with the default
- **GIVEN** the create step with «Correo»
- **WHEN** it is saved
- **THEN** the body SHALL carry no `canal`

#### Scenario: Adjusting only the channel
- **GIVEN** the adjust pop-up of a `correo` automation with recipients
- **WHEN** «Telegram» is chosen and saved
- **THEN** the body SHALL hold only `canal: "telegram"`

### Requirement: Runs View Reads Each Run's Own Channel (DEC-197)
The runs table SHALL choose its texts from the run's `canal`, with null read as `correo`, and never from the automation's current channel. With `canal='telegram'`:

| Value | Text |
|-------|------|
| `notificacion` `enviada` | «Enviada por Telegram» |
| `notificacion` `no-configurada` | «Telegram no configurado» |
| `error` `tiempo-agotado` in phase `notificacion` | «Telegram no respondió dentro del tiempo permitido. La consulta se ejecutó, pero no se confirmó el envío: el mensaje puede haberse entregado.» |
| `error` `servidor-inalcanzable` in phase `notificacion` | «No se pudo conectar con Telegram. La consulta se ejecutó, pero el mensaje no se envió.» |
| `error` `envio-rechazado` in phase `notificacion` | «Telegram rechazó el mensaje: el bot puede estar bloqueado o el chat ya no existir. La consulta se ejecutó, pero el mensaje no se envió.» |
| `error` `error-desconocido` in phase `notificacion` | «El envío por Telegram falló por un motivo no reconocido. La consulta se ejecutó, pero el mensaje no se envió.» |

`notificacion` `sin-vinculo` SHALL read «Sin vínculo» on any row. Every other value SHALL read as it does today.

#### Scenario: A run with no link
- **GIVEN** a run with `canal` `telegram` and `notificacion` `sin-vinculo`
- **THEN** the cell SHALL read «Sin vínculo»

#### Scenario: History keeps its channel
- **GIVEN** an automation now on `telegram`, with an older run having `canal` `correo` and `notificacion` `no-configurada`
- **THEN** that row SHALL read «Correo no configurado»

#### Scenario: Older rows read as email
- **GIVEN** a run with `canal` null and `error` `envio-rechazado` in phase `notificacion`
- **THEN** the row SHALL show the mail server's existing text

#### Scenario: A rejected Telegram send
- **GIVEN** a run with `canal` `telegram`, `error` `envio-rechazado` and `fase` `notificacion`
- **THEN** the row SHALL show the Telegram text above, and no «código SMTP»

### Requirement: Preview Pop-Up on the Telegram Channel (X10, DEC-195)
When a `200` preview answer has `canal` `telegram`, the pop-up SHALL show, every value as text:

| `decision` | Line |
|------------|------|
| `enviar` | «Se enviaría al chat vinculado.» |
| `sin-vinculo` | «No se enviaría: el tenant no tiene un chat de Telegram vinculado.» |
| `no-configurada` | «No se enviaría: el envío por Telegram no está configurado.» |

The other decisions SHALL read as today. «Para» SHALL read «Para: chat vinculado», or «Para: sin chat vinculado» when `decision` is `sin-vinculo`. The row count note SHALL say «el mensaje avisa que hay más» instead of «el correo». When `telegram` is set, `telegram.texto` SHALL go in the `<pre>` as `textContent`, while the subject and the frame stay hidden and `srcdoc` stays empty. When it is null, the pop-up SHALL say «Con este resultado una ejecución no arma un mensaje.»

#### Scenario: Previewing a Telegram automation that would send
- **GIVEN** an answer with `canal` `telegram`, `decision` `enviar`, `para` `[]` and `telegram.texto`
- **WHEN** the pop-up renders it
- **THEN** it SHALL show «Se enviaría al chat vinculado.», «Para: chat vinculado» and the text in the `<pre>`
- **AND** the subject and the frame SHALL be hidden, and `srcdoc` SHALL be empty

#### Scenario: Markup in the text stays text
- **GIVEN** a `telegram.texto` holding `<img src=x onerror=alert(1)>`
- **WHEN** the pop-up renders it
- **THEN** the `<pre>` SHALL show it as text, and no element SHALL be created from it

#### Scenario: Previewing with no link
- **GIVEN** an answer with `decision` `sin-vinculo` and `telegram.texto`
- **WHEN** the pop-up renders it
- **THEN** it SHALL show the no-link line, «Para: sin chat vinculado» and the text
