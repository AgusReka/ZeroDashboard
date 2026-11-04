/**
 * CH-43 (DEC-185, DEC-196): the Bot API client the poller talks to Telegram through. Three
 * methods, each a `POST` with a JSON body, each answering a closed `Resultado` and never
 * throwing.
 *
 * The token is part of every Bot API URL, so the URL is built in `urlMetodo` and nowhere
 * else, and it is never returned, logged or attached to an error (rule 7). No branch reads
 * a thrown error's `message`, Telegram's `description` or the body into a result, like
 * `src/automatizaciones/notificador.ts` classifies a failed send: only the category leaves.
 */

/** The transport, `fetch` in production and a fake in tests, so no test reaches the network. */
export type Buscar = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>;

/** Why a call failed. Closed: nothing from the error or the body travels with it. */
export type CategoriaTelegram = 'red' | 'tiempo-agotado' | 'respuesta-invalida' | 'rechazada' | 'conflicto' | 'abortada';

export type Resultado<T> = { ok: true; valor: T } | { ok: false; categoria: CategoriaTelegram };

/**
 * The parsed minimum of one update. A missing or ill-typed field reads `null`, so a
 * malformed update is still confirmed by the next offset and then skipped.
 */
export interface ActualizacionTelegram {
  updateId: number;
  chatId: bigint | null;
  texto: string | null;
}

export interface ClienteTelegram {
  obtenerBot(senal: AbortSignal): Promise<Resultado<{ usuario: string }>>;
  recibir(offset: number | null, senal: AbortSignal): Promise<Resultado<ActualizacionTelegram[]>>;
  responder(chatId: bigint, texto: string, senal?: AbortSignal): Promise<Resultado<void>>;
}

/** `getUpdates` long-poll wait, in seconds (Bot API `timeout`). */
export const ESPERA_LARGA_S = 25;
/** The long poll's own deadline: the wait plus room for the answer to arrive. */
const TIEMPO_RECIBIR_MS = 35_000;
/** `getMe` and `sendMessage` deadline. */
const TIEMPO_CORTO_MS = 10_000;

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** A chat id: an integer `number` (at most 52 significant bits, so `JSON.parse` is exact). */
function leerChatId(mensaje: Objeto): bigint | null {
  const chat = mensaje.chat;
  if (!esObjeto(chat)) return null;
  return typeof chat.id === 'number' && Number.isSafeInteger(chat.id) ? BigInt(chat.id) : null;
}

/** One raw update, or `null` when it has no usable `update_id` (it cannot be confirmed then). */
function leerActualizacion(cruda: unknown): ActualizacionTelegram | null {
  if (!esObjeto(cruda) || typeof cruda.update_id !== 'number' || !Number.isSafeInteger(cruda.update_id)) {
    return null;
  }
  const mensaje = cruda.message;
  if (!esObjeto(mensaje)) return { updateId: cruda.update_id, chatId: null, texto: null };
  return {
    updateId: cruda.update_id,
    chatId: leerChatId(mensaje),
    texto: typeof mensaje.text === 'string' ? mensaje.text : null,
  };
}

export function crearClienteTelegram(token: string, buscar: Buscar = fetch): ClienteTelegram {
  /** The only place the token is read. The URL it builds never leaves `llamar`. */
  function urlMetodo(metodo: string): string {
    return `https://api.telegram.org/bot${token}/${metodo}`;
  }

  /**
   * One call, answering the response's `result` or a category. `senal` is the caller's
   * (the poller's shutdown); the deadline is combined with it, and whichever fired decides
   * between `abortada` and `tiempo-agotado`. Only the error's `name` is consulted.
   */
  async function llamar(
    metodo: string,
    cuerpo: Objeto,
    tiempoMs: number,
    senal: AbortSignal | undefined,
  ): Promise<Resultado<unknown>> {
    const senales = senal === undefined ? [AbortSignal.timeout(tiempoMs)] : [senal, AbortSignal.timeout(tiempoMs)];
    let texto: string;
    try {
      const respuesta = await buscar(urlMetodo(metodo), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.any(senales),
      });
      texto = await respuesta.text();
    } catch (error) {
      if (senal?.aborted === true) return { ok: false, categoria: 'abortada' };
      const nombre = error instanceof Error ? error.name : '';
      return { ok: false, categoria: nombre === 'AbortError' || nombre === 'TimeoutError' ? 'tiempo-agotado' : 'red' };
    }
    let cuerpoRespuesta: unknown;
    try {
      cuerpoRespuesta = JSON.parse(texto);
    } catch {
      return { ok: false, categoria: 'respuesta-invalida' };
    }
    if (!esObjeto(cuerpoRespuesta) || typeof cuerpoRespuesta.ok !== 'boolean') {
      return { ok: false, categoria: 'respuesta-invalida' };
    }
    if (!cuerpoRespuesta.ok) {
      // A webhook on the bot or a second poller answers 409 to `getUpdates`.
      return { ok: false, categoria: cuerpoRespuesta.error_code === 409 ? 'conflicto' : 'rechazada' };
    }
    return { ok: true, valor: cuerpoRespuesta.result };
  }

  return {
    async obtenerBot(senal) {
      const r = await llamar('getMe', {}, TIEMPO_CORTO_MS, senal);
      if (!r.ok) return r;
      if (!esObjeto(r.valor) || typeof r.valor.username !== 'string' || r.valor.username === '') {
        return { ok: false, categoria: 'respuesta-invalida' };
      }
      return { ok: true, valor: { usuario: r.valor.username } };
    },

    async recibir(offset, senal) {
      const cuerpo: Objeto = { timeout: ESPERA_LARGA_S, allowed_updates: ['message'] };
      if (offset !== null) cuerpo.offset = offset;
      const r = await llamar('getUpdates', cuerpo, TIEMPO_RECIBIR_MS, senal);
      if (!r.ok) return r;
      if (!Array.isArray(r.valor)) return { ok: false, categoria: 'respuesta-invalida' };
      const actualizaciones: ActualizacionTelegram[] = [];
      for (const cruda of r.valor) {
        const leida = leerActualizacion(cruda);
        if (leida !== null) actualizaciones.push(leida);
      }
      return { ok: true, valor: actualizaciones };
    },

    async responder(chatId, texto, senal) {
      const r = await llamar('sendMessage', { chat_id: String(chatId), text: texto }, TIEMPO_CORTO_MS, senal);
      return r.ok ? { ok: true, valor: undefined } : r;
    },
  };
}
