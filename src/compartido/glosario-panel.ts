/** The panel glossary's forbidden terms (DEC-04, `lenguaje.md`). Lower case. */
export const TERMINOS_PROHIBIDOS_PANEL: readonly string[] = Object.freeze([
  'tenant',
  'cron',
  'sql',
  'consulta',
  'query',
  'ejecución',
  'réplica',
  'parámetro',
  'timeout',
  'plantilla',
]);

/**
 * The forbidden terms `texto` contains, case-insensitively, in list order. It lives in
 * `compartido/` because `plantillas/` (the save-time check) and `panel/` (the test over
 * the fallback and frequency texts) both read it, and `plantillas/` must not import
 * from `panel/`.
 */
export function terminosProhibidosEn(texto: string): string[] {
  const minusculas = texto.toLocaleLowerCase('es');
  return TERMINOS_PROHIBIDOS_PANEL.filter((termino) => minusculas.includes(termino));
}
