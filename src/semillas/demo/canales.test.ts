import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ClienteSemilla, TenantDemo } from './comun.js';
import { ID_STOCK_FISICO, ID_STOCK_PRODUCIBLE } from '../../plantillas/catalogo-inicial.js';
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

interface DatosAutomatizacion {
  id: string;
  plantillaId: string;
  valores: unknown;
  cron: string;
  minimoFilas: number;
  canal: string;
}

function delegados(vinculoExistente = false) {
  const escrituras: string[] = [];
  const automatizaciones: DatosAutomatizacion[] = [];
  const prisma = {
    automatizacion: {
      findUnique: async () => null,
      create: async ({ data }: { data: DatosAutomatizacion }) => {
        escrituras.push(data.id);
        automatizaciones.push(data);
      },
    },
    vinculoTelegram: {
      findUnique: async () => (vinculoExistente ? { id: 'v' } : null),
      create: async () => void escrituras.push('vinculo'),
    },
  } as unknown as Pick<ClienteSemilla, 'automatizacion' | 'vinculoTelegram'>;
  return { prisma, escrituras, automatizaciones };
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

  test('a linked tenant gets one automation per template, both every minute: stock-fisico by email, stock-producible by Telegram', async () => {
    const { prisma, escrituras, automatizaciones } = delegados(true);
    await sembrarCanales(prisma, foodStore('panel@prueba.test'), null, []);
    assert.deepEqual(escrituras, [IDS_CANALES_DEMO.automatizacionCorreo, IDS_CANALES_DEMO.automatizacionTelegram]);
    assert.deepEqual(
      automatizaciones.map((a) => [a.plantillaId, a.valores, a.cron, a.minimoFilas, a.canal]),
      [
        [ID_STOCK_FISICO, { umbral: 10 }, '* * * * *', 2, 'correo'],
        [ID_STOCK_PRODUCIBLE, { umbral: 20 }, '* * * * *', 1, 'telegram'],
      ],
    );
  });

  test('without a link the Telegram automation is not written', async () => {
    const { prisma, escrituras } = delegados(false);
    await sembrarCanales(prisma, foodStore('panel@prueba.test'), null, []);
    assert.deepEqual(escrituras, [IDS_CANALES_DEMO.automatizacionCorreo]);
  });
});
