import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { ErrorSinTenantActivo, tenantActivoOpcional } from './contexto-tenant.js';
import { cifrarCredencial } from './cripto-credencial.js';
import type { ResultadoEnvio } from './automatizaciones.js';
import type { Correo } from './correo.js';
import { notificadorDesdeTransporte, type Notificador } from './notificador.js';
import { crearPlanificador, type PoliticaReintentos, type Reloj } from './planificador.js';

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

/** A silent logger, or, with `lineas`, one that keeps every JSON line pino writes. */
function registro(lineas?: string[]) {
  return lineas
    ? Fastify({ logger: { stream: { write: (linea: string) => void lineas.push(linea) } } }).log
    : Fastify({ logger: false }).log;
}

/**
 * CH-14: a fake notifier that keeps every message and answers with `respuesta`. Ticks also
 * run the automations earlier tests left due, so each test reads only its own recipient's
 * messages through `a(para)`.
 */
function notificadorFalso(respuesta: (c: Correo) => Promise<ResultadoEnvio> = async () => ({ resultado: 'enviada' })) {
  const enviados: Correo[] = [];
  const notificador: Notificador = {
    enviar: (correo) => {
      enviados.push(correo);
      return respuesta(correo);
    },
  };
  return { notificador, a: (para: string) => enviados.filter((c) => c.para === para) };
}

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
 * CH-17b adds `intentos` (DEC-103), a count of connection attempts.
 */
