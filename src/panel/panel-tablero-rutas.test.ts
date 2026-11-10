import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { SIN_AGENTES } from '../agente/canal-agente.js';
import { alcanzable, databaseUrl, motivoSkip, objetivo } from '../consola/consola-auth-apoyo.js';
import { cifrarCredencial } from '../compartido/cripto-credencial.js';
import { generarTokenSesion } from '../compartido/crypto-auth.js';
import { fechaDelPeriodo } from '../reportes/reportes.js';
import { registerPanelTableroRoutes } from './panel-tablero-rutas.js';
import type { Compuerta } from './panel-tablero.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-48 task 3.3 (DEC-201, DEC-202): `GET /api/panel/tablero` and
 * `GET /api/panel/tablero/:reporteId/resultado` against a live PostgreSQL target. The views
 * read literal rows (`VALUES`), so the connection's role needs no grant and no replica.
 */

const ZONA = 'America/Argentina/Buenos_Aires';
const RELOJ = new Date('2026-11-10T15:00:00.000Z');
const ROL = 'ch48_rutas';
const CLAVE_ROL = 'ch48-clave-rutas';
const ACTUALIZADA = new Date('2026-11-10T12:00:00.000Z');

const SQL_LIMPIEZA = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL}');
    EXECUTE format('DROP ROLE %I', '${ROL}');
  END IF;
