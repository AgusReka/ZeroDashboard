import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { ErrorSinTenantActivo } from './contexto-tenant.js';
import { cifrarCredencial } from './cripto-credencial.js';
import { crearPlanificador, type Reloj } from './planificador.js';

/**
 * CH-13 unit 4a: one scheduler tick against a live PostgreSQL (tasks 4.1–4.4), skipped
 * when none is reachable. Time is a fake `Reloj`, and every fixture automation was
 * "created" in 2020, so the 2021 windows below contain its fires while every automation
 * another test file creates (with a real `creadaEn`) is never due in them.
 *
 * No connection here can ever be dialled successfully: each points at `127.0.0.1:1`, so a
 * run that reached the driver closes as a `conexion` failure, which is how these tests
 * tell "ran the whole pipeline" apart from "stopped before dialling".
 */

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

// A run reads the row ceiling through `loadConfig()`, as the template test route does.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

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

/** A clock that never moves on its own and never schedules anything. */
function relojFijo(ahora: Date): Reloj {
  return {
    ahora: () => ahora,
    programar: () => {
      throw new Error('ejecutarTick no programa temporizadores');
    },
  };
}

const EN = (hhmmss: string) => new Date(`2021-03-01T${hhmmss}Z`);

describe('scheduler tick — due check, tenant context, gate (CH-13 4.1–4.4)', { skip: motivoSkip }, () => {
  /** The raw client: fixtures and cleanup only. The scheduler gets the extended one. */
  let prisma!: PrismaClient;
  let aislado!: PrismaAislado;
  const marca = `CH-13 u4 ${Date.now()}`;
  const tenants: string[] = [];
  let conVista!: string;
  let sinVista!: string;

  async function tenant(activo = true): Promise<string> {
    const id = (await prisma.tenant.create({ data: { nombre: `${marca} ${tenants.length}`, activo } })).id;
    tenants.push(id);
    return id;
  }

  /** A connection on a closed port, with a legible credential and an approved `producto` view. */
  async function conexion(tenantId: string): Promise<string> {
    const { id } = await prisma.conexion.create({
      data: {
        tenantId,
        nombre: `${marca} conexion`,
        motor: 'postgres',
        host: '127.0.0.1',
        puerto: 1,
        baseDeDatos: 'nadie',
        usuarioDb: 'nadie',
        credencial: cifrarCredencial('nunca-se-usa'),
      },
    });
    await prisma.vistaCanonica.create({
      data: { tenantId, conexionId: id, entidad: 'producto', sql: 'SELECT 1 AS id', estadoValidacion: 'valida' },
    });
    return id;
  }

  async function automatizacion(tenantId: string, opciones: { activo?: boolean; vista?: boolean } = {}) {
    const conexionId = await conexion(tenantId);
    const fila = await prisma.automatizacion.create({
      data: {
        tenantId,
        plantillaId: opciones.vista === false ? sinVista : conVista,
        conexionId,
        cron: '* * * * *',
        activo: opciones.activo ?? true,
        creadaEn: new Date('2020-01-01T00:00:00Z'),
      },
    });
    return fila.id;
  }

  function ejecuciones(automatizacionId: string) {
    return prisma.ejecucion.findMany({ where: { automatizacionId }, orderBy: { iniciadaEn: 'asc' } });
  }

  /** One tick over `(desde, hasta]`, the window a scheduler created at `desde` evaluates. */
  async function tick(desde: Date, hasta: Date): Promise<void> {
    const planificador = crearPlanificador({
      prisma: aislado,
      zonaHoraria: 'UTC',
      log: Fastify({ logger: false }).log,
      reloj: relojFijo(desde),
    });
    await planificador.ejecutarTick(hasta);
  }

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    aislado = extenderConAislamiento(prisma);
    const plantilla = (sql: string, entidades: string[]) =>
      prisma.plantilla.create({
        data: {
          nombre: `${marca} ${entidades.join('-')}`,
          sql,
          parametros: [],
          entidades,
          automatizacion: 'stock-fisico',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      });
    conVista = (await plantilla('SELECT * FROM v_producto', ['producto'])).id;
    // `insumo` never has a view on any fixture connection: the DEC-71 gate refuses it.
    sinVista = (await plantilla('SELECT * FROM v_producto JOIN v_insumo USING (id)', ['producto', 'insumo'])).id;
  });

  after(async () => {
    for (const tenantId of tenants) {
      await prisma.ejecucion.deleteMany({ where: { tenantId } });
      await prisma.automatizacion.deleteMany({ where: { tenantId } });
      await prisma.vistaCanonica.deleteMany({ where: { tenantId } });
      await prisma.conexion.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
  });

  test('4.1 a due active automation runs exactly once per tick, whatever the fires in its window', async () => {
    const id = await automatizacion(await tenant());

    // Five fires inside the window, one run: catch-up belongs to CH-17.
    await tick(EN('10:00:30'), EN('10:05:30'));
    let filas = await ejecuciones(id);
    assert.equal(filas.length, 1);
    // It reached the driver: the closed port is the only thing that stopped it.
    assert.equal(filas[0].estado, 'fallo');
    assert.equal(filas[0].fase, 'conexion');

    // No fire inside `(10:05:30, 10:05:50]`: nothing runs.
    await tick(EN('10:05:30'), EN('10:05:50'));
    filas = await ejecuciones(id);
    assert.equal(filas.length, 1);
  });

  test('4.2 a deactivated tenant or a deactivated automation never runs', async () => {
    const deTenantInactivo = await automatizacion(await tenant(false));
    const inactiva = await automatizacion(await tenant(), { activo: false });

    await tick(EN('11:00:30'), EN('11:01:30'));

    assert.equal((await ejecuciones(deTenantInactivo)).length, 0);
    assert.equal((await ejecuciones(inactiva)).length, 0);
  });

  test('4.3 an entity with no passing validation blocks the run before any dial, naming the entity', async () => {
    const id = await automatizacion(await tenant(), { vista: false });

    await tick(EN('12:00:30'), EN('12:01:30'));

    const filas = await ejecuciones(id);
    assert.equal(filas.length, 1);
    // `preparacion`, not `conexion`: the closed port was never reached.
    assert.equal(filas[0].estado, 'fallo');
    assert.equal(filas[0].fase, 'preparacion');
    assert.equal(filas[0].error, 'vista-canonica-no-aprobada');
    assert.equal(filas[0].codigoError, 'insumo');
  });

  test("4.4 each run happens in its own tenant's context; a scoped query outside any context throws", async () => {
    const tenantA = await tenant();
    const tenantB = await tenant();
    const deA = await automatizacion(tenantA);
    const deB = await automatizacion(tenantB);

    await tick(EN('13:00:30'), EN('13:01:30'));

    // Each run's row belongs to its automation's owner, written through the scoped
    // client with no `tenantId` supplied by the scheduler.
    for (const [automatizacionId, duenio] of [[deA, tenantA], [deB, tenantB]]) {
      const filas = await ejecuciones(automatizacionId);
      assert.equal(filas.length, 1);
      assert.equal(filas[0].tenantId, duenio);
    }

    await assert.rejects(aislado.ejecucion.findMany(), ErrorSinTenantActivo);
    await assert.rejects(aislado.automatizacion.findMany({ where: { activo: true } }), ErrorSinTenantActivo);
  });
});
