import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { NOMBRE_COOKIE_CONSOLA, registrarGuardOperador } from '../consola/consola-auth.js';
import {
  alcanzable,
  borrarOperadores,
  crearOperador,
  crearSesion,
  databaseUrl,
  motivoSkip,
  nombreUnico,
  objetivo,
} from '../consola/consola-auth-apoyo.js';
import { cifrarCredencial } from '../compartido/cripto-credencial.js';
import { registerReportePruebaRoutes } from './reporte-prueba.js';
import { fechaDelPeriodo } from './reportes.js';

// `loadConfig()` runs on every execution and `destinoDeConexion` needs a master key (DEC-17).
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-45 (DEC-183, DEC-198) task 6.3: `POST /reportes/:id/prueba` and `POST /reportes/prueba`.
 * Every refusal answers before anything is dialed and writes no audit row; a completed attempt
 * is the usual verdict plus `periodo` and `faltantes`, capped by the visualization.
 */

const ZONA = 'America/Argentina/Buenos_Aires';

/** An unsaved report body that passes every check; each case overrides one field. */
const REPORTE_VALIDO = {
  nombre: 'CH-45 sin guardar',
  titulo: 'Productos',
  sql: 'SELECT id, nombre FROM v_producto ORDER BY id',
  entidades: ['producto'],
  visualizacion: 'tabla',
  periodo: null,
};

/** A client on which every model method throws, except the tenant lookup the hooks make. */
function clienteSoloTenant(tenant: { id: string; nombre: string; activo: boolean }): PrismaAislado {
  const modeloQueLanza = (modelo: string) =>
    new Proxy({}, {
      get: (_objetivo, metodo) => async () => {
        throw new Error(`la prueba de reporte leyó ${modelo}.${String(metodo)} antes de tiempo`);
      },
    });
  return new Proxy({}, {
    get: (_objetivo, modelo) =>
      modelo === 'tenant' ? { findUnique: async () => tenant } : modeloQueLanza(String(modelo)),
  }) as PrismaAislado;
}

describe('CH-45 report test routes — tenant header and body shape, no database', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    const cliente = clienteSoloTenant({ id: 't-activo', nombre: 'Activo', activo: true });
    registrarContextoTenant(app, cliente);
    registerReportePruebaRoutes(app, cliente, ZONA, 200);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('both routes exist and, with no x-tenant-id, answer 400 tenant-no-indicado', async () => {
    assert.equal(app.hasRoute({ method: 'POST', url: '/reportes/prueba' }), true);
    assert.equal(app.hasRoute({ method: 'POST', url: '/reportes/:id/prueba' }), true);
    for (const [url, payload] of [
      ['/reportes/r-1/prueba', { conexionId: 'c' }],
      ['/reportes/prueba', { ...REPORTE_VALIDO, conexionId: 'c' }],
    ] as const) {
      const respuesta = await app.inject({ method: 'POST', url, payload });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    }
  });

  test('the stored test takes only conexionId and dias: the period is the only input', async () => {
    const casos: [Record<string, unknown>, string[]][] = [
      [{}, ['/conexionId']],
      [{ conexionId: '' }, ['/conexionId']],
      [{ conexionId: 'c', dias: 'siete' }, ['/dias']],
      [{ conexionId: 'c', desde: '2026-01-01' }, ['/desde']],
      [{ conexionId: 'c', valores: { desde: '2026-01-01' } }, ['/valores']],
      [{ conexionId: 'c', limite: 500 }, ['/limite']],
      [{ conexionId: 'c', tenantId: 'otro' }, ['/tenantId']],
    ];
    for (const [payload, campos] of casos) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/reportes/r-1/prueba',
        headers: { 'x-tenant-id': 't-activo' },
        payload,
      });
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(payload)}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos });
    }
  });

  test('the unsaved test applies every report check except the columns, before any read', async () => {
    const casos: [Record<string, unknown>, string[]][] = [
      [{ visualizacion: 'torta' }, ['/visualizacion']],
      [{ titulo: 'Filas de la consulta' }, ['/titulo']],
      [{ periodo: { parametro: 'desde', dias: [7, 7] } }, ['/periodo/dias']],
      [{ sql: 'SELECT :hasta AS x FROM v_producto' }, ['/sql']],
      [{ columnas: [{ rol: 'valor', columna: 'id', titulo: 'Id' }] }, ['/columnas']],
      [{ valores: {} }, ['/valores']],
      [{ limite: 10 }, ['/limite']],
      [{ tenantId: 'otro' }, ['/tenantId']],
      [{ conexionId: '' }, ['/conexionId']],
    ];
    for (const [cambios, campos] of casos) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/reportes/prueba',
        headers: { 'x-tenant-id': 't-activo' },
        payload: { ...REPORTE_VALIDO, conexionId: 'c', ...cambios },
      });
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(cambios)}: ${respuesta.body}`);
      assert.deepEqual((respuesta.json() as { campos: string[] }).campos, campos, JSON.stringify(cambios));
    }
  });

  test('the unsaved test refuses dias on a report with no period, before any read', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/reportes/prueba',
      headers: { 'x-tenant-id': 't-activo' },
      payload: { ...REPORTE_VALIDO, conexionId: 'c', dias: 7 },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: ['/dias'] });
  });
});

/** A plain login role: no table grant, no schema CREATE, no superuser, so DEC-08 lets it read. */
const ROL_LECTOR = 'ch45_lector';
const CLAVE_LECTOR = 'ch45-clave-lector';

const SQL_LIMPIEZA = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL_LECTOR}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL_LECTOR}');
    EXECUTE format('DROP ROLE %I', '${ROL_LECTOR}');
  END IF;
END
$limpieza$;`;

