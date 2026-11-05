import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { componerCorreo, type EntradaCorreo } from './correo.js';
import { componerTelegram, LIMITE_TELEGRAM } from './mensaje-telegram.js';

/**
 * CH-44 (DEC-185, DEC-188, DEC-197): the Telegram message is the email's text part, cut to fit.
 * Pure: no database and no network.
 */

function entrada(parche: Partial<EntradaCorreo> = {}): EntradaCorreo {
  return {
    nombre: 'Stock bajo',
    automatizacion: 'stock-fisico',
    columnas: ['producto', 'cantidad'],
    filas: [['Harina', 3], ['Sal', 1]],
    hayMas: false,
    fecha: new Date('2026-11-05T12:00:00Z'),
    zona: 'UTC',
    ...parche,
  };
}

const MENSAJE = { encabezado: 'Productos con poco stock', linea: '{producto}: quedan {cantidad}' };

/** `n` rows whose lines are about `ancho` long, each one recognizable. */
const filasLargas = (n: number, ancho: number): unknown[][] =>
  Array.from({ length: n }, (_, i) => [`p${i}-`.padEnd(ancho, 'x'), i]);

/** Whether a UTF-16 string holds half of a surrogate pair. */
const tieneSustitutoSuelto = (texto: string): boolean =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(texto);

describe('componerTelegram', () => {
  test('a short message with texts equals the email text part', () => {
    const e = entrada({ mensaje: MENSAJE });
    assert.equal(componerTelegram(e), componerCorreo(e).texto);
  });

  test('a short message with no texts equals the email text part, in the table form', () => {
    const e = entrada();
    const texto = componerTelegram(e);
    assert.equal(texto, componerCorreo(e).texto);
    assert.ok(texto.includes('producto | cantidad\nHarina | 3\nSal | 1'), texto);
  });

  test('markup stays literal: nothing is escaped', () => {
    const texto = componerTelegram(entrada({ filas: [['<b>*x*</b>_&', 1]] }));
    assert.ok(texto.includes('<b>*x*</b>_& | 1'), texto);
  });

  test('a line break in a cell stays on its row', () => {
    const texto = componerTelegram(entrada({ filas: [['a\nb', 1]] }));
    assert.ok(texto.includes('a b | 1'), texto);
  });

  test('a message at exactly the limit is not cut, and one more character is', () => {
    const conAncho = (ancho: number) => componerTelegram(entrada({ nombre: 'n'.repeat(ancho), filas: [['x', 1]] }));
    const justo = LIMITE_TELEGRAM - conAncho(0).length;
    assert.equal(conAncho(justo).length, LIMITE_TELEGRAM);
    assert.ok(!conAncho(justo).includes('Por el largo'));
    assert.ok(conAncho(justo + 1).length <= LIMITE_TELEGRAM);
  });

  test('a long result is cut at a whole line, keeps the frame and says how many rows entered', () => {
    const e = entrada({ filas: filasLargas(500, 60) });
    const texto = componerTelegram(e);
    assert.ok(texto.length <= LIMITE_TELEGRAM, String(texto.length));
    assert.ok(texto.startsWith('Stock bajo\n'), 'the name');
    assert.ok(texto.endsWith('Enviado automáticamente por ZeroDashboard.'), 'the footer');
    const aviso = /Por el largo del mensaje, entran (\d+) de las 500 filas\./.exec(texto);
    assert.ok(aviso, 'the notice');
    const mostradas = Number(aviso[1]);
    assert.ok(mostradas > 0 && mostradas < 500);
    const filas = texto.split('\n').filter((linea) => /^p\d+-/.test(linea));
    assert.equal(filas.length, mostradas, 'the notice counts the rows shown');
    // Whole lines: the last row shown still has its count.
    assert.equal(filas[filas.length - 1], `p${mostradas - 1}-`.padEnd(60, 'x') + ` | ${mostradas - 1}`);
  });

  test('the row cap notice stays beside the length notice', () => {
    const texto = componerTelegram(entrada({ filas: filasLargas(500, 60), hayMas: true }));
    assert.ok(texto.includes('Se muestran las primeras 500 filas; la consulta devolvió más.'), texto.slice(-300));
    assert.ok(texto.includes('Por el largo del mensaje, entran '), texto.slice(-300));
  });

  test('the template texts are cut the same way', () => {
    const texto = componerTelegram(entrada({ mensaje: MENSAJE, filas: filasLargas(500, 60) }));
    assert.ok(texto.length <= LIMITE_TELEGRAM);
    assert.ok(texto.includes('Productos con poco stock\np0-'), 'the header stays above the rows');
  });

  test('one line above the limit is cut itself, ends in an ellipsis and splits no emoji', () => {
    const columnas = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const fila = columnas.map(() => '😀'.repeat(240));
    const texto = componerTelegram(entrada({ columnas, filas: [fila] }));
    assert.ok(texto.length <= LIMITE_TELEGRAM, String(texto.length));
    assert.ok(!tieneSustitutoSuelto(texto), 'no unpaired surrogate');
    assert.ok(texto.includes('…\n'), 'the cut line ends in an ellipsis');
    assert.ok(texto.includes('entran 1 de las 1 filas.'), texto.slice(-200));
  });

  test('a column row above the limit is cut too', () => {
    const columnas = Array.from({ length: 40 }, (_, i) => `${i}-`.padEnd(200, 'c'));
    const texto = componerTelegram(entrada({ columnas, filas: [columnas.map(() => 'x')] }));
    assert.ok(texto.length <= LIMITE_TELEGRAM, String(texto.length));
    assert.ok(texto.includes('entran 0 de las 1 filas.'), texto.slice(-200));
  });

  test('no size ever goes above the limit, or leaves half a character', () => {
    for (const ancho of [10, 45, 90, 180, 400, 495]) {
      for (const cuantas of [1, 9, 11, 40, 99, 101, 1000, 1001]) {
        const filas = filasLargas(cuantas, ancho).map(([celda, n]) => [`😀${String(celda)}`, n]);
        const texto = componerTelegram(entrada({ filas }));
        assert.ok(texto.length <= LIMITE_TELEGRAM, `${cuantas} x ${ancho}: ${texto.length}`);
        assert.ok(!tieneSustitutoSuelto(texto), `${cuantas} x ${ancho}`);
      }
    }
  });

  test('a template name that fills the frame still respects the limit', () => {
    const texto = componerTelegram(entrada({ nombre: 'n'.repeat(5000) }));
    assert.ok(texto.length <= LIMITE_TELEGRAM, String(texto.length));
  });
});
