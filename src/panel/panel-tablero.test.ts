import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { RespuestaSobreVistas } from '../ejecucion/ejecucion-sobre-vistas.js';
import type { FilaReporte, ReporteLeido } from '../reportes/reportes.js';
import {
  aNumero,
  crearCompuerta,
  DESCARTADO,
  EN_COLA_POR_TENANT,
  EN_CURSO_POR_TENANT,
  entradaDeConfiguracion,
  leerDiasDeConsulta,
  normalizarValor,
  respuestaDeEjecucion,
} from './panel-tablero.js';

/** CH-48 task 2.3: the pure half of the panel dashboard (design §1.3, §1.4). */

describe('CH-48 leerDiasDeConsulta — the query shape, with no AJV coercion', () => {
  test('absent dias, an empty query or undefined is no request', () => {
    assert.equal(leerDiasDeConsulta({}), undefined);
    assert.equal(leerDiasDeConsulta(undefined), undefined);
    assert.equal(leerDiasDeConsulta(null), undefined);
  });

  test('a digits-only string is its number', () => {
    assert.equal(leerDiasDeConsulta({ dias: '7' }), 7);
    assert.equal(leerDiasDeConsulta({ dias: '366' }), 366);
  });

  test('any other shape is a refusal: decimals, signs, exponents, a repeated key, an extra key', () => {
    for (const query of [
      { dias: '7.0' },
      { dias: '-7' },
      { dias: '1e1' },
      { dias: '' },
      { dias: ' 7' },
      { dias: '1000' },
      { dias: ['7', '30'] },
      { dias: 7 },
      { dias: '7', tenantId: 'otro' },
      { tenantId: 'otro' },
      'dias=7',
      ['7'],
    ]) {
      assert.equal(leerDiasDeConsulta(query), 'rechazo', JSON.stringify(query));
    }
  });
});

function fila(cambios: Partial<FilaReporte> = {}): FilaReporte {
  return {
    id: 'r-1',
    nombre: 'ventas-por-producto-interno',
    titulo: 'Ventas',
    descripcion: 'Por producto',
    sql: 'SELECT producto, unidades FROM v_pedido WHERE fecha >= :desde',
    entidades: ['pedido'],
    visualizacion: 'barras',
    columnas: [
      { rol: 'etiqueta', columna: 'producto_col', titulo: 'Producto' },
      { rol: 'valor', columna: 'unidades_col', titulo: 'Unidades' },
    ],
    periodo: { parametro: 'desde', dias: [30, 7] },
    ...cambios,
  };
}

describe('CH-48 entradaDeConfiguracion — what the configuration lists of a report', () => {
  test('title, description, visualization and the declared days with the first as default', () => {
    assert.deepEqual(entradaDeConfiguracion(fila()), {
      id: 'r-1',
      titulo: 'Ventas',
      descripcion: 'Por producto',
      visualizacion: 'barras',
      periodo: { dias: [30, 7], predeterminado: 30 },
    });
    assert.equal(entradaDeConfiguracion(fila({ periodo: null })).periodo, null);
  });

  test('no technical key and no assigned column name reaches the entry', () => {
    const texto = JSON.stringify(entradaDeConfiguracion(fila()));
    for (const prohibido of ['nombre', 'sql', 'entidades', 'columnas', 'conexionId', 'producto_col', 'unidades_col', 'v_pedido', 'interno', 'parametro']) {
      assert.ok(!texto.includes(prohibido), `${prohibido} in ${texto}`);
    }
  });

  test('a corrupt row is still listed, with a null period and a safe visualization', () => {
    assert.deepEqual(entradaDeConfiguracion(fila({ columnas: [] })), {
      id: 'r-1',
      titulo: 'Ventas',
      descripcion: 'Por producto',
      visualizacion: 'barras',
      periodo: null,
    });
    assert.equal(entradaDeConfiguracion(fila({ visualizacion: 'torta' })).visualizacion, 'tabla');
  });
});

