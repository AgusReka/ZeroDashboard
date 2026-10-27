/**
 * Hard cap on every list route. DEC-10 removes delete, so these tables only ever grow and
 * an uncapped `findMany` would be unbounded over the product's life. 200 matches the
 * `limite` ceiling of `/consultas/ejecutar`. There is no pagination parameter to see
 * past it (DEC-10), which is exactly why each list response says `truncado` out loud
 * instead of silently returning a short list.
 *
 * CH-21c: moved here from `consultas-guardadas.ts`, which re-exports it, so that
 * `conexiones.ts` can read it without an import cycle (`consultas-guardadas.ts` already
 * imports `camposInvalidos` from `conexiones.ts`). This module imports nothing.
 */
export const LIMITE_LISTADO = 200;
