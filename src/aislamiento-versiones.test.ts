import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { conTenantActivo, ErrorSinTenantActivo } from './contexto-tenant.js';

/**
 * CH-25 (DEC-146): the history table is a scoped model, and the scoping holds inside an
 * interactive transaction, which is where edit and restore will write. The design rests on
 * that second property, so it is proved here before any route is built on it. Same target
 * and variables as `src/aislamiento.test.ts`.
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

describe(
  'ConsultaGuardadaVersion is scoped, also inside an interactive transaction (CH-25 PR1)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    const marca = `CH-25 ${Date.now()}`;
    let db!: PrismaClient;
    let aislado!: ReturnType<typeof extenderConAislamiento>;
    const tenantIds: string[] = [];
    let a!: { id: string; nombre: string; consultaId: string; versionId: string };
    let b!: { id: string; nombre: string; consultaId: string; versionId: string };

    async function negocio(etiqueta: string) {
      const tenant = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}` } });
      tenantIds.push(tenant.id);
      const consulta = await db.consultaGuardada.create({
        data: { tenantId: tenant.id, nombre: `consulta ${etiqueta}`, sql: 'SELECT 1', version: 2 },
      });
      const version = await db.consultaGuardadaVersion.create({
        data: {
          tenantId: tenant.id,
          consultaGuardadaId: consulta.id,
          version: 1,
          nombre: `consulta ${etiqueta}`,
          sql: 'SELECT 0',
          parametros: [],
          desde: new Date('2026-10-01T00:00:00Z'),
        },
      });
      return { id: tenant.id, nombre: tenant.nombre, consultaId: consulta.id, versionId: version.id };
    }

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      aislado = extenderConAislamiento(db);
      a = await negocio('A');
      b = await negocio('B');
    });

    after(async () => {
      await db.consultaGuardadaVersion.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await db.consultaGuardada.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      await db.$disconnect();
    });

    test('without an active tenant every operation on the history rejects', async () => {
      await assert.rejects(() => aislado.consultaGuardadaVersion.findMany({}), ErrorSinTenantActivo);
      await assert.rejects(() => aislado.consultaGuardadaVersion.deleteMany({ where: {} }), ErrorSinTenantActivo);
      await assert.rejects(
        () => aislado.$transaction(async (tx) => tx.consultaGuardadaVersion.findMany({})),
        ErrorSinTenantActivo,
      );
    });

    test("a tenant reads only its own versions, and another tenant's version id resolves to null", async () => {
      await conTenantActivo({ id: a.id, nombre: a.nombre }, async () => {
        const propias = await aislado.consultaGuardadaVersion.findMany({ select: { id: true } });
        assert.deepEqual(propias.map((fila) => fila.id), [a.versionId]);
        assert.equal(await aislado.consultaGuardadaVersion.findUnique({ where: { id: b.versionId } }), null);
      });
    });

    test('inside $transaction the scope still applies: a foreign id is null and a create is stamped with the active tenant', async () => {
      await conTenantActivo({ id: a.id, nombre: a.nombre }, async () => {
        await aislado.$transaction(async (tx) => {
          assert.equal(await tx.consultaGuardada.findUnique({ where: { id: b.consultaId } }), null, 'a foreign query');
          assert.equal(await tx.consultaGuardadaVersion.findUnique({ where: { id: b.versionId } }), null, 'a foreign version');
          const propias = await tx.consultaGuardadaVersion.findMany({ select: { tenantId: true } });
          assert.ok(propias.every((fila) => fila.tenantId === a.id), 'only the active tenant rows');

          // The route will write a version without naming a tenant; the extension stamps it.
          const creada = await tx.consultaGuardadaVersion.create({
            data: {
              consultaGuardadaId: a.consultaId,
              version: 2,
              nombre: 'x',
              sql: 'SELECT 2',
              parametros: [],
              desde: new Date(),
            } as never,
          });
          assert.equal(creada.tenantId, a.id);
        });
      });
      // And it committed under A, not under B.
      assert.equal(await db.consultaGuardadaVersion.count({ where: { consultaGuardadaId: a.consultaId } }), 2);
      assert.equal(await db.consultaGuardadaVersion.count({ where: { consultaGuardadaId: b.consultaId } }), 1);
    });

    test('a failure inside the transaction rolls everything back, and the unique pair refuses a repeated version', async () => {
      await assert.rejects(() =>
        conTenantActivo({ id: a.id, nombre: a.nombre }, () =>
          aislado.$transaction(async (tx) => {
            await tx.consultaGuardada.update({ where: { id: a.consultaId }, data: { version: 99 } });
            // Version 1 already exists for this query: the archive of a concurrent edit.
            await tx.consultaGuardadaVersion.create({
              data: {
                consultaGuardadaId: a.consultaId,
                version: 1,
                nombre: 'x',
                sql: 'SELECT 3',
                parametros: [],
                desde: new Date(),
              } as never,
            });
          }),
        ),
      );
      assert.equal((await db.consultaGuardada.findUniqueOrThrow({ where: { id: a.consultaId } })).version, 2, 'the update was rolled back');
    });
  },
);
