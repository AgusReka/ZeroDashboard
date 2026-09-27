import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import pg from 'pg';
import type { SondeoEntidad } from './consulta-ejecucion.js';
import { CONTRATO_CANONICO, type EntidadCanonica, type TipoSemantico } from './contrato.js';
import {
  aceptaTipo,
  diagnosticar,
  informe,
  tipoObservadoDe,
  type DiagnosticoValidacion,
  type FilaValidacion,
  type InformeAutomatizacion,
} from './validacion-mapeo.js';

/**
 * CH-10 tasks 3.1–3.9 (spec `mapping-validation`). Pure functions, no database: the
 * probe's output is a list of `{ nombre, oid }` pairs, so every verdict can be proven
 * here by handing `diagnosticar` the columns a view would have reported. The live half
 * — that the probe really reports those pairs — is `validacion-mapeo-rutas.test.ts`.
 */

const OID = pg.types.builtins;

function entidad(nombre: string): EntidadCanonica {
  const encontrada = CONTRATO_CANONICO.find((e) => e.nombre === nombre);
  assert.ok(encontrada !== undefined, `the catalog must define ${nombre}`);
  return encontrada;
}

/** The OID a correct view would report for each semantic type. */
const OID_CORRECTO: Record<TipoSemantico, number> = {
  identificador: OID.INT4,
  texto: OID.TEXT,
  numero: OID.NUMERIC,
  booleano: OID.BOOL,
  fecha: OID.TIMESTAMPTZ,
};

/** The columns a view mapping `nombre` exactly as the contract asks would report. */
function columnasCorrectas(nombre: string): { nombre: string; oid: number }[] {
  return entidad(nombre).campos.map((c) => ({ nombre: c.nombre, oid: OID_CORRECTO[c.tipo] }));
}

function sondeoOk(nombre: string, columnas: { nombre: string; oid: number }[]): SondeoEntidad {
  return { entidad: nombre, resultado: 'ok', columnas };
}

/** `columnasCorrectas` with one column replaced (or removed, when `oid` is null). */
function conColumna(
  nombreEntidad: string,
  nombreCampo: string,
  reemplazo: { nombre: string; oid: number } | null,
): { nombre: string; oid: number }[] {
  const columnas = columnasCorrectas(nombreEntidad).filter((c) => c.nombre !== nombreCampo);
  return reemplazo === null ? columnas : [...columnas, reemplazo];
}

function campoDe(diagnostico: DiagnosticoValidacion, nombre: string) {
  const encontrado = diagnostico.campos.find((c) => c.campo === nombre);
  assert.ok(encontrado !== undefined, `the diagnostic must carry a verdict for ${nombre}`);
  return encontrado;
}

// ---- 3.1 / 3.2 the tolerant OID → category table (DEC-39, DEC-45) ----------------

