import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { LIMITE_VENTANA_MINUTOS } from './frescura.js';
import { registerTenantRoutes } from './tenants.js';

/**
 * CH-24 (DEC-142 to DEC-145): `PUT /tenants/:id/frescura` and the two new tenant fields
 * against a live PostgreSQL target. Same target and variables as `src/tenants.test.ts`
 * (see `src/aislamiento.test.ts`).
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

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip =
  `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
  'bring up the Compose db service and set TEST_DB_* (see src/aislamiento.test.ts)';

interface TenantPayload {
  id: string;
  nombre: string;
  activo: boolean;
  ventanaDesactualizacionMinutos: number | null;
  replicaActualizadaEn: string | null;
}

describe(
  'PUT /tenants/:id/frescura — live PostgreSQL target (CH-24 PR1)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    const marca = `CH-24 ${Date.now()}`;
    let db!: PrismaClient;
    let app!: FastifyInstance;
    const creados: string[] = [];

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      app = Fastify({ logger: false });
      const aislado = extenderConAislamiento(db);
      registrarContextoTenant(app, aislado);
      registerTenantRoutes(app, aislado);
      await app.ready();
    });

    after(async () => {
      if (creados.length > 0) {
        await db.tenant.deleteMany({ where: { id: { in: creados } } });
      }
      await db.$disconnect();
      await app.close();
    });

    async function tenant(etiqueta: string, activo = true): Promise<string> {
      const fila = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}`, activo } });
      creados.push(fila.id);
      return fila.id;
    }

    async function fila(id: string) {
      return await db.tenant.findUniqueOrThrow({
        where: { id },
        select: { nombre: true, activo: true, ventanaDesactualizacionMinutos: true, replicaActualizadaEn: true },
      });
    }

    /** No `X-Tenant-Id`: the route is exempt, the path names the tenant. */
    async function declarar(id: string, payload: unknown) {
      return await app.inject({ method: 'PUT', url: `/tenants/${encodeURIComponent(id)}/frescura`, payload: payload as object });
    }

    test('a new tenant has both fields null, in the create answer and in the list', async () => {
      const creado = await app.inject({ method: 'POST', url: '/tenants', payload: { nombre: `${marca} nuevo` } });
      assert.equal(creado.statusCode, 201, creado.body);
      const { tenant: cuerpo } = creado.json() as { tenant: TenantPayload };
      creados.push(cuerpo.id);
      assert.equal(cuerpo.ventanaDesactualizacionMinutos, null);
      assert.equal(cuerpo.replicaActualizadaEn, null);

      const lista = (await app.inject({ method: 'GET', url: '/tenants' })).json() as { tenants: TenantPayload[] };
      const enLista = lista.tenants.find((t) => t.id === cuerpo.id);
      assert.deepEqual(
        [enLista?.ventanaDesactualizacionMinutos, enLista?.replicaActualizadaEn],
        [null, null],
      );
    });

    test('declaring a window stores it and the list shows it', async () => {
      const id = await tenant('ventana');
      const respuesta = await declarar(id, { ventanaMinutos: 180 });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.equal((respuesta.json() as { tenant: TenantPayload }).tenant.ventanaDesactualizacionMinutos, 180);
      assert.equal((await fila(id)).ventanaDesactualizacionMinutos, 180);

      const lista = (await app.inject({ method: 'GET', url: '/tenants' })).json() as { tenants: TenantPayload[] };
      assert.equal(lista.tenants.find((t) => t.id === id)?.ventanaDesactualizacionMinutos, 180);
    });

    test('the bounds are accepted and null clears the declaration', async () => {
      const id = await tenant('limites');
      for (const ventanaMinutos of [0, LIMITE_VENTANA_MINUTOS]) {
        assert.equal((await declarar(id, { ventanaMinutos })).statusCode, 200);
        assert.equal((await fila(id)).ventanaDesactualizacionMinutos, ventanaMinutos);
      }
      assert.equal((await declarar(id, { ventanaMinutos: null })).statusCode, 200);
      assert.equal((await fila(id)).ventanaDesactualizacionMinutos, null);
    });

    test('actualizadaAhora stores the server time of the request', async () => {
      const id = await tenant('ahora');
      const antes = Date.now();
      const respuesta = await declarar(id, { actualizadaAhora: true });
      const despues = Date.now();
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const guardada = (await fila(id)).replicaActualizadaEn;
      assert.ok(guardada !== null, 'a refresh instant is stored');
      assert.ok(guardada.getTime() >= antes - 1000 && guardada.getTime() <= despues + 1000, 'it is the server clock');
      assert.equal((respuesta.json() as { tenant: TenantPayload }).tenant.replicaActualizadaEn, guardada.toISOString());
    });

    test('only the sent fields change; false leaves the refresh untouched', async () => {
      const id = await tenant('parcial');
      await declarar(id, { ventanaMinutos: 30, actualizadaAhora: true });
      const base = await fila(id);
      assert.equal((await declarar(id, { ventanaMinutos: 60 })).statusCode, 200);
      assert.equal((await fila(id)).replicaActualizadaEn?.getTime(), base.replicaActualizadaEn?.getTime());
      assert.equal((await declarar(id, { actualizadaAhora: false })).statusCode, 200);
      const final = await fila(id);
      assert.equal(final.replicaActualizadaEn?.getTime(), base.replicaActualizadaEn?.getTime());
      assert.equal(final.ventanaDesactualizacionMinutos, 60);
    });

    test('invalid values are a 400 that names the field and stores nothing', async () => {
      const id = await tenant('invalidos');
      await declarar(id, { ventanaMinutos: 45 });
      const antes = await fila(id);
      const casos: Array<[unknown, string]> = [
        [{ ventanaMinutos: -1 }, '/ventanaMinutos'],
        [{ ventanaMinutos: 1.5 }, '/ventanaMinutos'],
        [{ ventanaMinutos: '5' }, '/ventanaMinutos'],
        [{ ventanaMinutos: LIMITE_VENTANA_MINUTOS + 1 }, '/ventanaMinutos'],
        [{ ventanaMinutos: true }, '/ventanaMinutos'],
        [{ actualizadaAhora: 'true' }, '/actualizadaAhora'],
        [{ actualizadaAhora: 1 }, '/actualizadaAhora'],
      ];
      for (const [cuerpo, campo] of casos) {
        const respuesta = await declarar(id, cuerpo);
        assert.equal(respuesta.statusCode, 400, JSON.stringify(cuerpo) + respuesta.body);
        assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos: [campo] }, JSON.stringify(cuerpo));
      }
      assert.deepEqual(await fila(id), antes);
    });

    test('forbidden keys, unknown keys and an empty body are refused and change nothing', async () => {
      const id = await tenant('prohibidas');
      const antes = await fila(id);
      for (const cuerpo of [
        { nombre: 'otro' },
        { activo: false },
        { tenantId: 'x' },
        { replicaActualizadaEn: '2020-01-01T00:00:00Z' },
        { desconocida: 1 },
        { ventanaMinutos: 10, nombre: 'otro' },
        {},
      ]) {
        const respuesta = await declarar(id, cuerpo);
        assert.equal(respuesta.statusCode, 400, JSON.stringify(cuerpo) + respuesta.body);
        assert.equal((respuesta.json() as { error: string }).error, 'solicitud-invalida');
      }
      assert.deepEqual(await fila(id), antes);
    });

    test('an unknown tenant is 404 and a deactivated one is 409 with nothing stored', async () => {
      const desconocido = await declarar('no-existe', { ventanaMinutos: 10 });
      assert.equal(desconocido.statusCode, 404, desconocido.body);
      assert.deepEqual(desconocido.json(), { error: 'tenant-no-encontrado' });

      const id = await tenant('baja', false);
      const baja = await declarar(id, { ventanaMinutos: 10, actualizadaAhora: true });
      assert.equal(baja.statusCode, 409, baja.body);
      assert.deepEqual(baja.json(), { error: 'tenant-desactivado' });
      const guardada = await fila(id);
      assert.equal(guardada.ventanaDesactualizacionMinutos, null);
      assert.equal(guardada.replicaActualizadaEn, null);
    });

    test("declaring tenant A's freshness leaves tenant B untouched", async () => {
      const a = await tenant('A');
      const b = await tenant('B');
      await declarar(b, { ventanaMinutos: 500, actualizadaAhora: true });
      const antesB = await fila(b);
      assert.equal((await declarar(a, { ventanaMinutos: 5, actualizadaAhora: true })).statusCode, 200);
      assert.deepEqual(await fila(b), antesB);
    });
  },
);
