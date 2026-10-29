/**
 * CH-39 (DEC-188, DEC-192): the `{columna}` placeholders of a template's message line.
 *
 * A placeholder is `{`, one or more characters other than `{` and `}`, then `}`; its name is
 * the text between the braces, unchanged (no trimming, case-sensitive). Any other brace is
 * literal text. There are no expressions and no formats: a placeholder only stands for the
 * row's cell of the column with exactly that name.
 *
 * Pure and import-free, so the template routes (save-time check) and the email renderer
 * (substitution) share one reading of the line, and a later channel (CH-44) brings only its
 * own escaping.
 */

const MARCADOR = /\{([^{}]+)\}/g;

/** The placeholder names of `texto`, each once, in order of first appearance. */
export function marcadoresDe(texto: string): string[] {
  return [...new Set(Array.from(texto.matchAll(MARCADOR), (m) => m[1] as string))];
}

/** `texto` with its placeholders removed: what the glossary reads. */
export function textoSinMarcadores(texto: string): string {
  return texto.replace(MARCADOR, '');
}

/** The placeholder names of `linea` that are not in `columnas`, each once, in order. */
export function faltantesEn(linea: string, columnas: readonly string[]): string[] {
  return marcadoresDe(linea).filter((nombre) => !columnas.includes(nombre));
}

/**
 * `linea` with each placeholder replaced by `valorDe(nombre)` and every piece of literal
 * text between them passed through `literal`. The two are applied separately, so a value
 * is escaped once by its channel and the substituted line is never escaped again.
 */
export function sustituir(
  linea: string,
  valorDe: (nombre: string) => string,
  literal: (texto: string) => string,
): string {
  let salida = '';
  let desde = 0;
  for (const m of linea.matchAll(MARCADOR)) {
    const inicio = m.index as number;
    salida += literal(linea.slice(desde, inicio)) + valorDe(m[1] as string);
    desde = inicio + m[0].length;
  }
  return salida + literal(linea.slice(desde));
}