const REPORTE_BARRAS: ReporteLeido = {
  id: 'r-1',
  nombre: 'interno',
  titulo: 'Ventas',
  descripcion: null,
  sql: 'SELECT 1',
  entidades: ['pedido'],
  visualizacion: 'barras',
  columnas: [
    { rol: 'etiqueta', columna: 'producto', titulo: 'Producto' },
    { rol: 'valor', columna: 'unidades', titulo: 'Unidades' },
  ],
  periodo: { parametro: 'desde', dias: [30, 7] },
};

const PERIODO = { dias: 30, desde: '2026-10-11' };

function ok(columnas: string[], filas: unknown[][], corte: 'tope-de-filas' | null = null): RespuestaSobreVistas {
  return {
    codigo: 200,
    cuerpo: {
      resultado: 'ok',
      fase: 'ejecucion',
      columnas,
      filas,
      corte,
      paginacion: { limite: 20, desplazamiento: 0, hayMas: false, siguienteDesplazamiento: null, topeFilas: 20 },
      duracionMs: 3,
    },
  };
}

function fallo(fase: 'conexion' | 'permisos' | 'ejecucion', categoria: string): RespuestaSobreVistas {
  return {
    codigo: 200,
    cuerpo: { resultado: 'fallo', fase, categoria, codigo: '57014', duracionMs: 3 } as never,
  };
}

