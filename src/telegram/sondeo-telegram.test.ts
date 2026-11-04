import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fastify from 'fastify';
import type { Reloj } from '../automatizaciones/planificador.js';
import {
  crearClienteTelegram,
  type ActualizacionTelegram,
  type Buscar,
  type ClienteTelegram,
  type Resultado,
} from './cliente-telegram.js';
import { hashCodigo } from './codigo-vinculo.js';
import {
  crearSondeoTelegram,
  esperaSondeo,
  manejarMensaje,
  TEXTO_NO_VALIDO,
  TEXTO_VINCULADO,
  type FallosPorChat,
} from './sondeo-telegram.js';
import type { ResultadoVinculo } from './vincular.js';

/**
 * CH-43 (DEC-185, DEC-196): the poller with a manual clock, a fake client and a fake
 * `vincular`. No database and no network.
 */

/** A clock that records each timer instead of arming it; `avanzar` moves `ahora`. */
function relojManual() {
  let ms = Date.parse('2026-11-05T12:00:00.000Z');
  const temporizadores: { ms: number; disparar: () => void; cancelado: boolean }[] = [];
  const reloj: Reloj = {
    ahora: () => new Date(ms),
    programar: (espera, disparar) => {
      const temporizador = { ms: espera, disparar, cancelado: false };
      temporizadores.push(temporizador);
      return () => {
        temporizador.cancelado = true;
      };
    },
  };
  return {
    reloj,
    temporizadores,
    avanzar: (delta: number) => {
      ms += delta;
    },
    /** Timers neither fired nor cancelled. */
    pendientes: () => temporizadores.filter((t) => !t.cancelado),
  };
}

