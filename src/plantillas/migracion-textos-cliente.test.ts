import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { CATALOGO_INICIAL } from './catalogo-inicial.js';

/**
 * CH-37 (DEC-190): the backfill half of the `plantilla_textos_cliente` migration. A fresh
 * `test:db` database is migrated before any row exists, so only this test exercises the
 * two `UPDATE` statements. It reads them from the migration file, narrows each to its own
 * fixture ids, runs them in an interactive transaction and rolls it back: `Plantilla` is
 * global and the other test files run at the same time, so nothing may stay changed.
 */

const MIGRACION = new URL(
  '../../prisma/migrations/20261027000000_plantilla_textos_cliente/migration.sql',
  import.meta.url,
);

/** The `UPDATE` statements of the migration, without comments or the final `;`. */
function actualizacionesDeLaMigracion(): string[] {
  const sql = readFileSync(MIGRACION, 'utf8')
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('--'))
    .join('\n');
  return sql
    .split(';')
    .map((sentencia) => sentencia.trim())
    .filter((sentencia) => sentencia.startsWith('UPDATE'));
}

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

describe('migration plantilla_textos_cliente — backfill by slug (CH-37)', () => {
  test('the migration carries exactly the two backfill statements, one per seeded slug', () => {
    const sentencias = actualizacionesDeLaMigracion();
    assert.equal(sentencias.length, 2);
    assert.ok(sentencias[0]?.includes(`"automatizacion" = 'stock-fisico'`));
    assert.ok(sentencias[1]?.includes(`"automatizacion" = 'stock-producible'`));
  });
});

describe('migration plantilla_textos_cliente — backfill on live rows', { skip: motivoSkip }, () => {
  let prisma!: PrismaClient;
  const marca = `CH-37 migracion ${Date.now()}`;
  const fisico = randomUUID();
  // An operator-created twin of the seeded slug: the backfill keys on the slug, not the id.
  const gemela = randomUUID();
  const producible = randomUUID();
  const otra = randomUUID();
  const ids = [fisico, gemela, producible, otra];

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    for (const [id, automatizacion] of [
      [fisico, 'stock-fisico'],
      [gemela, 'stock-fisico'],
      [producible, 'stock-producible'],
      [otra, 'reporte-diario'],
    ] as const) {
      await prisma.plantilla.create({
        data: {
          id,
          nombre: `${marca} ${automatizacion}`,
          sql: 'SELECT 1',
          entidades: ['producto'],
          automatizacion,
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      });
    }
  });

  after(async () => {
    await prisma.plantilla.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test('the statements write each slug its texts, leave other slugs null, and roll back', async () => {
    const reversion = new Error('rollback del caso de prueba');
    const textosDe = (automatizacion: string) => {
      const entrada = CATALOGO_INICIAL.find((e) => e.automatizacion === automatizacion);
      return { titulo: entrada?.titulo, descripcion: entrada?.descripcion };
    };
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        for (const sentencia of actualizacionesDeLaMigracion()) {
          // Narrowed to the fixture ids, as a bound parameter list: a database that already
          // holds other rows (or other test files' templates) is never touched.
          const marcadores = ids.map((_id, i) => `$${i + 1}`).join(', ');
          await tx.$executeRawUnsafe(`${sentencia} AND "id" IN (${marcadores})`, ...ids);
        }
        const filas = await tx.plantilla.findMany({
          where: { id: { in: ids } },
          select: { id: true, titulo: true, descripcion: true },
        });
        const porId = new Map(filas.map((f) => [f.id, f]));
        assert.deepEqual(porId.get(fisico), { id: fisico, ...textosDe('stock-fisico') });
        assert.deepEqual(porId.get(gemela), { id: gemela, ...textosDe('stock-fisico') });
        assert.deepEqual(porId.get(producible), { id: producible, ...textosDe('stock-producible') });
        assert.deepEqual(porId.get(otra), { id: otra, titulo: null, descripcion: null });
        throw reversion;
      }),
      (error: unknown) => {
        // Anything but the sentinel is a failed assertion or a database error: surface it.
        if (error !== reversion) throw error;
        return true;
      },
    );
    const despues = await prisma.plantilla.findMany({
      where: { id: { in: ids } },
      select: { titulo: true, descripcion: true },
    });
    assert.deepEqual(despues, ids.map(() => ({ titulo: null, descripcion: null })));
  });
});
