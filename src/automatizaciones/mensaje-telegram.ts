import { partesDeTexto, unirTexto, type EntradaCorreo } from './correo.js';

/**
 * CH-44 (DEC-185, DEC-197): a run's Telegram message, the email's text part cut to fit. It is
 * sent with no `parse_mode`, so every character is literal and nothing is escaped.
 */

/**
 * `sendMessage.text`: "1-4096 characters after entities parsing". `.length` counts UTF-16
 * units, never fewer than the characters Telegram counts, so it can only err on the short side.
 */
export const LIMITE_TELEGRAM = 4096;

function avisoDeCorte(mostradas: number, total: number): string {
  return `Por el largo del mensaje, entran ${mostradas} de las ${total} filas.`;
}

/** `texto` within `maximo` UTF-16 units, ending in `…`, never splitting a code point. */
function cortar(texto: string, maximo: number): string {
  let salida = '';
  for (const caracter of texto) {
    if (salida.length + caracter.length + 1 > maximo) break;
    salida += caracter;
  }
  return `${salida}…`;
}

/**
 * The email's text part when it fits. Otherwise the leading body lines that fit whole, with
 * the name, date, notices and footer always kept and a notice of the cut. When not even the
 * first row fits, that line is cut itself, and so is the first line if it alone overflows.
 */
export function componerTelegram(e: EntradaCorreo): string {
  const partes = partesDeTexto(e);
  const entero = unirTexto(partes);
  if (entero.length <= LIMITE_TELEGRAM) {
    return entero;
  }
  const total = e.filas.length;
  // Measured with the total's digits, never shorter than the shown count's. Each body line
  // then costs its length plus one line break.
  const marco = unirTexto({ ...partes, cuerpo: [], avisos: [...partes.avisos, avisoDeCorte(total, total)] });
  let libre = LIMITE_TELEGRAM - marco.length;
  const cuerpo: string[] = [];
  for (const linea of partes.cuerpo) {
    const costo = linea.length + 1;
    if (costo > libre) {
      // Only the first two lines may be cut: from there on, the rows that fit are enough.
      if (cuerpo.length < 2 && libre >= 2) {
        cuerpo.push(cortar(linea, libre - 1));
      }
      break;
    }
    cuerpo.push(linea);
    libre -= costo;
  }
  const mostradas = Math.max(cuerpo.length - 1, 0);
  const texto = unirTexto({ ...partes, cuerpo, avisos: [...partes.avisos, avisoDeCorte(mostradas, total)] });
  // A template name long enough to fill the frame by itself: still never over the limit.
  return texto.length <= LIMITE_TELEGRAM ? texto : cortar(texto, LIMITE_TELEGRAM);
}
