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

// ---- message composition (N1, DEC-85) ------------------------------------------------

/** One message, ready for the notifier. `para` comes from the run's own automation. */
export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

/** Everything the renderer may see: the template's presentation and the returned rows. */
export interface EntradaCorreo {
  nombre: string;
  automatizacion: string;
  columnas: string[];
  filas: unknown[][];
  hayMas: boolean;
  fecha: Date;
  zona: string;
}

const PIE = 'Enviado automáticamente por ZeroDashboard.';

/**
 * Renders a run's result as a subject, an HTML part and a text part. The body holds only
 * the returned column names and cells plus static template text; no SQL, parameter,
 * connection or recipient ever reaches it, because none is an input (rule 5).
 */
export function componerCorreo(e: EntradaCorreo): Omit<Correo, 'para'> {
  // Short rows are padded and long rows cut to the column count, so the table never breaks.
  const filas = e.filas.map((fila) => e.columnas.map((_, i) => textoDeCelda(fila[i])));
  const pieza: Pieza = {
    tema: temaDe(e.automatizacion),
    nombre: unaLinea(e.nombre),
    fecha: `Ejecución del ${fechaEn(e.fecha, e.zona)}`,
    columnas: e.columnas,
    filas,
    avisos: avisosDe(e, filas),
  };
  return {
    asunto: asuntoCorreo({
      nombre: e.nombre,
      automatizacion: e.automatizacion,
      filas: e.filas.length,
      hayMas: e.hayMas,
    }),
    html: htmlDe(pieza),
    texto: textoDe(pieza),
  };
}

/** What both parts share once cells are normalized. */
interface Pieza {
  tema: Tema;
  nombre: string;
  fecha: string;
  columnas: string[];
  filas: string[][];
  avisos: string[];
}

/** The notices under the table: truncation, placeholders, and a result with no columns. */
function avisosDe(e: EntradaCorreo, filas: string[][]): string[] {
  const avisos: string[] = [];
  if (e.columnas.length === 0) {
    avisos.push(`La consulta devolvió ${e.filas.length} filas sin columnas.`);
  }
  if (e.hayMas) {
    avisos.push(`Se muestran las primeras ${e.filas.length} filas; la consulta devolvió más.`);
  }
  if (filas.some((fila) => fila.includes(MARCADOR_VACIO))) {
    avisos.push(`Las celdas sin valor se muestran como ${MARCADOR_VACIO}.`);
  }
  return avisos;
}

/** `YYYY-MM-DD HH:mm (zona)` in the deployment's zone (DEC-77), independent of the locale. */
function fechaEn(fecha: Date, zona: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  const dia = `${parte('year')}-${parte('month')}-${parte('day')}`;
  return `${dia} ${parte('hour')}:${parte('minute')} (${zona})`;
}

/** The text part: the same content, one row per line, cells joined by ` | `. */
function textoDe(p: Pieza): string {
  const tabla = p.columnas.length === 0 ? [] : [p.columnas, ...p.filas];
  return [
    p.nombre,
    p.fecha,
    '',
    ...tabla.map((fila) => fila.map(sinSaltos).join(' | ')),
    '',
    ...p.avisos,
    PIE,
  ].join('\n');
}

/** In the text part a cell stays on its row: each CR, LF or CRLF becomes one space. */
function sinSaltos(texto: string): string {
  return texto.replace(/\r\n|[\r\n]/g, ' ');
}

/** Inline styles of the validated workflow emails; none holds data, only the closed accent. */
const ESTILO = {
  cuerpo: 'margin:0;padding:16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;',
  marco: 'max-width:600px;margin:0 auto;background:#ffffff;border-collapse:collapse;',
  titulo: 'color:#ffffff;padding:16px;font-size:18px;font-weight:bold;',
  fecha: 'padding:12px 16px 0;color:#374151;font-size:13px;',
  contenido: 'padding:16px;',
  datos: 'border-collapse:collapse;font-size:13px;',
  columna: 'text-align:left;padding:6px 8px;',
  celda: 'padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;',
  aviso: 'padding:0 16px 8px;color:#4b5563;font-size:13px;',
  pie: 'padding:12px 16px;background:#f9fafb;color:#9ca3af;font-size:12px;',
};
const TABLA = 'width="100%" cellpadding="0" cellspacing="0"';

/** One layout row holding already-escaped content. */
function filaMarco(estilo: string, contenido: string): string {
  return `<tr><td style="${estilo}">${contenido}</td></tr>`;
}

/**
 * The HTML part: table layout, 600px wide, accent header, date, data, notices, footer.
 * Every interpolated text goes through `escaparHtml`; `tema.acento` comes from the map.
 */
function htmlDe(p: Pieza): string {
  const columna = `${ESTILO.columna}border-bottom:2px solid ${p.tema.acento};`;
  const datos =
    p.columnas.length === 0
      ? ''
      : `<table ${TABLA} style="${ESTILO.datos}">` +
        `<tr>${p.columnas.map((c) => `<th style="${columna}">${escaparHtml(c)}</th>`).join('')}</tr>` +
        p.filas
          .map((f) => `<tr>${f.map((v) => `<td style="${ESTILO.celda}">${escaparHtml(v)}</td>`).join('')}</tr>`)
          .join('') +
        '</table>';
  return (
    `<!DOCTYPE html><html lang="es"><body style="${ESTILO.cuerpo}">` +
    `<table role="presentation" ${TABLA} style="${ESTILO.marco}">` +
    filaMarco(`background:${p.tema.acento};${ESTILO.titulo}`, escaparHtml(p.nombre)) +
    filaMarco(ESTILO.fecha, escaparHtml(p.fecha)) +
    filaMarco(ESTILO.contenido, datos) +
    p.avisos.map((a) => filaMarco(ESTILO.aviso, escaparHtml(a))).join('') +
    filaMarco(ESTILO.pie, PIE) +
    '</table></body></html>'
  );
}
