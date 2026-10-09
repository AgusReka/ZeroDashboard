import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cronValido } from './automatizaciones.js';
import {
  cronDeHorario,
  proyectarAjustes,
  resolverAjustes,
  type FilaAjustes,
  type PlantillaAjustes,
} from './panel-ajustes.js';
import { DIAS_PRESET, frecuenciaDeCron, horarioPresetDeCron } from './panel-automatizaciones.js';

/**
 * Unit cases for CH-23 (DEC-138 to DEC-141): the pure half of the panel's adjust feature.
 * No database, no network: the preset mapping, the allow-listed projection and the body
 * rules that decide what is written.
 */

const ZONA = 'UTC';

const PLANTILLA: PlantillaAjustes = {
  sql: 'SELECT nombre FROM v_producto WHERE stock <= :umbral',
  parametros: [{ nombre: 'umbral', tipo: 'numero' }],
};

const SIN_UMBRAL: PlantillaAjustes = { sql: 'SELECT 1', parametros: [] };

function fila(parche: Partial<FilaAjustes> = {}): FilaAjustes {
  return { activo: true, cron: '30 8 * * 1-5', valores: { umbral: 20 }, destinatario: 'ana@empresa.com', ...parche };
}

// ---- preset mapping (DEC-129 vectors, the table the console also pins) -------------

/** The same vectors as `VECTORES_HORARIO` in `src/consola.test.ts`: dias, hora, cron. */
const VECTORES: Array<['todos' | 'lun-vie' | 'lun-sab', string, string]> = [
  ['todos', '08:30', '30 8 * * *'],
  ['lun-vie', '08:30', '30 8 * * 1-5'],
  ['lun-sab', '08:30', '30 8 * * 1-6'],
  ['todos', '00:00', '0 0 * * *'],
  ['lun-vie', '23:59', '59 23 * * 1-5'],
  ['todos', '07:05', '5 7 * * *'],
];

describe('cronDeHorario — hour and day set to the cron the scheduler reads', () => {
  test('each preset vector gives its cron, standard for the scheduler', () => {
    for (const [dias, hora, cron] of VECTORES) {
      assert.equal(cronDeHorario(hora, dias), cron, `${dias} ${hora}`);
      assert.ok(cronValido(cron, ZONA), cron);
    }
  });

  test('an invalid hour or day set gives null and never a cron', () => {
    for (const hora of ['24:00', '8:30', '08:60', '08:3', '', ' 08:30', '08:30:00', 8, null, undefined, '08.30']) {
      assert.equal(cronDeHorario(hora, 'todos'), null, String(hora));
    }
    for (const dias of ['', 'lunes', '*', '1-5', 'constructor', '__proto__', null, undefined, 1]) {
      assert.equal(cronDeHorario('08:30', dias), null, String(dias));
    }
  });

  test('it round-trips through horarioPresetDeCron and the readable frequency', () => {
    for (const [dias, hora, cron] of VECTORES) {
      const partes = horarioPresetDeCron(cron);
      assert.deepEqual(partes && [partes.dias, partes.hora, partes.minuto], [dias, Number(hora.slice(0, 2)), Number(hora.slice(3))]);
      assert.equal(frecuenciaDeCron(cron), `${DIAS_PRESET.get(dias)?.texto} a las ${hora}`);
    }
  });

  test('horarioPresetDeCron gives null for any non-preset expression', () => {
    for (const cron of ['*/15 * * * *', '0 8 1 * *', '0 8 * * 1', '61 8 * * *', '0 24 * * *', '']) {
      assert.equal(horarioPresetDeCron(cron), null, cron);
    }
  });
});

// ---- projection (allow-list) ---------------------------------------------------------

describe('proyectarAjustes — only the editable values', () => {
  test('a preset cron with a declared umbral gives the full shape', () => {
    assert.deepEqual(proyectarAjustes(fila(), PLANTILLA, ZONA), {
      umbral: 20,
      hora: '08:30',
      dias: 'lun-vie',
      destinatario: 'ana@empresa.com',
      zonaHoraria: ZONA,
    });
  });

  test('a custom cron gives no hora, no dias and no cron text', () => {
    const ajustes = proyectarAjustes(fila({ cron: '0 */6 * * *' }), PLANTILLA, ZONA);
    assert.deepEqual(Object.keys(ajustes).sort(), ['destinatario', 'umbral', 'zonaHoraria']);
    assert.ok(!JSON.stringify(ajustes).includes('*/6'));
  });

  test('a template without umbral, or a stored value that is not a finite number, omits umbral', () => {
    assert.ok(!('umbral' in proyectarAjustes(fila(), SIN_UMBRAL, ZONA)));
    for (const valores of [{ umbral: '20' }, { umbral: null }, {}, null, 'x', [20]]) {
      assert.ok(!('umbral' in proyectarAjustes(fila({ valores }), PLANTILLA, ZONA)), JSON.stringify(valores));
    }
  });

  test('a missing recipient is null, and no stored column outside the allow-list leaks', () => {
    const cruda = { ...fila({ destinatario: null }), tenantId: 'ten-1', conexionId: 'con-1', id: 'aut-1' };
    const ajustes = proyectarAjustes(cruda, { ...PLANTILLA, sql: 'SELECT secreto :umbral' }, ZONA);
    assert.equal(ajustes.destinatario, null);
    const texto = JSON.stringify(ajustes);
    for (const valor of ['ten-1', 'con-1', 'aut-1', 'secreto', 'cron', 'valores']) {
      assert.ok(!texto.includes(valor), valor);
    }
  });
});

