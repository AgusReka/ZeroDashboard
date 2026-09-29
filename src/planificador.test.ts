import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { ErrorSinTenantActivo } from './contexto-tenant.js';
import { cifrarCredencial } from './cripto-credencial.js';
import { crearPlanificador, type Reloj } from './planificador.js';

/**
 * CH-13 units 4a and 4b: scheduler ticks against a live PostgreSQL (tasks 4.1–4.6), skipped
 * when none is reachable, and the timer's start and stop over a fake client (task 4.7). Time is a fake `Reloj`, and every fixture automation was
 * "created" in 2020, so the 2021 windows below contain its fires while every automation
 * another test file creates (with a real `creadaEn`) is never due in them.
 *
 * Unless a test asks for the read-only role below, a fixture connection points at
 * `127.0.0.1:1`, so a run that reached the driver closes as a `conexion` failure, which is
 * how these tests tell "ran the whole pipeline" apart from "stopped before dialling".
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

/** A clock that moves `pasoMs` forward on every read, so a run has a real duration. */
function relojQueAvanza(desde: Date, pasoMs: number): Reloj {
  let t = desde.getTime();
  return {
    ahora: () => {
      const actual = new Date(t);
      t += pasoMs;
      return actual;
    },
    programar: () => {
      throw new Error('ejecutarTick no programa temporizadores');
    },
  };
}

const EN = (hhmmss: string) => new Date(`2021-03-01T${hhmmss}Z`);

/** A plain login role: no table grant, no schema CREATE, so DEC-08 lets a run read with it. */
const ROL_LECTOR = 'ch13_lector';
const CLAVE_LECTOR = 'ch13-clave-lector';

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

/**
 * Every column an `Ejecucion` row has: metadata only, no place for the rows a run read.
 * CH-14 adds `notificacion` (DEC-83), which holds an outcome label, never a body or row.
 */
const COLUMNAS_EJECUCION = [
  'automatizacionId', 'codigoError', 'corte', 'duracionMs', 'error', 'estado',
  'fase', 'filas', 'finalizadaEn', 'id', 'iniciadaEn', 'notificacion', 'tenantId',
];

