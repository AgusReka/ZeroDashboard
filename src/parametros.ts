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
