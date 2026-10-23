import { createTransport, type SendMailOptions, type SMTPTransportOptions } from 'nodemailer';
import {
  PATRON_CODIGO_SMTP,
  type CategoriaEnvio,
  type ResultadoEnvio,
} from './automatizaciones.js';
import { direccionValida, type Correo } from './correo.js';

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

// ---- sending (DEC-81) ----------------------------------------------------------------

/**
 * The nodemailer SMTP options for a configuration. `timeoutMs` (`SMTP_TIMEOUT_MS`) bounds
 * each phase of the connection: connect, greeting and any idle socket. The hardening flags
 * make sure no message content can make nodemailer read a file or fetch a URL, and that the
 * library itself logs nothing. TLS certificate checks keep nodemailer's default (on).
 */
export function opcionesTransporte(c: ConfigSmtp, timeoutMs: number): SMTPTransportOptions {
  return {
    host: c.host,
    port: c.port,
    secure: c.secure,
    ...(c.auth === null ? {} : { auth: { user: c.auth.user, pass: c.auth.pass } }),
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  };
}

/**
 * The part of a nodemailer transporter the notifier uses. A real `Transporter` fits it;
 * so does a test fake that rejects or never answers.
 */
export interface Transporte {
  sendMail(mensaje: SendMailOptions): Promise<unknown>;
  close(): void;
}

/** What the scheduler sends through. `enviar` never throws: every outcome is a value. */
export interface Notificador {
  enviar(correo: Correo): Promise<ResultadoEnvio>;
}

/**
 * The `codigoError` of a send failure: nodemailer's numeric `responseCode`, as a string,
 * only when it is a three-digit SMTP reply code (`PATRON_CODIGO_SMTP`, shared with
 * `cierreConNotificacion`). A Node code such as `ECONNECTION` feeds the category only.
 */
export function codigoSmtp(valor: unknown): string | null {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return null;
  const texto = String(valor);
  return PATRON_CODIGO_SMTP.test(texto) ? texto : null;
}

/** nodemailer `code` → closed category. Codes not listed fall to the reply-code rule. */
const CATEGORIA_POR_CODIGO: ReadonlyMap<string, CategoriaEnvio> = new Map([
  ['ETIMEDOUT', 'tiempo-agotado'],
  ['ECONNECTION', 'servidor-inalcanzable'],
  ['ESOCKET', 'servidor-inalcanzable'],
  ['EDNS', 'servidor-inalcanzable'],
  ['ETLS', 'servidor-inalcanzable'],
  ['EPROXY', 'servidor-inalcanzable'],
  ['EAUTH', 'credenciales-invalidas'],
  ['ENOAUTH', 'credenciales-invalidas'],
  ['EENVELOPE', 'envio-rechazado'],
  ['EMESSAGE', 'envio-rechazado'],
  ['EPROTOCOL', 'error-desconocido'],
  ['ESTREAM', 'error-desconocido'],
]);

/**
 * Classifies a failed send from its `code` and `responseCode` only. The error's `message`
 * and `response` hold server text, and can echo the user or the recipient: they are never
 * read, so they cannot reach the `Ejecucion` row or a log line.
 */
function falloDe(e: unknown): ResultadoEnvio {
  if (!(e instanceof Error)) {
    return { resultado: 'fallo', categoria: 'error-desconocido', codigo: null };
  }
  const { code, responseCode } = e as { code?: unknown; responseCode?: unknown };
  const codigo = codigoSmtp(responseCode);
  const conocida = typeof code === 'string' ? CATEGORIA_POR_CODIGO.get(code) : undefined;
  const rechazo = codigo !== null && (codigo.startsWith('4') || codigo.startsWith('5'));
  const categoria = conocida ?? (rechazo ? 'envio-rechazado' : 'error-desconocido');
  return { resultado: 'fallo', categoria, codigo };
}

/** The display name every message is sent under; the address is `SMTP_FROM`. */
const NOMBRE_REMITENTE = 'ZeroDashboard';

const TIEMPO_AGOTADO: ResultadoEnvio = {
  resultado: 'fallo',
  categoria: 'tiempo-agotado',
  codigo: null,
};

/** Best effort: a transport that fails to close must not turn a timeout into a throw. */
function cerrar(t: Transporte): void {
  try {
    t.close();
  } catch {
    // Nothing to report: the send is already recorded as tiempo-agotado.
  }
}

/**
 * Wraps a transporter. The message carries exactly the recipient, subject and the two
 * parts: no attachments, no extra headers.
 *
 * The socket timeouts in `opcionesTransporte` bound each network phase; this outer limit
 * bounds the whole send, whatever phase hangs, because the scheduler's tick is sequential
 * (R2 under DEC-19). When it fires the transporter is closed and the send is recorded as
 * `tiempo-agotado`; a late answer from the abandoned send is ignored. The SMTP transport is
 * not pooled, so each send opens its own connection and a closed transporter still sends
 * the next message.
 */
export function notificadorDesdeTransporte(
  t: Transporte,
  o: { de: string; timeoutMs: number },
): Notificador {
  const de = { name: NOMBRE_REMITENTE, address: o.de };
  return {
    async enviar(c) {
      const mensaje = { from: de, to: c.para, subject: c.asunto, html: c.html, text: c.texto };
      // `then` also catches a synchronous throw from `sendMail`: this promise never rejects.
      const envio = Promise.resolve()
        .then(() => t.sendMail(mensaje))
        .then((): ResultadoEnvio => ({ resultado: 'enviada' }), falloDe);
      let reloj: ReturnType<typeof setTimeout> | undefined;
      const limite = new Promise<ResultadoEnvio>((resolve) => {
        reloj = setTimeout(() => {
          cerrar(t);
          resolve(TIEMPO_AGOTADO);
        }, o.timeoutMs);
      });
      try {
        return await Promise.race([envio, limite]);
      } finally {
        clearTimeout(reloj);
      }
    },
  };
}

/**
 * The production notifier, built once at boot. `null` exactly when `SMTP_HOST` is absent or
 * empty (DEC-86): the scheduler then records `no-configurada`. An invalid configuration
 * throws here, before `listen`, naming the variable only.
 */
export function crearNotificadorSmtp(
  o: { timeoutMs: number },
  env: EntornoSmtp = process.env,
): Notificador | null {
  const smtp = leerSmtp(env);
  if (smtp === null) return null;
  const transporte = createTransport(opcionesTransporte(smtp, o.timeoutMs));
  return notificadorDesdeTransporte(transporte, { de: smtp.de, timeoutMs: o.timeoutMs });
}
