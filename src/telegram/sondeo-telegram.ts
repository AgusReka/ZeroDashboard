import type { FastifyBaseLogger } from 'fastify';
import type { Reloj } from '../automatizaciones/planificador.js';
import type { ActualizacionTelegram, CategoriaTelegram, ClienteTelegram } from './cliente-telegram.js';
import { hashCodigo, normalizarCodigo } from './codigo-vinculo.js';
import type { ResultadoVinculo } from './vincular.js';

/**
 * CH-43 (DEC-185, DEC-196): the Telegram poller. It reads `/start <code>` messages by long
 * polling Telegram outward (no webhook, no inbound port) and links the chat to the tenant
 * whose live code it carries. It is separate from the scheduler: it reads and runs no
 * automation, and enters a tenant context only inside `vincular`.
 *
 * One `vuelta()` at a time, rescheduled through the clock like the scheduler, so requests
 * never overlap. The offset and the guessing cap live in memory. Logs carry only closed
 * fields: no token, URL, chat id, code, message text or username (rules 5 and 7).
 */

export const TEXTO_VINCULADO = (nombre: string): string => `Listo, este chat va a recibir los avisos de ${nombre}.`;
export const TEXTO_NO_VALIDO = 'Ese código no es válido o ya venció. Generá uno nuevo desde el panel.';

/** Failed codes a chat may send inside `VENTANA_TOPE_MS` before it is ignored. */
export const TOPE_FALLOS = 5;
export const VENTANA_TOPE_MS = 10 * 60_000;

const ESPERA_MIN_MS = 1_000;
const ESPERA_MAX_MS = 60_000;

const PATRON_START = /^\/start(@\w+)?\s+(.+)$/;

/**
 * The delay before retry `intento` (0-based). A copy of the agent's `esperaReconexion`
 * (`src/agente-proceso/espera.ts`, CH-19c2, DEC-123): exponential, factor 2, equal jitter,
 * `tope = min(60 s, 1 s * 2^(intento + 1))`, so every delay lies in [1 s, 60 s]. Copied,
 * not imported: the agent is a separate build (design §13).
 */
export function esperaSondeo(intento: number, aleatorio: () => number): number {
  const tope = Math.min(ESPERA_MAX_MS, ESPERA_MIN_MS * 2 ** (intento + 1));
  return Math.round(tope / 2 + aleatorio() * (tope / 2));
}

export interface DependenciasSondeo {
  cliente: ClienteTelegram;
  vincular: (chatId: bigint, codigoHash: string) => Promise<ResultadoVinculo>;
  reloj: Reloj;
  aleatorio: () => number;
  log: FastifyBaseLogger;
}

export interface SondeoTelegram {
  iniciar(): void;
  detener(): Promise<void>;
  /** The bot's username once `getMe` answered, else `null` (the panel's `PuertoTelegram`). */
  bot(): string | null;
}

/** Failure times per chat, keyed by the chat id's decimal text. Never logged. */
export type FallosPorChat = Map<string, number[]>;

/** Drops every failure older than the window, and every chat left with none. */
function podar(fallos: FallosPorChat, ahoraMs: number): void {
  for (const [chat, tiempos] of fallos) {
    const vigentes = tiempos.filter((t) => ahoraMs - t < VENTANA_TOPE_MS);
    if (vigentes.length === 0) fallos.delete(chat);
    else fallos.set(chat, vigentes);
  }
}

/**
 * One update. Anything but `/start <payload>` or `/start@<bot> <payload>` is ignored with no
 * answer, as is a chat at its cap. Never throws for a failed answer: the link stays stored.
 */
