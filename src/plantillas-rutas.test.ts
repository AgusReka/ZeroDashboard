import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { LIMITE_LISTADO } from './consultas-guardadas.js';
import { registerPlantillaRoutes } from './plantillas-rutas.js';

/**
 * CH-12 unit 3: the template catalog's create, list and get (tasks 3.1–3.3). No request
 * here carries `x-tenant-id`: the catalog is global (DEC-61) and its routes are exempt by
 * exact row, so every case below is also a proof of that exemption.
 */

/** A body that passes every save-time check; each case overrides one field. */
const VALIDA = {
  nombre: 'CH-12 stock bajo',
  sql: 'SELECT * FROM v_producto WHERE "stockDisponible" < :umbral',
  parametros: [{ nombre: 'umbral', tipo: 'numero' }],
  entidades: ['producto'],
  automatizacion: 'stock-fisico',
  formato: 'correo-html',
  toleranciaFrescuraMinutos: 30,
};

interface CuerpoRechazo {
  error: string;
  campos: string[];
  rechazados?: unknown[];
  problemas?: { parametro: string | null; motivo: string }[];
}

/**
 * Signature pin (Threat Matrix "an exempt handler reaching a scoped model"): the
 * registrar takes the `plantilla` delegate, never the client. Checked by `tsc --noEmit`;
 * never called.
 */
export function firmaSoloDelegado(app: FastifyInstance, cliente: PrismaAislado): void {
  // @ts-expect-error — the full client is not a `plantilla` delegate.
  registerPlantillaRoutes(app, cliente);
}

// ---- 3.1/3.2 every rejection happens before any write, with no database at all ----

/** Every method throws: a rejected body that reached the table fails the case loudly. */
const plantillasQueNuncaDebenEscribirse = new Proxy({}, {
  get: (_objetivo, metodo) => async () => {
    throw new Error(`un cuerpo rechazado llegó a plantilla.${String(metodo)}`);
  },
}) as PrismaAislado['plantilla'];

describe('plantilla catalog — save-time rejections (CH-12 3.1, 3.2)', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    // The hooks get a client that throws too: an exempt route must not resolve a tenant.
    registrarContextoTenant(app, plantillasQueNuncaDebenEscribirse as unknown as PrismaAislado);
    registerPlantillaRoutes(app, plantillasQueNuncaDebenEscribirse);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  async function rechazar(cambios: Record<string, unknown>, quitar?: string): Promise<CuerpoRechazo> {
    const payload: Record<string, unknown> = { ...VALIDA, ...cambios };
    if (quitar !== undefined) delete payload[quitar];
    const respuesta = await app.inject({ method: 'POST', url: '/plantillas', payload });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    const cuerpo = respuesta.json() as CuerpoRechazo;
    assert.equal(cuerpo.error, 'solicitud-invalida');
    return cuerpo;
  }

  test('3.1 nombre and sql are required and non-empty, each rejection naming its field', async () => {
    assert.deepEqual((await rechazar({}, 'nombre')).campos, ['/nombre']);
    assert.deepEqual((await rechazar({}, 'sql')).campos, ['/sql']);
    assert.deepEqual((await rechazar({ nombre: '' })).campos, ['/nombre']);
    // Blank once trimmed: it could never execute, so it can never be saved.
    assert.deepEqual((await rechazar({ sql: '   ' })).campos, ['/sql']);
  });

  test('3.1 an entity outside the contract is rejected naming the value', async () => {
    const cuerpo = await rechazar({ entidades: ['producto', 'cliente'] });
    assert.deepEqual(cuerpo.campos, ['/entidades/1']);
    assert.deepEqual(cuerpo.rechazados, ['cliente']);
  });

  test('3.1 entidades must be a non-empty list without duplicates', async () => {
    assert.deepEqual((await rechazar({ entidades: [] })).campos, ['/entidades']);
    assert.deepEqual((await rechazar({ entidades: ['insumo', 'insumo'] })).campos, ['/entidades']);
    assert.deepEqual((await rechazar({}, 'entidades')).campos, ['/entidades']);
  });

  test('3.1 an automatizacion outside AUTOMATIZACIONES is rejected naming the value', async () => {
    const cuerpo = await rechazar({ automatizacion: 'envio-abandonado' });
    assert.deepEqual(cuerpo.campos, ['/automatizacion']);
    assert.deepEqual(cuerpo.rechazados, ['envio-abandonado']);
  });

  test('3.1 formato accepts only correo-html', async () => {
    const cuerpo = await rechazar({ formato: 'pdf' });
    assert.deepEqual(cuerpo.campos, ['/formato']);
    assert.deepEqual(cuerpo.rechazados, ['pdf']);
    assert.deepEqual((await rechazar({}, 'formato')).campos, ['/formato']);
  });

  test('3.1 toleranciaFrescuraMinutos is a non-negative integer', async () => {
    for (const valor of [-1, 1.5, 'treinta']) {
      assert.deepEqual((await rechazar({ toleranciaFrescuraMinutos: valor })).campos, [
        '/toleranciaFrescuraMinutos',
      ]);
    }
  });

  test('3.1 an unknown property such as tenantId is rejected, never stripped', async () => {
    assert.deepEqual((await rechazar({ tenantId: 'otro' })).campos, ['/tenantId']);
  });

  test('3.2 a hand-written $1 is rejected whatever parametros declares', async () => {
    const sql = 'SELECT * FROM v_producto WHERE id = $1';
    for (const parametros of [[], [{ nombre: 'id', tipo: 'texto' }]]) {
      const cuerpo = await rechazar({ sql, parametros });
      assert.ok(cuerpo.campos.includes('/sql'), JSON.stringify(cuerpo));
      assert.ok(cuerpo.problemas?.some((p) => p.motivo === 'posicional-a-mano' && p.parametro === '$1'));
    }
  });

  test('3.2 a declared parameter the sql never uses is rejected naming it', async () => {
    const cuerpo = await rechazar({ parametros: [...VALIDA.parametros, { nombre: 'x', tipo: 'numero' }] });
    assert.deepEqual(cuerpo.problemas?.map((p) => [p.parametro, p.motivo]), [['x', 'sin-usar']]);
  });
});

