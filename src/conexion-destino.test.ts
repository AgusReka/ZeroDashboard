import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, conTenantInyectado } from './aislamiento-prisma.js';
import { conTenantActivo } from './contexto-tenant.js';
import { cifrarCredencial, ErrorCredencialIlegible } from './cripto-credencial.js';
import { destinoDeConexion } from './conexion-destino.js';

/**
 * Integration cases for CH-07 task 2.3. They talk to a real PostgreSQL server because
 * the claim under test is about what is *stored*: that the column holds an envelope and
 * that a row which does not — a connection registered before CH-07 (DEC-20) — fails
 * legibly instead of being dialled.
 *
 * Same target and same skip contract as the other integration suites; see
 * `src/conexiones.test.ts`'s header for the TEST_DB_* variables.
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

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
// CH-07: the fixtures below encipher and decipher in the same run, so the key has to be
// a literal rather than a value generated per process.
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** The credential every fixture row carries, in the clear, before it is enciphered. */
const CREDENCIAL = 'clave-de-replica-ch07';

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

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip =
  `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
  "bring up the Compose db service and set TEST_DB_* (see src/conexiones.test.ts's header)";

describe(
  'destinoDeConexion — the single credential-bearing read',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    /** The raw client, for fixtures and for the out-of-band assertions on the row. */
    let prisma!: PrismaClient;
    let aislado!: ReturnType<typeof extenderConAislamiento>;
    let tenantPruebas!: string;
    let tenantAjeno!: string;

    before(async () => {
      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      const propio = await prisma.tenant.create({ data: { nombre: `CH-07 destino ${Date.now()}` } });
      const ajeno = await prisma.tenant.create({ data: { nombre: `CH-07 ajeno ${Date.now()}` } });
      tenantPruebas = propio.id;
      tenantAjeno = ajeno.id;
      aislado = extenderConAislamiento(prisma);
    });

    after(async () => {
      for (const id of [tenantPruebas, tenantAjeno]) {
        await prisma.conexion.deleteMany({ where: { tenantId: id } });
        await prisma.tenant.delete({ where: { id } });
      }
      await prisma.$disconnect();
    });

    /**
     * Seeds one row with an arbitrary stored `credencial` value. The fixtures write the
     * column directly rather than going through `POST /conexiones`, because two of the
     * cases below need a value the route can no longer produce: a legacy plaintext
     * credential and a corrupted envelope.
     */
    async function sembrar(credencialAlmacenada: string, tenantId: string): Promise<string> {
      const fila = await prisma.conexion.create({
        data: {
          nombre: `CH-07 destino ${Date.now()} ${Math.random()}`,
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: objetivo.user,
          credencial: credencialAlmacenada,
          tenantId,
        },
        select: { id: true },
      });
      return fila.id;
    }

    /** Runs `fn` as the fixture tenant, the way a request would. */
    function comoTenant<T>(id: string, fn: () => Promise<T>): Promise<T> {
      return conTenantActivo({ id, nombre: 'CH-07 pruebas' }, fn);
    }

    test('a stored envelope is deciphered in memory into a dialable destination', async () => {
      const id = await sembrar(cifrarCredencial(CREDENCIAL), tenantPruebas);

      const destino = await comoTenant(tenantPruebas, () => destinoDeConexion(aislado, id));

      assert.notEqual(destino, null);
      assert.equal(destino?.id, id);
      assert.equal(destino?.host, objetivo.host);
      assert.equal(destino?.port, objetivo.port);
      assert.equal(destino?.database, objetivo.database);
      assert.equal(destino?.user, objetivo.user);
      assert.equal(destino?.password, CREDENCIAL, 'the credential must come back deciphered');
    });

    test('the row itself never holds the plaintext (A2: a dump yields nothing readable)', async () => {
      const id = await sembrar(cifrarCredencial(CREDENCIAL), tenantPruebas);

      // Read out of band, with the raw client, exactly as a dump would see it.
      const fila = await prisma.conexion.findUnique({
        where: { id },
        select: { credencial: true },
      });

      assert.ok(fila !== null);
      assert.notEqual(fila.credencial, CREDENCIAL);
      assert.ok(!fila.credencial.includes(CREDENCIAL), 'the stored value must not contain it');
      assert.match(fila.credencial, /^v1:/, 'the stored value must be a versioned envelope');
      assert.equal(fila.credencial.split(':').length, 4);
    });

    test('an unknown id is null, not a throw', async () => {
      const destino = await comoTenant(tenantPruebas, () =>
        destinoDeConexion(aislado, 'no-existe-en-absoluto-ch07'),
      );
      assert.equal(destino, null);
    });

    test('another tenant reaches null, so no envelope of theirs is ever opened', async () => {
      // The CH-06 isolation extension answers first: the row does not resolve at all,
      // so the 404 happens before any decipher and before any socket.
      const id = await sembrar(cifrarCredencial(CREDENCIAL), tenantPruebas);

      const destino = await comoTenant(tenantAjeno, () => destinoDeConexion(aislado, id));
      assert.equal(destino, null);
    });

    test('a legacy plaintext row throws ErrorCredencialIlegible (DEC-20)', async () => {
      // No backfill migration ships with CH-07, so a connection registered before it
      // still holds plaintext. It must fail legibly instead of being dialled.
      const id = await sembrar(CREDENCIAL, tenantPruebas);

      await assert.rejects(
        () => comoTenant(tenantPruebas, () => destinoDeConexion(aislado, id)),
        ErrorCredencialIlegible,
      );
    });

    test('a corrupted envelope throws ErrorCredencialIlegible, never a partial plaintext', async () => {
      const partes = cifrarCredencial(CREDENCIAL).split(':');
      const cifrado = Buffer.from(partes[3], 'base64');
      cifrado[0] ^= 0x01;
      partes[3] = cifrado.toString('base64');
      const id = await sembrar(partes.join(':'), tenantPruebas);

      await assert.rejects(
        () => comoTenant(tenantPruebas, () => destinoDeConexion(aislado, id)),
        (error: unknown) => {
          assert.ok(error instanceof ErrorCredencialIlegible);
          const serializado = `${error.message}|${String(error.stack)}`;
          assert.ok(!serializado.includes(CREDENCIAL), 'no plaintext may ride out on the error');
          return true;
        },
      );
    });

    test('the tenant-injection helper still reads as the create path uses it', () => {
      // `conTenantInyectado` is a type-level statement only. Asserting it here keeps the
      // fixture above (which writes `tenantId` by hand, deliberately, to seed a second
      // tenant's row) from being mistaken for how the route does it.
      assert.deepEqual(conTenantInyectado({ nombre: 'x' }), { nombre: 'x' });
    });
  },
);