describe('scheduler tick — due check, tenant context, gate, run log (CH-13 4.1–4.6)', { skip: motivoSkip }, () => {
  /** The raw client: fixtures and cleanup only. The scheduler gets the extended one. */
  let prisma!: PrismaClient;
  let aislado!: PrismaAislado;
  let admin!: pg.Client;
  const marca = `CH-13 u4 ${Date.now()}`;
  const tenants: string[] = [];
  let conVista!: string;
  let sinVista!: string;
  let corrupta!: string;

  async function tenant(activo = true): Promise<string> {
    const id = (await prisma.tenant.create({ data: { nombre: `${marca} ${tenants.length}`, activo } })).id;
    tenants.push(id);
    return id;
  }

  /**
   * A connection with a legible credential and an approved `producto` view: on a closed
   * port, or, with `lector`, on the live server as the read-only role.
   */
  async function conexion(tenantId: string, lector = false): Promise<string> {
    const destino = lector
      ? { host: objetivo.host, puerto: objetivo.port, baseDeDatos: objetivo.database, usuarioDb: ROL_LECTOR }
      : { host: '127.0.0.1', puerto: 1, baseDeDatos: 'nadie', usuarioDb: 'nadie' };
    const { id } = await prisma.conexion.create({
      data: {
        tenantId,
        nombre: `${marca} conexion`,
        motor: 'postgres',
        ...destino,
        credencial: cifrarCredencial(lector ? CLAVE_LECTOR : 'nunca-se-usa'),
      },
    });
    await prisma.vistaCanonica.create({
      data: { tenantId, conexionId: id, entidad: 'producto', sql: 'SELECT 1 AS id', estadoValidacion: 'valida' },
    });
    return id;
  }

  interface OpcionesAutomatizacion {
    activo?: boolean;
    vista?: boolean;
    plantillaId?: string;
    cron?: string;
    lector?: boolean;
    creadaEn?: string;
  }

  async function automatizacion(tenantId: string, opciones: OpcionesAutomatizacion = {}) {
    const conexionId = await conexion(tenantId, opciones.lector);
    const fila = await prisma.automatizacion.create({
      data: {
        tenantId,
        plantillaId: opciones.plantillaId ?? (opciones.vista === false ? sinVista : conVista),
        conexionId,
        cron: opciones.cron ?? '* * * * *',
        activo: opciones.activo ?? true,
        creadaEn: new Date(opciones.creadaEn ?? '2020-01-01T00:00:00Z'),
      },
    });
    return fila.id;
  }

  function ejecuciones(automatizacionId: string) {
    return prisma.ejecucion.findMany({ where: { automatizacionId }, orderBy: { iniciadaEn: 'asc' } });
  }

  /** One tick over `(desde, hasta]`, the window a scheduler created at `desde` evaluates. */
  async function tick(desde: Date, hasta: Date, reloj: Reloj = relojFijo(desde)): Promise<void> {
    const planificador = crearPlanificador({
      prisma: aislado,
      zonaHoraria: 'UTC',
      log: Fastify({ logger: false }).log,
      reloj,
    });
    await planificador.ejecutarTick(hasta);
  }

  before(async () => {
    admin = new pg.Client({ ...objetivo });
    await admin.connect();
    await admin.query(SQL_LIMPIEZA);
    await admin.query(`CREATE ROLE ${ROL_LECTOR} LOGIN PASSWORD '${CLAVE_LECTOR}'`);
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
    // Stored entities outside the contract: the run throws inside the pipeline, which no
    // step classifies, so it can only close as `error-interno`.
    corrupta = (await plantilla('SELECT * FROM v_producto', ['producto', 'no-existe'])).id;
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
    await admin.query(SQL_LIMPIEZA);
    await admin.end();
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

  test('4.5 an unexpected throw closes its run as error-interno and the siblings still run', async () => {
    const tenantId = await tenant();
    // Created in this order, so they run in this order: the two throws come first.
    const cronCorrupto = await automatizacion(tenantId, { cron: 'no es cron', creadaEn: '2020-01-01T00:00:00Z' });
    const plantillaCorrupta = await automatizacion(tenantId, {
      plantillaId: corrupta,
      creadaEn: '2020-01-02T00:00:00Z',
    });
    const hermana = await automatizacion(tenantId, { creadaEn: '2020-01-03T00:00:00Z' });

    await tick(EN('14:00:30'), EN('14:01:30'));

    for (const id of [cronCorrupto, plantillaCorrupta]) {
      const filas = await ejecuciones(id);
      assert.equal(filas.length, 1, id);
      assert.equal(filas[0].estado, 'fallo');
      assert.equal(filas[0].fase, null);
      assert.equal(filas[0].error, 'error-interno');
      assert.equal(filas[0].codigoError, null);
      assert.ok(filas[0].finalizadaEn !== null, 'the row is closed, not left en-curso');
    }
    // The sibling ran its whole pipeline, up to the closed port.
    const filas = await ejecuciones(hermana);
    assert.equal(filas.length, 1);
    assert.equal(filas[0].estado, 'fallo');
    assert.equal(filas[0].fase, 'conexion');
  });

  test('4.6 every outcome writes exactly one closed Ejecucion with metadata and closed categories only', async () => {
    const tenantId = await tenant();
    const exito = await automatizacion(tenantId, { lector: true, creadaEn: '2020-01-01T00:00:00Z' });
    const compuerta = await automatizacion(tenantId, { vista: false, creadaEn: '2020-01-02T00:00:00Z' });
    const fallo = await automatizacion(tenantId, { creadaEn: '2020-01-03T00:00:00Z' });
    const excepcion = await automatizacion(tenantId, { plantillaId: corrupta, creadaEn: '2020-01-04T00:00:00Z' });

    await tick(EN('15:00:30'), EN('15:01:30'), relojQueAvanza(EN('15:00:30'), 250));

    const esperado: [string, Record<string, unknown>][] = [
      [exito, { estado: 'ok', fase: 'ejecucion', filas: 1, error: null, codigoError: null }],
      [compuerta, { estado: 'fallo', fase: 'preparacion', filas: null, error: 'vista-canonica-no-aprobada' }],
      [fallo, { estado: 'fallo', fase: 'conexion', filas: null }],
      [excepcion, { estado: 'fallo', fase: null, filas: null, error: 'error-interno', codigoError: null }],
    ];
    for (const [id, campos] of esperado) {
      const filas = await ejecuciones(id);
      assert.equal(filas.length, 1, id);
      const [fila] = filas;
      assert.deepEqual(Object.keys(fila).sort(), COLUMNAS_EJECUCION);
      for (const [columna, valor] of Object.entries(campos)) {
        assert.deepEqual(fila[columna as keyof typeof fila], valor, `${id} ${columna}`);
      }
      // Start and end from the injected clock, and a duration that agrees with them.
      assert.ok(fila.finalizadaEn !== null && fila.duracionMs !== null);
      assert.ok(fila.iniciadaEn.getTime() > EN('15:00:30').getTime());
      assert.ok(fila.duracionMs > 0);
      assert.equal(fila.duracionMs, fila.finalizadaEn.getTime() - fila.iniciadaEn.getTime());
      // A failure keeps a closed category and a publishable code: never driver text.
      if (fila.estado === 'fallo') {
        assert.match(fila.error ?? '', /^[a-z]+(-[a-z]+)*$/);
        assert.match(fila.codigoError ?? 'NULO', /^[A-Za-z0-9_,]+$/);
      }
    }
  });
});

describe('scheduler timer: start and stop (CH-13 4.7)', () => {
  /** A client whose only query, the tenant list, answers when the test says so. */
  function clienteControlado() {
    let responder!: (filas: { id: string; nombre: string }[]) => void;
    let fallar!: (error: Error) => void;
    const prisma = {
      tenant: {
        findMany: () =>
          new Promise<{ id: string; nombre: string }[]>((resolve, reject) => {
            responder = resolve;
            fallar = reject;
          }),
      },
    } as unknown as PrismaAislado;
    return { prisma, responder: () => responder([]), fallar: (error: Error) => fallar(error) };
  }

  /** A fake clock at 10:00:30.250 that records every timer instead of arming it. */
  function relojManual() {
    const temporizadores: { ms: number; disparar: () => void; cancelado: boolean }[] = [];
    const reloj: Reloj = {
      ahora: () => new Date('2021-03-01T10:00:30.250Z'),
      programar: (ms, disparar) => {
        const temporizador = { ms, disparar, cancelado: false };
        temporizadores.push(temporizador);
        return () => {
          temporizador.cancelado = true;
        };
      },
    };
    return { reloj, temporizadores };
  }

  const vuelta = () => new Promise<void>((resolve) => setImmediate(resolve));

  function planificador(prisma: PrismaAislado, reloj: Reloj) {
    return crearPlanificador({ prisma, zonaHoraria: 'UTC', log: Fastify({ logger: false }).log, reloj });
  }

  test('4.7 iniciar aligns the timer to the next whole minute plus one second', () => {
    const { reloj, temporizadores } = relojManual();
    planificador(clienteControlado().prisma, reloj).iniciar();
    // From 10:00:30.250 to 10:01:01.000.
    assert.deepEqual(temporizadores.map((t) => t.ms), [30_750]);
  });

  test('4.7 detener clears the pending timer, and nothing is armed after it', async () => {
    const { reloj, temporizadores } = relojManual();
    const p = planificador(clienteControlado().prisma, reloj);
    p.iniciar();
    await p.detener();
    assert.equal(temporizadores[0].cancelado, true);
    p.iniciar();
    assert.equal(temporizadores.length, 1);
  });

  test('4.7 detener awaits the in-flight tick before resolving and arms nothing after it', async () => {
    const { reloj, temporizadores } = relojManual();
    const cliente = clienteControlado();
    const p = planificador(cliente.prisma, reloj);
    p.iniciar();
    temporizadores[0].disparar();

    let detenido = false;
    const deteniendo = p.detener().then(() => {
      detenido = true;
    });
    await vuelta();
    assert.equal(detenido, false, 'the tick is still reading tenants');

    cliente.responder();
    await deteniendo;
    assert.equal(detenido, true);
    assert.equal(temporizadores.length, 1, 'no timer is armed once stopped');
  });

  test('4.7 a tick that throws is logged and the next minute is still armed', async () => {
    const { reloj, temporizadores } = relojManual();
    const cliente = clienteControlado();
    const p = planificador(cliente.prisma, reloj);
    p.iniciar();
    temporizadores[0].disparar();
    cliente.fallar(new Error('base caida'));
    await vuelta();
    await vuelta();
    assert.equal(temporizadores.length, 2);
    assert.equal(temporizadores[1].cancelado, false);
    await p.detener();
    assert.equal(temporizadores[1].cancelado, true);
  });
});
