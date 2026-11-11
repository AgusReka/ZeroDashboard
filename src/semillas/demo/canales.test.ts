import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ClienteSemilla, TenantDemo } from './comun.js';
import { IDS_CANALES_DEMO, sembrarCanales } from './canales.js';

/**
 * CH-49 (c): the every-minute automations go through the product's own checks before anything
 * is written. No database: the delegates only remember what they were asked to create.
 */

function foodStore(correoPanel: string): TenantDemo {
  return {
    ids: { tenant: 't', conexion: 'c', vistas: {}, usuario: 'u', automatizacion: 'a' },
    nombre: 'Food Store',
    replica: { host: 'h', puerto: 1, baseDatos: 'd', usuario: 'u', nombreConexion: 'n' },
    correoPanel,
    prefijoEtiqueta: '',
    tablero: { id: 'x', reportes: [] },
  };
}

function delegados() {
  const escrituras: string[] = [];
  const prisma = {
    automatizacion: {
      findUnique: async () => null,
      create: async ({ data }: { data: { id: string } }) => void escrituras.push(data.id),
    },
    vinculoTelegram: {
      findUnique: async () => null,
      create: async () => void escrituras.push('vinculo'),
    },
  } as unknown as Pick<ClienteSemilla, 'automatizacion' | 'vinculoTelegram'>;
  return { prisma, escrituras };
}

describe('CH-49 sembrarCanales — checks before writing', () => {
  test('a panel email that fails the recipients rule stops the seed before any row is written', async () => {
    const { prisma, escrituras } = delegados();
    const creadas: string[] = [];
    await assert.rejects(
      sembrarCanales(prisma, foodStore('con espacio@prueba.test'), 123n, creadas),
      (error: Error) =>
        error.message === 'demo automation automatizacion:correo-cada-minuto rejected: invalid recipients' &&
        !error.message.includes('123'),
    );
    assert.deepEqual(escrituras, []);
    assert.deepEqual(creadas, []);
  });

  test('with a valid email and a chat id, the link is written before the email automation', async () => {
    const { prisma, escrituras } = delegados();
    await sembrarCanales(prisma, foodStore('panel@prueba.test'), 123n, []);
    // The fake finds no link afterwards either, so the Telegram automation is skipped here;
    // the live cases in `semilla-demo.test.ts` cover the linked path.
    assert.deepEqual(escrituras, ['vinculo', IDS_CANALES_DEMO.automatizacionCorreo]);
  });
});
