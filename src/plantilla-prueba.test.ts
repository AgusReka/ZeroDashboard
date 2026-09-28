import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { cifrarCredencial } from './cripto-credencial.js';
import { registerPlantillaPruebaRoute } from './plantilla-prueba.js';

/**
 * CH-12 unit 5a: the test route's checks, every one of which answers before anything is
 * executed (tasks 5.1–5.3, 5.5; design "Data Flow — Test Route"). Unit 5b: the value
 * and credential checks that still answer before a dial (5.6), and execution itself over
 * the composed views, with the rule-4 cases that need a live target (5.4).
 */

const RUTA = '/plantillas/:id/prueba';

/**
 * A client on which every model method throws, except the tenant lookup the hooks make.
 * A case that reaches any other read fails loudly instead of passing by accident.
 */
function clienteSoloTenant(tenant: { id: string; nombre: string; activo: boolean }): PrismaAislado {
  const modeloQueLanza = (modelo: string) =>
    new Proxy({}, {
      get: (_objetivo, metodo) => async () => {
        throw new Error(`la ruta de prueba leyó ${modelo}.${String(metodo)} antes de tiempo`);
      },
    });
  return new Proxy({}, {
    get: (_objetivo, modelo) =>
      modelo === 'tenant' ? { findUnique: async () => tenant } : modeloQueLanza(String(modelo)),
  }) as PrismaAislado;
}

// ---- 5.1 and the body shape: no database at all -----------------------------------------

describe('plantilla test route — tenant header and body shape (CH-12 5.1, 5.6)', () => {
  let sinLecturas!: FastifyInstance;

  before(async () => {
    sinLecturas = Fastify({ logger: false });
    const cliente = clienteSoloTenant({ id: 't-activo', nombre: 'Activo', activo: true });
    registrarContextoTenant(sinLecturas, cliente);
    registerPlantillaPruebaRoute(sinLecturas, cliente);
    await sinLecturas.ready();
  });

  after(async () => {
    await sinLecturas.close();
  });

  test('5.1 the route exists and, with no x-tenant-id, answers 400 tenant-no-indicado', async () => {
    assert.equal(sinLecturas.hasRoute({ method: 'POST', url: RUTA }), true);
    const respuesta = await sinLecturas.inject({
      method: 'POST',
      url: '/plantillas/cualquiera/prueba',
      payload: { conexionId: 'cualquiera' },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
  });

  test('5.6 a malformed body is rejected naming the field, before any lookup', async () => {
    const casos: [Record<string, unknown>, string[]][] = [
      [{}, ['/conexionId']],
      [{ conexionId: '' }, ['/conexionId']],
      // The tenant comes from the header context, never from the body (rule 2).
      [{ conexionId: 'c', tenantId: 'otro' }, ['/tenantId']],
      // The stored template is the declaration; a request cannot bring its own.
      [{ conexionId: 'c', parametros: [] }, ['/parametros']],
      [{ conexionId: 'c', limite: 0 }, ['/limite']],
      [{ conexionId: 'c', desplazamiento: -1 }, ['/desplazamiento']],
      [{ conexionId: 'c', valores: [] }, ['/valores']],
    ];
    for (const [payload, campos] of casos) {
      const respuesta = await sinLecturas.inject({
        method: 'POST',
        url: '/plantillas/cualquiera/prueba',
        headers: { 'x-tenant-id': 't-activo' },
        payload,
      });
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(payload)}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos });
    }
  });
});

// ---- 5.2/5.3/5.5 lookups and the view gate against a live PostgreSQL --------------------

const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};
const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

// `loadConfig()` runs on every execution and `destinoDeConexion` needs a master key
// (DEC-17): the same fixture values every suite that boots an executing route supplies.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** One TCP handshake, no driver: decides whether this suite has a server to talk to. */
function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

/** A port nothing listens on: bound, read, released. */
function puertoCerrado(): Promise<number> {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address() as net.AddressInfo;
      servidor.close(() => resolve(port));
    });
  });
}

const motivoSkip: string | false = (await esAlcanzable(objetivo.host, objetivo.port, 1000))
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

