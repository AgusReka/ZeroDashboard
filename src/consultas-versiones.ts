import { sanearSql } from './consulta-ejecucion.js';
import {
  analizarSentencia,
  validarDeclaracion,
  type DeclaracionParametro,
  type ProblemaParametro,
} from './parametros.js';

/**
 * CH-25 (DEC-146 to DEC-150): the pure half of saved-query versioning. It holds the content
 * checks the create route and the edit route share, the note rule, the "same content"
 * comparison that keeps an identical edit from creating an empty version, and the parsing
 * of a `:version` path segment, with no Prisma and no I/O so every rule is unit-testable
 * without a database.
 */

/** The body of a create or an edit, as the route hands it over (types already coerced by AJV). */
export interface CuerpoConsulta {
  nombre: string;
  descripcion?: string | null;
  sql: string;
  /** The declaration (DEC-48). Its content is checked by `validarDeclaracion`. */
  parametros: unknown[];
}

/** What is stored for a saved query, once validated. */
export interface ContenidoConsulta {
  nombre: string;
  descripcion: string | null;
  sql: string;
  parametros: DeclaracionParametro[];
}

export type ResultadoCuerpo =
  | { ok: true; datos: ContenidoConsulta }
  | {
      ok: false;
      cuerpo: { error: 'solicitud-invalida'; campos: string[]; problemas?: ProblemaParametro[] };
    };

/**
 * The checks `POST /consultas-guardadas` has always done, extracted so `PUT` applies the
 * very same ones (DEC-150) and the two routes cannot drift. Behaviour is unchanged:
 *
 *  - `sanearSql` is used **as a predicate only**: a statement that is empty once trimmed
 *    could never execute, so it can never be saved. The stored text stays verbatim.
 *  - The static half of the parameter checks (DEC-49, DEC-56, DEC-57, DEC-59): the
 *    declaration's shape, then its fit with the statement.
 *  - One representation of absence for the description: omitted, null and blank all
 *    become null.
 *
 * The failure carries the exact 400 body the route sends.
 */
export function validarCuerpoConsulta(body: CuerpoConsulta): ResultadoCuerpo {
  const sql = sanearSql(body.sql);
  if (sql === '') {
    return { ok: false, cuerpo: { error: 'solicitud-invalida', campos: ['/sql'] } };
  }

  const declaracion = validarDeclaracion(body.parametros);
  const problemas = declaracion.ok ? analizarSentencia(sql, declaracion.valor) : declaracion.problemas;
  if (!declaracion.ok || problemas.length > 0) {
    return {
      ok: false,
      cuerpo: {
        error: 'solicitud-invalida',
        campos: [...new Set(problemas.map((problema) => problema.campo))],
        problemas,
      },
    };
  }

  const descripcion = (body.descripcion ?? '').trim() === '' ? null : (body.descripcion ?? null);
  return {
    ok: true,
    datos: { nombre: body.nombre, descripcion, sql: body.sql, parametros: declaracion.valor },
  };
}

/** The longest note a version can carry (DEC-148). */
export const LIMITE_NOTA = 500;

export type ResultadoNota = { ok: true; nota: string | null } | { ok: false; campos: string[] };

/**
 * The optional note of an edit or a restore. Absent, null and blank give `null`; a string is
 * trimmed and kept when it is at most `LIMITE_NOTA` characters. Anything else, a number or a
 * longer text, is refused by name. The route schema leaves `nota` untyped on purpose, so this
 * is the only place its type is checked and AJV cannot coerce a number into text.
 */
export function resolverNota(nota: unknown): ResultadoNota {
  if (nota === undefined || nota === null) {
    return { ok: true, nota: null };
  }
  if (typeof nota !== 'string') {
    return { ok: false, campos: ['/nota'] };
  }
  const limpia = nota.trim();
  if (limpia === '') {
    return { ok: true, nota: null };
  }
  return limpia.length > LIMITE_NOTA ? { ok: false, campos: ['/nota'] } : { ok: true, nota: limpia };
}

export type LecturaRestauracion = { ok: true; nota: unknown } | { ok: false; campos: string[] };

/**
 * The body of a restore: only an optional `nota`. A request with no body at all (or a JSON
 * `null`) is valid and means "no note", which a route schema of type object cannot express;
 * anything else must be an object whose only key, if any, is `nota`. An unknown key is
 * refused by name, `__proto__` included, since `JSON.parse` makes it an own key. The note's
 * own type and length are `resolverNota`'s concern.
 */
export function leerCuerpoRestauracion(cuerpo: unknown): LecturaRestauracion {
  if (cuerpo === undefined || cuerpo === null) {
    return { ok: true, nota: undefined };
  }
  if (typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return { ok: false, campos: ['/'] };
  }
  const ajenas = Object.keys(cuerpo).filter((clave) => clave !== 'nota');
  if (ajenas.length > 0) {
    return { ok: false, campos: ajenas.map((clave) => `/${clave}`) };
  }
  return { ok: true, nota: (cuerpo as { nota?: unknown }).nota };
}

/** Whether two declarations list the same `{nombre, tipo}` entries in the same order. */
function mismosParametros(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every((entrada, i) => {
    const otra: unknown = b[i];
    return (
      typeof entrada === 'object' &&
      entrada !== null &&
      typeof otra === 'object' &&
      otra !== null &&
      (entrada as DeclaracionParametro).nombre === (otra as DeclaracionParametro).nombre &&
      (entrada as DeclaracionParametro).tipo === (otra as DeclaracionParametro).tipo
    );
  });
}

/**
 * Whether an edit changes nothing (DEC-150: `409 sin-cambios`, no empty version). The
 * statement is compared verbatim, whitespace and trailing `;` included, because it is
 * stored verbatim; the parameters count in order, since the order is how the server binds
 * `$k`. The note is deliberately not part of the comparison: a note alone never creates a
 * version.
 */
export function mismoContenido(
  actual: Omit<ContenidoConsulta, 'parametros'> & { parametros: unknown },
  nuevo: ContenidoConsulta,
): boolean {
  return (
    actual.nombre === nuevo.nombre &&
    actual.descripcion === nuevo.descripcion &&
    actual.sql === nuevo.sql &&
    mismosParametros(actual.parametros, nuevo.parametros)
  );
}

const DIGITOS = '0123456789';

/**
 * A `:version` path segment: digits only, no sign, decimal point, exponent or leading zero,
 * from 1 to 999999999. Anything else is `null`, and the routes answer it as a version that
 * does not exist. Each character is checked against a digit string instead of a pattern,
 * the way the console script does, so no escape can be misread.
 */
export function analizarVersion(texto: string): number | null {
  if (texto.length === 0 || texto.length > 9 || texto.charAt(0) === '0') {
    return null;
  }
  for (let i = 0; i < texto.length; i++) {
    if (DIGITOS.indexOf(texto.charAt(i)) === -1) {
      return null;
    }
  }
  return Number(texto);
}
