import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  COPY_NEGOCIO,
  COPY_NEUTRO,
  copyDe,
  frecuenciaDeCron,
  proyectarActiva,
  proyectarDisponibles,
  resultadoDe,
  type FilaAutomatizacion,
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

// ---- 1.3 result mapping ------------------------------------------------------------

describe('resultadoDe — a neutral outcome, never the failure reason', () => {
  test('1.3 ok is completada', () => {
    assert.equal(resultadoDe('ok'), 'completada');
  });

  test('1.3 fallo, omitida and unknown states are no-realizada', () => {
    for (const estado of ['fallo', 'omitida', 'en-curso', 'algo-nuevo', '']) {
      assert.equal(resultadoDe(estado), 'no-realizada', estado);
    }
  });
});

// ---- 1.4 to 1.6 active-item projection ----------------------------------------------

const AHORA = new Date('2026-10-07T10:00:00Z');
const ZONA_BA = 'America/Argentina/Buenos_Aires';
const PROHIBIDAS = ['tenantId', 'conexionId', 'valores', 'codigoError', 'error', 'sql'];

/** A stored row as the database would hand it, carrying every forbidden field. */
const FILA_CRUDA = {
  id: 'aut-1',
  tenantId: 'ten-1',
  plantillaId: 'pla-1',
  conexionId: 'con-1',
  valores: { umbral: 5 },
  destinatario: 'ana@empresa.com',
  activo: true,
  cron: '0 8 * * *',
  plantilla: { automatizacion: 'stock-fisico', nombre: 'Console name', sql: 'SELECT 1' },
};
const EJECUCION_CRUDA = {
  id: 'eje-1',
  tenantId: 'ten-1',
  estado: 'fallo',
  iniciadaEn: new Date('2026-10-07T08:00:00Z'),
  finalizadaEn: new Date('2026-10-07T08:00:05Z'),
  error: 'sql-rechazado',
  codigoError: '42P01',
};

function fila(parche: Partial<FilaAutomatizacion> = {}): FilaAutomatizacion {
  return { activo: true, cron: '0 8 * * *', plantilla: { automatizacion: 'stock-fisico' }, ...parche };
}

/** Every key at any depth of a parsed JSON value. */
function clavesProfundas(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap(clavesProfundas);
  }
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => [k, ...clavesProfundas(v)]);
  }
  return [];
}