describe('CH-48 respuestaDeEjecucion — closed states and the projection (rule 5)', () => {
  test('every refusal of the engine path is no-disponible, with nothing else', () => {
    for (const codigo of [400, 404, 409] as const) {
      const respuesta = respuestaDeEjecucion(
        REPORTE_BARRAS,
        { codigo, cuerpo: { error: 'vista-canonica-no-aprobada', entidades: [{ entidad: 'pedido' }] } },
        PERIODO,
      );
      assert.deepEqual(respuesta, { estado: 'no-disponible' });
    }
  });

  test('failures: tiempo-agotado in any phase, sin-conexion in the connection phase, else error', () => {
    assert.deepEqual(respuestaDeEjecucion(REPORTE_BARRAS, fallo('ejecucion', 'tiempo-agotado'), PERIODO), { estado: 'tiempo-agotado' });
    assert.deepEqual(respuestaDeEjecucion(REPORTE_BARRAS, fallo('conexion', 'tiempo-agotado'), PERIODO), { estado: 'tiempo-agotado' });
    assert.deepEqual(respuestaDeEjecucion(REPORTE_BARRAS, fallo('conexion', 'host-inalcanzable'), PERIODO), { estado: 'sin-conexion' });
    assert.deepEqual(respuestaDeEjecucion(REPORTE_BARRAS, fallo('permisos', 'rol-superusuario'), PERIODO), { estado: 'error' });
    assert.deepEqual(respuestaDeEjecucion(REPORTE_BARRAS, fallo('ejecucion', 'error-sintaxis'), PERIODO), { estado: 'error' });
  });

  test('a missing assigned column is no-disponible, and the answer does not name it', () => {
    const respuesta = respuestaDeEjecucion(REPORTE_BARRAS, ok(['producto', 'total'], [['a', 1]]), PERIODO);
    assert.deepEqual(respuesta, { estado: 'no-disponible' });
    assert.ok(!JSON.stringify(respuesta).includes('unidades'));
  });

  test('zero rows with every column present is sin-datos', () => {
    assert.deepEqual(respuestaDeEjecucion(REPORTE_BARRAS, ok(['producto', 'unidades'], []), PERIODO), { estado: 'sin-datos' });
  });

  test('ok projects to the assigned columns in assignment order; an email column never leaves', () => {
    const respuesta = respuestaDeEjecucion(
      REPORTE_BARRAS,
      ok(['email', 'unidades', 'producto'], [
        ['ana@correo.test', 5, 'Mate'],
        ['beto@correo.test', 3, 'Yerba'],
      ]),
      PERIODO,
    );
    assert.deepEqual(respuesta, {
      estado: 'ok',
      columnas: [
        { rol: 'etiqueta', titulo: 'Producto' },
        { rol: 'valor', titulo: 'Unidades' },
      ],
      filas: [
        ['Mate', 5],
        ['Yerba', 3],
      ],
      corte: false,
      periodo: PERIODO,
    });
    const texto = JSON.stringify(respuesta);
    assert.ok(!texto.includes('@correo.test') && !texto.includes('email') && !texto.includes('"producto"'));
  });

  test('a numeric string value becomes a number; a non-numeric value is no-disponible', () => {
    const numero: ReporteLeido = {
      ...REPORTE_BARRAS,
      visualizacion: 'numero',
      columnas: [{ rol: 'valor', columna: 'total', titulo: 'Ventas del mes' }],
      periodo: null,
    };
    const respuesta = respuestaDeEjecucion(numero, ok(['total'], [['1520.50']]), null);
    assert.equal(respuesta.estado, 'ok');
    assert.deepEqual(respuesta.estado === 'ok' ? respuesta.filas : null, [[1520.5]]);
    const linea: ReporteLeido = { ...REPORTE_BARRAS, visualizacion: 'linea' };
    assert.deepEqual(respuestaDeEjecucion(linea, ok(['producto', 'unidades'], [['a', 1], ['b', 'n/a']]), PERIODO), { estado: 'no-disponible' });
    assert.deepEqual(respuestaDeEjecucion(linea, ok(['producto', 'unidades'], [['a', null]]), PERIODO), { estado: 'no-disponible' });
  });

  test('a table keeps strings, numbers, booleans and nulls as returned', () => {
    const tabla: ReporteLeido = {
      ...REPORTE_BARRAS,
      visualizacion: 'tabla',
      columnas: [
        { rol: 'columna', columna: 'a', titulo: 'A' },
        { rol: 'columna', columna: 'b', titulo: 'B' },
        { rol: 'columna', columna: 'c', titulo: 'C' },
        { rol: 'columna', columna: 'd', titulo: 'D' },
      ],
    };
    const respuesta = respuestaDeEjecucion(tabla, ok(['a', 'b', 'c', 'd'], [['n/a', 2, true, null]]), PERIODO);
    assert.deepEqual(respuesta.estado === 'ok' ? respuesta.filas : null, [['n/a', 2, true, null]]);
  });

  test('a date label at midnight UTC is YYYY-MM-DD', () => {
    const linea: ReporteLeido = { ...REPORTE_BARRAS, visualizacion: 'linea' };
    const respuesta = respuestaDeEjecucion(linea, ok(['producto', 'unidades'], [[new Date('2026-11-03T00:00:00.000Z'), '4']]), PERIODO);
    assert.deepEqual(respuesta.estado === 'ok' ? respuesta.filas : null, [['2026-11-03', 4]]);
  });

  test('corte is true when the engine cut at the cap', () => {
    const respuesta = respuestaDeEjecucion(REPORTE_BARRAS, ok(['producto', 'unidades'], [['a', 1]], 'tope-de-filas'), PERIODO);
    assert.equal(respuesta.estado === 'ok' ? respuesta.corte : null, true);
  });
});

