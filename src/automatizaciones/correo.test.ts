import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  asuntoCorreo,
  componerCorreo,
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

// ---- message composition: shared input ----------------------------------------------

/** A minimal render input; each test overrides only what it is about. */
function entrada(cambios: Partial<Parameters<typeof componerCorreo>[0]> = {}) {
  return {
    nombre: 'Stock bajo',
    automatizacion: 'stock-fisico',
    columnas: ['sku', 'cantidad'],
    filas: [['A-1', 3]] as unknown[][],
    hayMas: false,
    fecha: new Date('2026-09-29T12:00:00Z'),
    zona: 'UTC',
    ...cambios,
  };
}

// ---- 2.2 cells inside the message (N2, DEC-84) ----------------------------------------

describe('componerCorreo — incomplete data renders as a well-formed table', () => {
  test('2.2 null, undefined and empty cells render as the placeholder; short rows are padded', () => {
    const correo = componerCorreo(
      entrada({ columnas: ['a', 'b', 'c', 'd', 'e'], filas: [[null, undefined, '', 0]] }),
    );
    for (const parte of [correo.html, correo.texto]) {
      assert.equal(parte.includes('null'), false);
      assert.equal(parte.includes('undefined'), false);
      assert.equal(parte.includes('NaN'), false);
    }
    assert.equal(correo.texto.includes(`${RAYA} | ${RAYA} | ${RAYA} | 0 | ${RAYA}`), true);
    assert.equal(correo.html.split(`>${RAYA}</td>`).length - 1, 4);
    assert.equal(correo.html.split('>0</td>').length - 1, 1);
  });

  test('2.2 an aggregate row of zeros renders every 0 inside a well-formed table', () => {
    const correo = componerCorreo(entrada({ columnas: ['x', 'y', 'z'], filas: [[0, 0, 0]] }));
    assert.equal(correo.texto.includes('0 | 0 | 0'), true);
    assert.equal(correo.html.includes(RAYA), false);
    for (const etiqueta of ['table', 'tr', 'td', 'th']) {
      const abre = correo.html.split(`<${etiqueta}`).length - 1;
      const cierra = correo.html.split(`</${etiqueta}>`).length - 1;
      assert.equal(abre, cierra, etiqueta);
    }
  });
});

// ---- 2.3 escaping inside the message (Threat Matrix: HTML in a cell, column, or name) --