/** Lets the poller's promise chain settle. */
async function asentar(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

function registro() {
  const lineas: string[] = [];
  const log = Fastify({ logger: { stream: { write: (linea: string) => void lineas.push(linea) } } }).log;
  return { log, lineas };
}

/** A client scripted per method; unscripted calls succeed with nothing to report. */
function clienteFalso(guion: Partial<ClienteTelegram> = {}) {
  const offsets: (number | null)[] = [];
  const respuestas: { chatId: bigint; texto: string }[] = [];
  const cliente: ClienteTelegram = {
    obtenerBot: guion.obtenerBot ?? (async () => ({ ok: true, valor: { usuario: 'zd_bot' } })),
    recibir: async (offset, senal) => {
      offsets.push(offset);
      return guion.recibir ? guion.recibir(offset, senal) : { ok: true, valor: [] };
    },
    responder: async (chatId, texto, senal) => {
      respuestas.push({ chatId, texto });
      return guion.responder ? guion.responder(chatId, texto, senal) : { ok: true, valor: undefined };
    },
  };
  return { cliente, offsets, respuestas };
}

const actualizacion = (updateId: number, texto: string | null, chatId: bigint | null = 42n): ActualizacionTelegram => ({
  updateId,
  chatId,
  texto,
});

describe('sondeo-telegram (CH-43)', () => {
  /** Fires the only pending timer, then lets its round finish. */
  async function disparar(r: ReturnType<typeof relojManual>): Promise<void> {
    const pendientes = r.pendientes();
    assert.equal(pendientes.length, 1, 'exactly one timer is pending');
    pendientes[0].cancelado = true;
    pendientes[0].disparar();
    await asentar();
  }

  function sondeo(cliente: ClienteTelegram, r = relojManual(), aleatorio = () => 0.5) {
    const { log, lineas } = registro();
    const vinculos: { chatId: bigint; codigoHash: string }[] = [];
    const s = crearSondeoTelegram({
      cliente,
      vincular: async (chatId, codigoHash) => {
        vinculos.push({ chatId, codigoHash });
        return { vinculado: false };
      },
      reloj: r.reloj,
      aleatorio,
      log,
    });
    return { s, r, lineas, vinculos };
  }

  test('getMe is called until it answers; only then getUpdates, and the bot becomes available', async () => {
    let intentos = 0;
    const f = clienteFalso({
      obtenerBot: async () => (++intentos === 1 ? { ok: false, categoria: 'red' } : { ok: true, valor: { usuario: 'zd_bot' } }),
    });
    const { s, r } = sondeo(f.cliente);
    s.iniciar();
    assert.deepEqual(r.pendientes().map((t) => t.ms), [0]);
    await disparar(r);
    assert.equal(s.bot(), null);
    assert.deepEqual(f.offsets, []);
    assert.equal(r.pendientes()[0].ms, 1500);
    await disparar(r);
    assert.equal(s.bot(), 'zd_bot');
    assert.equal(r.pendientes()[0].ms, 0);
    await disparar(r);
    assert.deepEqual(f.offsets, [null]);
  });

  test('handled updates are confirmed by the next offset, malformed ones included', async () => {
    let vez = 0;
    const f = clienteFalso({
      recibir: async () =>
        ++vez === 1 ? { ok: true, valor: [actualizacion(10, 'hola'), actualizacion(11, null, null)] } : { ok: true, valor: [] },
    });
    const { s, r } = sondeo(f.cliente);
    s.iniciar();
    await disparar(r);
    await disparar(r);
    await disparar(r);
    assert.deepEqual(f.offsets, [null, 12]);
  });

  test('requests never overlap: nothing is armed while one is in flight', async () => {
    let soltar!: (r: Resultado<ActualizacionTelegram[]>) => void;
    const f = clienteFalso({ recibir: () => new Promise((resolve) => (soltar = resolve)) });
    const { s, r } = sondeo(f.cliente);
    s.iniciar();
    await disparar(r); // getMe
    await disparar(r); // getUpdates, left open
    assert.equal(f.offsets.length, 1);
    assert.equal(r.pendientes().length, 0);
    s.iniciar();
    assert.equal(r.pendientes().length, 0);
    soltar({ ok: true, valor: [] });
    await asentar();
    assert.equal(r.pendientes().length, 1);
    await s.detener();
  });

  test('backoff stays within [1 s, 60 s], grows on repeated conflicts and resets on success', async () => {
    for (let intento = 0; intento < 30; intento += 1) {
      for (const a of [0, 0.5, 0.999999]) {
        const ms = esperaSondeo(intento, () => a);
        assert.ok(ms >= 1_000 && ms <= 60_000, `${intento} ${a} ${ms}`);
      }
    }
    const guion: Resultado<ActualizacionTelegram[]>[] = [
      { ok: false, categoria: 'conflicto' },
      { ok: false, categoria: 'conflicto' },
      { ok: false, categoria: 'conflicto' },
      { ok: true, valor: [] },
      { ok: false, categoria: 'conflicto' },
    ];
    const f = clienteFalso({ recibir: async () => guion.shift()! });
    const { s, r, lineas } = sondeo(f.cliente, relojManual(), () => 0);
    s.iniciar();
    await disparar(r); // getMe
    const esperas: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      await disparar(r);
      esperas.push(r.pendientes()[0].ms);
    }
    assert.deepEqual(esperas, [1_000, 2_000, 4_000, 0, 1_000]);
    const avisos = lineas.map((l) => JSON.parse(l)).filter((l) => l.evento === 'telegram-sondeo');
    assert.equal(avisos.length, 4);
    assert.ok(avisos.every((l) => l.categoria === 'conflicto' && l.level === 40));
    await s.detener();
  });

  test('detener aborts the open long poll and resolves at once, with nothing armed after it', async () => {
    const f = clienteFalso({
      recibir: (_offset, senal) =>
        new Promise((resolve) => senal.addEventListener('abort', () => resolve({ ok: false, categoria: 'abortada' }))),
    });
    const { s, r, lineas } = sondeo(f.cliente);
    s.iniciar();
    await disparar(r); // getMe
    await disparar(r); // getUpdates, left open
    assert.equal(f.offsets.length, 1);
    const antes = r.temporizadores.length;
    await s.detener();
    assert.equal(r.temporizadores.length, antes);
    s.iniciar();
    assert.equal(r.temporizadores.length, antes);
    assert.equal(lineas.filter((l) => l.includes('telegram-sondeo')).length, 0);
  });

  test('detener before the first request cancels the pending timer', async () => {
    const f = clienteFalso();
    const { s, r } = sondeo(f.cliente);
    s.iniciar();
    await s.detener();
    assert.equal(r.pendientes().length, 0);
  });

  test('no log line carries the token, a chat id, the code or the message text', async () => {
    const token = '987:TOKEN-SECRETO';
    let vez = 0;
    const buscar: Buscar = async (url) => {
      vez += 1;
      if (url.endsWith('/getMe')) return { status: 200, text: async () => JSON.stringify({ ok: true, result: { username: 'zd_bot' } }) };
      if (url.endsWith('/sendMessage')) throw new Error(`send failed ${url}`);
      if (vez === 2) {
        const result = [{ update_id: 5, message: { chat: { id: 987654321987 }, text: '/start 7KQ2M9XA' } }];
        return { status: 200, text: async () => JSON.stringify({ ok: true, result }) };
      }
      if (vez === 4) return { status: 401, text: async () => JSON.stringify({ ok: false, error_code: 401, description: url }) };
      throw new Error(`ECONNREFUSED ${url}`);
    };
    const { s, r, lineas } = sondeo(crearClienteTelegram(token, buscar));
    s.iniciar();
    for (let i = 0; i < 5; i += 1) await disparar(r);
    await s.detener();
    const todo = lineas.join('\n');
    assert.ok(lineas.length >= 4);
    for (const prohibido of ['TOKEN-SECRETO', 'api.telegram.org', '987654321987', '7KQ2M9XA', '/start', 'ECONNREFUSED']) {
      assert.equal(todo.includes(prohibido), false, prohibido);
    }
  });
});

