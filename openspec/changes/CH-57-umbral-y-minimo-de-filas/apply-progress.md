# Apply progress: CH-57

Status: tasks 1.1-2.6 done. Verify items v.1 (smoke) and v.3 stay with the parent.

## Done
- 1.1-1.3 Route: item schema lists `etiqueta` and `ayuda` (no `type`), body type widened, `LARGO_MAXIMO_TEXTO_PARAMETRO`, `rechazoDeTextosDeParametros` (joined into the existing `solicitud-invalida` answer), `datosDePlantilla` keeps trimmed non-blank texts.
- 1.4 Route tests: refusal over cap / non-string, unknown key, round trip, blank absent, caps accepted, PUT keeps and drops, `POST /plantillas/prueba` accepts and refuses.
- 2.1-2.5 Console: `crearEditorParametros(..., conTextos)`, `declaracionConTextos()`, body and snapshot use it, fill in every mode, `descripcionDeParametro` precedence, minimum help constants, `aj-minimo-ayuda`.
- 2.6 Console tests: see the scenario map in the report.

## Deviation
- Item schema also carries `propertyNames: { enum: ['nombre','tipo','etiqueta','ayuda'] }`. Under Fastify's `removeAdditional`, `additionalProperties: false` alone strips an unknown entry key silently, so the spec scenario "An unknown key in an entry is refused" (400) needed it.

## Verification (parent re-runs smoke)
- consola.test.ts 546/546; plantillas-rutas.test.ts 62/62; npm run test:db 2381/2381; tsc clean.