describe('validacion-mapeo — Postgres types classify into five tolerant categories', () => {
  test('3.1 identificador accepts int2/int4/int8, uuid, text, varchar and bpchar', () => {
    for (const oid of [OID.INT2, OID.INT4, OID.INT8, OID.UUID, OID.TEXT, OID.VARCHAR, OID.BPCHAR]) {
      assert.ok(aceptaTipo('identificador', oid), `identificador must accept OID ${oid}`);
    }
    assert.ok(!aceptaTipo('identificador', OID.NUMERIC), 'a numeric is not an identifier');
    assert.ok(!aceptaTipo('identificador', OID.BOOL));
  });

  test('3.1 numero accepts the integers, numeric, float4 and float8', () => {
    for (const oid of [OID.INT2, OID.INT4, OID.INT8, OID.NUMERIC, OID.FLOAT4, OID.FLOAT8]) {
      assert.ok(aceptaTipo('numero', oid), `numero must accept OID ${oid}`);
    }
    assert.ok(!aceptaTipo('numero', OID.TEXT), 'a text column is not a number');
    assert.ok(!aceptaTipo('numero', OID.UUID));
  });

  test('3.1 texto accepts text, varchar and bpchar only', () => {
    for (const oid of [OID.TEXT, OID.VARCHAR, OID.BPCHAR]) {
      assert.ok(aceptaTipo('texto', oid), `texto must accept OID ${oid}`);
    }
    for (const oid of [OID.INT4, OID.UUID, OID.BOOL, OID.DATE]) {
      assert.ok(!aceptaTipo('texto', oid), `texto must reject OID ${oid}`);
    }
  });

  test('3.1 booleano accepts bool; fecha accepts date, timestamp and timestamptz', () => {
    assert.ok(aceptaTipo('booleano', OID.BOOL));
    assert.ok(!aceptaTipo('booleano', OID.INT2), 'a 0/1 smallint is not a boolean');
    for (const oid of [OID.DATE, OID.TIMESTAMP, OID.TIMESTAMPTZ]) {
      assert.ok(aceptaTipo('fecha', oid), `fecha must accept OID ${oid}`);
    }
    assert.ok(!aceptaTipo('fecha', OID.TEXT), 'a date stored as text is not a fecha');
  });

  test('3.1 the observed category of a known OID is its own meaning, never identificador for int/text', () => {
    assert.equal(tipoObservadoDe(OID.TEXT), 'texto');
    assert.equal(tipoObservadoDe(OID.INT8), 'numero');
    assert.equal(tipoObservadoDe(OID.UUID), 'identificador');
    assert.equal(tipoObservadoDe(OID.BOOL), 'booleano');
    assert.equal(tipoObservadoDe(OID.TIMESTAMP), 'fecha');
  });

  test('3.1 a uuid producto.id is accepted as identificador (spec scenario)', () => {
    const columnas = conColumna('producto', 'id', { nombre: 'id', oid: OID.UUID });
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));
    assert.equal(estado, 'valida');
    assert.equal(campoDe(diagnostico, 'id').veredicto, 'ok');
  });

  test('3.2 an OID outside the table fails as a category mismatch naming a cast hint', () => {
    // json, money, an int4 array, and an enum's dynamic OID: none has an entry.
    for (const oid of [OID.JSON, OID.MONEY, 1007, 16385]) {
      assert.equal(tipoObservadoDe(oid), null, `OID ${oid} must have no category`);
      for (const tipo of ['texto', 'numero', 'booleano', 'fecha', 'identificador'] as const) {
        assert.ok(!aceptaTipo(tipo, oid), `${tipo} must not accept OID ${oid}`);
      }
    }

    const columnas = conColumna('pedido', 'estado', { nombre: 'estado', oid: 16385 });
    const { estado, diagnostico } = diagnosticar(entidad('pedido'), sondeoOk('pedido', columnas));
    const campo = campoDe(diagnostico, 'estado');

    assert.equal(estado, 'invalida');
    assert.equal(campo.veredicto, 'tipo-incorrecto');
    assert.equal(campo.oid, 16385, 'the diagnostic must carry the OID it could not classify');
    assert.equal(campo.tipoObservado, null);
    assert.equal(campo.tipoPostgres, null, 'an enum OID has no builtin name');
    assert.deepEqual(campo.pista, { accion: 'castear-en-la-vista', sugerencia: '::text' });
  });

  test('3.2 the cast hint follows the expected type, and a known OID gets none', () => {
    const conMoney = conColumna('pedido', 'total', { nombre: 'total', oid: OID.MONEY });
    const total = campoDe(
      diagnosticar(entidad('pedido'), sondeoOk('pedido', conMoney)).diagnostico,
      'total',
    );
    assert.deepEqual(total.pista, { accion: 'castear-en-la-vista', sugerencia: '::numeric' });
    assert.equal(total.tipoPostgres, 'money');

    // A known but wrong category is a mapping mistake, not a type the table lacks.
    const conTexto = conColumna('pedido', 'total', { nombre: 'total', oid: OID.TEXT });
    const otro = campoDe(
      diagnosticar(entidad('pedido'), sondeoOk('pedido', conTexto)).diagnostico,
      'total',
    );
    assert.equal(otro.pista, null);
  });
});

// ---- 3.3 – 3.5 per-field verdicts and extra columns ------------------------------