// ---- body rules ----------------------------------------------------------------------

describe('resolverAjustes — what is written, and what is refused', () => {
  test('a full valid body gives the merged columns and keeps the other valores keys', () => {
    // Only declared keys can live in `valores` (DEC-58), so the template declares a second one.
    const dosParametros: PlantillaAjustes = {
      sql: 'SELECT 1 WHERE a <= :umbral AND b = :otro',
      parametros: [
        { nombre: 'umbral', tipo: 'numero' },
        { nombre: 'otro', tipo: 'texto' },
      ],
    };
    const resultado = resolverAjustes(
      { umbral: 5, hora: '09:15', dias: 'lun-sab', destinatario: '  nuevo@empresa.com  ' },
      fila({ valores: { umbral: 20, otro: 'se queda' } }),
      dosParametros,
      ZONA,
    );
    assert.deepEqual(resultado, {
      ok: true,
      datos: { valores: { umbral: 5, otro: 'se queda' }, cron: '15 9 * * 1-6', destinatario: 'nuevo@empresa.com' },
    });
  });

  test('only the sent fields are written; the other half of the schedule comes from the stored one', () => {
    assert.deepEqual(resolverAjustes({ hora: '10:00' }, fila(), PLANTILLA, ZONA), { ok: true, datos: { cron: '0 10 * * 1-5' } });
    assert.deepEqual(resolverAjustes({ dias: 'todos' }, fila(), PLANTILLA, ZONA), { ok: true, datos: { cron: '30 8 * * *' } });
    assert.deepEqual(resolverAjustes({ umbral: 0 }, fila(), PLANTILLA, ZONA), { ok: true, datos: { valores: { umbral: 0 } } });
  });

  test('an empty body is a 400 with no field', () => {
    assert.deepEqual(resolverAjustes({}, fila(), PLANTILLA, ZONA), { ok: false, estado: 400, campos: [] });
  });

  test('every offender is named together, in business names', () => {
    const resultado = resolverAjustes(
      { umbral: 'x', hora: '25:00', dias: 'lunes', destinatario: 'no-es-un-correo' },
      fila(),
      PLANTILLA,
      ZONA,
    );
    assert.deepEqual(resultado, { ok: false, estado: 400, campos: ['umbral', 'hora', 'dias', 'destinatario'] });
  });

  test('umbral must be a finite JSON number (DEC-60) and the template must declare it', () => {
    for (const umbral of ['5', null, true, {}, [], Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(
        resolverAjustes({ umbral }, fila(), PLANTILLA, ZONA),
        { ok: false, estado: 400, campos: ['umbral'] },
        String(umbral),
      );
    }
    assert.deepEqual(resolverAjustes({ umbral: 5 }, fila(), SIN_UMBRAL, ZONA), { ok: false, estado: 400, campos: ['umbral'] });
  });

  test('a recipient that is empty, not a string or carries a line break is refused', () => {
    for (const destinatario of ['', '   ', 5, null, 'a@b.com\r\nBcc: x@y.com']) {
      assert.deepEqual(
        resolverAjustes({ destinatario }, fila(), PLANTILLA, ZONA),
        { ok: false, estado: 400, campos: ['destinatario'] },
        String(destinatario),
      );
    }
  });

  test('a schedule change over a non-preset cron is a 409 and never overwrites it', () => {
    for (const cuerpo of [{ hora: '10:00' }, { dias: 'todos' }, { hora: '10:00', dias: 'todos', umbral: 5 }]) {
      assert.deepEqual(
        resolverAjustes(cuerpo, fila({ cron: '0 */6 * * *' }), PLANTILLA, ZONA),
        { ok: false, estado: 409, error: 'horario-no-editable' },
      );
    }
    assert.deepEqual(resolverAjustes({ umbral: 5 }, fila({ cron: '0 */6 * * *' }), PLANTILLA, ZONA), {
      ok: true,
      datos: { valores: { umbral: 5 } },
    });
  });

  test('a stored valores that is not an object is rebuilt from umbral alone', () => {
    assert.deepEqual(resolverAjustes({ umbral: 3 }, fila({ valores: null }), PLANTILLA, ZONA), {
      ok: true,
      datos: { valores: { umbral: 3 } },
    });
  });
});