interface Veredicto {
  resultado: 'ok' | 'fallo';
  columnas?: string[];
  filas?: unknown[][];
  corte?: string | null;
  categoria?: string;
  periodo: { dias: number; desde: string } | null;
  faltantes?: string[];
}

describe('CH-45 report test routes — two tenants on a live PostgreSQL (DEC-198)', { skip: alcanzable ? false : motivoSkip }, () => {
  let db!: PrismaClient;
  let aislado!: PrismaAislado;
  let admin!: pg.Client;
  let app!: FastifyInstance;
  let appTreinta!: FastifyInstance;
  const marca = `CH-45 prueba ${Date.now()}`;
  const operador = nombreUnico('op-ch45');
  let cookie = '';
  let tenantA = '';
  let tenantB = '';
  let conexionA = '';
  let conexionB = '';

  function construir(topeFilas: number): FastifyInstance {
    const nueva = Fastify({ logger: false });
    registrarGuardOperador(nueva, aislado);
    registrarContextoTenant(nueva, aislado);
    registerReportePruebaRoutes(nueva, aislado, ZONA, topeFilas);
    return nueva;
  }

  async function conexion(tenantId: string): Promise<string> {
    const fila = await db.conexion.create({
      data: {
        tenantId,
        nombre: `${marca} conexion`,
        motor: 'postgres',
        host: objetivo.host,
        puerto: objetivo.port,
        baseDeDatos: objetivo.database,
        usuarioDb: ROL_LECTOR,
        credencial: cifrarCredencial(CLAVE_LECTOR),
      },
    });
    return fila.id;
  }

  before(async () => {
    admin = new pg.Client({ ...objetivo });
    await admin.connect();
    await admin.query(SQL_LIMPIEZA);
    await admin.query(`CREATE ROLE ${ROL_LECTOR} LOGIN PASSWORD '${CLAVE_LECTOR}'`);

    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    aislado = extenderConAislamiento(db);
    tenantA = (await db.tenant.create({ data: { nombre: `${marca} A` } })).id;
    tenantB = (await db.tenant.create({ data: { nombre: `${marca} B` } })).id;
    conexionA = await conexion(tenantA);
    conexionB = await conexion(tenantB);
    // Each tenant's view reads literal rows of its own, so the lector role needs no grant.
    const vistas: [string, string, string][] = [
      [tenantA, conexionA, "SELECT id, nombre FROM (VALUES (1, 'a-uno'), (2, 'a-dos')) AS t(id, nombre)"],
      [tenantB, conexionB, "SELECT id, nombre FROM (VALUES (1, 'b-uno')) AS t(id, nombre)"],
    ];
    for (const [tenantId, conexionId, sql] of vistas) {
      await db.vistaCanonica.create({
        data: { tenantId, conexionId, entidad: 'producto', sql, estadoValidacion: 'valida' },
      });
    }
    const operadorId = (await crearOperador(aislado, operador, 'clave-de-operador-larga')).id;
    const { tokenPlano } = await crearSesion(aislado, operadorId, new Date(Date.now() + 3_600_000));
    cookie = `${NOMBRE_COOKIE_CONSOLA}=${tokenPlano}`;
    app = construir(200);
    appTreinta = construir(30);
    await app.ready();
    await appTreinta.ready();
  });

  after(async () => {
    for (const tenantId of [tenantA, tenantB].filter((t) => t !== '')) {
      await db.vistaCanonica.deleteMany({ where: { tenantId } });
      await db.conexion.deleteMany({ where: { tenantId } });
      await db.tenant.delete({ where: { id: tenantId } });
    }
    await db.reporte.deleteMany({ where: { nombre: { startsWith: marca } } });
    await borrarOperadores(aislado, [operador]);
    await db.$disconnect();
    await app.close();
    await appTreinta.close();
    await admin.query(SQL_LIMPIEZA);
    await admin.end();
  });

  async function reporte(datos: {
    sql: string;
    visualizacion: string;
    columnas: { rol: string; columna: string; titulo: string }[];
    entidades?: string[];
    periodo?: { parametro: string; dias: number[] };
  }): Promise<string> {
    const fila = await db.reporte.create({
      data: {
        nombre: `${marca} reporte`,
        titulo: 'Reporte de prueba',
        sql: datos.sql,
        entidades: datos.entidades ?? ['producto'],
        visualizacion: datos.visualizacion,
        columnas: datos.columnas,
        periodo: datos.periodo,
      },
    });
    return fila.id;
  }

  const TABLA = [
    { rol: 'columna', columna: 'id', titulo: 'Número' },
    { rol: 'columna', columna: 'nombre', titulo: 'Producto' },
  ];

  function probar(id: string, cuerpo: Record<string, unknown>, tenantId = tenantA, destino = app) {
    return destino.inject({
      method: 'POST',
      url: `/reportes/${encodeURIComponent(id)}/prueba`,
      headers: { cookie, 'x-tenant-id': tenantId },
      payload: cuerpo,
    });
  }

  function probarSinGuardar(cambios: Record<string, unknown>, tenantId = tenantA) {
    return app.inject({
      method: 'POST',
      url: '/reportes/prueba',
      headers: { cookie, 'x-tenant-id': tenantId },
      payload: { ...REPORTE_VALIDO, conexionId: conexionA, ...cambios },
    });
  }

  function registros(tenantId = tenantA) {
    return db.registroEjecucion.findMany({ where: { tenantId }, orderBy: { creadoEn: 'asc' } });
  }

  async function veredicto(respuesta: { statusCode: number; body: string; json(): unknown }): Promise<Veredicto> {
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    return respuesta.json() as Veredicto;
  }

  test('one report runs on two tenants without rewriting, each with its own rows', async () => {
    const id = await reporte({ sql: 'SELECT id, nombre FROM v_producto ORDER BY id', visualizacion: 'tabla', columnas: TABLA });
    const deA = await veredicto(await probar(id, { conexionId: conexionA }, tenantA));
    const deB = await veredicto(await probar(id, { conexionId: conexionB }, tenantB));
    assert.equal(deA.resultado, 'ok', JSON.stringify(deA));
    assert.deepEqual(deA.filas, [[1, 'a-uno'], [2, 'a-dos']]);
    assert.deepEqual(deB.filas, [[1, 'b-uno']]);
    assert.deepEqual([deA.periodo, deA.faltantes], [null, []]);
  });

  test("another tenant's connection is 404, nothing is dialed and nothing is recorded", async () => {
    const id = await reporte({ sql: 'SELECT id, nombre FROM v_producto', visualizacion: 'tabla', columnas: TABLA });
    const antes = (await registros()).length;
    const respuesta = await probar(id, { conexionId: conexionB }, tenantA);
    assert.equal(respuesta.statusCode, 404, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
    const sinGuardar = await probarSinGuardar({ conexionId: conexionB });
    assert.equal(sinGuardar.statusCode, 404, sinGuardar.body);
    assert.equal((await registros()).length, antes);
  });

  test('an unknown report is 404 reporte-no-encontrado', async () => {
    for (const id of ['11111111-2222-3333-4444-555555555555', 'no-es-un-uuid']) {
      const respuesta = await probar(id, { conexionId: conexionA });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'reporte-no-encontrado' });
    }
  });

  test('views not approved: 409 naming the entities, nothing recorded', async () => {
    const id = await reporte({
      sql: 'SELECT id, nombre FROM v_producto',
      visualizacion: 'tabla',
      columnas: TABLA,
      entidades: ['producto', 'pedido'],
    });
    const antes = (await registros()).length;
    const respuesta = await probar(id, { conexionId: conexionA });
    assert.equal(respuesta.statusCode, 409, respuesta.body);
    assert.deepEqual(respuesta.json(), {
      error: 'vista-canonica-no-aprobada',
      entidades: [{ entidad: 'pedido', estado: 'no-mapeada' }],
    });
    assert.equal((await registros()).length, antes);
  });

  test('an undeclared dias is 400 /dias, and dias on a report with no period too; nothing recorded', async () => {
    const conPeriodo = await reporte({
      sql: 'SELECT id, nombre FROM v_producto WHERE :desde::date IS NOT NULL',
      visualizacion: 'tabla',
      columnas: TABLA,
      periodo: { parametro: 'desde', dias: [7, 30] },
    });
    const sinPeriodo = await reporte({ sql: 'SELECT id, nombre FROM v_producto', visualizacion: 'tabla', columnas: TABLA });
    const antes = (await registros()).length;
    for (const [id, dias] of [[conPeriodo, 15], [sinPeriodo, 7]] as const) {
      const respuesta = await probar(id, { conexionId: conexionA, dias });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: ['/dias'] });
    }
    assert.equal((await registros()).length, antes);
  });

  test('the server computes and binds the date; the default is the first declared value', async () => {
    const id = await reporte({
      sql: 'SELECT :desde::text AS desde, count(*) AS total FROM v_producto',
      visualizacion: 'numero',
      columnas: [{ rol: 'valor', columna: 'total', titulo: 'Total' }],
      periodo: { parametro: 'desde', dias: [30, 7, 90] },
    });
    const siete = await veredicto(await probar(id, { conexionId: conexionA, dias: 7 }));
    const esperada = fechaDelPeriodo(new Date(), ZONA, 7);
    assert.equal(siete.resultado, 'ok', JSON.stringify(siete));
    assert.deepEqual(siete.periodo, { dias: 7, desde: esperada });
    // `count(*)` is a bigint, which the driver returns as text.
    assert.deepEqual(siete.filas, [[esperada, '2']]);
    assert.deepEqual(siete.faltantes, []);
    const predeterminado = await veredicto(await probar(id, { conexionId: conexionA }));
    assert.deepEqual(predeterminado.periodo, { dias: 30, desde: fechaDelPeriodo(new Date(), ZONA, 30) });
  });

  test('one audit row per run, with reporteId and the composed statement, never the date', async () => {
    const id = await reporte({
      sql: 'SELECT :desde::text AS desde, count(*) AS total FROM v_producto',
      visualizacion: 'numero',
      columnas: [{ rol: 'valor', columna: 'total', titulo: 'Total' }],
      periodo: { parametro: 'desde', dias: [7] },
    });
    const antes = (await registros()).length;
    const cuerpo = await veredicto(await probar(id, { conexionId: conexionA, dias: 7 }));
    const filas = await registros();
    assert.equal(filas.length, antes + 1);
    const fila = filas.at(-1)!;
    assert.equal(fila.origen, 'reporte-prueba');
    assert.equal(fila.reporteId, id);
    assert.equal(fila.plantillaId, null);
    assert.equal(fila.conexionId, conexionA);
    assert.equal(fila.operadorNombre, operador);
    assert.match(fila.sql, /^WITH v_producto AS/);
    assert.match(fila.sql, /:desde::text/);
    assert.ok(cuerpo.periodo !== null);
    assert.ok(!JSON.stringify(fila).includes(cuerpo.periodo.desde), 'the computed date must not reach the row');
    assert.equal(fila.resultado, 'ok');
    assert.equal(fila.filas, 1);
  });

  test('the unsaved test records reporteId null', async () => {
    const antes = (await registros()).length;
    await veredicto(await probarSinGuardar({}));
    const filas = await registros();
    assert.equal(filas.length, antes + 1);
    assert.deepEqual([filas.at(-1)!.origen, filas.at(-1)!.reporteId, filas.at(-1)!.plantillaId], ['reporte-prueba', null, null]);
  });

  test('bars are cut at twenty rows, with corte', async () => {
    const id = await reporte({
      sql: 'SELECT g AS producto, g * 10 AS total FROM generate_series(1, 35) AS g',
      visualizacion: 'barras',
      columnas: [
        { rol: 'etiqueta', columna: 'producto', titulo: 'Producto' },
        { rol: 'valor', columna: 'total', titulo: 'Total' },
      ],
    });
    const cuerpo = await veredicto(await probar(id, { conexionId: conexionA }));
    assert.equal(cuerpo.resultado, 'ok', JSON.stringify(cuerpo));
    assert.equal(cuerpo.filas?.length, 20);
    assert.equal(cuerpo.corte, 'tope-de-filas');
    // Below the cap there is no cut.
    const pocas = await reporte({
      sql: 'SELECT g AS producto, g AS total FROM generate_series(1, 20) AS g',
      visualizacion: 'barras',
      columnas: [
        { rol: 'etiqueta', columna: 'producto', titulo: 'Producto' },
        { rol: 'valor', columna: 'total', titulo: 'Total' },
      ],
    });
    const completo = await veredicto(await probar(pocas, { conexionId: conexionA }));
    assert.deepEqual([completo.filas?.length, completo.corte], [20, null]);
  });

  test('a lower maxFilasPorConsulta wins over the line cap', async () => {
    const id = await reporte({
      sql: 'SELECT g AS dia, g AS total FROM generate_series(1, 150) AS g',
      visualizacion: 'linea',
      columnas: [
        { rol: 'etiqueta', columna: 'dia', titulo: 'Día' },
        { rol: 'valor', columna: 'total', titulo: 'Total' },
      ],
    });
    const treinta = await veredicto(await probar(id, { conexionId: conexionA }, tenantA, appTreinta));
    assert.deepEqual([treinta.filas?.length, treinta.corte], [30, 'tope-de-filas']);
    const cien = await veredicto(await probar(id, { conexionId: conexionA }));
    assert.deepEqual([cien.filas?.length, cien.corte], [100, 'tope-de-filas']);
  });

  test('a column the result no longer returns is listed in faltantes, in assignment order', async () => {
    const id = await reporte({
      sql: 'SELECT nombre, id AS suma FROM v_producto',
      visualizacion: 'tabla',
      columnas: [
        { rol: 'columna', columna: 'total', titulo: 'Total' },
        { rol: 'columna', columna: 'nombre', titulo: 'Producto' },
        { rol: 'columna', columna: 'id', titulo: 'Número' },
      ],
    });
    const cuerpo = await veredicto(await probar(id, { conexionId: conexionA }));
    assert.equal(cuerpo.resultado, 'ok');
    assert.deepEqual(cuerpo.faltantes, ['total', 'id']);
  });

  test('the unsaved test runs with no columns and answers the result columns', async () => {
    const nombre = `${marca} sin columnas`;
    const cuerpo = await veredicto(await probarSinGuardar({ nombre }));
    assert.equal(cuerpo.resultado, 'ok', JSON.stringify(cuerpo));
    assert.deepEqual(cuerpo.columnas, ['id', 'nombre']);
    assert.deepEqual(cuerpo.faltantes, []);
    assert.equal(cuerpo.periodo, null);
    assert.equal(await db.reporte.count({ where: { nombre } }), 0, 'no Reporte row may be written');
  });

  test('the unsaved test with a period uses its default and binds the date', async () => {
    const cuerpo = await veredicto(
      await probarSinGuardar({
        sql: 'SELECT :desde::text AS desde FROM v_producto LIMIT 1',
        periodo: { parametro: 'desde', dias: [14, 7] },
        columnas: [{ rol: 'columna', columna: 'desde', titulo: 'Desde' }],
      }),
    );
    const esperada = fechaDelPeriodo(new Date(), ZONA, 14);
    assert.deepEqual(cuerpo.periodo, { dias: 14, desde: esperada });
    assert.deepEqual(cuerpo.filas, [[esperada]]);
  });

  test('a write statement is a 200 fallo from the engine, never a write', async () => {
    // A data-modifying CTE is caught by parse analysis once composed: `no-es-lectura`.
    const cte = await veredicto(
      await probarSinGuardar({ sql: 'WITH borrado AS (DELETE FROM "Reporte" RETURNING id) SELECT * FROM borrado' }),
    );
    assert.deepEqual([cte.resultado, cte.categoria], ['fallo', 'no-es-lectura']);
    // A bare statement cannot sit inside the composition at all: it is refused as syntax.
    const plano = await veredicto(await probarSinGuardar({ sql: 'DELETE FROM "Reporte"' }));
    assert.equal(plano.resultado, 'fallo');
    assert.ok(cte.periodo === null && cte.faltantes === undefined, 'faltantes is only on a successful result');
    assert.ok((await db.reporte.count({ where: { nombre: { startsWith: marca } } })) > 0, 'the catalog must be intact');
  });

  test('a stored report outside the rules fails closed: 500 and nothing recorded', async () => {
    const fila = await db.reporte.create({
      data: {
        nombre: `${marca} corrupto`,
        titulo: 'Corrupto',
        sql: 'SELECT 1 AS total',
        entidades: ['producto'],
        visualizacion: 'torta',
        columnas: [],
      },
    });
    const antes = (await registros()).length;
    const respuesta = await probar(fila.id, { conexionId: conexionA });
    assert.equal(respuesta.statusCode, 500, respuesta.body);
    assert.equal((await registros()).length, antes);
  });
});
