# Design: CH-26 — Freshness warning in the automation wizard

Inputs: proposal.md, specs/query-console/spec.md, DEC-180, `src/consola.ts` (wizard of CH-21c, freshness of CH-24).

## Script
- **`avisoFrescuraPlantilla(tolerancia)`** returns `''` or the sentence:
  - `ventana = ventanaDe(filaDeTenant(tenantActivo))` when there is an active tenant row, else `null`;
  - `''` unless `typeof tolerancia === 'number'` and `estadoFrescura(ventana, tolerancia) === 'desactualizada'`;
  - else «La réplica de este tenant se actualiza cada {toleranciaTexto(ventana)} y esta plantilla tolera {toleranciaTexto(tolerancia)}. Se puede crear igual: sus avisos pueden salir con datos más viejos de lo que necesita.»
- **`tarjetaPlantilla`**: a fourth span, `aviso-frescura`, hidden and empty, after the DEC-127 reason; `partesTarjeta[id].frescura` holds it.
- **`actualizarAvisosFrescura()`**: for each catalog row with a card, sets its text and `hidden`. Called at the end of `renderizarPicker` and in `abrirAlta` before the dialog opens.
- **`crearAutomatizacion`**: computes the chosen template's warning before sending; `confirmacionDeAlta(cuerpo, aviso)` appends ` ` + aviso when not empty. The POST body does not change.

## Style
`.aviso-frescura { font-size: var(--text-help); color: var(--warn-text); }` in the bridge style, next to `.motivo-plantilla`. The text carries the meaning; the color only supports it.

## Tests (`src/consola.test.ts`, CH-26 prefix)
- Window 180, tolerances 60 and 120: both cards warn with «3 h» and «1 h» / «2 h»; both radios enabled.
- Window 90: only the 60-minute card warns («90 min», «1 h»).
- Window 60 with tolerance 60, and an undeclared window: no warning.
- Creating the warned template: the success banner ends with the warning; the POST body equals the usual one.
- The CH-21c card-structure test gains `span.aviso-frescura`.

## Size
About 30 lines of code and 90 of tests. One PR.