// ---- 3.1/3.3 create, list and get against a live PostgreSQL ----------------------

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

const motivoSkip: string | false = (await esAlcanzable(objetivo.host, objetivo.port, 1000))
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

describe('plantilla catalog — create, list, get (CH-12 3.1, 3.3)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  const marca = `CH-12 u3 ${Date.now()}`;

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const aislado = extenderConAislamiento(prisma);
    app = Fastify({ logger: false });
    registrarContextoTenant(app, aislado);
    registerPlantillaRoutes(app, aislado.plantilla);
    await app.ready();
  });

  after(async () => {
    await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  async function crear(cambios: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const payload = { ...VALIDA, nombre: marca, ...cambios };
    const respuesta = await app.inject({ method: 'POST', url: '/plantillas', payload });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    return (respuesta.json() as { plantilla: Record<string, unknown> }).plantilla;
  }

  test('3.1 a headerless create persists every field it echoes back', async () => {
    const creada = await crear({ nombre: `${marca} alta`, entidades: ['insumo', 'producto'] });
    const { id, ...campos } = creada;
    assert.ok(typeof id === 'string' && id.length > 0);
    assert.deepEqual(campos, { ...VALIDA, nombre: `${marca} alta`, entidades: ['insumo', 'producto'] });
    assert.deepEqual(await prisma.plantilla.findUnique({ where: { id } }), creada);
  });

  test('3.1 every AUTOMATIZACIONES value is accepted', async () => {
    for (const automatizacion of ['stock-fisico', 'stock-producible', 'reporte-diario']) {
      assert.equal((await crear({ automatizacion })).automatizacion, automatizacion);
    }
  });

  test('3.3 a headerless get-by-id returns exactly what create echoed', async () => {
    const creada = await crear({ nombre: `${marca} consulta` });
    const respuesta = await app.inject({ method: 'GET', url: `/plantillas/${String(creada.id)}` });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.deepEqual(respuesta.json(), { plantilla: creada });
  });

  test('3.3 the headerless list is a summary ordered by nombre, then id', async () => {
    const b = await crear({ nombre: `${marca} orden b`, sql: 'SELECT 1 AS marca_u3_b', parametros: [] });
    const a = await crear({ nombre: `${marca} orden a` });
    const respuesta = await app.inject({ method: 'GET', url: '/plantillas' });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { plantillas, truncado } = respuesta.json() as {
      plantillas: { id: string }[];
      truncado: boolean;
    };
    assert.equal(truncado, false);
    const ids = plantillas.map((p) => p.id);
    assert.ok(ids.indexOf(String(a.id)) >= 0 && ids.indexOf(String(a.id)) < ids.indexOf(String(b.id)));
    assert.deepEqual(Object.keys(plantillas[ids.indexOf(String(a.id))]).sort(), [
      'automatizacion',
      'formato',
      'id',
      'nombre',
      'toleranciaFrescuraMinutos',
    ]);
    assert.ok(!respuesta.body.includes('marca_u3_b'), 'no stored sql may reach the list payload');
  });

  test(`3.3 the list is capped at ${LIMITE_LISTADO} rows and says so with truncado`, async () => {
    const prefijo = `${marca} tope `;
    try {
      await prisma.plantilla.createMany({
        data: Array.from({ length: LIMITE_LISTADO + 1 }, (_, i) => ({
          ...VALIDA,
          nombre: `${prefijo}${String(i).padStart(4, '0')}`,
        })),
      });
      const respuesta = await app.inject({ method: 'GET', url: '/plantillas' });
      const cuerpo = respuesta.json() as { plantillas: unknown[]; truncado: boolean };
      assert.equal(cuerpo.plantillas.length, LIMITE_LISTADO);
      assert.equal(cuerpo.truncado, true);
    } finally {
      await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: prefijo } } });
    }
  });

  test('3.3 an unknown or malformed id answers 404 plantilla-no-encontrada', async () => {
    for (const id of ['11111111-2222-3333-4444-555555555555', 'no-es-un-uuid']) {
      const respuesta = await app.inject({ method: 'GET', url: `/plantillas/${id}` });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'plantilla-no-encontrada' });
    }
  });
});