describe('CH-48 normalizarValor and aNumero', () => {
  test('dates, bigints, scalars and other values', () => {
    assert.equal(normalizarValor(new Date('2026-11-03T00:00:00.000Z')), '2026-11-03');
    assert.equal(normalizarValor(new Date('2026-11-03T10:15:00.000Z')), '2026-11-03T10:15:00.000Z');
    assert.equal(normalizarValor(12n), '12');
    assert.equal(normalizarValor('<b>x</b>'), '<b>x</b>');
    assert.equal(normalizarValor(1.5), 1.5);
    assert.equal(normalizarValor(false), false);
    assert.equal(normalizarValor(null), null);
    assert.equal(normalizarValor({ a: 1 }), '[object Object]');
  });

  test('aNumero accepts finite numbers and decimal strings only', () => {
    assert.equal(aNumero(3), 3);
    assert.equal(aNumero('-12.25'), -12.25);
    assert.equal(aNumero('10'), 10);
    for (const valor of ['1e3', '1.', '.5', ' 1', 'n/a', '', Number.NaN, Number.POSITIVE_INFINITY, null, true, 5n]) {
      assert.equal(aNumero(valor), null, String(valor));
    }
  });
});

/** A task whose end the test controls, counting how many times it started. */
function controlada<T>(valor: T) {
  let terminar!: () => void;
  let fallar!: (error: Error) => void;
  let llamadas = 0;
  const hecha = new Promise<void>((res, rej) => {
    terminar = res;
    fallar = rej;
  });
  return {
    tarea: async () => {
      llamadas++;
      await hecha;
      return valor;
    },
    terminar: () => terminar(),
    fallar: (error: Error) => fallar(error),
    llamadas: () => llamadas,
  };
}