export async function manejarMensaje(
  deps: Pick<DependenciasSondeo, 'cliente' | 'vincular' | 'reloj' | 'log'>,
  fallos: FallosPorChat,
  actualizacion: ActualizacionTelegram,
  senal?: AbortSignal,
): Promise<void> {
  const { cliente, vincular, reloj, log } = deps;
  const { chatId, texto } = actualizacion;
  if (chatId === null || texto === null) return;
  const coincidencia = PATRON_START.exec(texto.trim());
  if (coincidencia === null) return;
  const ahoraMs = reloj.ahora().getTime();
  podar(fallos, ahoraMs);
  const clave = chatId.toString();
  // At the cap the chat is neither looked up nor answered until its oldest failure ages out.
  if ((fallos.get(clave)?.length ?? 0) >= TOPE_FALLOS) return;

  const codigo = normalizarCodigo(coincidencia[2]);
  const resultado: ResultadoVinculo =
    codigo === null ? { vinculado: false } : await vincular(chatId, hashCodigo(codigo));

  let respuesta: string;
  if (resultado.vinculado) {
    log.info({ evento: 'telegram-vinculo', tenantId: resultado.tenantId, resultado: 'vinculado' }, 'telegram chat linked');
    respuesta = TEXTO_VINCULADO(resultado.tenantNombre);
  } else {
    fallos.set(clave, [...(fallos.get(clave) ?? []), ahoraMs]);
    log.info({ evento: 'telegram-vinculo', resultado: 'no-valido' }, 'telegram code refused');
    respuesta = TEXTO_NO_VALIDO;
  }
  const enviado = await cliente.responder(chatId, respuesta, senal);
  if (!enviado.ok && enviado.categoria !== 'abortada') {
    log.warn({ evento: 'telegram-respuesta', categoria: enviado.categoria }, 'telegram answer failed');
  }
}

export function crearSondeoTelegram(deps: DependenciasSondeo): SondeoTelegram {
  const { cliente, reloj, aleatorio, log } = deps;
  const fallos: FallosPorChat = new Map();
  // Shared with every request in flight, so `detener()` aborts the open long poll.
  const control = new AbortController();
  let usuario: string | null = null;
  let offset: number | null = null;
  let intento = 0;
  let detenido = false;
  let cancelar: (() => void) | null = null;
  let enCurso: Promise<void> | null = null;

  /** The wait before the next request after a failure, or `null` to stop on an abort. */
  function fallo(categoria: CategoriaTelegram | 'error-interno'): number | null {
    if (categoria === 'abortada') return null;
    log.warn({ evento: 'telegram-sondeo', categoria }, 'telegram poll failed');
    const ms = esperaSondeo(intento, aleatorio);
    intento += 1;
    return ms;
  }

  /** One request and its updates. Answers the delay before the next one, or `null`. */
  async function vuelta(): Promise<number | null> {
    if (usuario === null) {
      const r = await cliente.obtenerBot(control.signal);
      if (!r.ok) return fallo(r.categoria);
      usuario = r.valor.usuario;
      intento = 0;
      return 0;
    }
    const r = await cliente.recibir(offset, control.signal);
    if (!r.ok) return fallo(r.categoria);
    intento = 0;
    for (const actualizacion of r.valor) {
      if (detenido) break;
      try {
        await manejarMensaje(deps, fallos, actualizacion, control.signal);
      } catch {
        // A database failure while linking: logged by its event only, and the update is
        // still confirmed so one bad message cannot stall the loop.
        log.error({ evento: 'telegram-vinculo', resultado: 'error-interno' }, 'telegram link failed');
      }
      offset = actualizacion.updateId + 1;
    }
    return detenido ? null : 0;
  }

  function programar(ms: number): void {
    if (!detenido) cancelar = reloj.programar(ms, disparar);
  }

  function disparar(): void {
    cancelar = null;
    enCurso = vuelta()
      .catch(() => fallo('error-interno'))
      .then((ms) => {
        enCurso = null;
        if (ms !== null) programar(ms);
      });
  }

  function iniciar(): void {
    if (!detenido && cancelar === null && enCurso === null) programar(0);
  }

  async function detener(): Promise<void> {
    detenido = true;
    cancelar?.();
    cancelar = null;
    control.abort();
    await enCurso;
  }

  return { iniciar, detener, bot: () => usuario };
}
