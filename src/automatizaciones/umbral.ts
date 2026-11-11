import {
  prepararSentencia,
  validarDeclaracion,
  type ProblemaParametro,
  type Resultado,
  type SentenciaPreparada,
} from '../ejecucion/parametros.js';

/**
 * UX review P-06 (DEC-205): the one place that says what a stored `umbral` may be.
 *
 * DEC-60 fixes `numero` as any finite JSON number, and that stays true for every parameter of
 * queries, templates and reports. DEC-205 refines it for the parameter named `umbral` only:
 * the value that decides when an automation fires counts units, so it must be an integer, 0
 * or more (`Number.isInteger` and `>= 0`). A number written as text stays refused, with no
 * conversion (`"3"` is not valid): that is DEC-60's own shape check, which still runs first.
 *
 * Three routes write it and all three call {@link prepararSentenciaDeAutomatizacion}, so the
 * rule is not copied into each: `PUT /api/panel/automatizaciones/:id/ajustes`, and the
 * console's `POST /automatizaciones` and `PUT /automatizaciones/:id/ajustes`. Nothing stored
 * is migrated or rewritten: a decimal already in a row is still read (the panel's read
 * exposes any finite number) and still runs (the catalog compares `"stockDisponible"::numeric`);
 * only a new write is refused.
 */
export const NOMBRE_UMBRAL = 'umbral';

/** The pointer the console reports a refused `umbral` under, as `prepararSentencia` does for any value. */
const CAMPO_UMBRAL = `/valores/${NOMBRE_UMBRAL}`;

/** The DEC-205 rule on one value: an integer, 0 or more. Anything else, text included, is not valid. */
export function esUmbralValido(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;
}

/** Whether the declaration holds `umbral` as a `numero`: the only case the rule applies to. */
function declaraUmbralNumerico(parametros: unknown): boolean {
  const declaracion = validarDeclaracion(parametros);
  return declaracion.ok && declaracion.valor.some((d) => d.nombre === NOMBRE_UMBRAL && d.tipo === 'numero');
}

export interface OpcionesUmbral {
  /**
   * The `umbral` already stored on the automation being adjusted. A body that sends exactly
   * that value back (the console's `PUT` replaces `valores` as a whole, so an operator who
   * changes only the hour resends it) is not a new write and is not refused, even if it is a
   * decimal stored before DEC-205. Any other value goes through the rule. Absent for a create.
   */
  guardado?: unknown;
}

/**
 * `prepararSentencia` plus the DEC-205 rule for `umbral`. Same result shape: when the rule
 * refuses, the problem is `{ parametro: 'umbral', motivo: 'valor-invalido', campo: '/valores/umbral' }`,
 * the one every other refused value carries, so the routes answer with their usual
 * `solicitud-invalida` and the console reads it unchanged. A value DEC-60 already refused is
 * not reported twice.
 */
export function prepararSentenciaDeAutomatizacion(
  sql: string,
  declaracion: unknown,
  valores: unknown,
  opciones: OpcionesUmbral = {},
): Resultado<SentenciaPreparada> {
  const preparada = prepararSentencia(sql, declaracion, valores);
  if (!declaraUmbralNumerico(declaracion) || typeof valores !== 'object' || valores === null || Array.isArray(valores)) {
    return preparada;
  }
  const enviado = Object.entries(valores).find(([nombre]) => nombre === NOMBRE_UMBRAL)?.[1];
  const esElGuardado =
    typeof enviado === 'number' && Number.isFinite(enviado) && opciones.guardado !== undefined && Object.is(enviado, opciones.guardado);
  // Not a number, or not finite: DEC-60's shape check has already said so, or the key is absent.
  if (typeof enviado !== 'number' || !Number.isFinite(enviado) || esUmbralValido(enviado) || esElGuardado) {
    return preparada;
  }
  const problema: ProblemaParametro = { parametro: NOMBRE_UMBRAL, motivo: 'valor-invalido', campo: CAMPO_UMBRAL };
  return { ok: false, problemas: preparada.ok ? [problema] : [...preparada.problemas, problema] };
}