const COLUMNAS_EJECUCION = [
  'automatizacionId', 'codigoError', 'corte', 'duracionMs', 'error', 'estado',
  'fase', 'filas', 'finalizadaEn', 'id', 'iniciadaEn', 'intentos', 'notificacion', 'tenantId',
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
   * port, or, with `lector`, on the live server as the read-only role. CH-17b: with
   * `puerto`, the role dials `127.0.0.1:puerto` instead, where a test may start a listener;
   * `clave` replaces the role's password.
   */
  async function conexion(
    tenantId: string,
    lector = false,
    vistaSql = 'SELECT 1 AS id',
    { puerto, clave = CLAVE_LECTOR }: { puerto?: number; clave?: string } = {},
  ): Promise<string> {
    const destino = lector
      ? {
          host: puerto === undefined ? objetivo.host : '127.0.0.1',
          puerto: puerto ?? objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: ROL_LECTOR,
        }
      : { host: '127.0.0.1', puerto: 1, baseDeDatos: 'nadie', usuarioDb: 'nadie' };
    const { id } = await prisma.conexion.create({
      data: {
        tenantId,
        nombre: `${marca} conexion`,
        motor: 'postgres',
        ...destino,
        credencial: cifrarCredencial(lector ? clave : 'nunca-se-usa'),
      },
    });
    await prisma.vistaCanonica.create({
      data: { tenantId, conexionId: id, entidad: 'producto', sql: vistaSql, estadoValidacion: 'valida' },
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
    /** CH-14: the `producto` view's body, so a run can return 0 rows or a marker cell. */
    vistaSql?: string;
    destinatario?: string;
    /** CH-17b: see `conexion`. */
    puerto?: number;
    clave?: string;
  }

  async function automatizacion(tenantId: string, opciones: OpcionesAutomatizacion = {}) {
    const conexionId = await conexion(tenantId, opciones.lector, opciones.vistaSql, {
      puerto: opciones.puerto,
      clave: opciones.clave,
    });
    const fila = await prisma.automatizacion.create({
      data: {
        tenantId,
        plantillaId: opciones.plantillaId ?? (opciones.vista === false ? sinVista : conVista),
        conexionId,
        cron: opciones.cron ?? '* * * * *',
        activo: opciones.activo ?? true,
        creadaEn: new Date(opciones.creadaEn ?? '2020-01-01T00:00:00Z'),
        destinatario: opciones.destinatario ?? null,
      },
    });
    return fila.id;
  }

  /** The named columns of a run's row, so one `deepEqual` states the whole outcome. */
  function columnas(fila: Record<string, unknown>, ...nombres: string[]): Record<string, unknown> {
    return Object.fromEntries(nombres.map((nombre) => [nombre, fila[nombre]]));
  }

  function ejecuciones(automatizacionId: string) {
    return prisma.ejecucion.findMany({ where: { automatizacionId }, orderBy: { iniciadaEn: 'asc' } });
  }

  /** One tick over `(desde, hasta]`, the window a scheduler created at `desde` evaluates. */
  async function tick(
    desde: Date,
    hasta: Date,
    reloj: Reloj = relojFijo(desde),
    extra: { notificador?: Notificador | null; lineas?: string[] } = {},
  ): Promise<void> {
    const { notificador, lineas } = extra;
    // With `lineas`, every log line is kept as the JSON pino writes, to inspect what leaks.
    const log = lineas
      ? Fastify({ logger: { stream: { write: (linea: string) => void lineas.push(linea) } } }).log
      : Fastify({ logger: false }).log;
    const planificador = crearPlanificador({
      prisma: aislado,
      zonaHoraria: 'UTC',
      log,
      reloj,
      ...(notificador === undefined ? {} : { notificador }),
    });
    await planificador.ejecutarTick(hasta);
  }

  /** CH-18: hooks on each tenant's automation listing, the first query a tick runs in it. */
  interface OpcionesBarrido {
    /**
     * `automatizacion.findMany` throws in this tenant's context. Read on every listing, so a
     * test can heal the tenant between two ticks.
     */
    fallaListadoEn?: string;
    /** Awaited before each listing, so a test can hold one tenant's first query. */
    antesDeListar?: (tenantId: string | undefined) => Promise<void>;
    /** CH-18 (DEC-108): the marker write (`notificacion: 'enviando'`) throws instead. */
    fallaMarca?: boolean;
  }

  /**
   * CH-17a: the client a sweep test hands the planner. `tenant.findMany` is narrowed to
   * `propios`, because node:test runs files in parallel and a real sweep would close every
   * other file's `en-curso` rows. Each `ejecucion.updateMany` records the tenant context it
   * ran in, the `notificacion` it writes, and its count; the one in `fallaEn`'s context
   * throws instead.
   *
   * CH-18: each `automatizacion.findMany` records the tenant context it was called in, in
   * call order, in `listados`; see `OpcionesBarrido` for the failure and the hold. Each
   * `ejecucion.update` that writes the marker records the row id in `marcas`, attempted
   * writes included.
   */
  function clienteDeBarrido(propios: string[], fallaEn?: string, opciones: OpcionesBarrido = {}) {
    const llamadas: { tenantId: string | undefined; notificacion: unknown; cerradas: number }[] = [];
    const listados: (string | undefined)[] = [];
    const marcas: string[] = [];
    const automatizacion = new Proxy(aislado.automatizacion, {
      get: (destino, prop) =>
        prop === 'findMany'
          ? async (args: Parameters<typeof aislado.automatizacion.findMany>[0]) => {
              const tenantId = tenantActivoOpcional()?.id;
              listados.push(tenantId);
              await opciones.antesDeListar?.(tenantId);
              if (opciones.fallaListadoEn !== undefined && tenantId === opciones.fallaListadoEn) {
                throw new Error('base caida secreta');
              }
              return aislado.automatizacion.findMany(args);
            }
          : Reflect.get(destino, prop),
    });
    const ejecucion = new Proxy(aislado.ejecucion, {
      get: (destino, prop) =>
        prop === 'updateMany'
          ? async (args: Parameters<typeof aislado.ejecucion.updateMany>[0]) => {
              const tenantId = tenantActivoOpcional()?.id;
              if (fallaEn !== undefined && tenantId === fallaEn) throw new Error('base caida secreta');
              const { count } = await aislado.ejecucion.updateMany(args);
              llamadas.push({ tenantId, notificacion: args.data.notificacion, cerradas: count });
              return { count };
            }
          : prop === 'update'
            ? async (args: Parameters<typeof aislado.ejecucion.update>[0]) => {
                if (args.data.notificacion === 'enviando') {
                  marcas.push(String(args.where.id));
                  if (opciones.fallaMarca) throw new Error('base caida secreta');
                }
                return aislado.ejecucion.update(args);
              }
            : Reflect.get(destino, prop),
    });
    const tenantNarrowed = {
      findMany: (args: Parameters<typeof aislado.tenant.findMany>[0] = {}) =>
        aislado.tenant.findMany({ ...args, where: { AND: [args.where ?? {}, { id: { in: propios } }] } }),
    };
    const cliente = new Proxy(aislado, {
      get: (destino, prop) =>
        prop === 'tenant'
          ? tenantNarrowed
          : prop === 'ejecucion'
            ? ejecucion
            : prop === 'automatizacion'
              ? automatizacion
              : Reflect.get(destino, prop),
    });
    return { cliente, llamadas, listados, marcas };
  }

  /** CH-18: two new tenants, in the order a tick visits them (by id, as the database sorts). */
  async function dosTenantsEnOrden(): Promise<[string, string]> {
    const creados = [await tenant(), await tenant()];
    const [primero, segundo] = await prisma.tenant.findMany({
      where: { id: { in: creados } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return [primero.id, segundo.id];
  }

  /** A row a previous process left `en-curso`. */
  function atascada(tenantId: string, automatizacionId: string, iniciadaEn = EN('08:00:00')) {
    return prisma.ejecucion.create({ data: { tenantId, automatizacionId, estado: 'en-curso', iniciadaEn } });
  }

  /** CH-17b: the deployment default (DEC-98): three attempts in total, 5000 ms apart. */
  const TRES_INTENTOS: PoliticaReintentos = { intentos: 3, pausaMs: 5_000 };

  /**
   * CH-17b: a fixed clock that records the milliseconds of every timer the planner asks
   * for. `alPausar` gets the timer's 1-based number and decides when it fires; by default
   * on the next turn, so a retry loop runs to its end. Nothing in these tests cancels.
   */
  function relojDePausas(
    ahora: Date,
    alPausar: (n: number, disparar: () => void) => void = (_, disparar) => void setImmediate(disparar),
  ) {
    const pausas: number[] = [];
    const reloj: Reloj = {
      ahora: () => ahora,
      programar: (ms, disparar) => {
        pausas.push(ms);
        alPausar(pausas.length, disparar);
        return () => {};
      },
    };
    return { reloj, pausas };
  }

  /**
   * CH-17b: one tick over `propios` tenants only, so the due automations of earlier tests
   * and other files never dial, pause, or consume the fake clock's timers.
   */
  async function tickDe(
    propios: string[],
    hasta: Date,
    reloj: Reloj,
    reintentos?: PoliticaReintentos,
    extra: { notificador?: Notificador; lineas?: string[] } = {},
  ): Promise<void> {
    await crearPlanificador({
      prisma: clienteDeBarrido(propios).cliente,
      zonaHoraria: 'UTC',
      log: registro(extra.lineas),
      reloj,
      ...(reintentos === undefined ? {} : { reintentos }),
      ...(extra.notificador === undefined ? {} : { notificador: extra.notificador }),
    }).ejecutarTick(hasta);
  }

  /** CH-17b: a local port nothing listens on right now, so a dial to it is refused. */
  async function puertoLibre(): Promise<number> {
    const servidor = net.createServer();
    await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    const { port } = servidor.address() as net.AddressInfo;
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    return port;
  }

  /**
   * CH-17b: a listener on `puerto` that either forwards every socket to the live server, so
   * a dial there connects, or accepts it and never answers, so a dial there runs out of
   * time. Returns the function that closes it and every socket it holds.
   */
  async function escuchar(puerto: number, modo: 'reenviar' | 'callar'): Promise<() => Promise<void>> {
    const sockets = new Set<net.Socket>();
    const servidor = net.createServer((entrante) => {
      sockets.add(entrante);
      entrante.on('error', () => {});
      if (modo === 'reenviar') {
        const saliente = net.connect({ host: objetivo.host, port: objetivo.port });
        sockets.add(saliente);
        saliente.on('error', () => entrante.destroy());
        entrante.pipe(saliente).pipe(entrante);
      }
    });
    await new Promise<void>((resolve) => servidor.listen(puerto, '127.0.0.1', resolve));
    return async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => servidor.close(() => resolve()));
    };
  }

  /** CH-17b: waits until `listo()` holds, for a run that is parked in a pause. */
  async function esperarA(listo: () => boolean): Promise<void> {
    for (let vuelta = 0; !listo(); vuelta++) {
      if (vuelta === 500) throw new Error('esperarA: the condition never held');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /** CH-17b: sets one environment variable for the length of `cuerpo`, then restores it. */
  async function conVariable(nombre: string, valor: string, cuerpo: () => Promise<void>): Promise<void> {
    const previo = process.env[nombre];
    process.env[nombre] = valor;
    try {
      await cuerpo();
    } finally {
      if (previo === undefined) delete process.env[nombre];
      else process.env[nombre] = previo;
    }
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

    // Five fires inside the window, one run: no catch-up (DEC-95, a limit of the artifact).
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

  test('CH-24 a tenant whose declared window exceeds the template tolerance runs exactly like any other (DEC-142)', async () => {
    // The template tolerates 30 minutes; the first tenant declares 1000, the second nothing.
    const desactualizado = await tenant();
    await prisma.tenant.update({ where: { id: desactualizado }, data: { ventanaDesactualizacionMinutos: 1000 } });
    const idDesactualizado = await automatizacion(desactualizado);
    const idSinDeclarar = await automatizacion(await tenant());

    await tick(EN('12:00:30'), EN('12:01:30'));

    const [conVentana] = await ejecuciones(idDesactualizado);
    const [sinVentana] = await ejecuciones(idSinDeclarar);
    assert.ok(conVentana !== undefined && sinVentana !== undefined, 'both runs happened');
    // Not rejected, not delayed: it reached the driver and failed on the closed port as the control did.
    assert.deepEqual(
      columnas(conVentana, 'estado', 'fase', 'codigoError', 'error'),
      columnas(sinVentana, 'estado', 'fase', 'codigoError', 'error'),
    );
    assert.equal(conVentana.fase, 'conexion');
    assert.equal((await ejecuciones(idDesactualizado)).length, 1);
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

  test('CH-14 5.1 a run with 0 rows never calls the notifier; a run with rows calls it once with its own recipient', async () => {
    const tenantId = await tenant();
    const vacia = await automatizacion(tenantId, {
      lector: true,
      vistaSql: 'SELECT 1 AS id WHERE false',
      destinatario: 'ch14-51-vacia@example.com',
      creadaEn: '2020-01-01T00:00:00Z',
    });
    const conFilas = await automatizacion(tenantId, {
      lector: true,
      destinatario: 'ch14-51@example.com',
      creadaEn: '2020-01-02T00:00:00Z',
    });
    const falso = notificadorFalso();

    await tick(EN('16:00:30'), EN('16:01:30'), undefined, { notificador: falso.notificador });

    assert.equal(falso.a('ch14-51-vacia@example.com').length, 0);
    const [vaciaFila] = await ejecuciones(vacia);
    assert.deepEqual(
      columnas(vaciaFila, 'estado', 'fase', 'filas', 'notificacion'),
      { estado: 'ok', fase: 'ejecucion', filas: 0, notificacion: 'omitida-sin-filas' },
    );
    const enviados = falso.a('ch14-51@example.com');
    assert.equal(enviados.length, 1);
    // The template's own name and the run's row count reach the subject.
    assert.ok(enviados[0].asunto.endsWith(`${marca} producto (1)`), enviados[0].asunto);
    const filas = await ejecuciones(conFilas);
    assert.equal(filas.length, 1);
    assert.deepEqual(
      columnas(filas[0], 'estado', 'fase', 'filas', 'notificacion'),
      { estado: 'ok', fase: 'ejecucion', filas: 1, notificacion: 'enviada' },
    );
  });

  test('CH-14 5.2 no recipient records sin-destinatario; an absent or null notifier records no-configurada', async () => {
    const sinDestinatario = await automatizacion(await tenant(), { lector: true });
    const conDestinatario = await automatizacion(await tenant(), { lector: true, destinatario: 'ch14-52@example.com' });
    const falso = notificadorFalso();

    await tick(EN('17:00:30'), EN('17:01:30'), undefined, { notificador: falso.notificador });
    // SMTP unset: first no notifier injected at all, then an explicit `null`.
    await tick(EN('17:01:30'), EN('17:02:30'));
    await tick(EN('17:02:30'), EN('17:03:30'), undefined, { notificador: null });

    const resultados = async (id: string) => (await ejecuciones(id)).map((f) => [f.estado, f.notificacion]);
    // A missing recipient wins over an unset SMTP: the operator can fix it on the automation.
    assert.deepEqual(await resultados(sinDestinatario), [
      ['ok', 'sin-destinatario'],
      ['ok', 'sin-destinatario'],
      ['ok', 'sin-destinatario'],
    ]);
    assert.deepEqual(await resultados(conDestinatario), [
      ['ok', 'enviada'],
      ['ok', 'no-configurada'],
      ['ok', 'no-configurada'],
    ]);
    assert.equal(falso.a('ch14-52@example.com').length, 1);
  });

  test('CH-14 5.3 a query failure or a gate refusal records notificacion null and never calls the notifier', async () => {
    const tenantId = await tenant();
    const fallo = await automatizacion(tenantId, { destinatario: 'ch14-53-fallo@example.com' });
    const rechazo = await automatizacion(tenantId, { vista: false, destinatario: 'ch14-53-rechazo@example.com' });
    const falso = notificadorFalso();

    await tick(EN('18:00:30'), EN('18:01:30'), undefined, { notificador: falso.notificador });

    const casos: [string, string, string][] = [
      [fallo, 'ch14-53-fallo@example.com', 'conexion'],
      [rechazo, 'ch14-53-rechazo@example.com', 'preparacion'],
    ];
    for (const [id, para, fase] of casos) {
      const filas = await ejecuciones(id);
      assert.equal(filas.length, 1);
      assert.deepEqual(columnas(filas[0], 'estado', 'fase', 'notificacion'), { estado: 'fallo', fase, notificacion: null });
      assert.equal(falso.a(para).length, 0);
    }
  });

  test('CH-14 5.4 5.6 a failed send closes fallo/notificacion keeping filas, logs no secrets, and a sibling still runs', async () => {
    const tenantId = await tenant();
    const falla = await automatizacion(tenantId, {
      lector: true,
      vistaSql: "SELECT 'fila-secreta' AS id",
      destinatario: 'ch14-54-falla@example.com',
      creadaEn: '2020-01-01T00:00:00Z',
    });
    const hermana = await automatizacion(tenantId, {
      lector: true,
      destinatario: 'ch14-54@example.com',
      creadaEn: '2020-01-02T00:00:00Z',
    });
    // A verdict carrying SMTP text that a real notifier never returns: none of it may leak.
    const falso = notificadorFalso(async (c) =>
      c.para === 'ch14-54-falla@example.com'
        ? ({ resultado: 'fallo', categoria: 'envio-rechazado', codigo: '550', message: '550 secreto-smtp' } as ResultadoEnvio)
        : { resultado: 'enviada' },
    );
    const lineas: string[] = [];

    await tick(EN('19:00:30'), EN('19:01:30'), undefined, { notificador: falso.notificador, lineas });

    // The row did reach the message, so its absence from the log below means something.
    assert.match(falso.a('ch14-54-falla@example.com')[0].texto, /fila-secreta/);
    const [fila] = await ejecuciones(falla);
    assert.deepEqual(columnas(fila, 'estado', 'fase', 'filas', 'error', 'codigoError', 'notificacion'), {
      estado: 'fallo',
      fase: 'notificacion',
      filas: 1,
      error: 'envio-rechazado',
      codigoError: '550',
      notificacion: 'fallo-envio',
    });
    const [deHermana] = await ejecuciones(hermana);
    assert.deepEqual(columnas(deHermana, 'estado', 'notificacion'), { estado: 'ok', notificacion: 'enviada' });

    const avisos = lineas.map((l) => JSON.parse(l)).filter((l) => l.automatizacionId === falla);
    assert.equal(avisos.length, 1);
    assert.deepEqual(columnas(avisos[0], 'msg', 'automatizacionId', 'fase', 'error', 'codigoError'), {
      msg: 'scheduled run failed',
      automatizacionId: falla,
      fase: 'notificacion',
      error: 'envio-rechazado',
      codigoError: '550',
    });
    for (const secreto of ['ch14-54-falla@example.com', 'fila-secreta', 'secreto-smtp']) {
      assert.ok(!lineas.join('\n').includes(secreto), secreto);
    }
  });

  test('CH-14 5.5 a notifier that throws closes the row as error-interno and logs only the error name', async () => {
    const id = await automatizacion(await tenant(), { lector: true, destinatario: 'ch14-55@example.com' });
    // A synchronous throw, the case a `.catch` on the returned promise would miss.
    const notificador: Notificador = {
      enviar: () => {
        throw new TypeError('ch14-55 texto del servidor');
      },
    };
    const lineas: string[] = [];

    await tick(EN('20:00:30'), EN('20:01:30'), undefined, { notificador, lineas });

    const filas = await ejecuciones(id);
    assert.equal(filas.length, 1);
    assert.deepEqual(columnas(filas[0], 'estado', 'fase', 'filas', 'error', 'codigoError', 'notificacion'), {
      estado: 'fallo',
      fase: 'notificacion',
      filas: 1,
      error: 'error-interno',
      codigoError: null,
      notificacion: 'fallo-envio',
    });
    assert.ok(filas[0].finalizadaEn !== null, 'the row is closed, not left en-curso');
    const aviso = lineas.map((l) => JSON.parse(l)).find((l) => l.automatizacionId === id);
    assert.equal(aviso?.nombreError, 'TypeError');
    assert.ok(!lineas.join('\n').includes('texto del servidor'));
  });

  test('CH-14 5.7 the send is inside the duration and the row closes once, after it', async () => {
    const id = await automatizacion(await tenant(), { lector: true, destinatario: 'ch14-57@example.com' });
    let ahora = EN('21:00:30').getTime();
    const reloj: Reloj = {
      ahora: () => new Date(ahora),
      programar: () => {
        throw new Error('ejecutarTick no programa temporizadores');
      },
    };
    let durante: Record<string, unknown>[] = [];
    // Every send takes five seconds on the injected clock.
    const falso = notificadorFalso(async (c) => {
      if (c.para === 'ch14-57@example.com') {
        durante = (await ejecuciones(id)).map((f) => columnas(f, 'estado', 'finalizadaEn', 'notificacion'));
      }
      ahora += 5_000;
      return { resultado: 'enviada' };
    });

    await tick(EN('21:00:30'), EN('21:01:30'), reloj, { notificador: falso.notificador });

    // While the send was in flight the row was still open: nothing closed it before. CH-18
    // (DEC-108): it carried the marker written just before the send.
    assert.deepEqual(durante, [{ estado: 'en-curso', finalizadaEn: null, notificacion: 'enviando' }]);
    const [fila] = await ejecuciones(id);
    assert.deepEqual(columnas(fila, 'estado', 'notificacion', 'duracionMs'), {
      estado: 'ok',
      notificacion: 'enviada',
      duracionMs: 5_000,
    });
    assert.equal(fila.finalizadaEn?.getTime(), fila.iniciadaEn.getTime() + 5_000);
  });

  test('CH-14 5.9 a hanging send is cut by the outer limit and the next automation still runs', async () => {
    const colgada = await automatizacion(await tenant(), { lector: true, destinatario: 'ch14-59@example.com' });
    const siguiente = await automatizacion(await tenant(), { lector: true });
    // The real notifier over a transport that never answers: only its outer limit ends it.
    const notificador = notificadorDesdeTransporte(
      { sendMail: () => new Promise(() => {}), close: () => {} },
      { de: 'zerodashboard@example.com', timeoutMs: 50 },
    );

    await tick(EN('22:00:30'), EN('22:01:30'), undefined, { notificador });

    const [fila] = await ejecuciones(colgada);
    assert.deepEqual(columnas(fila, 'estado', 'fase', 'error', 'notificacion'), {
      estado: 'fallo',
      fase: 'notificacion',
      error: 'tiempo-agotado',
      notificacion: 'fallo-envio',
    });
    const [deSiguiente] = await ejecuciones(siguiente);
    assert.deepEqual(columnas(deSiguiente, 'estado', 'notificacion'), { estado: 'ok', notificacion: 'sin-destinatario' });
  });

  test('CH-17a 1.1 the boot sweep closes en-curso rows of active and deactivated tenants as fallo/interrumpida', async () => {
    const activo = await tenant();
    const inactivo = await tenant(false);
    const deActivo = await automatizacion(activo);
    const deInactivo = await automatizacion(inactivo);
    await atascada(activo, deActivo);
    await atascada(inactivo, deInactivo);
    // Closed rows of every `estado`, with their outcome columns set: the sweep must not touch them.
    for (const [hora, cierre] of [
      ['07:00:00', { estado: 'ok', fase: 'ejecucion', filas: 3, notificacion: 'enviada' }],
      ['07:01:00', { estado: 'fallo', fase: 'conexion', error: 'host-inalcanzable', codigoError: 'ECONNREFUSED' }],
      ['07:02:00', { estado: 'omitida', error: 'solapamiento' }],
    ] as const) {
      await prisma.ejecucion.create({
        data: { tenantId: activo, automatizacionId: deActivo, iniciadaEn: EN(hora), finalizadaEn: EN(hora), duracionMs: 0, ...cierre },
      });
    }
    const cerradasAntes = (await ejecuciones(deActivo)).filter((f) => f.estado !== 'en-curso');
    const { cliente } = clienteDeBarrido([activo, inactivo]);
    // One read when the planner is built, then 09:00:00 is the boot time; a second read
    // would give 09:00:01.
    const reloj = relojQueAvanza(EN('08:59:59'), 1_000);

    await crearPlanificador({ prisma: cliente, zonaHoraria: 'UTC', log: registro(), reloj }).barrerInterrumpidas();

    const interrumpida = {
      estado: 'fallo', error: 'interrumpida', finalizadaEn: EN('09:00:00'),
      duracionMs: null, filas: null, corte: null, fase: null, codigoError: null, notificacion: null,
    };
    for (const id of [deActivo, deInactivo]) {
      const [barrida] = (await ejecuciones(id)).filter((f) => f.iniciadaEn.getTime() === EN('08:00:00').getTime());
      assert.deepEqual(columnas(barrida, ...Object.keys(interrumpida)), interrumpida, id);
    }
    // Nothing re-executed: no new row, and the closed rows are byte-for-byte unchanged.
    assert.equal((await ejecuciones(deInactivo)).length, 1);
    assert.deepEqual((await ejecuciones(deActivo)).filter((f) => f.error !== 'interrumpida'), cerradasAntes);
  });

  test('CH-17a 1.2 each tenant is swept in its own context, and one failing tenant leaves the other swept', async () => {
    const a = await tenant();
    const b = await tenant();
    const deA = await automatizacion(a);
    const deB = await automatizacion(b);
    await atascada(a, deA, EN('08:00:00'));
    await atascada(a, deA, EN('08:00:01'));
    await atascada(b, deB);
    const lineas: string[] = [];
    const conFallo = clienteDeBarrido([a, b], b);

    await crearPlanificador({ prisma: conFallo.cliente, zonaHoraria: 'UTC', log: registro(lineas) }).barrerInterrumpidas();

    // CH-18 (DEC-108): two writes per tenant, the `incierta` one first (no row here was
    // marked), then the one that closes the rest.
    assert.deepEqual(conFallo.llamadas, [
      { tenantId: a, notificacion: 'incierta', cerradas: 0 },
      { tenantId: a, notificacion: null, cerradas: 2 },
    ]);
    assert.deepEqual((await ejecuciones(deA)).map((f) => f.error), ['interrumpida', 'interrumpida']);
    assert.deepEqual((await ejecuciones(deB)).map((f) => f.estado), ['en-curso']);
    const avisos = lineas.map((l) => JSON.parse(l));
    assert.deepEqual(
      avisos.filter((l) => l.tenantId === b).map((l) => columnas(l, 'msg', 'error', 'nombreError')),
      [{ msg: 'boot sweep failed for a tenant', error: 'error-interno', nombreError: 'Error' }],
    );
    assert.deepEqual(avisos.filter((l) => 'cerradas' in l).map((l) => l.cerradas), [2]);
    assert.ok(!lineas.join('\n').includes('base caida secreta'));

    // Without the failure, B is swept too, in B's context only.
    const sinFallo = clienteDeBarrido([a, b]);
    await crearPlanificador({ prisma: sinFallo.cliente, zonaHoraria: 'UTC', log: registro() }).barrerInterrumpidas();
    const esperadas = [
      { tenantId: a, notificacion: 'incierta', cerradas: 0 },
      { tenantId: a, notificacion: null, cerradas: 0 },
      { tenantId: b, notificacion: 'incierta', cerradas: 0 },
      { tenantId: b, notificacion: null, cerradas: 1 },
    ];
    const orden = (x: { tenantId?: string }, y: { tenantId?: string }) => String(x.tenantId).localeCompare(String(y.tenantId));
    assert.deepEqual([...sinFallo.llamadas].sort(orden), esperadas.sort(orden));

    // Outside any context the scoped write fails closed. The filter matches nothing, so
    // even a broken extension could not close another file's rows here.
    await assert.rejects(
      aislado.ejecucion.updateMany({ where: { id: 'no-existe' }, data: { estado: 'fallo' } }),
      ErrorSinTenantActivo,
    );
  });

  test('CH-17a 1.3 a row that goes en-curso after the sweep stays en-curso through a later tick', async () => {
    const tenantId = await tenant();
    // Never due in the window below, so only the sibling runs in this tenant's tick.
    const quieta = await automatizacion(tenantId, { cron: '0 0 1 1 *', creadaEn: '2020-01-01T00:00:00Z' });
    const hermana = await automatizacion(tenantId, { creadaEn: '2020-01-02T00:00:00Z' });
    const { cliente } = clienteDeBarrido([tenantId]);
    const p = crearPlanificador({ prisma: cliente, zonaHoraria: 'UTC', log: registro(), reloj: relojFijo(EN('23:00:30')) });

    await p.barrerInterrumpidas();
    const viva = await atascada(tenantId, quieta, EN('23:00:40'));
    await p.ejecutarTick(EN('23:01:30'));

    // The tick did run in this tenant: the sibling reached the closed port.
    assert.deepEqual((await ejecuciones(hermana)).map((f) => f.fase), ['conexion']);
    const fila = await prisma.ejecucion.findUniqueOrThrow({ where: { id: viva.id } });
    assert.deepEqual(columnas(fila, 'estado', 'finalizadaEn', 'error'), { estado: 'en-curso', finalizadaEn: null, error: null });
  });

  test('CH-17a 2.1 a stuck automation gets one omitida/solapamiento row per tick and runs or notifies nothing', async () => {
    const tenantId = await tenant();
    // A run would reach the live server, read one row and send it: none of that may happen.
    const id = await automatizacion(tenantId, { lector: true, destinatario: 'ch17a-21@example.com' });
    const viva = await atascada(tenantId, id);
    const falso = notificadorFalso();
    const lineas: string[] = [];

    // A clock that moves on every read: equal start and end prove a single read.
    await tick(EN('09:10:30'), EN('09:11:30'), relojQueAvanza(EN('09:10:30'), 250), { notificador: falso.notificador, lineas });
    await tick(EN('09:11:30'), EN('09:12:30'), relojQueAvanza(EN('09:11:30'), 250), { notificador: falso.notificador });

    const [enCurso, ...omitidas] = await ejecuciones(id);
    assert.deepEqual(enCurso, viva, 'the en-curso row is unchanged');
    const omitida = {
      tenantId, estado: 'omitida', error: 'solapamiento',
      duracionMs: null, filas: null, corte: null, fase: null, codigoError: null, notificacion: null,
    };
    assert.equal(omitidas.length, 2, 'one row per tick');
    for (const fila of omitidas) {
      assert.deepEqual(columnas(fila, ...Object.keys(omitida)), omitida);
      assert.deepEqual(fila.finalizadaEn, fila.iniciadaEn);
    }
    assert.equal(falso.a('ch17a-21@example.com').length, 0);
    const avisos = lineas.map((l) => JSON.parse(l)).filter((l) => l.automatizacionId === id);
    assert.deepEqual(avisos.map((l) => columnas(l, 'level', 'msg', 'error')), [
      { level: 40, msg: 'scheduled run skipped: previous run still en-curso', error: 'solapamiento' },
    ]);

    // Once the next boot sweep closes the stuck row, its omitida rows block nothing.
    await crearPlanificador({ prisma: clienteDeBarrido([tenantId]).cliente, zonaHoraria: 'UTC', log: registro() }).barrerInterrumpidas();
    await tick(EN('09:12:30'), EN('09:13:30'), undefined, { notificador: falso.notificador });
    const ultima = (await ejecuciones(id)).at(-1);
    assert.deepEqual(columnas(ultima ?? {}, 'estado', 'notificacion'), { estado: 'ok', notificacion: 'enviada' });
    assert.equal(falso.a('ch17a-21@example.com').length, 1);
  });

  test('CH-17a 2.2 overlap is per automation and per tenant, and a failed lookup leaves later siblings running', async () => {
    // B is created first, so the teardown deletes B's row before the A automation it names.
    const b = await tenant();
    const a = await tenant();
    // Run in this order: the stuck one, the one whose lookup fails below, then the last.
    const trabada = await automatizacion(a, { creadaEn: '2020-01-01T00:00:00Z' });
    const hermana = await automatizacion(a, { creadaEn: '2020-01-02T00:00:00Z' });
    const ultima = await automatizacion(a, { creadaEn: '2020-01-03T00:00:00Z' });
    await atascada(a, trabada);
    // An en-curso row in B naming A's automation: only an unscoped lookup could see it.
    await atascada(b, ultima);

    await tick(EN('09:20:30'), EN('09:21:30'));

    const resultado = async (id: string) => (await ejecuciones(id)).filter((f) => f.tenantId === a).map((f) => f.estado + '/' + f.fase);
    assert.deepEqual(await resultado(trabada), ['en-curso/null', 'omitida/null']);
    // The siblings ran their whole pipeline, up to the closed port.
    assert.deepEqual(await resultado(hermana), ['fallo/conexion']);
    assert.deepEqual(await resultado(ultima), ['fallo/conexion']);

    // The overlap lookup throws for `hermana` only: the per-run catch records it, the run
    // does not start, and the sibling after it still runs.
    const ejecucion = new Proxy(aislado.ejecucion, {
      get: (destino, prop) =>
        prop === 'findFirst'
          ? (args: Parameters<typeof aislado.ejecucion.findFirst>[0]) =>
              args?.where?.automatizacionId === hermana
                ? Promise.reject(new Error('base caida secreta'))
                : aislado.ejecucion.findFirst(args)
          : Reflect.get(destino, prop),
    });
    const cliente = new Proxy(aislado, { get: (d, p) => (p === 'ejecucion' ? ejecucion : Reflect.get(d, p)) });
    const lineas: string[] = [];
    await crearPlanificador({ prisma: cliente, zonaHoraria: 'UTC', log: registro(lineas), reloj: relojFijo(EN('09:21:30')) })
      .ejecutarTick(EN('09:22:30'));

    assert.deepEqual(await resultado(hermana), ['fallo/conexion']);
    assert.deepEqual(await resultado(ultima), ['fallo/conexion', 'fallo/conexion']);
    assert.deepEqual(await resultado(trabada), ['en-curso/null', 'omitida/null', 'omitida/null']);
    const avisos = lineas.map((l) => JSON.parse(l)).filter((l) => l.automatizacionId === hermana);
    assert.deepEqual(avisos.map((l) => columnas(l, 'msg', 'error', 'nombreError')), [
      { msg: 'scheduled run could not be recorded', error: 'error-interno', nombreError: 'Error' },
    ]);
    assert.ok(!lineas.join('\n').includes('base caida secreta'));
  });

  test('CH-17b 2.1 retry off dials once; a cap of 3 on a closed port pauses twice and closes one row', async () => {
    const tenantId = await tenant();
    const exito = await automatizacion(tenantId, { lector: true, creadaEn: '2020-01-01T00:00:00Z' });
    const cerrada = await automatizacion(tenantId, { creadaEn: '2020-01-02T00:00:00Z' });

    // No policy: this clock throws on any timer, so a pause would close the run error-interno.
    await tickDe([tenantId], EN('06:01:30'), relojFijo(EN('06:00:30')));
    const { reloj, pausas } = relojDePausas(EN('06:01:30'));
    const lineas: string[] = [];
    await tickDe([tenantId], EN('06:02:30'), reloj, TRES_INTENTOS, { lineas });

    const resultado = async (id: string) =>
      (await ejecuciones(id)).map((f) => columnas(f, 'estado', 'fase', 'error', 'intentos', 'notificacion'));
    const ok = { estado: 'ok', fase: 'ejecucion', error: null, intentos: 1, notificacion: 'sin-destinatario' };
    // A first-try connection counts one attempt, with retry off or on (DEC-103).
    assert.deepEqual(await resultado(exito), [ok, ok]);
    assert.deepEqual(await resultado(cerrada), [
      { estado: 'fallo', fase: 'conexion', error: 'host-inalcanzable', intentos: 1, notificacion: null },
      { estado: 'fallo', fase: 'conexion', error: 'host-inalcanzable', intentos: 3, notificacion: null },
    ]);
    // Two pauses of the policy's length; a fourth dial would have needed a third one.
    assert.deepEqual(pausas, [5_000, 5_000]);
    const avisos = lineas.map((l) => JSON.parse(l)).filter((l) => l.automatizacionId === cerrada);
    assert.deepEqual(avisos.map((l) => columnas(l, 'level', 'msg', 'intentos', 'error')), [
      { level: 30, msg: 'scheduled run connection retry', intentos: 1, error: 'host-inalcanzable' },
      { level: 30, msg: 'scheduled run connection retry', intentos: 2, error: 'host-inalcanzable' },
      { level: 40, msg: 'scheduled run failed', intentos: 3, error: 'host-inalcanzable' },
    ]);
  });

  test('CH-17b 2.2 a refused first attempt, then a connection, closes one ok row with intentos 2', async () => {
    const puerto = await puertoLibre();
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, puerto });
    let cerrar: (() => Promise<void>) | undefined;
    // Attempt 1 is refused; the pause starts a forwarder to the live server on that port.
    const { reloj, pausas } = relojDePausas(EN('06:10:30'), (_, disparar) => {
      void escuchar(puerto, 'reenviar').then((c) => {
        cerrar = c;
        disparar();
      });
    });

    try {
      await tickDe([tenantId], EN('06:11:30'), reloj, TRES_INTENTOS);
    } finally {
      await cerrar?.();
    }

    assert.deepEqual(pausas, [5_000]);
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'fase', 'error', 'filas', 'intentos')), [
      { estado: 'ok', fase: 'ejecucion', error: null, filas: 1, intentos: 2 },
    ]);
  });

  test('CH-17b 2.2 at the cap the row carries the last attempt category: refused twice, then timed out', async () => {
    const puerto = await puertoLibre();
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, puerto });
    let cerrar: (() => Promise<void>) | undefined;
    // Before attempt 3, a listener that accepts the socket and never answers.
    const { reloj, pausas } = relojDePausas(EN('06:20:30'), (n, disparar) => {
      if (n === 1) {
        setImmediate(disparar);
        return;
      }
      void escuchar(puerto, 'callar').then((c) => {
        cerrar = c;
        disparar();
      });
    });

    try {
      await conVariable('CONNECTION_TEST_TIMEOUT_MS', '200', () =>
        tickDe([tenantId], EN('06:21:30'), reloj, TRES_INTENTOS),
      );
    } finally {
      await cerrar?.();
    }

    assert.deepEqual(pausas, [5_000, 5_000]);
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'fase', 'error', 'intentos')), [
      { estado: 'fallo', fase: 'conexion', error: 'tiempo-agotado', intentos: 3 },
    ]);
  });

  test('CH-17b 2.3 wrong credentials, a query-phase timeout and a failed send dial once; a gate refusal never', async () => {
    const tenantId = await tenant();
    const credenciales = await automatizacion(tenantId, { lector: true, clave: 'clave-equivocada', creadaEn: '2020-01-01T00:00:00Z' });
    const lenta = await automatizacion(tenantId, { lector: true, vistaSql: 'SELECT pg_sleep(2) AS id', creadaEn: '2020-01-02T00:00:00Z' });
    const envio = await automatizacion(tenantId, { lector: true, destinatario: 'ch17b-23@example.com', creadaEn: '2020-01-03T00:00:00Z' });
    const compuerta = await automatizacion(tenantId, { vista: false, creadaEn: '2020-01-04T00:00:00Z' });
    const falso = notificadorFalso(async () => ({ resultado: 'fallo', categoria: 'envio-rechazado', codigo: '550' }));
    const { reloj, pausas } = relojDePausas(EN('06:30:30'));

    await conVariable('QUERY_TIMEOUT_MS', '100', () =>
      tickDe([tenantId], EN('06:31:30'), reloj, TRES_INTENTOS, { notificador: falso.notificador }),
    );

    assert.deepEqual(pausas, [], 'no failure here earns a pause');
    const esperado: [string, Record<string, unknown>][] = [
      [credenciales, { estado: 'fallo', fase: 'conexion', error: 'credenciales-invalidas', intentos: 1 }],
      [lenta, { estado: 'fallo', fase: 'ejecucion', error: 'tiempo-agotado', intentos: 1 }],
      [envio, { estado: 'fallo', fase: 'notificacion', error: 'envio-rechazado', intentos: 1 }],
      // Refused before any dial: nothing was attempted, so the count is null, not 0 or 1.
      [compuerta, { estado: 'fallo', fase: 'preparacion', error: 'vista-canonica-no-aprobada', intentos: null }],
    ];
    for (const [id, campos] of esperado) {
      const filas = await ejecuciones(id);
      assert.deepEqual(filas.map((f) => columnas(f, ...Object.keys(campos))), [campos], id);
    }
    // The send is attempted exactly once (email-notification, DEC-97).
    assert.equal(falso.a('ch17b-23@example.com').length, 1);
  });

  test('CH-17b 2.4 a run in a pause stays en-curso, and another planner tick records omitida with null intentos', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId);
    let soltar: (() => void) | undefined;
    // The first pause is held until the test lets it go; the second fires at once.
    const { reloj, pausas } = relojDePausas(EN('06:40:30'), (n, disparar) => {
      if (n === 1) soltar = disparar;
      else setImmediate(disparar);
    });

    const corrida = tickDe([tenantId], EN('06:41:30'), reloj, TRES_INTENTOS);
    await esperarA(() => soltar !== undefined);
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'intentos')), [
      { estado: 'en-curso', intentos: null },
    ]);
    // A second instance's tick: the overlap guard (DEC-96) covers the run mid-retry.
    await tickDe([tenantId], EN('06:41:40'), relojFijo(EN('06:40:40')));
    assert.deepEqual(pausas, [5_000], 'no second attempt starts before the pause fires');
    soltar?.();
    await corrida;

    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'error', 'intentos')), [
      { estado: 'fallo', error: 'host-inalcanzable', intentos: 3 },
      { estado: 'omitida', error: 'solapamiento', intentos: null },
    ]);
  });

  test('CH-17b 2.4 detener during a pause cancels it and closes the row with the last category and count', async () => {
    const puerto = await puertoLibre();
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, puerto });
    let ahora = EN('06:50:30');
    const temporizadores: { ms: number; disparar: () => void; cancelado: boolean }[] = [];
    const reloj: Reloj = {
      ahora: () => ahora,
      programar: (ms, disparar) => {
        const temporizador = { ms, disparar, cancelado: false };
        temporizadores.push(temporizador);
        return () => {
          temporizador.cancelado = true;
        };
      },
    };
    const p = crearPlanificador({
      prisma: clienteDeBarrido([tenantId]).cliente,
      zonaHoraria: 'UTC',
      log: registro(),
      reloj,
      reintentos: TRES_INTENTOS,
    });
    let cerrar: (() => Promise<void>) | undefined;

    try {
      await conVariable('CONNECTION_TEST_TIMEOUT_MS', '200', async () => {
        // The timer path: the tick fires from the planner's own timer, as in production.
        p.iniciar();
        ahora = EN('06:51:30');
        temporizadores[0].disparar();
        // Attempt 1 is refused; attempt 2 meets a listener that never answers.
        await esperarA(() => temporizadores.length === 2);
        cerrar = await escuchar(puerto, 'callar');
        temporizadores[1].disparar();
        await esperarA(() => temporizadores.length === 3);
        await p.detener();
      });
    } finally {
      await cerrar?.();
    }

    // The pending pause is cancelled and nothing is armed after it: no attempt, no tick.
    assert.deepEqual(temporizadores.map((t) => [t.ms, t.cancelado]), [[31_000, false], [5_000, false], [5_000, true]]);
    const filas = await ejecuciones(id);
    assert.deepEqual(filas.map((f) => columnas(f, 'estado', 'fase', 'error', 'intentos', 'notificacion')), [
      { estado: 'fallo', fase: 'conexion', error: 'tiempo-agotado', intentos: 2, notificacion: null },
    ]);
    assert.ok(filas[0].finalizadaEn !== null, 'the row is closed, not left en-curso');
  });

  test('CH-17b 2.4 the boot sweep closes an en-curso row with intentos null, whatever it held', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId);
    // The close is the only write of a count, so a live run never holds one; this row does.
    await prisma.ejecucion.create({
      data: { tenantId, automatizacionId: id, estado: 'en-curso', iniciadaEn: EN('08:00:00'), intentos: 2 },
    });

    await crearPlanificador({ prisma: clienteDeBarrido([tenantId]).cliente, zonaHoraria: 'UTC', log: registro() })
      .barrerInterrumpidas();

    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'error', 'intentos')), [
      { estado: 'fallo', error: 'interrumpida', intentos: null },
    ]);
  });

  /** CH-18: the fields pino adds to every line, set apart from the ones the planner chose. */
  const CAMPOS_DE_PINO = ['hostname', 'level', 'msg', 'pid', 'time'];

  test('CH-18 1.1 a tenant whose listing throws is logged with closed fields, and the next tenant still runs', async () => {
    const [a, b] = await dosTenantsEnOrden();
    const deA = await automatizacion(a, { lector: true, destinatario: 'ch18-11-a@example.com' });
    const deB = await automatizacion(b, { lector: true, destinatario: 'ch18-11-b@example.com' });
    const { nombre } = await prisma.tenant.findUniqueOrThrow({ where: { id: a } });
    // The failing tenant is the lower id, so the tick visits it first.
    const { cliente, listados } = clienteDeBarrido([a, b], undefined, { fallaListadoEn: a });
    const falso = notificadorFalso();
    const lineas: string[] = [];

    await crearPlanificador({
      prisma: cliente,
      zonaHoraria: 'UTC',
      log: registro(lineas),
      reloj: relojFijo(EN('05:00:30')),
      notificador: falso.notificador,
    }).ejecutarTick(EN('05:01:30'));

    // B was still entered after A failed, and its run went the whole way to the send.
    assert.deepEqual(listados, [a, b]);
    assert.deepEqual((await ejecuciones(deB)).map((f) => columnas(f, 'tenantId', 'estado', 'notificacion')), [
      { tenantId: b, estado: 'ok', notificacion: 'enviada' },
    ]);
    assert.equal(falso.a('ch18-11-b@example.com').length, 1);
    // A's failure happened before any run: no row, no send.
    assert.equal((await ejecuciones(deA)).length, 0);
    assert.equal(falso.a('ch18-11-a@example.com').length, 0);
    // One line names a tenant, with closed fields only: no message, stack, or tenant name.
    const avisos = lineas.map((l) => JSON.parse(l)).filter((l) => 'tenantId' in l);
    assert.deepEqual(avisos.map((l) => columnas(l, 'level', 'msg', 'tenantId', 'error', 'nombreError')), [
      { level: 50, msg: 'scheduled tick failed for a tenant', tenantId: a, error: 'error-interno', nombreError: 'Error' },
    ]);
    assert.deepEqual(
      Object.keys(avisos[0]).filter((k) => !CAMPOS_DE_PINO.includes(k)).sort(),
      ['error', 'nombreError', 'tenantId'],
    );
    for (const secreto of ['base caida secreta', nombre]) {
      assert.ok(!lineas.join('\n').includes(secreto), secreto);
    }
  });

  test('CH-18 1.2 a tenant that failed in one tick does not get that window back in the next (DEC-95)', async () => {
    const [a, b] = await dosTenantsEnOrden();
    const deA = await automatizacion(a, { cron: '0 9 * * *' });
    const deB = await automatizacion(b, { cron: '0 9 * * *' });
    const opciones: OpcionesBarrido = { fallaListadoEn: a };
    const { cliente, listados } = clienteDeBarrido([a, b], undefined, opciones);
    // Built at 08:59:30, so the first window is (08:59:30, 09:00:30] and holds the 09:00 fire.
    const p = crearPlanificador({ prisma: cliente, zonaHoraria: 'UTC', log: registro(), reloj: relojFijo(EN('08:59:30')) });

    await p.ejecutarTick(EN('09:00:30'));
    // A is healthy again; the next window, (09:00:30, 09:01:30], holds no fire.
    opciones.fallaListadoEn = undefined;
    await p.ejecutarTick(EN('09:01:30'));

    assert.deepEqual(listados, [a, b, a, b]);
    assert.equal((await ejecuciones(deA)).length, 0, "A's 09:00 fire is lost, not caught up");
    // B shows the 09:00 fire was due in the first window: it ran then, once.
    assert.deepEqual((await ejecuciones(deB)).map((f) => columnas(f, 'tenantId', 'fase')), [
      { tenantId: b, fase: 'conexion' },
    ]);
  });

  test('CH-18 1.3 tenants run one at a time, each in its own context: the second waits for the first', async () => {
    const [a, b] = await dosTenantsEnOrden();
    const deA = await automatizacion(a);
    const deB = await automatizacion(b);
    let soltar!: () => void;
    const retenido = new Promise<void>((resolve) => {
      soltar = resolve;
    });
    const { cliente, listados } = clienteDeBarrido([a, b], undefined, {
      antesDeListar: (tenantId) => (tenantId === a ? retenido : Promise.resolve()),
    });

    const corrida = crearPlanificador({ prisma: cliente, zonaHoraria: 'UTC', log: registro(), reloj: relojFijo(EN('05:10:30')) })
      .ejecutarTick(EN('05:11:30'));
    await esperarA(() => listados.length === 1);
    // A's first query is held: a concurrent tenant would start in this time.
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(listados, [a]);
    assert.equal((await ejecuciones(deB)).length, 0);
    soltar();
    await corrida;

    assert.deepEqual(listados, [a, b]);
    for (const [id, duenio] of [[deA, a], [deB, b]]) {
      assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'tenantId', 'fase')), [
        { tenantId: duenio, fase: 'conexion' },
      ]);
    }
  });

  // ---- CH-18 unit 2: at most one send per run, and the marker before it (X6) ----------

  /** CH-18: a planner over `propios` only, built at `desde`, with the given notifier. */
  function planificadorDe(
    cliente: PrismaAislado,
    desde: Date,
    extra: { notificador?: Notificador | null; lineas?: string[]; reintentos?: PoliticaReintentos; reloj?: Reloj } = {},
  ) {
    return crearPlanificador({
      prisma: cliente,
      zonaHoraria: 'UTC',
      log: registro(extra.lineas),
      reloj: extra.reloj ?? relojFijo(desde),
      ...(extra.notificador === undefined ? {} : { notificador: extra.notificador }),
      ...(extra.reintentos === undefined ? {} : { reintentos: extra.reintentos }),
    });
  }

  test('CH-18 2.3 while the notifier runs, the row is en-curso with the marker; it closes enviada', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, destinatario: 'ch18-23@example.com' });
    let durante: Record<string, unknown>[] = [];
    const falso = notificadorFalso(async () => {
      durante = (await ejecuciones(id)).map((f) => columnas(f, 'estado', 'finalizadaEn', 'notificacion'));
      return { resultado: 'enviada' };
    });

    await planificadorDe(clienteDeBarrido([tenantId]).cliente, EN('04:00:30'), { notificador: falso.notificador })
      .ejecutarTick(EN('04:01:30'));

    assert.deepEqual(durante, [{ estado: 'en-curso', finalizadaEn: null, notificacion: 'enviando' }]);
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'notificacion')), [
      { estado: 'ok', notificacion: 'enviada' },
    ]);
    assert.equal(falso.a('ch18-23@example.com').length, 1);
  });

  test('CH-18 2.4 the marker is written only on the path that sends: never for an omission or a failed run', async () => {
    const tenantId = await tenant();
    const vacia = await automatizacion(tenantId, {
      lector: true, vistaSql: 'SELECT 1 AS id WHERE false', destinatario: 'ch18-24-vacia@example.com', creadaEn: '2020-01-01T00:00:00Z',
    });
    const sinDestinatario = await automatizacion(tenantId, { lector: true, creadaEn: '2020-01-02T00:00:00Z' });
    const fallida = await automatizacion(tenantId, { destinatario: 'ch18-24-fallo@example.com', creadaEn: '2020-01-03T00:00:00Z' });
    const compuerta = await automatizacion(tenantId, { vista: false, destinatario: 'ch18-24-compuerta@example.com', creadaEn: '2020-01-04T00:00:00Z' });
    const envia = await automatizacion(tenantId, { lector: true, destinatario: 'ch18-24@example.com', creadaEn: '2020-01-05T00:00:00Z' });
    const { cliente, marcas } = clienteDeBarrido([tenantId]);
    const falso = notificadorFalso();

    // With a notifier, then with SMTP unset: one planner each, two windows.
    await planificadorDe(cliente, EN('04:10:30'), { notificador: falso.notificador }).ejecutarTick(EN('04:11:30'));
    await planificadorDe(cliente, EN('04:11:30'), { notificador: null }).ejecutarTick(EN('04:12:30'));

    const resultado = async (id: string) => (await ejecuciones(id)).map((f) => `${f.estado}/${f.notificacion}`);
    assert.deepEqual(await resultado(vacia), ['ok/omitida-sin-filas', 'ok/omitida-sin-filas']);
    assert.deepEqual(await resultado(sinDestinatario), ['ok/sin-destinatario', 'ok/sin-destinatario']);
    assert.deepEqual(await resultado(fallida), ['fallo/null', 'fallo/null']);
    assert.deepEqual(await resultado(compuerta), ['fallo/null', 'fallo/null']);
    assert.deepEqual(await resultado(envia), ['ok/enviada', 'ok/no-configurada']);
    // One marker in ten runs: the row of the one run that reached the notifier.
    const [enviada] = await ejecuciones(envia);
    assert.deepEqual(marcas, [enviada.id]);
    for (const para of ['ch18-24-vacia@example.com', 'ch18-24-fallo@example.com', 'ch18-24-compuerta@example.com']) {
      assert.equal(falso.a(para).length, 0, para);
    }
    assert.equal(falso.a('ch18-24@example.com').length, 1);
  });

  test('CH-18 2.5 a marker write that throws calls no notifier and closes fallo/notificacion as error-interno', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, destinatario: 'ch18-25@example.com' });
    const { cliente, marcas } = clienteDeBarrido([tenantId], undefined, { fallaMarca: true });
    const falso = notificadorFalso();
    const lineas: string[] = [];

    await planificadorDe(cliente, EN('04:20:30'), { notificador: falso.notificador, lineas }).ejecutarTick(EN('04:21:30'));

    assert.equal(marcas.length, 1, 'the marker was attempted');
    assert.equal(falso.a('ch18-25@example.com').length, 0, 'no send without the marker');
    const filas = await ejecuciones(id);
    assert.deepEqual(filas.map((f) => columnas(f, 'estado', 'fase', 'filas', 'error', 'codigoError', 'notificacion')), [
      { estado: 'fallo', fase: 'notificacion', filas: 1, error: 'error-interno', codigoError: null, notificacion: 'fallo-envio' },
    ]);
    const avisos = lineas.map((l) => JSON.parse(l)).filter((l) => l.automatizacionId === id);
    assert.deepEqual(avisos.map((l) => columnas(l, 'msg', 'error', 'nombreError')), [
      { msg: 'scheduled run failed', error: 'error-interno', nombreError: 'Error' },
    ]);
    assert.ok(!lineas.join('\n').includes('base caida secreta'));
  });

  test('CH-18 2.6 a process lost mid-send leaves en-curso/enviando, and the next boot sweep records incierta', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, destinatario: 'ch18-26@example.com' });
    // The send never answers: as far as this run knows, the process died during it.
    const falso = notificadorFalso(() => new Promise<ResultadoEnvio>(() => {}));
    void planificadorDe(clienteDeBarrido([tenantId]).cliente, EN('04:30:30'), { notificador: falso.notificador })
      .ejecutarTick(EN('04:31:30'));
    await esperarA(() => falso.a('ch18-26@example.com').length === 1);
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'notificacion')), [
      { estado: 'en-curso', notificacion: 'enviando' },
    ]);

    // The next process: its boot sweep closes the row and sends nothing.
    await planificadorDe(clienteDeBarrido([tenantId]).cliente, EN('04:40:00'), { notificador: falso.notificador })
      .barrerInterrumpidas();

    const barrida = {
      estado: 'fallo', error: 'interrumpida', notificacion: 'incierta', finalizadaEn: EN('04:40:00'),
      duracionMs: null, filas: null, corte: null, fase: null, codigoError: null, intentos: null,
    };
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, ...Object.keys(barrida))), [barrida]);
    assert.equal(falso.a('ch18-26@example.com').length, 1, 'the sweep never sends');
  });

  test('CH-18 2.7 the sweep turns enviando into incierta, keeps null as null, and leaves closed rows alone', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId);
    await prisma.ejecucion.create({
      data: { tenantId, automatizacionId: id, estado: 'en-curso', iniciadaEn: EN('08:00:00'), notificacion: 'enviando' },
    });
    await atascada(tenantId, id, EN('08:00:01'));
    for (const [hora, cierre] of [
      ['07:00:00', { estado: 'ok', fase: 'ejecucion', filas: 3, notificacion: 'enviada' }],
      ['07:01:00', { estado: 'fallo', fase: 'notificacion', filas: 2, error: 'tiempo-agotado', notificacion: 'fallo-envio' }],
      ['07:02:00', { estado: 'omitida', error: 'solapamiento' }],
    ] as const) {
      await prisma.ejecucion.create({
        data: { tenantId, automatizacionId: id, iniciadaEn: EN(hora), finalizadaEn: EN(hora), duracionMs: 0, ...cierre },
      });
    }
    const cerradasAntes = (await ejecuciones(id)).filter((f) => f.estado !== 'en-curso');
    const lineas: string[] = [];

    await planificadorDe(clienteDeBarrido([tenantId]).cliente, EN('09:00:00'), { lineas }).barrerInterrumpidas();

    const barridas = (await ejecuciones(id)).filter((f) => f.error === 'interrumpida');
    assert.deepEqual(barridas.map((f) => columnas(f, 'iniciadaEn', 'estado', 'notificacion')), [
      { iniciadaEn: EN('08:00:00'), estado: 'fallo', notificacion: 'incierta' },
      { iniciadaEn: EN('08:00:01'), estado: 'fallo', notificacion: null },
    ]);
    assert.deepEqual((await ejecuciones(id)).filter((f) => f.error !== 'interrumpida'), cerradasAntes);
    // The total and, apart, how many of them are uncertain: counts only (rule 5).
    const resumen = lineas.map((l) => JSON.parse(l)).filter((l) => l.msg === 'boot sweep closed interrupted runs');
    assert.deepEqual(resumen.map((l) => columnas(l, 'cerradas', 'inciertas')), [{ cerradas: 2, inciertas: 1 }]);
  });

  test('CH-18 2.8 a retried dial that then connects sends once', async () => {
    const puerto = await puertoLibre();
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, puerto, destinatario: 'ch18-28-reintento@example.com' });
    let cerrar: (() => Promise<void>) | undefined;
    const { reloj } = relojDePausas(EN('04:50:30'), (_, disparar) => {
      void escuchar(puerto, 'reenviar').then((c) => {
        cerrar = c;
        disparar();
      });
    });
    const falso = notificadorFalso();

    try {
      await tickDe([tenantId], EN('04:51:30'), reloj, TRES_INTENTOS, { notificador: falso.notificador });
    } finally {
      await cerrar?.();
    }

    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'intentos', 'notificacion')), [
      { estado: 'ok', intentos: 2, notificacion: 'enviada' },
    ]);
    assert.equal(falso.a('ch18-28-reintento@example.com').length, 1);
  });

  test('CH-18 2.8 a run stuck in enviando makes the next tick skip as omitida, with no send', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, destinatario: 'ch18-28-solape@example.com' });
    const atascadaEnviando = await prisma.ejecucion.create({
      data: { tenantId, automatizacionId: id, estado: 'en-curso', iniciadaEn: EN('04:59:00'), notificacion: 'enviando' },
    });
    const falso = notificadorFalso();

    await tickDe([tenantId], EN('05:21:30'), relojFijo(EN('05:20:30')), undefined, { notificador: falso.notificador });

    const [enCurso, ...resto] = await ejecuciones(id);
    assert.deepEqual(enCurso, atascadaEnviando, 'the marked row is unchanged');
    assert.deepEqual(resto.map((f) => columnas(f, 'estado', 'error', 'notificacion')), [
      { estado: 'omitida', error: 'solapamiento', notificacion: null },
    ]);
    assert.equal(falso.a('ch18-28-solape@example.com').length, 0);
  });

  test('CH-18 2.8 detener during a send on the timer path waits for it: one send, enviada, nothing armed', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, destinatario: 'ch18-28-detener@example.com' });
    let ahora = EN('05:30:30');
    const temporizadores: { ms: number; disparar: () => void }[] = [];
    const reloj: Reloj = {
      ahora: () => ahora,
      programar: (ms, disparar) => {
        temporizadores.push({ ms, disparar });
        return () => {};
      },
    };
    let soltarEnvio!: (r: ResultadoEnvio) => void;
    const falso = notificadorFalso(() => new Promise<ResultadoEnvio>((resolve) => {
      soltarEnvio = resolve;
    }));
    const p = planificadorDe(clienteDeBarrido([tenantId]).cliente, ahora, { notificador: falso.notificador, reloj });

    p.iniciar();
    ahora = EN('05:31:01');
    temporizadores[0].disparar();
    await esperarA(() => falso.a('ch18-28-detener@example.com').length === 1);
    let detenido = false;
    const deteniendo = p.detener().then(() => {
      detenido = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(detenido, false, 'detener waits for the send in flight');
    soltarEnvio({ resultado: 'enviada' });
    await deteniendo;

    assert.equal(falso.a('ch18-28-detener@example.com').length, 1);
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'notificacion')), [
      { estado: 'ok', notificacion: 'enviada' },
    ]);
    assert.equal(temporizadores.length, 1, 'no timer is armed once stopped');
  });

  test('CH-18 2.8 a send cut by the outer time limit was attempted once and is not repeated', async () => {
    const tenantId = await tenant();
    const id = await automatizacion(tenantId, { lector: true, destinatario: 'ch18-28-tiempo@example.com' });
    let envios = 0;
    const notificador = notificadorDesdeTransporte(
      {
        sendMail: () => {
          envios++;
          return new Promise(() => {});
        },
        close: () => {},
      },
      { de: 'zerodashboard@example.com', timeoutMs: 50 },
    );

    await tickDe([tenantId], EN('05:41:30'), relojFijo(EN('05:40:30')), undefined, { notificador });

    assert.equal(envios, 1);
    assert.deepEqual((await ejecuciones(id)).map((f) => columnas(f, 'estado', 'fase', 'error', 'notificacion')), [
      { estado: 'fallo', fase: 'notificacion', error: 'tiempo-agotado', notificacion: 'fallo-envio' },
    ]);
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

  function planificador(prisma: PrismaAislado, reloj: Reloj, lineas?: string[]) {
    return crearPlanificador({ prisma, zonaHoraria: 'UTC', log: registro(lineas), reloj });
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

  test('CH-17a 1.2 a sweep whose tenant list fails resolves and logs closed fields only', async () => {
    const cliente = clienteControlado();
    const lineas: string[] = [];
    const barrido = planificador(cliente.prisma, relojManual().reloj, lineas).barrerInterrumpidas();
    cliente.fallar(new Error('base caida secreta'));
    await barrido;
    const fallos = lineas.map((l) => JSON.parse(l)).filter((l) => l.msg === 'boot sweep failed');
    assert.deepEqual(fallos.map((l) => [l.error, l.nombreError]), [['error-interno', 'Error']]);
    assert.ok(!lineas.join('\n').includes('base caida secreta'));
  });

  test('CH-17a 1.3 arrancar arms the first tick only once the sweep has resolved', async () => {
    const { reloj, temporizadores } = relojManual();
    const cliente = clienteControlado();
    const arranque = planificador(cliente.prisma, reloj).arrancar();
    await vuelta();
    assert.equal(temporizadores.length, 0, 'the sweep is still reading tenants');
    cliente.responder();
    await arranque;
    assert.deepEqual(temporizadores.map((t) => t.ms), [30_750]);
  });

  test('CH-17a 1.3 a failed sweep still arms the first tick', async () => {
    const { reloj, temporizadores } = relojManual();
    const cliente = clienteControlado();
    const arranque = planificador(cliente.prisma, reloj).arrancar();
    cliente.fallar(new Error('base caida'));
    await arranque;
    assert.deepEqual(temporizadores.map((t) => t.ms), [30_750]);
  });

  test('CH-17a 1.3 detener during the sweep leaves no timer armed', async () => {
    const { reloj, temporizadores } = relojManual();
    const cliente = clienteControlado();
    const p = planificador(cliente.prisma, reloj);
    const arranque = p.arrancar();
    await p.detener();
    cliente.responder();
    await arranque;
    assert.equal(temporizadores.length, 0);
  });
});
