/**
 * Named query parameters (CH-11): the plain-text scanner and the `:nombre` → `$k`
 * rewrite (DEC-47).
 *
 * There is no SQL parser here, on purpose (DEC-09). The scanner is a small state machine
 * whose only job is to know where a `:` or a `$` *cannot* mean a parameter: inside a
 * string literal, an escape string, a quoted identifier, a comment, or a dollar-quoted
 * block. Everything it does not recognize it leaves byte-for-byte alone, and Postgres
 * remains the judge of whether the text is valid SQL.
 *
 * Rule 4 holds by construction: the rewrite only ever inserts `$k` tokens. No value
 * passes through this part of the module at all.
 *
 * Documented limits (rule 6 — recorded, not patched around):
 * - In an array slice `arr[lo:hi]`, `:hi` reads as a marker. DEC-57 rejects it loudly as
 *   undeclared; the workaround is `arr[lo : hi]`. A numeric slice `arr[1:2]` is not
 *   affected, because a marker name cannot start with a digit.
 * - `standard_conforming_strings = off` is not modeled: inside a plain `'...'` string a
 *   backslash is an ordinary character, as it is under the server default.
 */

/** A `:nombre` marker found in the normal state, with its span in the original text. */
export interface Marcador {
  nombre: string;
  /** Index of the `:`. */
  inicio: number;
  /** Index just past the last character of the name. */
  fin: number;
}

/**
 * A `$n` written by hand in the normal state (DEC-59). The scanner only reports it;
 * rejecting it is the caller's decision, because the scanner does not know what the
 * statement is for.
 */
export interface PosicionalAMano {
  texto: string;
  inicio: number;
  fin: number;
}

/** Everything the scanner found outside literals, identifiers, comments and `$$` blocks. */
export interface Escaneo {
  marcadores: Marcador[];
  posicionales: PosicionalAMano[];
}

/** The rewritten text, and how many driver binds it reserves (`$1..$n`, DEC-53). */
export interface Reescritura {
  texto: string;
  n: number;
}

/**
 * A word in the normal state, consumed whole. `$` is a word character after the first
 * position, as it is for Postgres identifiers, so `a$1` is one identifier and never a
 * hand-written bind.
 */
const PALABRA = /[\p{L}\p{N}_][\p{L}\p{N}_$]*/uy;
/** A marker: `:` directly followed by a name. `::` is handled before this is tried. */
const MARCADOR = /:([A-Za-z_][A-Za-z0-9_]*)/y;
/** A hand-written positional bind: `$` followed by digits. */
const POSICIONAL = /\$[0-9]+/y;
/** The opening of a dollar-quoted block, `$$` or `$tag$`. The tag cannot start with a digit. */
const APERTURA_DOLAR = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/y;

/**
 * Matches a sticky pattern exactly at `desde`. The patterns are module-level and carry
 * `lastIndex` as state, so every use goes through here and sets it first.
 */
function coincidirEn(patron: RegExp, texto: string, desde: number): RegExpExecArray | null {
  patron.lastIndex = desde;
  return patron.exec(texto);
}

/**
 * Skips the body of a quoted construct that opened just before `i`, returning the index
 * just past its closing quote. A doubled quote (`''`, `""`) stays inside. In an escape
 * string (`E'...'`) a backslash also escapes the character after it, so `E'\''` is one
 * string. An unterminated construct runs to the end of the text; Postgres rejects it.
 */
