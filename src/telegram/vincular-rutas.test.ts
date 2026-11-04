import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento } from '../aislamiento/aislamiento-prisma.js';
import { DURACION_CODIGO_MS, generarCodigo, hashCodigo, normalizarCodigo } from './codigo-vinculo.js';
import { crearVincular } from './vincular.js';

/**
 * CH-43 (DEC-185, DEC-196): `crearVincular` against a live PostgreSQL target. Same target and
 * variables as `src/panel/panel-telegram-rutas.test.ts` (see `src/aislamiento/aislamiento.test.ts`).
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
  'bring up the Compose db service and set TEST_DB_* (see src/aislamiento/aislamiento.test.ts)';

/** The fixed clock the codes expire against. */
const RELOJ = new Date('2026-11-05T12:00:00.000Z');

describe('crearVincular — live PostgreSQL target (CH-43)', { skip: alcanzable ? false : motivoSkip }, () => {
  const marca = `CH-43b ${Date.now()}`;
  let db!: PrismaClient;
  let vincular!: ReturnType<typeof crearVincular>;
  const tenantIds: string[] = [];

  before(() => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    vincular = crearVincular(extenderConAislamiento(db), { ahora: () => RELOJ });
  });

  after(async () => {
    if (tenantIds.length > 0) {
      const donde = { tenantId: { in: tenantIds } };
      await db.vinculoTelegram.deleteMany({ where: donde });
      await db.codigoVinculoTelegram.deleteMany({ where: donde });
      await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await db.$disconnect();
  });

  async function tenant(etiqueta: string, activo = true): Promise<{ id: string; nombre: string }> {
    const fila = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}`, activo } });
    tenantIds.push(fila.id);
    return { id: fila.id, nombre: fila.nombre };
  }

  /** A code for `tenantId`, replacing its previous one; answers its hash. */
  async function codigo(tenantId: string, venceEn = new Date(RELOJ.getTime() + DURACION_CODIGO_MS)): Promise<string> {
    const { codigoHash } = generarCodigo();
    await db.codigoVinculoTelegram.deleteMany({ where: { tenantId } });
    await db.codigoVinculoTelegram.create({ data: { tenantId, codigoHash, venceEn } });
    return codigoHash;
  }

  const vinculos = (tenantId: string) => db.vinculoTelegram.findMany({ where: { tenantId } });
  const codigos = (tenantId: string) => db.codigoVinculoTelegram.findMany({ where: { tenantId } });

  test('a valid code links the chat, deletes the code, and a reused code is not valid', async () => {
    const a = await tenant('A');
    const hash = await codigo(a.id);
    assert.deepEqual(await vincular(42n, hash), { vinculado: true, tenantId: a.id, tenantNombre: a.nombre });
    const filas = await vinculos(a.id);
    assert.equal(filas.length, 1);
    assert.equal(filas[0].chatId, 42n);
    assert.deepEqual(await codigos(a.id), []);
    assert.deepEqual(await vincular(42n, hash), { vinculado: false });
  });

  test('a chat id above 32 bits is kept exactly, and only the link columns are stored', async () => {
    const a = await tenant('grande');
    await vincular(-1001234567890123n, await codigo(a.id));
    const [fila] = await vinculos(a.id);
    assert.equal(fila.chatId, -1001234567890123n);
    assert.deepEqual(Object.keys(fila).sort(), ['chatId', 'id', 'tenantId', 'vinculadoEn']);
  });

  test('relinking replaces the chat, with still one link for the tenant', async () => {
    const a = await tenant('relink');
    await vincular(42n, await codigo(a.id));
    assert.equal((await vincular(77n, await codigo(a.id))).vinculado, true);
    const filas = await vinculos(a.id);
    assert.deepEqual(filas.map((f) => f.chatId), [77n]);
  });

  test('one chat links two tenants', async () => {
    const a = await tenant('comp A');
    const b = await tenant('comp B');
    await vincular(42n, await codigo(a.id));
    await vincular(42n, await codigo(b.id));
    assert.deepEqual((await vinculos(a.id)).map((f) => f.chatId), [42n]);
    assert.deepEqual((await vinculos(b.id)).map((f) => f.chatId), [42n]);
  });

  test('an expired code does not link and leaves the existing link alone', async () => {
    const a = await tenant('vencido');
    await vincular(42n, await codigo(a.id));
    const hash = await codigo(a.id, RELOJ);
    assert.deepEqual(await vincular(77n, hash), { vinculado: false });
    assert.deepEqual((await vinculos(a.id)).map((f) => f.chatId), [42n]);
    assert.equal((await codigos(a.id)).length, 1);
  });

  test('a replaced code is not valid', async () => {
    const a = await tenant('reemplazo');
    const c1 = await codigo(a.id);
    await codigo(a.id);
    assert.deepEqual(await vincular(42n, c1), { vinculado: false });
    assert.deepEqual(await vinculos(a.id), []);
  });

  test('a deactivated tenant is never linked', async () => {
    const a = await tenant('baja', false);
    assert.deepEqual(await vincular(42n, await codigo(a.id)), { vinculado: false });
    assert.deepEqual(await vinculos(a.id), []);
  });

  test("A's code links only A: B is neither linked nor has its code changed", async () => {
    const a = await tenant('iso A');
    const b = await tenant('iso B');
    const hashA = await codigo(a.id);
    await codigo(b.id);
    const antesB = await codigos(b.id);
    assert.equal((await vincular(42n, hashA)).vinculado, true);
    assert.deepEqual((await vinculos(a.id)).map((f) => f.chatId), [42n]);
    assert.deepEqual(await vinculos(b.id), []);
    assert.deepEqual(await codigos(b.id), antesB);
  });

  test('a code typed loosely hashes to the stored one', async () => {
    const a = await tenant('suelto');
    const { codigo: plano, codigoHash } = generarCodigo();
    await db.codigoVinculoTelegram.create({
      data: { tenantId: a.id, codigoHash, venceEn: new Date(RELOJ.getTime() + DURACION_CODIGO_MS) },
    });
    const suelto = `${plano.slice(0, 4).toLowerCase()}-${plano.slice(4).toLowerCase()}`;
    assert.equal((await vincular(9n, hashCodigo(normalizarCodigo(suelto)!))).vinculado, true);
  });

  test('an unknown hash is not valid', async () => {
    assert.deepEqual(await vincular(42n, hashCodigo('ZZZZZZZZ') + 'x'), { vinculado: false });
  });
});