describe('validacion-mapeo — per-field verdicts', () => {
  test('3.3 a view mapping every field exactly is valida, with ok on every field in contract order', () => {
    for (const e of CONTRATO_CANONICO) {
      const { estado, diagnostico } = diagnosticar(e, sondeoOk(e.nombre, columnasCorrectas(e.nombre)));
      assert.equal(estado, 'valida', e.nombre);
      assert.equal(diagnostico.version, 1);
      assert.deepEqual(diagnostico.sondeo, { resultado: 'ok' });
      assert.deepEqual(
        diagnostico.campos.map((c) => [c.campo, c.veredicto]),
        e.campos.map((c) => [c.nombre, 'ok']),
      );
      assert.deepEqual(diagnostico.columnasSobrantes, []);
    }
  });

  test('3.3 a missing required column fails and is named ausente (spec: activo absent)', () => {
    const columnas = conColumna('producto', 'activo', null);
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));
    const activo = campoDe(diagnostico, 'activo');

    assert.equal(estado, 'invalida');
    assert.equal(activo.veredicto, 'ausente');
    assert.equal(activo.columna, null);
    assert.equal(activo.oid, null);
  });

  test('3.3 a missing optional column is ausente but does not fail the entity', () => {
    const columnas = conColumna('producto', 'sku', null);
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));
    assert.equal(estado, 'valida');
    assert.equal(campoDe(diagnostico, 'sku').veredicto, 'ausente');
  });

  test('3.3 a wrong-category column fails naming expected and observed (spec: stockDisponible as text)', () => {
    const columnas = conColumna('producto', 'stockDisponible', {
      nombre: 'stockDisponible',
      oid: OID.TEXT,
    });
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));
    const stock = campoDe(diagnostico, 'stockDisponible');

    assert.equal(estado, 'invalida');
    assert.equal(stock.veredicto, 'tipo-incorrecto');
    assert.equal(stock.tipoEsperado, 'numero');
    assert.equal(stock.tipoObservado, 'texto');
    assert.equal(stock.tipoPostgres, 'text');
    assert.equal(stock.columna, 'stockDisponible');
  });

  test('3.3 tipo-incorrecto fails even on an optional field', () => {
    const columnas = conColumna('producto', 'sku', { nombre: 'sku', oid: OID.BOOL });
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));
    assert.equal(estado, 'invalida');
    assert.equal(campoDe(diagnostico, 'sku').veredicto, 'tipo-incorrecto');
  });

  test('3.4 an unquoted mixed-case alias is diagnosed as alias-sin-comillas, not ausente nor extra', () => {
    const columnas = conColumna('producto', 'stockDisponible', {
      nombre: 'stockdisponible',
      oid: OID.NUMERIC,
    });
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));
    const stock = campoDe(diagnostico, 'stockDisponible');

    assert.equal(estado, 'invalida');
    assert.equal(stock.veredicto, 'alias-sin-comillas');
    assert.equal(stock.columna, 'stockdisponible', 'the folded column must be named');
    assert.deepEqual(diagnostico.columnasSobrantes, [], 'the folded column is attributed, not extra');
  });

  test('3.5 a contract column reported twice is duplicada and fails', () => {
    const columnas = [...columnasCorrectas('producto'), { nombre: 'nombre', oid: OID.TEXT }];
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));
    assert.equal(estado, 'invalida');
    assert.equal(campoDe(diagnostico, 'nombre').veredicto, 'duplicada');
    assert.deepEqual(diagnostico.columnasSobrantes, []);
  });

  test('3.5 a column outside the contract fails the entity and is named (spec: notasInternas)', () => {
    const columnas = [...columnasCorrectas('producto'), { nombre: 'notasInternas', oid: OID.TEXT }];
    const { estado, diagnostico } = diagnosticar(entidad('producto'), sondeoOk('producto', columnas));

    assert.equal(estado, 'invalida', 'DEC-43: an extra column fails the entity');
    assert.ok(diagnostico.campos.every((c) => c.veredicto === 'ok'), 'every contract field is fine');
    assert.deepEqual(diagnostico.columnasSobrantes, [{ columna: 'notasInternas', oid: OID.TEXT }]);
  });

  test('3.5 a failed probe is invalida, carries its classification and evaluates no field', () => {
    const { estado, diagnostico } = diagnosticar(entidad('insumo'), {
      entidad: 'insumo',
      resultado: 'fallo',
      categoria: 'error-sintaxis',
      codigo: '42P01',
    });
    assert.equal(estado, 'invalida');
    assert.deepEqual(diagnostico.sondeo, {
      resultado: 'fallo',
      categoria: 'error-sintaxis',
      codigo: '42P01',
    });
    assert.deepEqual(diagnostico.campos, []);
    assert.deepEqual(diagnostico.columnasSobrantes, []);
  });
});

// ---- 3.6 – 3.9 the applicability report (DEC-22, DEC-46) --------------------------

/** A persisted row for `nombre`, built by running the real diagnosis over `columnas`. */
function fila(nombre: string, columnas = columnasCorrectas(nombre)): FilaValidacion {
  const { estado, diagnostico } = diagnosticar(entidad(nombre), sondeoOk(nombre, columnas));
  return {
    entidad: nombre,
    estadoValidacion: estado,
    // Round-tripped through JSON, as it will be once stored in a JSONB column.
    diagnosticoValidacion: JSON.parse(JSON.stringify(diagnostico)),
    validadaEn: new Date('2026-09-26T12:00:00Z'),
  };
}

