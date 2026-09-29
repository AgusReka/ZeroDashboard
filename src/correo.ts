/**
 * CH-14: the pure half of the email notification (N1, N2). Two things live here and
 * nothing else: whether a string is one header-safe recipient address (DEC-82), and how a
 * run's columns and rows become a subject, an HTML part and a text part (DEC-84, DEC-85).
 * No Fastify, no Prisma, no pg, no nodemailer: `src/notificador.ts` owns the transport and
 * `src/planificador.ts` decides whether to call it.
 */

// ---- recipient validation (DEC-82) ---------------------------------------------------

/** RFC 5321 limits: the whole path and the local part. */
const MAX_DIRECCION = 254;
const MAX_LOCAL = 64;

/** Dot-separated RFC 5322 atext: no whitespace, no `,;<>"()`, no edge or doubled dot. */
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
/** One DNS label: ASCII letters, digits and inner hyphens, at most 63 characters. */
const ETIQUETA = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
/** The top-level label is letters only, at least two of them. */
const TLD = /^[A-Za-z]{2,}$/;

/**
 * Whether `valor` is exactly one plain ASCII address `local@dominio`. Whitespace anywhere
 * (including at the edges) is refused rather than trimmed, so a caller can never persist
 * a value that differs from the one checked. Non-ASCII addresses (IDN, SMTPUTF8) are a
 * documented limit, not a bug.
 */
export function direccionValida(valor: string): boolean {
  if (valor.length > MAX_DIRECCION) {
    return false;
  }
  const partes = valor.split('@');
  if (partes.length !== 2) {
    return false;
  }
  const [local, dominio] = partes;
  if (local.length > MAX_LOCAL || !LOCAL.test(local)) {
    return false;
  }
  const etiquetas = dominio.split('.');
  return (
    etiquetas.length >= 2 &&
    etiquetas.every((etiqueta) => ETIQUETA.test(etiqueta)) &&
    TLD.test(etiquetas[etiquetas.length - 1])
  );
}

// ---- cell text (N2, DEC-84) ----------------------------------------------------------

/** What every missing value reads as; the reader never sees `null` or `undefined`. */
export const MARCADOR_VACIO = '—';
/** Longest cell text shown; the rest is cut and marked with an ellipsis. */
const MAX_CELDA = 500;

/**
 * How one top-level cell value reads in the message. Only the top level is normalized:
 * an object is shown as its JSON text verbatim, so `{"a":null}` keeps the word `null`
 * inside it (a documented limit, DEC-84).
 */
export function textoDeCelda(valor: unknown): string {
  const texto = textoCrudo(valor);
  return texto.length > MAX_CELDA ? `${texto.slice(0, MAX_CELDA - 1)}…` : texto;
}

function textoCrudo(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') {
    return MARCADOR_VACIO;
  }
  if (typeof valor === 'string') {
    return valor;
  }
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? String(valor) : MARCADOR_VACIO;
  }
  if (typeof valor === 'bigint') {
    return String(valor);
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? MARCADOR_VACIO : valor.toISOString();
  }
  if (valor instanceof Uint8Array) {
    return '[binario]';
  }
  try {
    // `undefined` for functions and symbols; a throw for cycles and BigInt members.
    const json: unknown = JSON.stringify(valor);
    return typeof json === 'string' ? json : MARCADOR_VACIO;
  } catch {
    return MARCADOR_VACIO;
  }
}

// ---- escaping (Threat Matrix: HTML in a cell, column, or name) -----------------------

const ENTIDADES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Neutralizes the five characters that could open markup or an attribute. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

// ---- theme and subject (DEC-85; Threat Matrix: CRLF in template name) ----------------

interface Tema {
  acento: string;
  emoji: string;
}

/**
 * The closed palette of the validated workflows, keyed by the template's `automatizacion`
 * label. A `Map` lookup, so a label such as `constructor` never reaches `Object.prototype`.
 * Only these values ever appear inside a `style` attribute.
 */
const TEMAS: ReadonlyMap<string, Tema> = new Map([
  ['stock-fisico', { acento: '#f59e0b', emoji: '⚠️' }],
  ['stock-producible', { acento: '#dc2626', emoji: '🔴' }],
  ['reporte-diario', { acento: '#2563eb', emoji: '📊' }],
]);
/** Any other label: a gray accent and no emoji, never a throw. */
const TEMA_NEUTRO: Tema = { acento: '#6b7280', emoji: '' };

function temaDe(automatizacion: string): Tema {
  return TEMAS.get(automatizacion) ?? TEMA_NEUTRO;
}

/** Longest subject, counted in code points so an emoji is never split. */
const MAX_ASUNTO = 200;
/** C0 and C1 controls (CR and LF included) and the Unicode line and paragraph separators. */
const CONTROLES = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/** One header-safe line: every run of control characters becomes a single space. */
function unaLinea(texto: string): string {
  return texto.replace(CONTROLES, ' ').replace(/ {2,}/g, ' ').trim();
}

/**
 * `{emoji} {nombre} ({n}{+})`, where `n` is the number of rows shown and `+` marks a
 * truncated result. The name is cut first, so the count always survives the 200 cap.
 */
export function asuntoCorreo(e: {
  nombre: string;
  automatizacion: string;
  filas: number;
  hayMas: boolean;
}): string {
  const { emoji } = temaDe(e.automatizacion);
  const prefijo = emoji === '' ? '' : `${emoji} `;
  const cuenta = ` (${e.filas}${e.hayMas ? '+' : ''})`;
  const disponible = MAX_ASUNTO - Array.from(prefijo + cuenta).length;
  const nombre = Array.from(unaLinea(e.nombre));
  const corto =
    nombre.length > disponible ? `${nombre.slice(0, disponible - 1).join('')}…` : nombre.join('');
  return `${prefijo}${corto}${cuenta}`;
}
