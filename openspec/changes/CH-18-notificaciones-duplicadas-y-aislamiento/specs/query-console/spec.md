# Delta for Query Console

## MODIFIED Requirements

### Requirement: Runs View Shows Readable Messages for solapamiento and interrumpida (DEC-96, DEC-99, DEC-108)

In the runs view, a run with `error='solapamiento'` SHALL show a legible message stating that the run was skipped because the previous run was still in progress, and a run with `error='interrumpida'` SHALL show a legible message stating that the run was interrupted by a service restart. An `omitida` status SHALL render with a legible label. A `notificacion` of `enviando` SHALL render a legible "sending" label and `incierta` SHALL render a legible label stating it is unknown whether the email was sent. A run with `fase='notificacion'` and `error='tiempo-agotado'` SHALL show copy stating the email may have been delivered ("puede haberse entregado"), and MUST NOT state that the email was not sent; other send failures keep their existing copy. The raw values MUST NOT be the only text shown, and `null` MUST NOT be rendered as text. New label and copy strings MUST NOT contain a backtick, because the page script is embedded in a template literal.
(Previously: no labels for `enviando` or `incierta`; a timed-out send was shown as not sent.)

#### Scenario: Overlap skip is legible

- GIVEN a run with `estado='omitida'` and `error='solapamiento'`
- WHEN the runs view is opened
- THEN it SHALL show a legible skipped label and the overlap message

#### Scenario: Interrupted run is legible

- GIVEN a run with `estado='fallo'` and `error='interrumpida'`
- WHEN the runs view is opened
- THEN it SHALL show a failed status and the interruption message
- AND null `duracionMs`, `filas`, and `notificacion` SHALL render as placeholders

#### Scenario: Unknown error values still render

- GIVEN a run whose `error` is not a known value
- WHEN the runs view is opened
- THEN the view SHALL render without failing and without showing a stack trace

#### Scenario: Interrupted mid-send shows uncertainty

- GIVEN a run with `error='interrumpida'` and `notificacion='incierta'`
- WHEN the runs view is opened
- THEN it SHALL show the interruption message and a label stating it is unknown whether the email was sent

#### Scenario: Pending send is labelled

- GIVEN an `en-curso` run with `notificacion='enviando'`
- WHEN the runs view is opened
- THEN it SHALL show a legible sending label, not the raw value alone

#### Scenario: Timed-out send does not claim non-delivery

- GIVEN a run with `fase='notificacion'`, `notificacion='fallo-envio'`, and `error='tiempo-agotado'`
- WHEN the runs view is opened
- THEN it SHALL state the email may have been delivered
- AND SHALL NOT state that the email was not sent

#### Scenario: Console page stays servable

- GIVEN the new labels and copy
- WHEN the console page is requested
- THEN the response SHALL be a servable page and no new string SHALL contain a backtick
