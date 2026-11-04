import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearClienteTelegram, type Buscar } from './cliente-telegram.js';

/**
 * CH-43 (DEC-185, DEC-196): the Bot API client with an injected transport. No test reaches
 * `api.telegram.org`.
 */
const TOKEN = '123456:SECRETO-de-prueba';

interface Llamada {
  url: string;
  metodo: string;
  cuerpo: Record<string, unknown>;
  senal: AbortSignal;
}

/** A transport that records each call and answers `responder(llamada)`. */
function transporte(responder: (llamada: Llamada) => Promise<{ status: number; text(): Promise<string> }>) {
  const llamadas: Llamada[] = [];
  const buscar: Buscar = async (url, init) => {
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['content-type'], 'application/json');
    const llamada = { url, metodo: url.slice(url.lastIndexOf('/') + 1), cuerpo: JSON.parse(init.body), senal: init.signal };
    llamadas.push(llamada);
    return responder(llamada);
  };
  return { buscar, llamadas };
}

const json = (cuerpo: unknown, status = 200) => async () => ({ status, text: async () => JSON.stringify(cuerpo) });

describe('cliente-telegram (CH-43)', () => {
  const senal = () => new AbortController().signal;

  test('getUpdates is a POST with offset, timeout 25 and only messages', async () => {
    const { buscar, llamadas } = transporte(json({ ok: true, result: [] }));
    const cliente = crearClienteTelegram(TOKEN, buscar);
    assert.deepEqual(await cliente.recibir(12, senal()), { ok: true, valor: [] });
    assert.equal(llamadas[0].url, `https://api.telegram.org/bot${TOKEN}/getUpdates`);
    assert.deepEqual(llamadas[0].cuerpo, { offset: 12, timeout: 25, allowed_updates: ['message'] });
    await cliente.recibir(null, senal());
    assert.equal('offset' in llamadas[1].cuerpo, false);
  });

  test('getMe gives the username, and sendMessage sends the chat id as a string', async () => {
    const { buscar, llamadas } = transporte(async (l) =>
      json(l.metodo === 'getMe' ? { ok: true, result: { id: 1, username: 'zd_bot' } } : { ok: true, result: {} })(),
    );
    const cliente = crearClienteTelegram(TOKEN, buscar);
    assert.deepEqual(await cliente.obtenerBot(senal()), { ok: true, valor: { usuario: 'zd_bot' } });
    assert.deepEqual(await cliente.responder(-1001234567890123n, 'hola'), { ok: true, valor: undefined });
    assert.deepEqual(llamadas[1].cuerpo, { chat_id: '-1001234567890123', text: 'hola' });
  });

  test('updates are parsed to the minimum, a chat id above 32 bits exactly, missing fields as null', async () => {
    const result = [
      { update_id: 10, message: { chat: { id: -1001234567890123 }, text: '/start ABCD', from: { username: 'x' } } },
      { update_id: 11, message: { chat: { id: 42 } } },
      { update_id: 12, message: { chat: { id: '42' }, text: 7 } },
      { update_id: 13, edited_message: {} },
      { message: { chat: { id: 42 }, text: 'sin id' } },
      'basura',
    ];
    const cliente = crearClienteTelegram(TOKEN, transporte(json({ ok: true, result })).buscar);
    assert.deepEqual(await cliente.recibir(null, senal()), {
      ok: true,
      valor: [
        { updateId: 10, chatId: -1001234567890123n, texto: '/start ABCD' },
        { updateId: 11, chatId: 42n, texto: null },
        { updateId: 12, chatId: null, texto: null },
        { updateId: 13, chatId: null, texto: null },
      ],
    });
  });

  test('every failure maps to its closed category', async () => {
    const casos: [string, Parameters<typeof transporte>[0], string][] = [
      ['red', async () => { throw new TypeError('fetch failed'); }, 'red'],
      ['timeout', async () => { throw new DOMException('t', 'TimeoutError'); }, 'tiempo-agotado'],
      ['not json', async () => ({ status: 502, text: async () => '<html>Bad Gateway</html>' }), 'respuesta-invalida'],
      ['no ok', json({ result: [] }), 'respuesta-invalida'],
      ['result not a list', json({ ok: true, result: {} }), 'respuesta-invalida'],
      ['conflict', json({ ok: false, error_code: 409, description: 'Conflict: webhook' }, 409), 'conflicto'],
      ['refused', json({ ok: false, error_code: 401, description: 'Unauthorized' }, 401), 'rechazada'],
      ['body fails', async () => ({ status: 200, text: async () => { throw new Error('reset'); } }), 'red'],
    ];
    for (const [nombre, responder, categoria] of casos) {
      const cliente = crearClienteTelegram(TOKEN, transporte(responder).buscar);
      assert.deepEqual(await cliente.recibir(null, senal()), { ok: false, categoria }, nombre);
    }
  });

  test('getMe without a username is an invalid answer', async () => {
    const cliente = crearClienteTelegram(TOKEN, transporte(json({ ok: true, result: { id: 1 } })).buscar);
    assert.deepEqual(await cliente.obtenerBot(senal()), { ok: false, categoria: 'respuesta-invalida' });
  });

  test("the caller's abort reaches the transport and reads as abortada", async () => {
    const control = new AbortController();
    const { buscar } = transporte(
      (l) =>
        new Promise((_, reject) => {
          l.senal.addEventListener('abort', () => reject(new DOMException('a', 'AbortError')));
        }),
    );
    const pendiente = crearClienteTelegram(TOKEN, buscar).recibir(null, control.signal);
    control.abort();
    assert.deepEqual(await pendiente, { ok: false, categoria: 'abortada' });
  });

  test('the token never appears in a result, whatever the failure carries', async () => {
    const respuestas: Parameters<typeof transporte>[0][] = [
      async (l) => { throw new Error(`connect ECONNREFUSED ${l.url}`); },
      async (l) => { throw new DOMException(`timeout ${l.url}`, 'TimeoutError'); },
      async (l) => ({ status: 500, text: async () => `error at ${l.url}` }),
      async (l) => json({ ok: false, error_code: 401, description: `bad token ${TOKEN}`, url: l.url })(),
      async (l) => json({ ok: false, error_code: 409, description: `conflict ${TOKEN}` })(),
    ];
    for (const responder of respuestas) {
      const cliente = crearClienteTelegram(TOKEN, transporte(responder).buscar);
      const resultados = [
        await cliente.obtenerBot(senal()),
        await cliente.recibir(1, senal()),
        await cliente.responder(1n, 'x'),
      ];
      for (const r of resultados) {
        assert.equal(r.ok, false);
        assert.equal(JSON.stringify(r).includes('SECRETO'), false);
        assert.deepEqual(Object.keys(r).sort(), ['categoria', 'ok']);
      }
    }
  });
});
