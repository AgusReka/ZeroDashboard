import { createHash, randomInt } from 'node:crypto';

/**
 * CH-43 (DEC-185, DEC-196): the one-time code a tenant sends to the bot to link a chat.
 * Pure: no database, no clock, no I/O. Only `hashCodigo`'s digest is ever stored; the plain
 * code leaves the server once, in the `POST /api/panel/telegram/codigo` response.
 */

/** How long a code stays valid after it is created: 10 minutes. */
export const DURACION_CODIGO_MS = 10 * 60_000;

/** Crockford base32: digits and letters without `I`, `L`, `O` and `U`. */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const LONGITUD = 8;

const PATRON = new RegExp(`^[${ALFABETO}]{${LONGITUD}}$`);

/** SHA-256 hex of a code already normalized. */
export function hashCodigo(codigo: string): string {
  return createHash('sha256').update(codigo, 'utf8').digest('hex');
}

/**
 * A fresh code and its hash. Each character comes from `randomInt(32)`, a cryptographic
 * source with no modulo bias.
 */
export function generarCodigo(): { codigo: string; codigoHash: string } {
  let codigo = '';
  for (let i = 0; i < LONGITUD; i += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return { codigo, codigoHash: hashCodigo(codigo) };
}

/**
 * A received code read leniently, or `null` when it is not 8 valid characters. Spaces and
 * hyphens are dropped, letters are upper-cased, `O` reads as `0`, and `I` and `L` read as
 * `1`. It runs before `hashCodigo` on both sides, so equal codes hash equally.
 */
export function normalizarCodigo(texto: string): string | null {
  const codigo = texto
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return PATRON.test(codigo) ? codigo : null;
}