describe('proyectarActiva — allow-list without technical fields', () => {
  test('1.4 no forbidden key and no stored value reaches the item', () => {
    const item = proyectarActiva(FILA_CRUDA, EJECUCION_CRUDA, AHORA, 'UTC');
    const claves = clavesProfundas(item);
    for (const prohibida of PROHIBIDAS) {
      assert.ok(!claves.includes(prohibida), prohibida);
    }
    const texto = JSON.stringify(item);
    for (const valor of ['SELECT 1', 'Console name', '42P01', 'sql-rechazado', 'ten-1', 'con-1']) {
      assert.ok(!texto.includes(valor), valor);
    }
  });

  test('1.4 the item has exactly the allow-listed keys and no id', () => {
    const item = proyectarActiva(FILA_CRUDA, EJECUCION_CRUDA, AHORA, 'UTC');
    assert.deepEqual(Object.keys(item).sort(), [
      'descripcion',
      'estado',
      'frecuencia',
      'proximaEjecucion',
      'titulo',
      'ultimaEjecucion',
    ]);
    assert.deepEqual(Object.keys(item.ultimaEjecucion ?? {}).sort(), ['fecha', 'resultado']);
  });

  test('1.4 the copy comes from the slug map, and the fallback for an unmapped slug', () => {
    const mapeada = proyectarActiva(fila(), null, AHORA, 'UTC');
    assert.equal(mapeada.titulo, 'Aviso de stock bajo');
    const otra = proyectarActiva(
      fila({ plantilla: { automatizacion: 'reporte-semanal' } }),
      null,
      AHORA,
      'UTC',
    );
    assert.equal(otra.titulo, 'Automatización de tu negocio');
  });

  test('1.4 estado is activa or pausada only; a failed last run does not change it', () => {
    assert.equal(proyectarActiva(fila(), null, AHORA, 'UTC').estado, 'activa');
    assert.equal(proyectarActiva(fila({ activo: false }), null, AHORA, 'UTC').estado, 'pausada');
    const conFallo = proyectarActiva(fila(), EJECUCION_CRUDA, AHORA, 'UTC');
    assert.equal(conFallo.estado, 'activa');
    assert.equal(conFallo.ultimaEjecucion?.resultado, 'no-realizada');
  });

  test('1.4 frecuencia is a missing key, not null, outside the three patterns', () => {
    const item = proyectarActiva(fila({ cron: '*/15 * * * *' }), null, AHORA, 'UTC');
    assert.equal('frecuencia' in item, false);
    assert.equal(proyectarActiva(fila(), null, AHORA, 'UTC').frecuencia, 'Todos los días a las 08:00');
  });

  test('1.4 fecha is finalizadaEn, or iniciadaEn when the run has no end', () => {
    const fin = proyectarActiva(fila(), { ...EJECUCION_CRUDA }, AHORA, 'UTC');
    assert.equal(fin.ultimaEjecucion?.fecha, '2026-10-07T08:00:05.000Z');
    const sinFin = proyectarActiva(
      fila(),
      { estado: 'ok', iniciadaEn: new Date('2026-10-07T07:00:00Z'), finalizadaEn: null },
      AHORA,
      'UTC',
    );
    assert.deepEqual(sinFin.ultimaEjecucion, {
      fecha: '2026-10-07T07:00:00.000Z',
      resultado: 'completada',
    });
  });

  test('1.5 next run from a fixed clock, per zone', () => {
    assert.equal(proyectarActiva(fila(), null, AHORA, 'UTC').proximaEjecucion, '2026-10-08T08:00:00.000Z');
    assert.equal(proyectarActiva(fila(), null, AHORA, ZONA_BA).proximaEjecucion, '2026-10-07T11:00:00.000Z');
  });

  test('1.5 a paused automation has no next run', () => {
    assert.equal(proyectarActiva(fila({ activo: false }), null, AHORA, 'UTC').proximaEjecucion, null);
  });

  test('1.6 an invalid stored cron gives a null next run, no frecuencia and no throw', () => {
    for (const cron of ['no es un cron', '61 8 * * *']) {
      const item = proyectarActiva(fila({ cron }), null, AHORA, 'UTC');
      assert.equal(item.proximaEjecucion, null, cron);
      assert.equal('frecuencia' in item, false, cron);
    }
  });
});

// ---- 1.7 and 1.8 available automations --------------------------------------------

describe('proyectarDisponibles — what the client can still turn on', () => {
  const FISICO = { id: 'p-1', automatizacion: 'stock-fisico' };
  const PRODUCIBLE = { id: 'p-2', automatizacion: 'stock-producible' };

  test('1.7 a template with an active automation is not available', () => {
    const lista = proyectarDisponibles([FISICO, PRODUCIBLE], new Set(['p-1']));
    assert.deepEqual(lista, [copyDe('stock-producible')]);
  });

  test('1.7 a template with only a paused automation is available (its id is not active)', () => {
    assert.equal(proyectarDisponibles([FISICO], new Set()).length, 1);
    assert.equal(proyectarDisponibles([FISICO], new Set(['p-9'])).length, 1);
  });

  test('1.7 a tenant without automations sees every mapped template', () => {
    assert.equal(proyectarDisponibles([FISICO, PRODUCIBLE], new Set()).length, 2);
  });

  test('1.7 a template without business copy is hidden', () => {
    const lista = proyectarDisponibles(
      [{ id: 'p-3', automatizacion: 'reporte-semanal' }, FISICO],
      new Set(),
    );
    assert.deepEqual(lista, [copyDe('stock-fisico')]);
  });

  test('1.7 order is the copy map order, whatever the input order', () => {
    const lista = proyectarDisponibles([PRODUCIBLE, FISICO], new Set());
    assert.deepEqual(
      lista.map((i) => i.titulo),
      ['Aviso de stock bajo', 'Aviso de productos que ya casi no podés armar'],
    );
  });

  test('1.7 items carry only titulo and descripcion', () => {
    for (const item of proyectarDisponibles([FISICO, PRODUCIBLE], new Set())) {
      assert.deepEqual(Object.keys(item).sort(), ['descripcion', 'titulo']);
    }
  });

  test('1.8 two templates with the same slug yield a single entry', () => {
    const lista = proyectarDisponibles(
      [
        { id: 'p-8', automatizacion: 'stock-fisico' },
        { id: 'p-7', automatizacion: 'stock-fisico' },
      ],
      new Set(),
    );
    assert.deepEqual(lista, [copyDe('stock-fisico')]);
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