describe('plantilla test route — lookups, view gate and pre-dial checks (CH-12 5.2, 5.3, 5.5, 5.6)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  const marca = `CH-12 u5a ${Date.now()}`;
  let tenantA!: string;
  let tenantB!: string;
  /** Every connection points at a closed port: a dial would fail, never hang (5.5). */
  let puerto!: number;

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    tenantA = (await prisma.tenant.create({ data: { nombre: `${marca} A` } })).id;
    tenantB = (await prisma.tenant.create({ data: { nombre: `${marca} B` } })).id;
    puerto = await puertoCerrado();
    app = Fastify({ logger: false });
    const aislado = extenderConAislamiento(prisma);
    registrarContextoTenant(app, aislado);
    registerPlantillaPruebaRoute(app, aislado);
    await app.ready();
  });

  after(async () => {
    for (const tenantId of [tenantA, tenantB]) {
      if (tenantId === undefined) continue;
      await prisma.vistaCanonica.deleteMany({ where: { tenantId } });
      await prisma.conexion.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  /** Written around the API: the route reads rows, it never registers them. */
  async function conexion(tenantId: string): Promise<string> {
    const fila = await prisma.conexion.create({
      data: {
        tenantId,
        nombre: `${marca} conexion`,
        motor: 'postgres',
        host: '127.0.0.1',
        puerto,
        baseDeDatos: 'nunca-se-disca',
        usuarioDb: 'nadie',
        credencial: 'nunca-se-descifra',
      },
    });
    return fila.id;
  }

  async function plantilla(
    entidades: string[],
    sql = 'SELECT * FROM v_producto',
    parametros: { nombre: string; tipo: string }[] = [],
  ): Promise<string> {
    const fila = await prisma.plantilla.create({
      data: {
        nombre: `${marca} plantilla`,
        sql,
        parametros,
        entidades,
        automatizacion: 'stock-fisico',
        formato: 'correo-html',
        toleranciaFrescuraMinutos: 30,
      },
    });
    return fila.id;
  }

  function probar(plantillaId: string, conexionId: string, tenantId = tenantA, valores?: object) {
    return app.inject({
      method: 'POST',
      url: `/plantillas/${encodeURIComponent(plantillaId)}/prueba`,
      headers: { 'x-tenant-id': tenantId },
      payload: valores === undefined ? { conexionId } : { conexionId, valores },
    });
  }

  test('5.2 an unknown or malformed template id answers 404 plantilla-no-encontrada', async () => {
    const propia = await conexion(tenantA);
    for (const id of ['11111111-2222-3333-4444-555555555555', 'no-es-un-uuid']) {
      const respuesta = await probar(id, propia);
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'plantilla-no-encontrada' });
    }
  });

  test("5.2 another tenant's connection, or none at all, answers 404 conexion-no-encontrada", async () => {
    const id = await plantilla(['producto']);
    const deB = await conexion(tenantB);
    // B's connection has a view that would pass: the 404 must come before it is read.
    await prisma.vistaCanonica.create({
      data: { tenantId: tenantB, conexionId: deB, entidad: 'producto', sql: 'SELECT 1', estadoValidacion: 'valida' },
    });
    for (const conexionId of [deB, '11111111-2222-3333-4444-555555555555']) {
      const respuesta = await probar(id, conexionId);
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'conexion-no-encontrada' });
    }
  });

  async function vista(conexionId: string, entidad: string, estadoValidacion: string): Promise<void> {
    await prisma.vistaCanonica.create({
      data: { tenantId: tenantA, conexionId, entidad, sql: `SELECT 1 AS ${entidad}`, estadoValidacion },
    });
  }

  async function rechazoDeLaCompuerta(plantillaId: string, conexionId: string) {
    const respuesta = await probar(plantillaId, conexionId);
    assert.equal(respuesta.statusCode, 409, respuesta.body);
    const cuerpo = respuesta.json() as { error: string; entidades: unknown };
    assert.equal(cuerpo.error, 'vista-canonica-no-aprobada');
    return cuerpo.entidades;
  }

  test('5.3 an entity with no registered view is rejected naming it', async () => {
    const id = await plantilla(['insumo']);
    const propia = await conexion(tenantA);
    await vista(propia, 'producto', 'valida');
    assert.deepEqual(await rechazoDeLaCompuerta(id, propia), [{ entidad: 'insumo', estado: 'no-mapeada' }]);
  });

  test('5.3 every failing entity is listed in contract order, passing ones are not', async () => {
    // Declared out of contract order on purpose: the answer follows the contract.
    const id = await plantilla(['insumo', 'producto', 'pedido', 'item_pedido']);
    const propia = await conexion(tenantA);
    await vista(propia, 'producto', 'valida');
    await vista(propia, 'item_pedido', 'no-validado');
    await vista(propia, 'insumo', 'invalida');
    assert.deepEqual(await rechazoDeLaCompuerta(id, propia), [
      { entidad: 'pedido', estado: 'no-mapeada' },
      { entidad: 'item_pedido', estado: 'no-validado' },
      { entidad: 'insumo', estado: 'invalida' },
    ]);
  });

  test("5.3 only the named connection's views count, even within the same tenant", async () => {
    const id = await plantilla(['producto']);
    const nombrada = await conexion(tenantA);
    const otra = await conexion(tenantA);
    await vista(nombrada, 'producto', 'no-validado');
    await vista(otra, 'producto', 'valida');
    assert.deepEqual(await rechazoDeLaCompuerta(id, nombrada), [{ entidad: 'producto', estado: 'no-validado' }]);
  });

  test('5.5 a connection on a closed port still gets its 4xx: nothing is dialed first', async () => {
    const id = await plantilla(['receta_componente']);
    const propia = await conexion(tenantA);
    await vista(propia, 'receta_componente', 'invalida');
    const fila = await prisma.conexion.findUniqueOrThrow({ where: { id: propia }, select: { puerto: true } });
    assert.equal(await esAlcanzable('127.0.0.1', fila.puerto, 500), false, 'the fixture port must be closed');
    // A dial would have produced a `200 fallo conexion` verdict, not this rejection.
    assert.deepEqual(await rechazoDeLaCompuerta(id, propia), [{ entidad: 'receta_componente', estado: 'invalida' }]);
  });

  test('5.6 a value the stored declaration rejects answers 400 naming it, before the credential', async () => {
    // The gate passes, but this connection's credential cannot be opened and its port is
    // closed: a 400 proves the values were checked before `destinoDeConexion` and a dial.
    const sql = 'SELECT *, :eco AS eco FROM v_producto';
    const id = await plantilla(['producto'], sql, [{ nombre: 'eco', tipo: 'texto' }]);
    const propia = await conexion(tenantA);
    await vista(propia, 'producto', 'valida');
    const casos: [object, { parametro: string; motivo: string; campo: string }[]][] = [
      [{}, [{ parametro: 'eco', motivo: 'valor-faltante', campo: '/valores/eco' }]],
      [{ eco: 7 }, [{ parametro: 'eco', motivo: 'valor-invalido', campo: '/valores/eco' }]],
      [{ eco: 'x', otro: 'y' }, [{ parametro: 'otro', motivo: 'valor-no-declarado', campo: '/valores/otro' }]],
    ];
    for (const [valores, problemas] of casos) {
      const respuesta = await probar(id, propia, tenantA, valores);
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(valores)}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), {
        error: 'solicitud-invalida',
        campos: problemas.map((problema) => problema.campo),
        problemas,
      });
    }
  });

  test('5.6 a stored credential that cannot be opened answers 409 credencial-ilegible', async () => {
    const id = await plantilla(['producto']);
    const propia = await conexion(tenantA);
    await vista(propia, 'producto', 'valida');
    const respuesta = await probar(id, propia);
    assert.equal(respuesta.statusCode, 409, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'credencial-ilegible' });
  });
});