const abierto = () => true;
const vuelta = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('CH-48 crearCompuerta — per-tenant gate and single-flight (DEC-201)', () => {
  test('the limits are 3 in flight and 8 queued', () => {
    assert.deepEqual([EN_CURSO_POR_TENANT, EN_COLA_POR_TENANT], [3, 8]);
  });

  test('a fourth run of a tenant waits until one of the three ends; another tenant does not wait', async () => {
    const compuerta = crearCompuerta();
    const tareas = [0, 1, 2, 3].map((i) => controlada(`a${i}`));
    const pedidos = tareas.map((t, i) => compuerta.pedir('A', `A|r-${i}|30`, abierto, t.tarea));
    await vuelta();
    assert.deepEqual(tareas.map((t) => t.llamadas()), [1, 1, 1, 0]);
    const deB = controlada('b');
    const pedidoB = compuerta.pedir('B', 'B|r-0|30', abierto, deB.tarea);
    await vuelta();
    assert.equal(deB.llamadas(), 1, "B is not delayed by A's three runs");
    tareas[1].terminar();
    await vuelta();
    assert.equal(tareas[3].llamadas(), 1, 'the fourth starts once a slot frees');
    tareas.forEach((t) => t.terminar());
    deB.terminar();
    assert.deepEqual(await Promise.all([...pedidos, pedidoB]), ['a0', 'a1', 'a2', 'a3', 'b']);
  });

  test('beyond three in flight and eight queued, a distinct run is lleno and never runs', async () => {
    const compuerta = crearCompuerta();
    const tareas = Array.from({ length: 11 }, (_, i) => controlada(i));
    const pedidos = tareas.map((t, i) => compuerta.pedir('A', `A|r-${i}|30`, abierto, t.tarea));
    assert.ok(pedidos.every((p) => p !== 'lleno'));
    const sobrante = controlada('x');
    assert.equal(compuerta.pedir('A', 'A|r-extra|30', abierto, sobrante.tarea), 'lleno');
    tareas.forEach((t) => t.terminar());
    await Promise.all(pedidos);
    assert.equal(sobrante.llamadas(), 0);
  });

  test('identical requests share one run and one answer, and take no extra place', async () => {
    const compuerta = crearCompuerta({ enCurso: 1, enCola: 0 });
    const tarea = controlada({ estado: 'ok' });
    const primero = compuerta.pedir('A', 'A|r-1|30', abierto, tarea.tarea);
    const segundo = compuerta.pedir('A', 'A|r-1|30', abierto, tarea.tarea);
    assert.notEqual(segundo, 'lleno', 'joining takes no place');
    tarea.terminar();
    const [a, b] = await Promise.all([primero, segundo]);
    assert.equal(tarea.llamadas(), 1);
    assert.equal(a, b);
  });

  test('nothing is kept after a run: the same request afterwards runs again', async () => {
    const compuerta = crearCompuerta();
    let llamadas = 0;
    const tarea = async () => ++llamadas;
    assert.equal(await compuerta.pedir('A', 'A|r-1|30', abierto, tarea), 1);
    assert.equal(await compuerta.pedir('A', 'A|r-1|30', abierto, tarea), 2);
  });

  test('a queued run whose every request closed is dropped and never runs', async () => {
    const compuerta = crearCompuerta({ enCurso: 1, enCola: 8 });
    const primera = controlada('primera');
    const enCurso = compuerta.pedir('A', 'A|r-1|30', abierto, primera.tarea);
    let abiertoUno = true;
    let abiertoDos = true;
    const cerrada = controlada('cerrada');
    const descartada = compuerta.pedir('A', 'A|r-2|30', () => abiertoUno, cerrada.tarea);
    compuerta.pedir('A', 'A|r-2|30', () => abiertoDos, cerrada.tarea);
    const siguiente = controlada('siguiente');
    const despues = compuerta.pedir('A', 'A|r-3|30', abierto, siguiente.tarea);
    abiertoUno = false;
    abiertoDos = false;
    primera.terminar();
    assert.equal(await descartada, DESCARTADO);
    assert.equal(cerrada.llamadas(), 0);
    await vuelta();
    assert.equal(siguiente.llamadas(), 1, 'the next one starts in its place');
    siguiente.terminar();
    assert.deepEqual(await Promise.all([enCurso, despues]), ['primera', 'siguiente']);
  });

  test('a run kept by one open request of two still runs', async () => {
    const compuerta = crearCompuerta({ enCurso: 1, enCola: 8 });
    const primera = controlada(1);
    compuerta.pedir('A', 'A|r-1|30', abierto, primera.tarea);
    const compartida = controlada(2);
    const uno = compuerta.pedir('A', 'A|r-2|30', () => false, compartida.tarea);
    compuerta.pedir('A', 'A|r-2|30', abierto, compartida.tarea);
    primera.terminar();
    await vuelta();
    compartida.terminar();
    assert.equal(await uno, 2);
    assert.equal(compartida.llamadas(), 1);
  });

  test('a run that throws frees its slot, rejects its waiters and the next queued run starts', async () => {
    const compuerta = crearCompuerta({ enCurso: 1, enCola: 8 });
    const falla = controlada('nunca');
    const pedido = compuerta.pedir('A', 'A|r-1|30', abierto, falla.tarea);
    const siguiente = controlada('siguiente');
    const despues = compuerta.pedir('A', 'A|r-2|30', abierto, siguiente.tarea);
    falla.fallar(new Error('motor caído'));
    await assert.rejects(pedido as Promise<unknown>, /motor caído/);
    await vuelta();
    assert.equal(siguiente.llamadas(), 1);
    siguiente.terminar();
    assert.equal(await despues, 'siguiente');
  });

  test('an idle tenant leaves no record and no shared entry', async () => {
    const compuerta = crearCompuerta();
    const tarea = controlada('x');
    const pedido = compuerta.pedir('A', 'A|r-1|30', abierto, tarea.tarea);
    assert.deepEqual(compuerta.ocupacion(), { tenants: 1, entradas: 1 });
    tarea.terminar();
    await pedido;
    await vuelta();
    assert.deepEqual(compuerta.ocupacion(), { tenants: 0, entradas: 0 });
    const falla = compuerta.pedir('B', 'B|r-1|30', abierto, async () => {
      throw new Error('x');
    });
    await assert.rejects(falla as Promise<unknown>, /x/);
    await vuelta();
    assert.deepEqual(compuerta.ocupacion(), { tenants: 0, entradas: 0 });
  });
});
