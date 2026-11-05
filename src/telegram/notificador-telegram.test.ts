import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearClienteTelegram, type CategoriaTelegram } from './cliente-telegram.js';
import { crearNotificadorTelegram } from './notificador-telegram.js';

/** CH-44 (DEC-185, DEC-197): one attempt, and only a closed category leaves. No network. */
const TOKEN = '123456:SECRETO-de-prueba';

describe('crearNotificadorTelegram', () => {
  test('an accepted notice reads enviada', async () => {
    const llamadas: Array<[bigint, string]> = [];
    const notificador = crearNotificadorTelegram({
      enviarAviso: async (chatId, texto) => {
        llamadas.push([chatId, texto]);
        return { ok: true, valor: undefined };
      },
    });
    assert.deepEqual(await notificador.enviar(42n, 'hola'), { resultado: 'enviada' });
    assert.deepEqual(llamadas, [[42n, 'hola']]);
  });

  const CASOS: Array<[CategoriaTelegram, string]> = [
    ['tiempo-agotado', 'tiempo-agotado'],
    ['red', 'servidor-inalcanzable'],
    ['rechazada', 'envio-rechazado'],
    ['respuesta-invalida', 'error-desconocido'],
    ['conflicto', 'error-desconocido'],
    ['abortada', 'error-desconocido'],
  ];
  for (const [categoria, esperada] of CASOS) {
    test(`${categoria} maps to ${esperada}, with no code`, async () => {
      const notificador = crearNotificadorTelegram({ enviarAviso: async () => ({ ok: false, categoria }) });
      assert.deepEqual(await notificador.enviar(42n, 'hola'), { resultado: 'fallo', categoria: esperada, codigo: null });
    });
  }

  for (const codigo of [401, 403, 400, 429]) {
    test(`a ${codigo} is one rejected request, with nothing of the answer in the verdict`, async () => {
      let llamadas = 0;
      const cliente = crearClienteTelegram(TOKEN, async () => {
        llamadas += 1;
        return {
          status: codigo,
          text: async () =>
            JSON.stringify({ ok: false, error_code: codigo, description: `chat 42 ${TOKEN}`, parameters: { retry_after: 3 } }),
        };
      });
      const verdicto = await crearNotificadorTelegram(cliente).enviar(42n, 'hola');
      assert.equal(llamadas, 1, 'never retried');
      assert.deepEqual(verdicto, { resultado: 'fallo', categoria: 'envio-rechazado', codigo: null });
      assert.ok(!JSON.stringify(verdicto).includes(TOKEN));
    });
  }

  test('a transport failure carrying the token and the chat leaves neither', async () => {
    const cliente = crearClienteTelegram(TOKEN, async () => {
      throw new Error(`fetch failed for https://api.telegram.org/bot${TOKEN}/sendMessage chat 42`);
    });
    const verdicto = await crearNotificadorTelegram(cliente).enviar(42n, 'hola');
    assert.deepEqual(verdicto, { resultado: 'fallo', categoria: 'servidor-inalcanzable', codigo: null });
  });
});
