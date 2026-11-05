import type { CategoriaEnvio, ResultadoEnvio } from '../automatizaciones/automatizaciones.js';
import type { CategoriaTelegram, ClienteTelegram } from './cliente-telegram.js';

/**
 * CH-44 (DEC-185, DEC-197): the Telegram side of a run's notice. One attempt, never retried,
 * and the same verdict type as the email notifier, so the run closes the same way. Only the
 * client's closed category travels: nothing from Telegram's answer, and no code, because
 * `codigoError` holds an SMTP reply on this column and `error_code` may change (Bot API).
 */
export interface NotificadorTelegram {
  enviar(chatId: bigint, texto: string): Promise<ResultadoEnvio>;
}

const CATEGORIAS: Readonly<Record<CategoriaTelegram, CategoriaEnvio>> = {
  'tiempo-agotado': 'tiempo-agotado',
  red: 'servidor-inalcanzable',
  rechazada: 'envio-rechazado',
  'respuesta-invalida': 'error-desconocido',
  conflicto: 'error-desconocido',
  abortada: 'error-desconocido',
};

export function crearNotificadorTelegram(cliente: Pick<ClienteTelegram, 'enviarAviso'>): NotificadorTelegram {
  return {
    async enviar(chatId, texto) {
      const r = await cliente.enviarAviso(chatId, texto);
      return r.ok
        ? { resultado: 'enviada' }
        : { resultado: 'fallo', categoria: CATEGORIAS[r.categoria], codigo: null };
    },
  };
}