function filaNoValidada(nombre: string): FilaValidacion {
  return { entidad: nombre, estadoValidacion: 'no-validado', diagnosticoValidacion: null, validadaEn: null };
}

function automatizacion(filas: FilaValidacion[], nombre: string): InformeAutomatizacion {
  const encontrada = informe(filas).automatizaciones.find((a) => a.automatizacion === nombre);
  assert.ok(encontrada !== undefined, `the report must list ${nombre}`);
  return encontrada;
}

const TODAS_VALIDAS = (): FilaValidacion[] => CONTRATO_CANONICO.map((e) => fila(e.nombre));

describe('validacion-mapeo — the applicability report', () => {
  test('every entity valid: the report lists five entities and three aplicable automations', () => {
    const resultado = informe(TODAS_VALIDAS());
    assert.deepEqual(
      resultado.entidades.map((e) => [e.entidad, e.obligatoriedad, e.estado]),
      CONTRATO_CANONICO.map((e) => [e.nombre, e.obligatoriedad, 'valida']),
    );
    assert.deepEqual(
      resultado.automatizaciones.map((a) => [a.automatizacion, a.estado, a.motivos]),
      [
        ['stock-fisico', 'aplicable', []],
        ['stock-producible', 'aplicable', []],
        ['reporte-diario', 'aplicable', []],
      ],
    );
  });

  test('3.6 unmapped optional insumo: stock-producible inaplicable, "entity not mapped", never bloqueada', () => {
    const filas = TODAS_VALIDAS().filter((f) => f.entidad !== 'insumo');
    const resultado = informe(filas);
    const producible = automatizacion(filas, 'stock-producible');

    assert.equal(producible.estado, 'inaplicable');
    assert.deepEqual(producible.motivos, [
      { entidad: 'insumo', campo: null, motivo: 'entidad-no-mapeada' },
    ]);
    const insumo = resultado.entidades.find((e) => e.entidad === 'insumo');
    assert.deepEqual(
      { estado: insumo?.estado, validadaEn: insumo?.validadaEn, diagnostico: insumo?.diagnostico },
      { estado: 'no-mapeada', validadaEn: null, diagnostico: null },
    );
    // The other two automations do not depend on insumo at all.
    assert.equal(automatizacion(filas, 'stock-fisico').estado, 'aplicable');
    assert.equal(automatizacion(filas, 'reporte-diario').estado, 'aplicable');
  });

  test('3.7 unmapped required producto blocks all three automations, naming the entity', () => {
    const filas = TODAS_VALIDAS().filter((f) => f.entidad !== 'producto');
    for (const nombre of ['stock-fisico', 'stock-producible', 'reporte-diario']) {
      const a = automatizacion(filas, nombre);
      assert.equal(a.estado, 'bloqueada', nombre);
      assert.deepEqual(a.motivos, [
        { entidad: 'producto', campo: null, motivo: 'entidad-no-mapeada' },
      ]);
    }
  });

  test('3.7 producto failing on activo blocks exactly the automations naming producto.activo', () => {
    const filas = TODAS_VALIDAS().map((f) =>
      f.entidad === 'producto' ? fila('producto', conColumna('producto', 'activo', null)) : f,
    );
    for (const nombre of ['stock-fisico', 'stock-producible']) {
      const a = automatizacion(filas, nombre);
      assert.equal(a.estado, 'bloqueada', nombre);
      assert.deepEqual(a.motivos, [{ entidad: 'producto', campo: 'activo', motivo: 'ausente' }]);
    }
    // producto.activo does not name reporte-diario, so that automation is untouched.
    assert.equal(automatizacion(filas, 'reporte-diario').estado, 'aplicable');
  });

  test('3.7 a wrong-typed sku blocks stock-fisico and reporte-diario only', () => {
    const filas = TODAS_VALIDAS().map((f) =>
      f.entidad === 'producto'
        ? fila('producto', conColumna('producto', 'sku', { nombre: 'sku', oid: OID.BOOL }))
        : f,
    );
    assert.equal(automatizacion(filas, 'stock-fisico').estado, 'bloqueada');
    assert.equal(automatizacion(filas, 'reporte-diario').estado, 'bloqueada');
    assert.equal(automatizacion(filas, 'stock-producible').estado, 'aplicable');
    assert.deepEqual(automatizacion(filas, 'reporte-diario').motivos, [
      { entidad: 'producto', campo: 'sku', motivo: 'tipo-incorrecto' },
    ]);
  });

  test('3.7 a failed probe or an extra column blocks every dependent automation', () => {
    const conSobrante = TODAS_VALIDAS().map((f) =>
      f.entidad === 'pedido'
        ? fila('pedido', [...columnasCorrectas('pedido'), { nombre: 'correo', oid: OID.TEXT }])
        : f,
    );
    assert.deepEqual(automatizacion(conSobrante, 'reporte-diario'), {
      automatizacion: 'reporte-diario',
      estado: 'bloqueada',
      motivos: [{ entidad: 'pedido', campo: null, motivo: 'columnas-sobrantes' }],
    });

    const sondeoFallido = diagnosticar(entidad('pedido'), {
      entidad: 'pedido',
      resultado: 'fallo',
      categoria: 'no-es-lectura',
      codigo: '0A000',
    });
    const conFallo = TODAS_VALIDAS().map((f) =>
      f.entidad === 'pedido'
        ? {
            ...f,
            estadoValidacion: sondeoFallido.estado,
            diagnosticoValidacion: JSON.parse(JSON.stringify(sondeoFallido.diagnostico)),
          }
        : f,
    );
    assert.deepEqual(automatizacion(conFallo, 'reporte-diario').motivos, [
      { entidad: 'pedido', campo: null, motivo: 'sondeo-fallido' },
    ]);
  });

  test('3.8 a mapped entity still no-validado makes its automations pendiente', () => {
    const filas = TODAS_VALIDAS().map((f) => (f.entidad === 'pedido' ? filaNoValidada('pedido') : f));
    const reporte = automatizacion(filas, 'reporte-diario');
    assert.equal(reporte.estado, 'pendiente');
    assert.deepEqual(reporte.motivos, [{ entidad: 'pedido', campo: null, motivo: 'no-validada' }]);
    assert.equal(
      informe(filas).entidades.find((e) => e.entidad === 'pedido')?.estado,
      'no-validado',
    );
  });

  test('3.8 bloqueada outranks pendiente', () => {
    const filas = TODAS_VALIDAS()
      .filter((f) => f.entidad !== 'pedido')
      .map((f) => (f.entidad === 'item_pedido' ? filaNoValidada('item_pedido') : f));
    const reporte = automatizacion(filas, 'reporte-diario');
    assert.equal(reporte.estado, 'bloqueada');
    assert.deepEqual(reporte.motivos, [
      { entidad: 'pedido', campo: null, motivo: 'entidad-no-mapeada' },
      { entidad: 'item_pedido', campo: null, motivo: 'no-validada' },
    ]);
  });

  test('3.9 inaplicable and bloqueada at once reports inaplicable, listing every reason (DEC-46)', () => {
    const filas = TODAS_VALIDAS()
      .filter((f) => f.entidad !== 'insumo')
      .map((f) =>
        f.entidad === 'producto' ? fila('producto', conColumna('producto', 'activo', null)) : f,
      );
    const producible = automatizacion(filas, 'stock-producible');

    assert.equal(producible.estado, 'inaplicable');
    assert.deepEqual(producible.motivos, [
      { entidad: 'producto', campo: 'activo', motivo: 'ausente' },
      { entidad: 'insumo', campo: null, motivo: 'entidad-no-mapeada' },
    ]);
  });

  test('an empty mapping reports every entity no-mapeada and never throws', () => {
    const resultado = informe([]);
    assert.ok(resultado.entidades.every((e) => e.estado === 'no-mapeada'));
    assert.equal(resultado.automatizaciones.length, 3);
    // stock-producible depends on producto (required, unmapped) and on the two optional
    // entities (unmapped): inaplicable wins, every reason listed.
    assert.equal(automatizacion([], 'stock-producible').estado, 'inaplicable');
    assert.equal(automatizacion([], 'stock-fisico').estado, 'bloqueada');
  });

  test('an unreadable persisted diagnostic on an invalida row blocks, it never passes', () => {
    const filas = TODAS_VALIDAS().map((f) =>
      f.entidad === 'pedido' ? { ...f, estadoValidacion: 'invalida', diagnosticoValidacion: { x: 1 } } : f,
    );
    assert.deepEqual(automatizacion(filas, 'reporte-diario').motivos, [
      { entidad: 'pedido', campo: null, motivo: 'diagnostico-ilegible' },
    ]);
    assert.equal(
      informe(filas).entidades.find((e) => e.entidad === 'pedido')?.diagnostico,
      null,
    );
  });
});