describe('componerCorreo — cell content is never markup', () => {
  test('2.3 markup in a cell, a column name and the template name is escaped text', () => {
    const correo = componerCorreo(
      entrada({
        nombre: `Informe <b>"Q1"</b> & 'ventas'`,
        columnas: ['a<b', 'nota'],
        filas: [['<script>alert(1)</script>', `O'Neil & "hijos"`]],
      }),
    );
    assert.equal(correo.html.includes('<script>'), false);
    assert.equal(correo.html.includes('a<b'), false);
    assert.equal(correo.html.includes('<b>'), false);
    assert.equal(correo.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
    assert.equal(correo.html.includes('a&lt;b'), true);
    assert.equal(correo.html.includes('O&#39;Neil &amp; &quot;hijos&quot;'), true);
    assert.equal(
      correo.html.includes('Informe &lt;b&gt;&quot;Q1&quot;&lt;/b&gt; &amp; &#39;ventas&#39;'),
      true,
    );
  });
});

// ---- 2.4 notices (N2) ------------------------------------------------------------------

const AVISO_CORTE = 'la consulta devolvió más.';
const AVISO_VACIAS = 'Las celdas sin valor se muestran como —.';

describe('componerCorreo — notices tell the reader what the table does not show', () => {
  test('2.4 a truncated result states how many rows are shown, in both parts', () => {
    const filas = Array.from({ length: 500 }, (_, i) => [`S-${i}`, i + 1]);
    const correo = componerCorreo(entrada({ filas, hayMas: true }));
    const aviso = 'Se muestran las primeras 500 filas; la consulta devolvió más.';
    assert.equal(correo.html.includes(aviso), true);
    assert.equal(correo.texto.includes(aviso), true);
    assert.equal(correo.asunto, '⚠️ Stock bajo (500+)');
  });

  test('2.4 a complete result shows no truncation notice and no empty-cell notice', () => {
    const correo = componerCorreo(entrada({ filas: [['A-1', 3], ['B-2', 7]], hayMas: false }));
    for (const parte of [correo.html, correo.texto]) {
      assert.equal(parte.includes(AVISO_CORTE), false);
      assert.equal(parte.includes(AVISO_VACIAS), false);
    }
  });

  test('2.4 an empty cell adds the placeholder notice, in both parts', () => {
    const correo = componerCorreo(entrada({ filas: [['A-1', null]] }));
    assert.equal(correo.html.includes(AVISO_VACIAS), true);
    assert.equal(correo.texto.includes(AVISO_VACIAS), true);
  });

  test('2.4 rows without columns render a notice instead of an empty table', () => {
    const correo = componerCorreo(entrada({ columnas: [], filas: [[], [], []] }));
    const aviso = 'La consulta devolvió 3 filas sin columnas.';
    assert.equal(correo.html.includes(aviso), true);
    assert.equal(correo.texto.includes(aviso), true);
    assert.equal(correo.html.includes('<th'), false);
  });
});

// ---- 2.5 accent colour (DEC-85) --------------------------------------------------------

const ACENTOS = ['#f59e0b', '#dc2626', '#2563eb'];

describe('componerCorreo — the label picks the accent colour', () => {
  test('2.5 each known label uses its own accent and subject emoji, and no other accent', () => {
    const casos = [
      { automatizacion: 'stock-fisico', emoji: '⚠️', acento: '#f59e0b' },
      { automatizacion: 'stock-producible', emoji: '🔴', acento: '#dc2626' },
      { automatizacion: 'reporte-diario', emoji: '📊', acento: '#2563eb' },
    ];
    for (const caso of casos) {
      const correo = componerCorreo(entrada({ automatizacion: caso.automatizacion }));
      assert.equal(correo.asunto, `${caso.emoji} Stock bajo (1)`, caso.automatizacion);
      assert.equal(correo.html.includes(caso.acento), true, caso.automatizacion);
      for (const otro of ACENTOS.filter((a) => a !== caso.acento)) {
        assert.equal(correo.html.includes(otro), false, `${caso.automatizacion} ${otro}`);
      }
    }
  });

  test('2.5 an unknown label falls back to the neutral accent, never a throw', () => {
    for (const automatizacion of ['otra-cosa', 'constructor', '__proto__', '']) {
      const correo = componerCorreo(entrada({ automatizacion }));
      assert.equal(correo.html.includes('#6b7280'), true, automatizacion);
      assert.equal(ACENTOS.some((a) => correo.html.includes(a)), false, automatizacion);
    }
  });
});

// ---- 2.6 text part, run date, and body content (rule 5) -------------------------------

describe('componerCorreo — the text part and the date line', () => {
  test('2.6 the text part carries the same columns, rows and notices as the HTML', () => {
    const correo = componerCorreo(entrada({ filas: [['A-1', 3], ['B-2', null]], hayMas: true }));
    assert.equal(correo.html.includes('>A-1</td>'), true);
    const lineas = correo.texto.split('\n');
    for (const linea of [
      'Stock bajo',
      'sku | cantidad',
      'A-1 | 3',
      `B-2 | ${RAYA}`,
      'Se muestran las primeras 2 filas; la consulta devolvió más.',
      AVISO_VACIAS,
      'Enviado automáticamente por ZeroDashboard.',
    ]) {
      assert.equal(lineas.includes(linea), true, linea);
    }
  });

  test('2.6 CR and LF inside cells and column names become spaces in the text part', () => {
    const correo = componerCorreo(
      entrada({ columnas: ['nota\r\nlarga', 'b'], filas: [['uno\r\ndos', 'tres\ncuatro']] }),
    );
    const lineas = correo.texto.split('\n');
    assert.equal(correo.texto.includes('\r'), false);
    assert.equal(lineas.includes('nota larga | b'), true);
    assert.equal(lineas.includes('uno dos | tres cuatro'), true);
  });

  test('2.6 the run date is shown in the configured zone, in both parts', () => {
    const utc = componerCorreo(entrada({ zona: 'UTC' }));
    const ba = componerCorreo(entrada({ zona: 'America/Argentina/Buenos_Aires' }));
    assert.equal(utc.texto.includes('Ejecución del 2026-09-29 12:00 (UTC)'), true);
    assert.equal(utc.html.includes('Ejecución del 2026-09-29 12:00 (UTC)'), true);
    const lineaBa = 'Ejecución del 2026-09-29 09:00 (America/Argentina/Buenos_Aires)';
    assert.equal(ba.texto.includes(lineaBa), true);
    assert.equal(ba.html.includes(lineaBa), true);
  });

  test('2.6 the message holds no SQL, parameter, connection or recipient data', () => {
    const conInternos = {
      ...entrada(),
      sql: 'SELECT secreto FROM inventario',
      parametros: { umbral: 'valor-param-7' },
      host: 'db.interno.local',
      para: 'ana@empresa.com',
    } as Parameters<typeof componerCorreo>[0];
    const correo = componerCorreo(conInternos);
    assert.deepEqual(Object.keys(correo).sort(), ['asunto', 'html', 'texto']);
    for (const parte of [correo.asunto, correo.html, correo.texto]) {
      for (const interno of ['SELECT', 'valor-param-7', 'db.interno.local', 'ana@empresa.com']) {
        assert.equal(parte.includes(interno), false, interno);
      }
    }
    assert.equal(correo.html.includes('A-1'), true);
  });
});
