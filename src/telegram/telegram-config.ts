/**
 * CH-43 (DEC-185, DEC-196): the global Telegram bot's configuration. This file is the only
 * place that reads `TELEGRAM_BOT_TOKEN`, as `src/automatizaciones/notificador.ts` is for
 * `SMTP_*`: the token is never copied onto `AppConfig`, so no `log.info(config)` can print
 * it (rule 7).
 */

/** Where a variable comes from. `process.env` in production, a plain object in tests. */
export type EntornoTelegram = Readonly<Record<string, string | undefined>>;

/**
 * The bot token, or `null` when `TELEGRAM_BOT_TOKEN` is absent or empty after trimming.
 * Any other value is the token, with no format check: a bad token is Telegram's to refuse,
 * and the poller then backs off on `getMe` instead of stopping the boot.
 */
export function leerTelegram(env: EntornoTelegram): { token: string } | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  return token === undefined || token === '' ? null : { token };
}
