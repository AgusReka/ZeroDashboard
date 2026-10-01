# Delta for Query Console

## ADDED Requirements

### Requirement: Runs View Shows Readable Messages for solapamiento and interrumpida (DEC-96, DEC-99)

In the runs view, a run with `error='solapamiento'` SHALL show a legible message stating that the run was skipped because the previous run was still in progress, and a run with `error='interrumpida'` SHALL show a legible message stating that the run was interrupted by a service restart. An `omitida` status SHALL render with a legible label. The raw values MUST NOT be the only text shown, and `null` MUST NOT be rendered as text.

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
