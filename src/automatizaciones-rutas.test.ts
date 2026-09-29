import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { registerAutomatizacionRoutes } from './automatizaciones-rutas.js';

/**
 * CH-13 units 3 and 5: create, list, get and deactivate an automation (tasks 3.1–3.5),
 * and list its runs (task 5.1). Every
 * check that answers before a database read runs against a client that throws on any
 * read; the rest run against a live PostgreSQL and skip when none is reachable.
 */

/** A client on which every model method throws, except the tenant lookup the hooks make. */
function clienteSoloTenant(tenant: { id: string; nombre: string; activo: boolean }): PrismaAislado {
  const modeloQueLanza = (modelo: string) =>
    new Proxy({}, {
      get: (_objetivo, metodo) => async () => {
        throw new Error(`la ruta leyó ${modelo}.${String(metodo)} antes de tiempo`);
      },
    });
  return new Proxy({}, {
    get: (_objetivo, modelo) =>
      modelo === 'tenant' ? { findUnique: async () => tenant } : modeloQueLanza(String(modelo)),
  }) as PrismaAislado;
}

describe('automation routes — tenant header, body shape and cron (CH-13 3.1, 3.3)', () => {
  let sinLecturas!: FastifyInstance;

  before(async () => {
    sinLecturas = Fastify({ logger: false });
    const cliente = clienteSoloTenant({ id: 't-activo', nombre: 'Activo', activo: true });
    registrarContextoTenant(sinLecturas, cliente);
    registerAutomatizacionRoutes(sinLecturas, cliente, 'UTC');
    await sinLecturas.ready();
  });

  after(async () => {
    await sinLecturas.close();
  });

  test('3.1 every automation route exists and, with no x-tenant-id, answers 400 tenant-no-indicado', async () => {
    const rutas: ['GET' | 'POST', string, string][] = [
      ['POST', '/automatizaciones', '/automatizaciones'],
      ['GET', '/automatizaciones', '/automatizaciones'],
      ['GET', '/automatizaciones/:id', '/automatizaciones/cualquiera'],
      ['POST', '/automatizaciones/:id/desactivar', '/automatizaciones/cualquiera/desactivar'],
      ['GET', '/automatizaciones/:id/ejecuciones', '/automatizaciones/cualquiera/ejecuciones'],
    ];
    for (const [method, patron, url] of rutas) {
      assert.equal(sinLecturas.hasRoute({ method, url: patron }), true, `${method} ${patron}`);
      const respuesta = await sinLecturas.inject({ method, url, payload: method === 'POST' ? {} : undefined });
      assert.equal(respuesta.statusCode, 400, `${method} ${url}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    }
  });

  test('3.1/3.3 a malformed body or an invalid cron is rejected naming the field, before any read', async () => {
    const valido = { plantillaId: 'p', conexionId: 'c', cron: '0 8 * * *' };
    const casos: [Record<string, unknown>, string[]][] = [
      [{ plantillaId: 'p', conexionId: 'c' }, ['/cron']],
      // The tenant comes from the header context, never from the body (rule 2).
      [{ ...valido, tenantId: 'otro' }, ['/tenantId']],
      [{ ...valido, activo: false }, ['/activo']],
      [{ ...valido, valores: [] }, ['/valores']],
      [{ ...valido, cron: '@daily' }, ['/cron']],
      [{ ...valido, cron: '0 0 8 * * *' }, ['/cron']],
      [{ ...valido, cron: '61 * * * *' }, ['/cron']],
    ];
    for (const [payload, campos] of casos) {
      const respuesta = await sinLecturas.inject({
        method: 'POST',
        url: '/automatizaciones',
        headers: { 'x-tenant-id': 't-activo' },
        payload,
      });
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(payload)}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json().campos.sort(), [...campos].sort());
    }
  });
});

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

const motivoSkip: string | false = (await esAlcanzable(objetivo.host, objetivo.port, 1000))
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

describe('automation routes — create, list, get, deactivate, runs (CH-13 3.2, 3.4, 3.5, 5.1)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  const marca = `CH-13 u3 ${Date.now()}`;
  let tenantA!: string;
  let tenantB!: string;
  let plantillaId!: string;
  let conexionA!: string;
  let conexionB!: string;

  async function conexion(tenantId: string): Promise<string> {
    const fila = await prisma.conexion.create({
      data: {
        tenantId,
        nombre: `${marca} conexion`,
        motor: 'postgres',
        host: '127.0.0.1',
        puerto: 1,
        baseDeDatos: 'nunca-se-disca',
        usuarioDb: 'nadie',
        credencial: 'nunca-se-descifra',
      },
    });
    return fila.id;
  }

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    tenantA = (await prisma.tenant.create({ data: { nombre: `${marca} A` } })).id;
    tenantB = (await prisma.tenant.create({ data: { nombre: `${marca} B` } })).id;
    conexionA = await conexion(tenantA);
    conexionB = await conexion(tenantB);
    plantillaId = (
      await prisma.plantilla.create({
        data: {
          nombre: `${marca} plantilla`,
          sql: 'SELECT * FROM v_producto WHERE nombre = :nombre',
          parametros: [{ nombre: 'nombre', tipo: 'texto' }],
          entidades: ['producto'],
          automatizacion: 'stock-fisico',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      })
    ).id;
    app = Fastify({ logger: false });
    const aislado = extenderConAislamiento(prisma);
    registrarContextoTenant(app, aislado);
    registerAutomatizacionRoutes(app, aislado, 'UTC');
    await app.ready();
  });

  after(async () => {
    for (const tenantId of [tenantA, tenantB]) {
      if (tenantId === undefined) continue;
      await prisma.ejecucion.deleteMany({ where: { tenantId } });
      await prisma.automatizacion.deleteMany({ where: { tenantId } });
      await prisma.conexion.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  function crear(payload: Record<string, unknown>, tenantId = tenantA) {
    return app.inject({ method: 'POST', url: '/automatizaciones', headers: { 'x-tenant-id': tenantId }, payload });
  }

  function pedir(method: 'GET' | 'POST', url: string, tenantId = tenantA) {
    return app.inject({ method, url, headers: { 'x-tenant-id': tenantId } });
  }

  const cuerpo = () => ({ plantillaId, conexionId: conexionA, valores: { nombre: 'x' }, cron: '0 8 * * 1-5' });

  test('3.2 a valid create persists activo: true, scoped to the header tenant', async () => {
    const respuesta = await crear(cuerpo());
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    const { automatizacion } = respuesta.json();
    assert.equal(automatizacion.activo, true);
    assert.deepEqual(automatizacion.valores, { nombre: 'x' });
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id: automatizacion.id } });
    assert.equal(fila.tenantId, tenantA);
    assert.equal(fila.cron, '0 8 * * 1-5');
  });

  test('3.2 a missing or ill-typed parameter value is 400 naming it; nothing persists', async () => {
    const antes = await prisma.automatizacion.count({ where: { tenantId: tenantA } });
    for (const valores of [{}, { nombre: 3 }]) {
      const respuesta = await crear({ ...cuerpo(), valores });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json().campos, ['/valores/nombre']);
    }
    assert.equal(await prisma.automatizacion.count({ where: { tenantId: tenantA } }), antes);
  });

  test("3.2 another tenant's connection, or an unknown template, is 404; nothing persists", async () => {
    // A foreign connection would be written under A, the header tenant; count A's rows only,
    // since other suites may write automations in parallel.
    const antes = await prisma.automatizacion.count({ where: { tenantId: tenantA } });
    const deB = await crear({ ...cuerpo(), conexionId: conexionB });
    assert.equal(deB.statusCode, 404, deB.body);
    assert.deepEqual(deB.json(), { error: 'conexion-no-encontrada' });
    const sinPlantilla = await crear({ ...cuerpo(), plantillaId: 'no-existe' });
    assert.equal(sinPlantilla.statusCode, 404, sinPlantilla.body);
    assert.deepEqual(sinPlantilla.json(), { error: 'plantilla-no-encontrada' });
    assert.equal(await prisma.automatizacion.count({ where: { tenantId: tenantA } }), antes);
  });

  test('3.4/3.5 list, get, deactivate once, and the deactivated row stays listed', async () => {
    const id = (await crear(cuerpo())).json().automatizacion.id as string;

    const obtenida = await pedir('GET', `/automatizaciones/${id}`);
    assert.equal(obtenida.statusCode, 200, obtenida.body);
    assert.equal(obtenida.json().automatizacion.plantillaId, plantillaId);
    assert.equal(obtenida.json().automatizacion.conexionId, conexionA);
    assert.deepEqual(obtenida.json().automatizacion.valores, { nombre: 'x' });

    const baja = await pedir('POST', `/automatizaciones/${id}/desactivar`);
    assert.equal(baja.statusCode, 200, baja.body);
    assert.equal(baja.json().automatizacion.activo, false);
    const repetida = await pedir('POST', `/automatizaciones/${id}/desactivar`);
    assert.equal(repetida.statusCode, 409, repetida.body);
    assert.deepEqual(repetida.json(), { error: 'automatizacion-desactivada' });

    const listado = await pedir('GET', '/automatizaciones');
    assert.equal(listado.statusCode, 200, listado.body);
    const fila = listado.json().automatizaciones.find((a: { id: string }) => a.id === id);
    assert.equal(fila?.activo, false);
    assert.equal('valores' in fila, false);
    assert.equal(listado.json().truncado, false);
    assert.deepEqual((await pedir('GET', '/automatizaciones', tenantB)).json().automatizaciones, []);
  });

  test('3.4/3.5 an unknown or foreign id is 404; no route edits, deletes or reactivates', async () => {
    const deA = (await crear(cuerpo())).json().automatizacion.id as string;
    for (const [method, url] of [
      ['GET', `/automatizaciones/${deA}`],
      ['POST', `/automatizaciones/${deA}/desactivar`],
      ['GET', '/automatizaciones/no-existe'],
      ['POST', '/automatizaciones/no-existe/desactivar'],
    ] as const) {
      const respuesta = await pedir(method, url, tenantB);
      assert.equal(respuesta.statusCode, 404, `${method} ${url}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'automatizacion-no-encontrada' });
    }
    assert.equal((await prisma.automatizacion.findUniqueOrThrow({ where: { id: deA } })).activo, true);
    for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
      assert.equal(app.hasRoute({ method, url: '/automatizaciones/:id' }), false);
    }
    assert.equal(app.hasRoute({ method: 'POST', url: '/automatizaciones/:id/activar' }), false);
  });

  test("5.1 an automation's runs are listed newest first, even deactivated; a foreign id is 404", async () => {
    const id = (await crear(cuerpo())).json().automatizacion.id as string;
    // Run rows are the scheduler's to write; here they are written directly, oldest first.
    const iniciadas = ['2021-03-01T10:00:00Z', '2021-03-02T10:00:00Z', '2021-03-03T10:00:00Z'];
    for (const [i, iniciada] of iniciadas.entries()) {
      await prisma.ejecucion.create({
        data: {
          tenantId: tenantA,
          automatizacionId: id,
          estado: i === 1 ? 'fallo' : 'ok',
          iniciadaEn: new Date(iniciada),
          finalizadaEn: new Date(new Date(iniciada).getTime() + 250),
          duracionMs: 250,
          filas: i === 1 ? null : 3,
          fase: i === 1 ? 'conexion' : 'ejecucion',
          error: i === 1 ? 'conexion' : null,
        },
      });
    }
    assert.equal((await pedir('POST', `/automatizaciones/${id}/desactivar`)).statusCode, 200);

    const propia = await pedir('GET', `/automatizaciones/${id}/ejecuciones`);
    assert.equal(propia.statusCode, 200, propia.body);
    const { ejecuciones, truncado } = propia.json();
    assert.equal(truncado, false);
    assert.deepEqual(
      ejecuciones.map((e: { iniciadaEn: string }) => e.iniciadaEn),
      iniciadas.map((i) => new Date(i).toISOString()).reverse(),
    );
    assert.deepEqual(
      { ...ejecuciones[1], id: undefined },
      {
        id: undefined,
        estado: 'fallo',
        iniciadaEn: '2021-03-02T10:00:00.000Z',
        finalizadaEn: '2021-03-02T10:00:00.250Z',
        duracionMs: 250,
        filas: null,
        corte: null,
        fase: 'conexion',
        error: 'conexion',
        codigoError: null,
      },
    );

    for (const url of [`/automatizaciones/${id}/ejecuciones`, '/automatizaciones/no-existe/ejecuciones']) {
      const ajena = await pedir('GET', url, tenantB);
      assert.equal(ajena.statusCode, 404, `${url}: ${ajena.body}`);
      assert.deepEqual(ajena.json(), { error: 'automatizacion-no-encontrada' });
    }
  });
});
