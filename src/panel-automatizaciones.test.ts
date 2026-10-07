import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  COPY_NEGOCIO,
  COPY_NEUTRO,
  copyDe,
  frecuenciaDeCron,
} from './panel-automatizaciones.js';

/**
 * Unit cases for CH-22b (DEC-137): the pure half of the panel's automations read. No
 * database, no network, no clock: only the copy map, the frequency text and the rules that
 * build the allow-listed items.
 */

// ---- 1.1 copy map and fallback ------------------------------------------------------

describe('copyDe — business copy with a neutral fallback', () => {
  test('1.1 a mapped slug returns its map entry', () => {
    assert.deepEqual(copyDe('stock-fisico'), {
      titulo: 'Aviso de stock bajo',
      descripcion: 'Te avisamos por correo cuando un producto se está quedando sin stock.',
    });
    assert.equal(copyDe('stock-producible'), COPY_NEGOCIO.get('stock-producible'));
  });

  test('1.1 the map keeps the catalog order used by disponibles', () => {
    assert.deepEqual([...COPY_NEGOCIO.keys()], ['stock-fisico', 'stock-producible']);
  });

  test('1.1 an unmapped slug returns the fallback and never throws', () => {
    for (const slug of ['reporte-semanal', '', 'constructor', '__proto__']) {
      assert.equal(copyDe(slug), COPY_NEUTRO, slug);
    }
  });

  test('1.1 the fallback carries only a title and a description, no template name', () => {
    assert.deepEqual(Object.keys(COPY_NEUTRO).sort(), ['descripcion', 'titulo']);
    assert.equal(COPY_NEUTRO.titulo, 'Automatización de tu negocio');
    assert.equal(COPY_NEUTRO.descripcion, 'Una revisión automática que te mandamos por correo.');
  });
});

// ---- 1.2 frequency mapping (DEC-129) ------------------------------------------------

describe('frecuenciaDeCron — text only for the three DEC-129 patterns', () => {
  test('1.2 the three patterns', () => {
    assert.equal(frecuenciaDeCron('30 8 * * *'), 'Todos los días a las 08:30');
    assert.equal(frecuenciaDeCron('0 9 * * 1-5'), 'De lunes a viernes a las 09:00');
    assert.equal(frecuenciaDeCron('0 18 * * 1-6'), 'De lunes a sábado a las 18:00');
  });

  test('1.2 hour and minute are zero-padded', () => {
    assert.equal(frecuenciaDeCron('5 7 * * *'), 'Todos los días a las 07:05');
  });

  test('1.2 extra whitespace is normalized', () => {
    assert.equal(frecuenciaDeCron('  30   8 *  * *  '), 'Todos los días a las 08:30');
  });

  test('1.2 any other expression gives null', () => {
    for (const cron of [
      '*/15 * * * *',
      '0 8 1 * *',
      '0 8 * * 0-6',
      '0 8 * * 1',
      '61 8 * * *',
      '0 24 * * *',
      'no es un cron',
      '',
    ]) {
      assert.equal(frecuenciaDeCron(cron), null, cron);
    }
  });

  test('1.2 the result never contains the cron string', () => {
    for (const cron of ['30 8 * * *', '0 9 * * 1-5', '0 18 * * 1-6']) {
      assert.ok(!(frecuenciaDeCron(cron) ?? '').includes(cron), cron);
    }
  });
});

// ---- 1.9 glossary scan --------------------------------------------------------------

describe('glosario — no technical term reaches the client copy', () => {
  const PROHIBIDOS = [
    'tenant',
    'cron',
    'sql',
    'consulta',
    'query',
    'ejecución',
    'réplica',
    'parámetro',
    'timeout',
    'plantilla',
  ];

  test('1.9 the copy map, the fallback and every frequency text are clean', () => {
    const textos: string[] = [];
    for (const { titulo, descripcion } of [...COPY_NEGOCIO.values(), COPY_NEUTRO]) {
      textos.push(titulo, descripcion);
    }
    for (const cron of ['30 8 * * *', '0 9 * * 1-5', '0 18 * * 1-6']) {
      textos.push(frecuenciaDeCron(cron) as string);
    }
    assert.equal(textos.length, 9);
    for (const texto of textos) {
      for (const termino of PROHIBIDOS) {
        assert.ok(!texto.toLowerCase().includes(termino), `"${termino}" en "${texto}"`);
      }
    }
  });
});
