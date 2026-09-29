import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  asuntoCorreo,
  direccionValida,
  escaparHtml,
  textoDeCelda,
} from './correo.js';

/**
 * Unit cases for CH-14 Phase 2: the pure email renderer (N1, N2; DEC-84, DEC-85) and the
 * recipient check (DEC-82). No network, no database, no nodemailer: `src/correo.ts` only
 * turns a run's columns and rows into text, and says whether a string is one address.
 */

const RAYA = '—';

// ---- 2.1 recipient validation (DEC-82) -----------------------------------------------

describe('direccionValida — one plain ASCII address, header-safe', () => {
  test('2.1 accepts plain ASCII addresses', () => {
    for (const valor of [
      'ana@empresa.com',
      'ana.lopez+stock@ventas.empresa.com.ar',
      "o'brien_1@x-y.io",
      `${'a'.repeat(64)}@x.co`,
    ]) {
      assert.equal(direccionValida(valor), true, valor);
    }
  });

  test('2.1 rejects header injection, lists, and separators', () => {
    for (const valor of [
      'a@x.com\r\nBcc: b@y.com',
      'a@x.com\nb@y.com',
      'a@x.com,b@y.com',
      'a@x.com;b@y.com',
      'Ana <a@x.com>',
      '"ana"@x.com',
      'a(b)@x.com',
      'a @x.com',
      ' a@x.com',
      'a@x.com ',
      'a\t@x.com',
    ]) {
      assert.equal(direccionValida(valor), false, JSON.stringify(valor));
    }
  });

  test('2.1 rejects malformed local parts, domains, and lengths', () => {
    for (const valor of [
      'not-an-email',
      '',
      '@x.com',
      'a@',
      'a@@x.com',
      'a@b@x.com',
      '.a@x.com',
      'a.@x.com',
      'a..b@x.com',
      `${'a'.repeat(65)}@x.co`,
      `a@${`${'b'.repeat(63)}.`.repeat(4)}com`,
      'a@localhost',
      'a@x.c',
      'a@x.c0m',
      'a@-x.com',
      'a@x-.com',
      'a@x..com',
      'ñandú@x.com',
      'a@exämple.com',
    ]) {
      assert.equal(direccionValida(valor), false, JSON.stringify(valor));
    }
  });
});

// ---- 2.2 cell text (N2, DEC-84) -------------------------------------------------------

describe('textoDeCelda — no null, undefined or broken cell ever reaches the reader', () => {
  test('2.2 missing values become the placeholder; zero stays 0', () => {
    for (const valor of [null, undefined, '', Number.NaN, Infinity, -Infinity]) {
      assert.equal(textoDeCelda(valor), RAYA, String(valor));
    }
    assert.equal(textoDeCelda(0), '0');
    assert.equal(textoDeCelda(12.5), '12.5');
    assert.equal(textoDeCelda(10n), '10');
    assert.equal(textoDeCelda('texto'), 'texto');
  });

  test('2.2 booleans, dates, bytes and objects have a fixed reading', () => {
    assert.equal(textoDeCelda(true), 'Sí');
    assert.equal(textoDeCelda(false), 'No');
    assert.equal(textoDeCelda(new Date('2026-01-02T03:04:05Z')), '2026-01-02T03:04:05.000Z');
    assert.equal(textoDeCelda(new Date('invalida')), RAYA);
    assert.equal(textoDeCelda(Buffer.from([1, 2])), '[binario]');
    assert.equal(textoDeCelda(new Uint8Array([1])), '[binario]');
    assert.equal(textoDeCelda({ a: 1, b: [2] }), '{"a":1,"b":[2]}');
    const ciclico: Record<string, unknown> = {};
    ciclico.yo = ciclico;
    assert.equal(textoDeCelda(ciclico), RAYA);
    assert.equal(textoDeCelda(() => 1), RAYA);
  });

  test('2.2 long text is capped at 500 characters ending in an ellipsis', () => {
    const texto = textoDeCelda('x'.repeat(900));
    assert.equal(texto.length, 500);
    assert.equal(texto.endsWith('…'), true);
    assert.equal(textoDeCelda('y'.repeat(500)), 'y'.repeat(500));
  });
});

// ---- 2.3 escaping (Threat Matrix: HTML in a cell, column, or name) --------------------

describe('escaparHtml — text never opens markup or an attribute', () => {
  test('2.3 escaparHtml covers the five significant characters', () => {
    assert.equal(
      escaparHtml(`<a href="x">&'</a>`),
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
    assert.equal(escaparHtml('sin cambios'), 'sin cambios');
  });
});

// ---- 2.5 subject (DEC-85; Threat Matrix: CRLF in template name) ------------------------

/** A subject input for `Stock bajo` with one row; each test overrides what it is about. */
function asunto(cambios: Partial<Parameters<typeof asuntoCorreo>[0]> = {}): string {
  return asuntoCorreo({
    nombre: 'Stock bajo',
    automatizacion: 'stock-fisico',
    filas: 1,
    hayMas: false,
    ...cambios,
  });
}

describe('asuntoCorreo — header-safe subject themed by the template label', () => {
  test('2.5 each known label selects its own emoji', () => {
    assert.equal(asunto({ automatizacion: 'stock-fisico' }), '⚠️ Stock bajo (1)');
    assert.equal(asunto({ automatizacion: 'stock-producible' }), '🔴 Stock bajo (1)');
    assert.equal(asunto({ automatizacion: 'reporte-diario' }), '📊 Stock bajo (1)');
  });

  test('2.5 an unknown label has no emoji and never throws', () => {
    for (const automatizacion of ['otra-cosa', 'constructor', '__proto__', '']) {
      assert.equal(asunto({ automatizacion }), 'Stock bajo (1)', automatizacion);
    }
  });

  test('2.5 the count carries a + when the result was truncated', () => {
    assert.equal(
      asunto({ automatizacion: 'stock-producible', filas: 500, hayMas: true }),
      '🔴 Stock bajo (500+)',
    );
  });

  test('2.5 CR, LF and other control characters never reach the subject', () => {
    const valor = asunto({ nombre: 'Report\r\nBcc: x@y.com\u0000\t\u2028fin' });
    assert.equal(/[\r\n\u0000-\u001f\u007f\u2028\u2029]/.test(valor), false);
    assert.equal(valor, '⚠️ Report Bcc: x@y.com fin (1)');
  });

  test('2.5 the subject is capped at 200 characters and keeps the count', () => {
    const valor = asunto({ nombre: 'n'.repeat(300) });
    assert.equal(Array.from(valor).length, 200);
    assert.equal(valor.endsWith('… (1)'), true);
  });
});
