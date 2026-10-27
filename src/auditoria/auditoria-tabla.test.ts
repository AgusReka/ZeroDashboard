import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { alcanzable, databaseUrl, motivoSkip } from '../consola/consola-auth-apoyo.js';

/**
 * CH-20 (DEC-162): the audit table refuses UPDATE, DELETE and TRUNCATE, whoever asks — here
 * the raw client, with no application code in the way. Rows written by this suite stay in
 * the database by design; they belong to a tenant created and then deleted here, which also
 * proves that deleting a tenant does not collide with its audit rows (no foreign keys).
 */
describe(
  'CH-20 audit table — immutability on a live PostgreSQL target (DEC-162)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let db!: PrismaClient;
    let tenantId = '';
    let filaId = '';

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      tenantId = (await db.tenant.create({ data: { nombre: `CH-20 tabla ${Date.now()}` } })).id;
      const fila = await db.registroEjecucion.create({
        data: {
          tenantId,
          tenantNombre: 'CH-20 tabla',
          operadorId: 'op-prueba',
          operadorNombre: 'prueba',
          origen: 'consulta',
          conexionId: 'c-prueba',
          sql: 'SELECT 1',
          resultado: 'ok',
          filas: 1,
          duracionMs: 1,
        },
      });
      filaId = fila.id;
    });

    after(async () => {
      await db.$disconnect();
    });

    test('an update is refused by the database and the row is unchanged', async () => {
      await assert.rejects(db.registroEjecucion.update({ where: { id: filaId }, data: { sql: 'SELECT 2' } }), /inmutable/);
      assert.equal((await db.registroEjecucion.findUniqueOrThrow({ where: { id: filaId } })).sql, 'SELECT 1');
    });

    test('a delete is refused by the database and the row survives', async () => {
      await assert.rejects(db.registroEjecucion.delete({ where: { id: filaId } }), /inmutable/);
      await assert.rejects(db.$executeRawUnsafe('DELETE FROM "RegistroEjecucion" WHERE id = $1', filaId), /inmutable/);
      assert.ok(await db.registroEjecucion.findUnique({ where: { id: filaId } }));
    });

    test('a truncate is refused by the database', async () => {
      await assert.rejects(db.$executeRawUnsafe('TRUNCATE "RegistroEjecucion"'), /inmutable/);
      assert.ok(await db.registroEjecucion.findUnique({ where: { id: filaId } }));
    });

    test('deleting the tenant works and leaves its audit rows in place', async () => {
      await db.tenant.delete({ where: { id: tenantId } });
      assert.equal(await db.tenant.findUnique({ where: { id: tenantId } }), null);
      assert.ok(await db.registroEjecucion.findUnique({ where: { id: filaId } }));
    });
  },
);