function saltarEntreComillas(sql: string, i: number, comilla: string, conEscapes: boolean): number {
  while (i < sql.length) {
    const c = sql[i];
    if (conEscapes && c === '\\') {
      i += 2;
      continue;
    }
    if (c === comilla) {
      if (sql[i + 1] === comilla) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

/** Skips a `--` comment body, stopping at (not past) the line break that ends it. */
function saltarComentarioDeLinea(sql: string, i: number): number {
  while (i < sql.length && sql[i] !== '\n' && sql[i] !== '\r') {
    i += 1;
  }
  return i;
}

/**
 * Skips a `/* ... *\/` comment body. Postgres block comments nest, so a depth counter is
 * kept: in `/* /* *\/ :x *\/` the `:x` is still inside a comment.
 */
function saltarComentarioDeBloque(sql: string, i: number): number {
  let profundidad = 1;
  while (i < sql.length) {
    if (sql[i] === '/' && sql[i + 1] === '*') {
      profundidad += 1;
      i += 2;
    } else if (sql[i] === '*' && sql[i + 1] === '/') {
      profundidad -= 1;
      i += 2;
      if (profundidad === 0) {
        return i;
      }
    } else {
      i += 1;
    }
  }
  return sql.length;
}

/**
 * Scans `sql` and reports every marker and every hand-written `$n` found in the normal
 * state, in order of appearance. Never throws: an unterminated string, identifier,
 * comment or dollar quote simply absorbs the rest of the text.
 */
export function escanearSentencia(sql: string): Escaneo {
  const marcadores: Marcador[] = [];
  const posicionales: PosicionalAMano[] = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];

    const palabra = coincidirEn(PALABRA, sql, i);
    if (palabra !== null) {
      const fin = i + palabra[0].length;
      // `E'...'` is an escape string: the word must be exactly `E`, directly before the quote.
      if ((palabra[0] === 'E' || palabra[0] === 'e') && sql[fin] === "'") {
        i = saltarEntreComillas(sql, fin + 1, "'", true);
      } else {
        i = fin;
      }
      continue;
    }

    if (c === "'" || c === '"') {
      i = saltarEntreComillas(sql, i + 1, c, false);
      continue;
    }
    if (c === '-' && sql[i + 1] === '-') {
      i = saltarComentarioDeLinea(sql, i + 2);
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      i = saltarComentarioDeBloque(sql, i + 2);
      continue;
    }

    if (c === ':') {
      if (sql[i + 1] === ':') {
        i += 2; // a cast; the type name after it is an ordinary word
        continue;
      }
      const marcador = coincidirEn(MARCADOR, sql, i);
      if (marcador !== null) {
        const fin = i + marcador[0].length;
        marcadores.push({ nombre: marcador[1], inicio: i, fin });
        i = fin;
        continue;
      }
    }

    if (c === '$') {
      const apertura = coincidirEn(APERTURA_DOLAR, sql, i);
      if (apertura !== null) {
        const cierre = sql.indexOf(apertura[0], i + apertura[0].length);
        i = cierre === -1 ? sql.length : cierre + apertura[0].length;
        continue;
      }
      const posicional = coincidirEn(POSICIONAL, sql, i);
      if (posicional !== null) {
        const fin = i + posicional[0].length;
        posicionales.push({ texto: posicional[0], inicio: i, fin });
        i = fin;
        continue;
      }
    }

    i += 1; // any other character, including a lone `:` or `$`, is literal
  }
  return { marcadores, posicionales };
}

/**
 * Rewrites every marker naming one of `nombres` to `$k`, where `k` is that name's index
 * in `nombres` plus one; a name repeated in the text reuses the same `$k`. Only the
 * marker's own span is replaced, so every other byte of `sql` survives unchanged — with
 * no markers the result is `sql` itself, and `n` is `0`.
 *
 * A marker whose name is not in `nombres` is left as written. The caller rejects such a
 * statement (DEC-57) before executing it; this function only transforms text.
 *
 * `nombres` must be distinct. A duplicate would make two binds claim one name, so it is
 * treated as a programming error rather than silently binding the wrong value.
 */
export function reescribirMarcadores(sql: string, nombres: readonly string[]): Reescritura {
  const posicion = new Map<string, number>();
  nombres.forEach((nombre, indice) => posicion.set(nombre, indice + 1));
  if (posicion.size !== nombres.length) {
    throw new Error('reescribirMarcadores: los nombres declarados deben ser distintos');
  }

  let texto = '';
  let desde = 0;
  for (const marcador of escanearSentencia(sql).marcadores) {
    const k = posicion.get(marcador.nombre);
    if (k === undefined) {
      continue;
    }
    texto += `${sql.slice(desde, marcador.inicio)}$${k}`;
    desde = marcador.fin;
  }
  return { texto: texto + sql.slice(desde), n: nombres.length };
}

// --- Declaration and static analysis (DEC-49, DEC-56, DEC-57, DEC-59) ---

/** The parameter type vocabulary (DEC-49), distinct from `TipoSemantico`. */
export const TIPOS_PARAMETRO = ['texto', 'numero', 'booleano', 'fecha'] as const;
export type TipoParametro = (typeof TIPOS_PARAMETRO)[number];

/** One declared parameter. Every declared parameter is required (DEC-50). Reused by CH-12 (DEC-52). */
export interface DeclaracionParametro {
  nombre: string;
  tipo: TipoParametro;
}

/** Why a parameter was rejected. Problems are always listed in this order. */
export const MOTIVOS_PARAMETRO = [
  'nombre-invalido',
  'nombre-duplicado',
  'tipo-desconocido',
  'posicional-a-mano', // DEC-59
  'sin-declarar', // DEC-57
  'sin-usar', // DEC-56
  'valor-faltante', // DEC-50
  'valor-no-declarado', // DEC-58
  'valor-invalido', // DEC-60
] as const;
export type MotivoParametro = (typeof MOTIVOS_PARAMETRO)[number];

/**
 * One problem, as the route renders it (DEC-51). `parametro` names the parameter, or the
 * hand-written `$n`, when there is one; `campo` is a JSON pointer into the request body.
 */
export interface ProblemaParametro {
  parametro: string | null;
  motivo: MotivoParametro;
  campo: string;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; problemas: ProblemaParametro[] };

/** A parameter name: ASCII, case-sensitive, the same grammar the scanner uses for markers. */
const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTipo(valor: unknown): valor is TipoParametro {
  return (TIPOS_PARAMETRO as readonly unknown[]).includes(valor);
}

/** Sorts problems into `MOTIVOS_PARAMETRO` order; the sort is stable within one motivo. */
function ordenar(problemas: ProblemaParametro[]): ProblemaParametro[] {
  const rango = (p: ProblemaParametro) => MOTIVOS_PARAMETRO.indexOf(p.motivo);
  return [...problemas].sort((a, b) => rango(a) - rango(b));
}

/**
 * Validates a declaration (DEC-49): a list of `{nombre, tipo}` entries with well-formed,
 * distinct names and a known `tipo`. `undefined` is the empty declaration. The accepted
 * value is a copy holding only `nombre` and `tipo`; any other key of an entry is dropped.
 */
export function validarDeclaracion(entrada: unknown): Resultado<DeclaracionParametro[]> {
  if (entrada === undefined) {
    return { ok: true, valor: [] };
  }
  if (!Array.isArray(entrada)) {
    // The route schemas guarantee a list; this only keeps a stray caller from being read.
    return { ok: false, problemas: [{ parametro: null, motivo: 'nombre-invalido', campo: '/parametros' }] };
  }
  const problemas: ProblemaParametro[] = [];
  const declaracion: DeclaracionParametro[] = [];
  const vistos = new Set<string>();
  entrada.forEach((item: unknown, i) => {
    const nombre = esObjeto(item) && typeof item.nombre === 'string' ? item.nombre : null;
    const tipo = esObjeto(item) ? item.tipo : undefined;
    if (nombre === null || !NOMBRE.test(nombre)) {
      problemas.push({ parametro: nombre, motivo: 'nombre-invalido', campo: `/parametros/${i}/nombre` });
    } else if (vistos.has(nombre)) {
      problemas.push({ parametro: nombre, motivo: 'nombre-duplicado', campo: `/parametros/${i}/nombre` });
    }
    if (!esTipo(tipo)) {
      problemas.push({ parametro: nombre, motivo: 'tipo-desconocido', campo: `/parametros/${i}/tipo` });
    } else if (nombre !== null) {
      declaracion.push({ nombre, tipo });
    }
    if (nombre !== null) {
      vistos.add(nombre);
    }
  });
  return problemas.length === 0 ? { ok: true, valor: declaracion } : { ok: false, problemas: ordenar(problemas) };
}

/**
 * Checks a statement against a valid declaration, without values — the static checks the
 * save path runs too. Reports every hand-written `$n` (DEC-59), every undeclared marker
 * (DEC-57) and every declared name the text never uses (DEC-56), each distinct token once,
 * already in `MOTIVOS_PARAMETRO` order.
 */
export function analizarSentencia(sql: string, declaracion: readonly DeclaracionParametro[]): ProblemaParametro[] {
  const { marcadores, posicionales } = escanearSentencia(sql);
  const declarados = new Set(declaracion.map((d) => d.nombre));
  const usados = new Set(marcadores.map((m) => m.nombre));
  const problemas: ProblemaParametro[] = [];
  for (const texto of new Set(posicionales.map((p) => p.texto))) {
    problemas.push({ parametro: texto, motivo: 'posicional-a-mano', campo: '/sql' });
  }
  for (const nombre of usados) {
    if (!declarados.has(nombre)) {
      problemas.push({ parametro: nombre, motivo: 'sin-declarar', campo: '/sql' });
    }
  }
  declaracion.forEach(({ nombre }, i) => {
    if (!usados.has(nombre)) {
      problemas.push({ parametro: nombre, motivo: 'sin-usar', campo: `/parametros/${i}/nombre` });
    }
  });
  return problemas;
}

// --- Values and preparation (DEC-50, DEC-58, DEC-60, rule 4) ---

/** A value that passed the DEC-60 shape check, as handed to the driver. */
export type ValorParametro = string | number | boolean;

declare const marca: unique symbol;

/**
 * A statement ready for the driver: `texto` carries only `$1..$n` placeholders and
 * `valores[k-1]` is the value for `$k`. Only `prepararSentencia` builds one, so nothing
 * can reach execution without passing the scanner (DEC-59).
 */
export interface SentenciaPreparada {
  readonly texto: string;
  readonly valores: readonly ValorParametro[];
  readonly [marca]: true;
}

/** An ISO 8601 date or date-time (DEC-60). Calendar validity is left to Postgres (DEC-51). */
const FECHA = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Whether a value has the JSON shape DEC-60 fixes for each `tipo`. Nothing is converted. */
const FORMA: Record<TipoParametro, (valor: unknown) => boolean> = {
  texto: (valor) => typeof valor === 'string',
  numero: (valor) => typeof valor === 'number' && Number.isFinite(valor),
  booleano: (valor) => typeof valor === 'boolean',
  fecha: (valor) => typeof valor === 'string' && FECHA.test(valor),
};

/** `/valores/<nombre>`, escaping the key as a JSON pointer segment (RFC 6901). */
function campoDeValor(nombre: string): string {
  return `/valores/${nombre.replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

/**
 * Checks a value map against a valid declaration: a value for every declared name
 * (DEC-50), none for an undeclared one (DEC-58), each with its DEC-60 shape. `undefined`
 * is the empty map. The map is copied into a `Map` with `Object.entries` and is never
 * indexed by a user-supplied key. The accepted values follow declaration order.
 */
function validarValores(declaracion: readonly DeclaracionParametro[], entrada: unknown): Resultado<ValorParametro[]> {
  if (entrada !== undefined && !esObjeto(entrada)) {
    return { ok: false, problemas: [{ parametro: null, motivo: 'valor-invalido', campo: '/valores' }] };
  }
  const recibidos = new Map<string, unknown>(Object.entries(entrada ?? {}));
  const problemas: ProblemaParametro[] = [];
  const valores: ValorParametro[] = [];
  for (const { nombre, tipo } of declaracion) {
    const valor = recibidos.get(nombre);
    if (!recibidos.has(nombre)) {
      problemas.push({ parametro: nombre, motivo: 'valor-faltante', campo: campoDeValor(nombre) });
    } else if (!FORMA[tipo](valor)) {
      problemas.push({ parametro: nombre, motivo: 'valor-invalido', campo: campoDeValor(nombre) });
    } else {
      valores.push(valor as ValorParametro);
    }
  }
  const declarados = new Set(declaracion.map((d) => d.nombre));
  for (const nombre of recibidos.keys()) {
    if (!declarados.has(nombre)) {
      problemas.push({ parametro: nombre, motivo: 'valor-no-declarado', campo: campoDeValor(nombre) });
    }
  }
  return problemas.length === 0 ? { ok: true, valor: valores } : { ok: false, problemas };
}

/**
 * Validates a declaration, a statement and a value map together and, when all three
 * agree, rewrites the markers to `$k` in declaration order (DEC-47, DEC-53). `sql` is
 * expected already sanitized by the route (`sanearSql`), which this does not repeat.
 *
 * Every problem is returned in one list, in `MOTIVOS_PARAMETRO` order. The one exception is
 * an invalid declaration: it is reported alone, because the statement and the values can
 * only be read against a declaration that is itself valid.
 *
 * Rule 4 holds by construction: the text only ever gains `$k` tokens, and the values
 * travel apart in `valores`.
 */
export function prepararSentencia(sql: string, declaracion: unknown, valores: unknown): Resultado<SentenciaPreparada> {
  const decl = validarDeclaracion(declaracion);
  if (!decl.ok) {
    return decl;
  }
  const vals = validarValores(decl.valor, valores);
  const problemas = [...analizarSentencia(sql, decl.valor), ...(vals.ok ? [] : vals.problemas)];
  if (!vals.ok || problemas.length > 0) {
    return { ok: false, problemas: ordenar(problemas) };
  }
  const { texto } = reescribirMarcadores(sql, decl.valor.map((d) => d.nombre));
  const sentencia = { texto, valores: Object.freeze(vals.valor) } as SentenciaPreparada;
  return { ok: true, valor: Object.freeze(sentencia) };
}
