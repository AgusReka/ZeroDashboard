import { direccionValida } from './correo.js';

/**
 * The email notifier (N1; DEC-81, DEC-86). This file is the only place that reads the
 * `SMTP_*` variables: like the credential master key (DEC-17), they are never copied onto
 * `AppConfig`, so no `log.info(config)` can print them (rule 7).
 */

/** Where a variable comes from. `process.env` in production, a plain object in tests. */
export type EntornoSmtp = Readonly<Record<string, string | undefined>>;

/**
 * A complete, validated SMTP configuration. `auth` is `null` when the relay takes mail
 * without credentials (Mailpit). `de` is the sender address.
 */
export interface ConfigSmtp {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string } | null;
  de: string;
}

/** The implicit-TLS port, used when `SMTP_SECURE=true` and no `SMTP_PORT` is given. */
const PUERTO_SEGURO = 465;
/** The submission port (STARTTLS when offered), used otherwise. */
const PUERTO_ENVIO = 587;
const PUERTO_MAXIMO = 65535;

/** Unset and empty are the same thing, as in `config.ts`. */
function valor(env: EntornoSmtp, nombre: string): string | undefined {
  const v = env[nombre];
  return v === undefined || v === '' ? undefined : v;
}

function seguroDe(env: EntornoSmtp): boolean {
  const v = valor(env, 'SMTP_SECURE');
  if (v === undefined || v === 'false') return false;
  if (v === 'true') return true;
  throw new Error('SMTP_SECURE must be true or false');
}

function puertoDe(env: EntornoSmtp, secure: boolean): number {
  const v = valor(env, 'SMTP_PORT');
  if (v === undefined) return secure ? PUERTO_SEGURO : PUERTO_ENVIO;
  const puerto = Number(v);
  if (!Number.isInteger(puerto) || puerto <= 0 || puerto > PUERTO_MAXIMO) {
    throw new Error('SMTP_PORT must be a valid TCP port number');
  }
  return puerto;
}

function credencialesDe(env: EntornoSmtp): ConfigSmtp['auth'] {
  const user = valor(env, 'SMTP_USER');
  const pass = valor(env, 'SMTP_PASSWORD');
  if (user === undefined && pass === undefined) return null;
  if (user === undefined) throw new Error('SMTP_USER must be set when SMTP_PASSWORD is set');
  if (pass === undefined) throw new Error('SMTP_PASSWORD must be set when SMTP_USER is set');
  return { user, pass };
}

/**
 * Reads the SMTP settings (DEC-86 addendum). An absent or empty `SMTP_HOST` means "not
 * configured" and returns `null`; nothing else is read then, so runs record
 * `no-configurada`. Once `SMTP_HOST` is set, the rest must be complete and valid, or this
 * throws and the boot stops. Every message names the variable and never its value: an
 * error message is a log line, and these values include a password.
 */
export function leerSmtp(env: EntornoSmtp): ConfigSmtp | null {
  const host = valor(env, 'SMTP_HOST');
  if (host === undefined) return null;

  const de = valor(env, 'SMTP_FROM');
  if (de === undefined || !direccionValida(de)) {
    throw new Error('SMTP_FROM must be set to one valid email address');
  }
  const secure = seguroDe(env);
  return { host, port: puertoDe(env, secure), secure, auth: credencialesDe(env), de };
}