END
$limpieza$;`;

/** The keys pino adds to every line; anything else on the `info` line is the route's. */
const CLAVES_PINO = new Set(['level', 'time', 'pid', 'hostname', 'msg']);

interface Linea {
  level: number;
  msg: string;
  [clave: string]: unknown;
}

describe('CH-48 panel dashboard routes — live PostgreSQL (DEC-201, DEC-202)', { skip: alcanzable ? false : motivoSkip }, () => {
  const marca = `CH-48 rutas ${Date.now()}`;
  let db!: PrismaClient;
  let aislado!: PrismaAislado;
  let admin!: pg.Client;
  let app!: FastifyInstance;
  let lleno!: FastifyInstance;
  const partes: string[] = [];
  const tenantIds: string[] = [];
  const reportes: Record<string, string> = {};
  let cookieA = { cookie: '' };
  let cookieB = { cookie: '' };
  let cookieC = { cookie: '' };
  let tenantA = '';

  /** One tenant, one user and one live panel session cookie. */
  async function negocio(etiqueta: string, replicaActualizadaEn: Date | null) {
    const tenant = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}`, activo: true, replicaActualizadaEn } });
    tenantIds.push(tenant.id);
    const usuario = await db.usuario.create({
      data: { tenantId: tenant.id, correo: `${tenant.id}@prueba.test`, claveHash: 'x', activo: true },
    });
    const { tokenPlano, tokenHash } = generarTokenSesion();
    await db.sesionPanel.create({
      data: { tokenHash, usuarioId: usuario.id, tenantId: tenant.id, expiraEn: new Date(Date.now() + 3_600_000) },
    });
    return { tenantId: tenant.id, cookie: { cookie: `zd_panel_session=${tokenPlano}` } };
  }

  async function conexion(tenantId: string): Promise<string> {
    return (
      await db.conexion.create({
        data: {
          tenantId,
          nombre: `${marca} conexion`,
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: ROL,
          credencial: cifrarCredencial(CLAVE_ROL),
        },
      })
    ).id;
  }

  async function reporte(clave: string, datos: {
    titulo: string;
    sql: string;
    visualizacion: string;
    columnas: { rol: string; columna: string; titulo: string }[];
    entidades?: string[];
    periodo?: { parametro: string; dias: number[] };
    descripcion?: string;
  }): Promise<string> {
    const fila = await db.reporte.create({
      data: {
        nombre: `${marca} ${clave}`,
        titulo: datos.titulo,
        descripcion: datos.descripcion ?? null,
        sql: datos.sql,
        entidades: datos.entidades ?? ['producto'],
        visualizacion: datos.visualizacion,
        columnas: datos.columnas,
        periodo: datos.periodo,
      },
    });
    reportes[clave] = fila.id;
    return fila.id;
  }

  const BARRAS = [
    { rol: 'etiqueta', columna: 'prod_nombre', titulo: 'Producto' },
    { rol: 'valor', columna: 'prod_unidades', titulo: 'Unidades' },
  ];

  before(async () => {
    admin = new pg.Client({ ...objetivo });
    await admin.connect();
    await admin.query(SQL_LIMPIEZA);
    await admin.query(`CREATE ROLE ${ROL} LOGIN PASSWORD '${CLAVE_ROL}'`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    aislado = extenderConAislamiento(db);

    const a = await negocio('A', ACTUALIZADA);
    const b = await negocio('B', null);
    const c = await negocio('C', null);
    tenantA = a.tenantId;
    cookieA = a.cookie;
    cookieB = b.cookie;
    cookieC = c.cookie;
    const conexionA = await conexion(a.tenantId);
    const conexionC = await conexion(c.tenantId);
    await db.vistaCanonica.create({
      data: {
        tenantId: a.tenantId,
        conexionId: conexionA,
        entidad: 'producto',
        sql: "SELECT * FROM (VALUES ('Mate', 5, 'ana@correo.test'), ('Yerba', 3, 'beto@correo.test')) AS t(nombre, unidades, email)",
        estadoValidacion: 'valida',
      },
    });

    await reporte('ventas', {
      titulo: 'Ventas por producto',
      descripcion: 'Unidades vendidas',
      sql: 'SELECT nombre AS prod_nombre, unidades AS prod_unidades, email FROM v_producto WHERE :desde::date IS NOT NULL ORDER BY unidades DESC',
      visualizacion: 'barras',
      columnas: BARRAS,
      periodo: { parametro: 'desde', dias: [30, 7] },
    });
    await reporte('stock', {
      titulo: 'Stock',
      sql: 'SELECT nombre AS prod_nombre, unidades AS prod_unidades FROM v_producto ORDER BY nombre',
      visualizacion: 'tabla',
      columnas: [
        { rol: 'columna', columna: 'prod_nombre', titulo: 'Producto' },
        { rol: 'columna', columna: 'prod_unidades', titulo: 'Unidades' },
      ],
    });
    await reporte('vacio', {
      titulo: 'Sin ventas',
      sql: 'SELECT nombre AS prod_nombre, unidades AS prod_unidades FROM v_producto WHERE unidades > 100',
      visualizacion: 'barras',
      columnas: BARRAS,
    });
    await reporte('pedidos', {
      titulo: 'Pedidos',
      sql: 'SELECT nombre AS prod_nombre, unidades AS prod_unidades FROM v_producto',
      visualizacion: 'barras',
      columnas: BARRAS,
      entidades: ['producto', 'pedido'],
    });
    await reporte('renombrada', {
      titulo: 'Total',
      sql: 'SELECT nombre AS prod_nombre FROM v_producto',
      visualizacion: 'numero',
      columnas: [{ rol: 'valor', columna: 'prod_total', titulo: 'Total' }],
    });
    reportes.corrupto = (
      await db.reporte.create({
        data: {
          nombre: `${marca} corrupto`,
          titulo: 'Corrupto',
          sql: 'SELECT 1 AS total',
          entidades: ['producto'],
          visualizacion: 'torta',
          columnas: [],
        },
      })
    ).id;
    await reporte('fuera', {
      titulo: 'Fuera del tablero',
      sql: 'SELECT nombre AS prod_nombre FROM v_producto',
      visualizacion: 'tabla',
      columnas: [{ rol: 'columna', columna: 'prod_nombre', titulo: 'Producto' }],
    });

    await db.tablero.create({
      data: {
        tenantId: a.tenantId,
        conexionId: conexionA,
        reportes: ['ventas', 'stock', 'vacio', 'pedidos', 'renombrada', 'corrupto'].map((clave) => reportes[clave]),
      },
    });
    await db.tablero.create({ data: { tenantId: c.tenantId, conexionId: conexionC, reportes: [] } });

    const stream = new Writable({
      write(trozo, _codificacion, listo) {
        partes.push(String(trozo));
        listo();
      },
    });
    app = Fastify({ logger: { level: 'info', stream } });
    registrarContextoTenant(app, aislado);
    registerPanelTableroRoutes(app, { prisma: aislado, zonaHoraria: ZONA, topeFilas: 200, canales: SIN_AGENTES, ahora: () => RELOJ });
    await app.ready();
    const compuertaLlena: Compuerta = { pedir: () => 'lleno', ocupacion: () => ({ tenants: 0, entradas: 0 }) };
    lleno = Fastify({ logger: false });
    registrarContextoTenant(lleno, aislado);
    registerPanelTableroRoutes(lleno, { prisma: aislado, zonaHoraria: ZONA, topeFilas: 200, canales: SIN_AGENTES, compuerta: compuertaLlena });
    await lleno.ready();
  });

  after(async () => {
    if (tenantIds.length > 0) {
      const donde = { tenantId: { in: tenantIds } };
      await db.tablero.deleteMany({ where: donde });
      await db.vistaCanonica.deleteMany({ where: donde });
      await db.conexion.deleteMany({ where: donde });
      await db.usuario.deleteMany({ where: donde });
      await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await db.reporte.deleteMany({ where: { nombre: { startsWith: marca } } });
    await db.$disconnect();
    await app.close();
    await lleno.close();
    await admin.query(SQL_LIMPIEZA);
    await admin.end();
  });

  /** The log lines written since `desde` (an index into `partes`). */
  function lineasDesde(desde: number): Linea[] {
    return partes
      .slice(desde)
      .join('')
      .split('\n')
      .filter((l) => l !== '')
      .map((l) => JSON.parse(l) as Linea);
  }

  function configuracion(cookie: { cookie: string }, en = app) {
    return en.inject({ method: 'GET', url: '/api/panel/tablero', headers: cookie });
  }

  function resultado(clave: string, consulta = '', cookie = cookieA, en = app) {
    const id = reportes[clave] ?? clave;
    return en.inject({ method: 'GET', url: `/api/panel/tablero/${encodeURIComponent(id)}/resultado${consulta}`, headers: cookie });
  }

  test('the configuration lists the reports in dashboard order, with no technical field', async () => {
    const respuesta = await configuracion(cookieA);
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    const cuerpo = respuesta.json() as { reportes: Record<string, unknown>[]; datos: unknown; zonaHoraria: string };
    assert.deepEqual(cuerpo.reportes.map((r) => r.titulo), ['Ventas por producto', 'Stock', 'Sin ventas', 'Pedidos', 'Total', 'Corrupto']);
    assert.deepEqual(cuerpo.reportes[0], {
      id: reportes.ventas,
      titulo: 'Ventas por producto',
      descripcion: 'Unidades vendidas',
      visualizacion: 'barras',
      periodo: { dias: [30, 7], predeterminado: 30 },
    });
    assert.equal(cuerpo.reportes[1].periodo, null);
    assert.deepEqual(cuerpo.reportes[5], { id: reportes.corrupto, titulo: 'Corrupto', descripcion: null, visualizacion: 'tabla', periodo: null });
    assert.deepEqual(cuerpo.datos, { actualizadosEn: ACTUALIZADA.toISOString() });
    assert.equal(cuerpo.zonaHoraria, ZONA);
    for (const prohibido of ['"nombre"', '"sql"', '"entidades"', '"columnas"', '"conexionId"', 'prod_nombre', 'prod_unidades', 'v_producto', tenantA, marca]) {
      assert.ok(!respuesta.body.includes(prohibido), `${prohibido} in the configuration`);
    }
  });

  test('no dashboard and an empty dashboard both answer no reports; a null freshness stays null', async () => {
    for (const cookie of [cookieB, cookieC]) {
      const respuesta = await configuracion(cookie);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), { reportes: [], datos: { actualizadosEn: null }, zonaHoraria: ZONA });
    }
  });

  test('reading the configuration runs nothing: no run line', async () => {
    const desde = partes.length;
    await configuracion(cookieA);
    assert.ok(!lineasDesde(desde).some((l) => l.msg === 'panel report run'));
  });

  test('no cookie is 401 sesion-invalida on both routes, with no-store', async () => {
    for (const url of ['/api/panel/tablero', `/api/panel/tablero/${reportes.ventas}/resultado`]) {
      const respuesta = await app.inject({ method: 'GET', url });
      assert.equal(respuesta.statusCode, 401, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'sesion-invalida' });
      assert.equal(respuesta.headers['cache-control'], 'no-store');
    }
  });

  test('a catalog report not on the dashboard, and an unknown id, are 404 reporte-no-encontrado', async () => {
    for (const clave of ['fuera', '11111111-2222-3333-4444-555555555555']) {
      const respuesta = await resultado(clave);
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'reporte-no-encontrado' });
      assert.equal(respuesta.headers['cache-control'], 'no-store');
    }
    const sinTablero = await resultado('ventas', '', cookieB);
    assert.equal(sinTablero.statusCode, 404, sinTablero.body);
  });

  test('an undeclared, malformed or extra query value is 400 /dias, and nothing runs', async () => {
    const desde = partes.length;
    for (const [clave, consulta] of [
      ['ventas', '?dias=15'],
      ['ventas', '?dias=7.0'],
      ['ventas', '?dias=-7'],
      ['ventas', '?dias=7&dias=30'],
      ['ventas', '?dias=7&tenantId=otro'],
      ['stock', '?dias=7'],
    ] as const) {
      const respuesta = await resultado(clave, consulta);
      assert.equal(respuesta.statusCode, 400, `${clave}${consulta}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: ['/dias'] });
    }
    assert.ok(!lineasDesde(desde).some((l) => l.msg === 'panel report run'));
  });

  test('ok answers only the assigned columns, in order, with the default period', async () => {
    const respuesta = await resultado('ventas');
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    assert.deepEqual(respuesta.json(), {
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
      periodo: { dias: 30, desde: fechaDelPeriodo(RELOJ, ZONA, 30) },
    });
    assert.ok(!respuesta.body.includes('@correo.test'), 'an unassigned column never leaves the server');
    const siete = await resultado('ventas', '?dias=7');
    assert.deepEqual((siete.json() as { periodo: unknown }).periodo, { dias: 7, desde: fechaDelPeriodo(RELOJ, ZONA, 7) });
  });

  test('a table answers its rows; zero rows is sin-datos', async () => {
    const tabla = await resultado('stock');
    assert.deepEqual((tabla.json() as { filas: unknown }).filas, [['Mate', 5], ['Yerba', 3]]);
    const vacio = await resultado('vacio');
    assert.equal(vacio.statusCode, 200, vacio.body);
    assert.deepEqual(vacio.json(), { estado: 'sin-datos' });
  });

  test('unapproved views and a missing column are no-disponible, naming nothing', async () => {
    for (const clave of ['pedidos', 'renombrada']) {
      const respuesta = await resultado(clave);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), { estado: 'no-disponible' });
    }
  });

  test('a corrupt stored report is no-disponible, logs one error line and runs nothing', async () => {
    const desde = partes.length;
    const respuesta = await resultado('corrupto');
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.deepEqual(respuesta.json(), { estado: 'no-disponible' });
    const lineas = lineasDesde(desde);
    const errores = lineas.filter((l) => l.level >= 50);
    assert.equal(errores.length, 1);
    assert.equal(errores[0].msg, 'stored report out of rules');
    assert.equal(errores[0].reporteId, reportes.corrupto);
    assert.ok(!lineas.some((l) => l.msg === 'panel report run'));
  });

  test('a run writes no audit row and no error line, and one info line with the six closed fields', async () => {
    const antes = await db.registroEjecucion.count({ where: { tenantId: tenantA } });
    const desde = partes.length;
    const respuesta = await resultado('ventas', '?dias=7');
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.equal(await db.registroEjecucion.count({ where: { tenantId: tenantA } }), antes);
    const lineas = lineasDesde(desde);
    assert.ok(!lineas.some((l) => l.level >= 50), 'no error line, and no "audit skipped" line');
    const corridas = lineas.filter((l) => l.msg === 'panel report run');
    assert.equal(corridas.length, 1);
    const [linea] = corridas;
    assert.equal(linea.level, 30);
    assert.deepEqual(Object.keys(linea).filter((k) => !CLAVES_PINO.has(k)).sort(), ['conexionId', 'duracionMs', 'estado', 'filas', 'reporteId', 'tenantId']);
    assert.deepEqual([linea.tenantId, linea.reporteId, linea.estado, linea.filas], [tenantA, reportes.ventas, 'ok', 2]);
    assert.equal(typeof linea.duracionMs, 'number');
    const texto = JSON.stringify(lineas);
    for (const prohibido of ['Mate', '@correo.test', 'v_producto', fechaDelPeriodo(RELOJ, ZONA, 7)]) {
      assert.ok(!texto.includes(prohibido), `${prohibido} in the log`);
    }
  });

  test('a full gate is 429 demasiadas-solicitudes, after every refusal', async () => {
    const respuesta = await resultado('ventas', '', cookieA, lleno);
    assert.equal(respuesta.statusCode, 429, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'demasiadas-solicitudes' });
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    // A refused request never reaches the gate.
    assert.equal((await resultado('fuera', '', cookieA, lleno)).statusCode, 404);
    assert.equal((await resultado('ventas', '?dias=15', cookieA, lleno)).statusCode, 400);
  });
});