describe('manejarMensaje (CH-43)', () => {
  function contexto(resultado: (codigoHash: string) => ResultadoVinculo = () => ({ vinculado: false })) {
    const f = clienteFalso();
    const r = relojManual();
    const { log, lineas } = registro();
    const consultas: { chatId: bigint; codigoHash: string }[] = [];
    const deps = {
      cliente: f.cliente,
      reloj: r.reloj,
      log,
      vincular: async (chatId: bigint, codigoHash: string) => {
        consultas.push({ chatId, codigoHash });
        return resultado(codigoHash);
      },
    };
    const fallos: FallosPorChat = new Map();
    const manejar = (a: ActualizacionTelegram) => manejarMensaje(deps, fallos, a);
    return { f, r, lineas, consultas, fallos, manejar };
  }

  const VALIDO = hashCodigo('7KQ2M9XA');
  const vincula = (h: string): ResultadoVinculo =>
    h === VALIDO ? { vinculado: true, tenantId: 't-a', tenantNombre: 'Ferretería Sur' } : { vinculado: false };

  test('other messages are ignored with no lookup and no answer', async () => {
    const c = contexto();
    for (const texto of ['hola', '/start', '/start   ', '/ayuda 7KQ2M9XA', 'start 7KQ2M9XA', null]) {
      await c.manejar(actualizacion(1, texto));
    }
    await c.manejar(actualizacion(1, '/start 7KQ2M9XA', null));
    assert.deepEqual(c.consultas, []);
    assert.deepEqual(c.f.respuestas, []);
  });

  test('a valid code links and gets the success answer with the tenant name', async () => {
    const c = contexto(vincula);
    await c.manejar(actualizacion(1, '/start 7KQ2M9XA', 42n));
    assert.deepEqual(c.consultas, [{ chatId: 42n, codigoHash: VALIDO }]);
    assert.deepEqual(c.f.respuestas, [{ chatId: 42n, texto: 'Listo, este chat va a recibir los avisos de Ferretería Sur.' }]);
    assert.equal(TEXTO_VINCULADO('X'), 'Listo, este chat va a recibir los avisos de X.');
    const linea = JSON.parse(c.lineas[0]);
    assert.deepEqual([linea.evento, linea.tenantId, linea.resultado], ['telegram-vinculo', 't-a', 'vinculado']);
  });

  test('/start@bot and a loosely typed code still match', async () => {
    const c = contexto(vincula);
    await c.manejar(actualizacion(1, '/start@zd_bot 7kq2-m9xa'));
    await c.manejar(actualizacion(2, '/start 7kq2 m9xa'));
    assert.deepEqual(c.consultas.map((q) => q.codigoHash), [VALIDO, VALIDO]);
  });

  test('a wrong or malformed code gets the "not valid" answer; a malformed one is not looked up', async () => {
    const c = contexto();
    await c.manejar(actualizacion(1, '/start ZZZZZZZZ'));
    await c.manejar(actualizacion(2, '/start nope'));
    assert.equal(c.consultas.length, 1);
    assert.deepEqual(c.f.respuestas.map((x) => x.texto), [TEXTO_NO_VALIDO, TEXTO_NO_VALIDO]);
    assert.equal(TEXTO_NO_VALIDO, 'Ese código no es válido o ya venció. Generá uno nuevo desde el panel.');
  });

  test('the sixth attempt in 10 minutes is ignored until the oldest failure ages out', async () => {
    const c = contexto(vincula);
    for (let i = 0; i < 5; i += 1) {
      await c.manejar(actualizacion(i, i === 0 ? '/start nope' : '/start ZZZZZZZZ'));
      c.r.avanzar(60_000);
    }
    const antes = { consultas: c.consultas.length, respuestas: c.f.respuestas.length };
    await c.manejar(actualizacion(9, '/start 7KQ2M9XA'));
    assert.deepEqual({ consultas: c.consultas.length, respuestas: c.f.respuestas.length }, antes);
    // Another chat is not capped.
    await c.manejar(actualizacion(10, '/start 7KQ2M9XA', 77n));
    assert.equal(c.f.respuestas.at(-1)?.chatId, 77n);
    // The first failure was 10 minutes ago: the chat is heard again.
    c.r.avanzar(5 * 60_000);
    await c.manejar(actualizacion(11, '/start 7KQ2M9XA'));
    assert.equal(c.consultas.at(-1)?.chatId, 42n);
    assert.equal(c.f.respuestas.at(-1)?.texto, TEXTO_VINCULADO('Ferretería Sur'));
  });

  test('the cap map is pruned: aged-out chats are dropped', async () => {
    const c = contexto();
    await c.manejar(actualizacion(1, '/start ZZZZZZZZ', 1n));
    await c.manejar(actualizacion(2, '/start ZZZZZZZZ', 2n));
    assert.equal(c.fallos.size, 2);
    c.r.avanzar(10 * 60_000);
    await c.manejar(actualizacion(3, '/start ZZZZZZZZ', 3n));
    assert.deepEqual([...c.fallos.keys()], ['3']);
  });

  test('a failed answer keeps the link and is logged by category only', async () => {
    const c = contexto(vincula);
    c.f.cliente.responder = async () => ({ ok: false, categoria: 'red' });
    await c.manejar(actualizacion(1, '/start 7KQ2M9XA'));
    assert.equal(c.consultas.length, 1);
    const lineas = c.lineas.map((l) => JSON.parse(l));
    assert.equal(lineas[0].resultado, 'vinculado');
    assert.deepEqual([lineas[1].evento, lineas[1].categoria, lineas[1].level], ['telegram-respuesta', 'red', 40]);
  });
});