// ---- 5.4 execution over the composed views, against a live PostgreSQL --------------------

/** A plain login role: no table grant, no schema CREATE, no superuser, so DEC-08 lets it read. */
const ROL_LECTOR = 'ch12_lector';
const CLAVE_LECTOR = 'ch12-clave-lector';

/** Drops the fixture role. Safe to run before creation and after teardown. */
const SQL_LIMPIEZA = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL_LECTOR}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL_LECTOR}');
    EXECUTE format('DROP ROLE %I', '${ROL_LECTOR}');
  END IF;
END
$limpieza$;`;

/** The two verdict shapes of the existing execution contract, as far as these cases read them. */
type Veredicto =
  | { resultado: 'ok'; columnas: string[]; filas: unknown[][] }
  | { resultado: 'fallo'; fase: string; categoria: string; codigo: string | null };

describe('plantilla test route — execution over the composed views (CH-12 5.4)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  let prisma!: PrismaClient;
  let admin!: pg.Client;
  const marca = `CH-12 u5b ${Date.now()}`;
  let tenantId!: string;
  let conexionId!: string;

  before(async () => {
    admin = new pg.Client({ ...objetivo });
    await admin.connect();
    await admin.query(SQL_LIMPIEZA);
    await admin.query(`CREATE ROLE ${ROL_LECTOR} LOGIN PASSWORD '${CLAVE_LECTOR}'`);

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    tenantId = (await prisma.tenant.create({ data: { nombre: `${marca} tenant` } })).id;
    conexionId = (
      await prisma.conexion.create({
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
      })
    ).id;
    // Both views read literal rows, so the lector role needs no table grant at all.
    const vistas: [string, string][] = [
      ['producto', "SELECT id, nombre FROM (VALUES (1, 'uno'), (2, 'dos')) AS t(id, nombre)"],
      ['insumo', 'SELECT id, cantidad FROM (VALUES (1, 10), (2, 20)) AS t(id, cantidad)'],
    ];
    for (const [entidad, sql] of vistas) {
      await prisma.vistaCanonica.create({
        data: { tenantId, conexionId, entidad, sql, estadoValidacion: 'valida' },
      });
    }

    app = Fastify({ logger: false });
    const aislado = extenderConAislamiento(prisma);
    registrarContextoTenant(app, aislado);
    registerPlantillaPruebaRoute(app, aislado);
    await app.ready();
  });

  after(async () => {
    if (tenantId !== undefined) {
      await prisma.vistaCanonica.deleteMany({ where: { tenantId } });
      await prisma.conexion.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
    await app.close();
    await admin.query(SQL_LIMPIEZA);
    await admin.end();
  });

  async function plantilla(entidades: string[], sql: string, parametros: { nombre: string; tipo: string }[] = []) {
    const fila = await prisma.plantilla.create({
      data: {
        nombre: `${marca} plantilla`,
        sql,
        parametros,
        entidades,
        automatizacion: 'stock-fisico',
        formato: 'correo-html',
        toleranciaFrescuraMinutos: 30,
      },
    });
    return fila.id;
  }

  async function veredicto(plantillaId: string, valores: object = {}): Promise<Veredicto> {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/plantillas/${plantillaId}/prueba`,
      headers: { 'x-tenant-id': tenantId },
      payload: { conexionId, valores },
    });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    return respuesta.json() as Veredicto;
  }

  test('5.4 rows come back over the composed views; a hostile value comes back as data', async () => {
    // Declared out of contract order: composition follows the contract (DEC-70).
    const sql =
      'SELECT p.id, p.nombre, i.cantidad, :eco AS eco ' +
      'FROM v_producto p JOIN v_insumo i ON i.id = p.id ORDER BY p.id';
    const id = await plantilla(['insumo', 'producto'], sql, [{ nombre: 'eco', tipo: 'texto' }]);
    for (const eco of ["O'Brien", `x'; DROP TABLE "Plantilla"; --`]) {
      const cuerpo = await veredicto(id, { eco });
      assert.ok(cuerpo.resultado === 'ok', JSON.stringify(cuerpo));
      // Spliced into the text, the first value would be a syntax error and the second a
      // DROP: returned verbatim in every row, each was bound as a driver parameter only.
      assert.deepEqual(cuerpo.columnas, ['id', 'nombre', 'cantidad', 'eco']);
      assert.deepEqual(cuerpo.filas, [
        [1, 'uno', 10, eco],
        [2, 'dos', 20, eco],
      ]);
    }
    assert.equal(await prisma.plantilla.count({ where: { id } }), 1, 'the catalog must be intact');
  });

  test('5.4 a template reading a view it did not declare runs and answers 200 fallo 42P01', async () => {
    // `insumo` has a passing view on this connection, but only declared entities are
    // composed: `v_insumo` is an undefined relation, reported by the existing contract.
    const id = await plantilla(['producto'], 'SELECT * FROM v_producto CROSS JOIN v_insumo');
    const cuerpo = await veredicto(id);
    assert.ok(cuerpo.resultado === 'fallo', JSON.stringify(cuerpo));
    assert.deepEqual(
      [cuerpo.fase, cuerpo.categoria, cuerpo.codigo],
      ['ejecucion', 'error-sintaxis', '42P01'],
    );
  });
});
