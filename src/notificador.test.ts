import assert from 'node:assert/strict';
import net from 'node:net';
import { describe, test } from 'node:test';
import { createTransport, type SendMailOptions } from 'nodemailer';
import type { Correo } from './correo.js';
import {
  codigoSmtp,
  crearNotificadorSmtp,
  leerSmtp,
  notificadorDesdeTransporte,
  opcionesTransporte,
  type ConfigSmtp,
  type Transporte,
} from './notificador.js';

/**
 * Unit cases for CH-14 Phase 4: the notifier (DEC-81, DEC-86 and its addendum). `leerSmtp`
 * reads an explicit environment object, so no case touches `process.env`. The transport
 * cases use nodemailer's JSON transport or a fake; only the `crearNotificadorSmtp` cases
 * open sockets, and only to servers they start themselves on 127.0.0.1.
 */

const REMITENTE = 'avisos@empresa-demo.com';

const CORREO: Correo = {
  para: 'destino@empresa-demo.com',
  asunto: '📦 Stock bajo (3)',
  html: '<table><tr><td>Tornillo</td></tr></table>',
  texto: 'Tornillo',
};

/**
 * A real nodemailer JSON transport (no network) that also keeps the message it built, so a
 * case can inspect exactly what would have gone out.
 */
function transporteJson(): Transporte & { mensajes: Record<string, unknown>[] } {
  const json = createTransport({ jsonTransport: true });
  const mensajes: Record<string, unknown>[] = [];
  return {
    mensajes,
    async sendMail(m: SendMailOptions) {
      const info = await json.sendMail(m);
      mensajes.push(JSON.parse(info.message) as Record<string, unknown>);
      return info;
    },
    close: () => json.close(),
  };
}

// ---- 4.1 / 4.2 SMTP_* parsing (DEC-86 addendum) --------------------------------------

describe('leerSmtp — SMTP is optional, and complete and valid once SMTP_HOST is set', () => {
  test('4.1 an absent or empty SMTP_HOST means not configured, whatever else is set', () => {
    assert.equal(leerSmtp({}), null);
    assert.equal(leerSmtp({ SMTP_HOST: '' }), null);
    // Nothing else is read when SMTP is unset: a stray invalid value cannot stop the boot.
    const basura = { SMTP_PORT: 'x', SMTP_SECURE: 'si', SMTP_USER: 'u' };
    assert.equal(leerSmtp({ SMTP_HOST: '', ...basura }), null);
  });

  test('4.1 a host and a sender are enough: port 587, not secure, no authentication', () => {
    assert.deepEqual(leerSmtp({ SMTP_HOST: 'mailpit', SMTP_FROM: REMITENTE }), {
      host: 'mailpit',
      port: 587,
      secure: false,
      auth: null,
      de: REMITENTE,
    });
  });

  test('4.1 SMTP_SECURE selects the default port; an explicit SMTP_PORT wins', () => {
    const base = { SMTP_HOST: 'smtp.empresa-demo.com', SMTP_FROM: REMITENTE };
    assert.deepEqual(leerSmtp({ ...base, SMTP_SECURE: 'true' }), {
      host: 'smtp.empresa-demo.com',
      port: 465,
      secure: true,
      auth: null,
      de: REMITENTE,
    });
    assert.equal(leerSmtp({ ...base, SMTP_SECURE: 'false' })?.port, 587);
    assert.equal(leerSmtp({ ...base, SMTP_SECURE: '' })?.secure, false);
    assert.equal(leerSmtp({ ...base, SMTP_PORT: '1025' })?.port, 1025);
    assert.equal(leerSmtp({ ...base, SMTP_SECURE: 'true', SMTP_PORT: '2465' })?.port, 2465);
  });

  test('4.1 SMTP_USER and SMTP_PASSWORD together become the credentials', () => {
    const smtp = leerSmtp({
      SMTP_HOST: 'smtp.empresa-demo.com',
      SMTP_FROM: REMITENTE,
      SMTP_USER: 'cuenta-envio',
      SMTP_PASSWORD: 'clave-de-prueba',
    });
    assert.deepEqual(smtp?.auth, { user: 'cuenta-envio', pass: 'clave-de-prueba' });
  });

  test('4.2 every invalid or partial setting stops the boot naming the variable, never a value', () => {
    const base = { SMTP_HOST: 'smtp.host-privado.test', SMTP_FROM: REMITENTE };
    const casos: Array<[Record<string, string>, string]> = [
      [{ SMTP_HOST: 'smtp.host-privado.test' }, 'SMTP_FROM'],
      [{ ...base, SMTP_FROM: '' }, 'SMTP_FROM'],
      [{ ...base, SMTP_FROM: 'no-es-una-direccion' }, 'SMTP_FROM'],
      [{ ...base, SMTP_FROM: 'avisos@empresa-demo.com\r\nBcc: robo@afuera.test' }, 'SMTP_FROM'],
      [{ ...base, SMTP_FROM: 'uno@empresa-demo.com,dos@empresa-demo.com' }, 'SMTP_FROM'],
      [{ ...base, SMTP_PORT: 'veinticinco' }, 'SMTP_PORT'],
      [{ ...base, SMTP_PORT: '0' }, 'SMTP_PORT'],
      [{ ...base, SMTP_PORT: '-25' }, 'SMTP_PORT'],
      [{ ...base, SMTP_PORT: '25.5' }, 'SMTP_PORT'],
      [{ ...base, SMTP_PORT: '70000' }, 'SMTP_PORT'],
      [{ ...base, SMTP_SECURE: 'yes' }, 'SMTP_SECURE'],
      [{ ...base, SMTP_SECURE: 'TRUE' }, 'SMTP_SECURE'],
      [{ ...base, SMTP_SECURE: '1' }, 'SMTP_SECURE'],
      [{ ...base, SMTP_USER: 'usuario-secreto' }, 'SMTP_PASSWORD'],
      [{ ...base, SMTP_USER: 'usuario-secreto', SMTP_PASSWORD: '' }, 'SMTP_PASSWORD'],
      [{ ...base, SMTP_PASSWORD: 'clave-super-secreta' }, 'SMTP_USER'],
    ];
    for (const [env, variable] of casos) {
      assert.throws(
        () => leerSmtp(env),
        (e: unknown) => {
          assert.ok(e instanceof Error);
          assert.ok(e.message.includes(variable), `${variable} named in: ${e.message}`);
          for (const valor of Object.values(env)) {
            if (valor !== '') {
              assert.ok(!e.message.includes(valor), `a value leaked into: ${e.message}`);
            }
          }
          return true;
        },
        variable,
      );
    }
  });
});

// ---- 4.3 message shape (DEC-81) ------------------------------------------------------

describe('notificadorDesdeTransporte — one message, fixed sender, no attachments', () => {
  test('4.3 builds to/from/subject/html/text and reports enviada', async () => {
    const t = transporteJson();
    const notificador = notificadorDesdeTransporte(t, { de: REMITENTE, timeoutMs: 1000 });

    assert.deepEqual(await notificador.enviar(CORREO), { resultado: 'enviada' });
    assert.equal(t.mensajes.length, 1);
    const [m] = t.mensajes;
    assert.deepEqual(m.from, { name: 'ZeroDashboard', address: REMITENTE });
    assert.deepEqual(m.to, [{ address: 'destino@empresa-demo.com', name: '' }]);
    assert.equal(m.subject, CORREO.asunto);
    assert.equal(m.html, CORREO.html);
    assert.equal(m.text, CORREO.texto);
    assert.equal(m.attachments, undefined);
  });

  test('4.3 each call sends its own recipient and content', async () => {
    const t = transporteJson();
    const de = 'otro@remitente.test';
    const notificador = notificadorDesdeTransporte(t, { de, timeoutMs: 1000 });
    await notificador.enviar({ para: 'b@tenant-b.test', asunto: 'B', html: '<p>B</p>', texto: 'B' });

    assert.deepEqual(t.mensajes[0].from, { name: 'ZeroDashboard', address: 'otro@remitente.test' });
    assert.deepEqual(t.mensajes[0].to, [{ address: 'b@tenant-b.test', name: '' }]);
    assert.equal(t.mensajes[0].html, '<p>B</p>');
  });
});

// ---- 4.4 closed error categories ------------------------------------------------------

/** A nodemailer-shaped error carrying server text and credentials that must not leak. */
function errorSmtp(code: string | undefined, responseCode?: number): Error {
  const e = new Error('535 5.7.8 Authentication failed for cuenta-envio / clave-filtrada');
  return Object.assign(e, { code, responseCode, response: '550 buzon lleno de destino@x.test' });
}

function rechazando(motivo: unknown): Transporte {
  return { sendMail: () => Promise.reject(motivo), close: () => {} };
}

async function envioCon(motivo: unknown) {
  return notificadorDesdeTransporte(rechazando(motivo), { de: REMITENTE, timeoutMs: 1000 }).enviar(
    CORREO,
  );
}

describe('notificadorDesdeTransporte — a failed send is a closed category, never text', () => {
  test('4.4 each nodemailer code maps to its category', async () => {
    const tabla: Array<[string, string]> = [
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
      ['EREQUIRETLS', 'error-desconocido'],
    ];
    for (const [code, categoria] of tabla) {
      const esperado = { resultado: 'fallo', categoria, codigo: null };
      assert.deepEqual(await envioCon(errorSmtp(code)), esperado, code);
    }
  });

  test('4.4 a bare 4xx/5xx reply is a rejection; the reply code is kept, the text never', async () => {
    assert.deepEqual(await envioCon(errorSmtp(undefined, 550)), {
      resultado: 'fallo',
      categoria: 'envio-rechazado',
      codigo: '550',
    });
    assert.deepEqual(await envioCon(errorSmtp(undefined, 421)), {
      resultado: 'fallo',
      categoria: 'envio-rechazado',
      codigo: '421',
    });
    assert.deepEqual(await envioCon(errorSmtp('EAUTH', 535)), {
      resultado: 'fallo',
      categoria: 'credenciales-invalidas',
      codigo: '535',
    });
    // A known code wins over the reply code; a reply outside 4xx/5xx is no rejection.
    assert.deepEqual(await envioCon(errorSmtp('EPROTOCOL', 554)), {
      resultado: 'fallo',
      categoria: 'error-desconocido',
      codigo: '554',
    });
    assert.deepEqual(await envioCon(errorSmtp(undefined, 250)), {
      resultado: 'fallo',
      categoria: 'error-desconocido',
      codigo: '250',
    });
  });

  test('4.4 a non-Error rejection or a synchronous throw is error-desconocido', async () => {
    const esperado = { resultado: 'fallo', categoria: 'error-desconocido', codigo: null };
    assert.deepEqual(await envioCon('535 clave-filtrada'), esperado);
    assert.deepEqual(await envioCon({ code: 'EAUTH', responseCode: 535 }), esperado);
    assert.deepEqual(await envioCon(undefined), esperado);
    const lanza: Transporte = {
      sendMail: () => {
        throw errorSmtp('ECONNECTION');
      },
      close: () => {},
    };
    assert.deepEqual(
      await notificadorDesdeTransporte(lanza, { de: REMITENTE, timeoutMs: 1000 }).enviar(CORREO),
      { resultado: 'fallo', categoria: 'servidor-inalcanzable', codigo: null },
    );
  });

  test('4.4 codigoSmtp keeps only a three-digit SMTP reply code', () => {
    for (const [valor, esperado] of [
      [250, '250'],
      [421, '421'],
      [599, '599'],
    ] as const) {
      assert.equal(codigoSmtp(valor), esperado);
    }
    const invalidos = [199, 600, 55, 5500, 550.5, -550, NaN, '550', 'ECONNECTION', '42P01', null];
    for (const valor of [...invalidos, undefined]) {
      assert.equal(codigoSmtp(valor), null, String(valor));
    }
  });
});

// ---- 4.5 hardening: no file or URL access, no library logging --------------------------

const CONFIG: ConfigSmtp = {
  host: 'smtp.empresa-demo.com',
  port: 587,
  secure: false,
  auth: { user: 'cuenta-envio', pass: 'clave-de-prueba' },
  de: REMITENTE,
};

describe('opcionesTransporte — hardened nodemailer options with the send budget', () => {
  test('4.5 sets the connection, the three socket timeouts and the hardening flags', () => {
    assert.deepEqual(opcionesTransporte(CONFIG, 1234), {
      host: 'smtp.empresa-demo.com',
      port: 587,
      secure: false,
      auth: { user: 'cuenta-envio', pass: 'clave-de-prueba' },
      connectionTimeout: 1234,
      greetingTimeout: 1234,
      socketTimeout: 1234,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
    const sinAuth = opcionesTransporte({ ...CONFIG, auth: null, port: 465, secure: true }, 50);
    assert.equal('auth' in sinAuth, false);
    assert.deepEqual([sinAuth.port, sinAuth.secure, sinAuth.socketTimeout], [465, true, 50]);
  });

  test('4.5 content that references a file or a URL is sent as text, never fetched', async () => {
    // The production options, with only the delivery swapped for JSON output.
    const json = createTransport({ ...opcionesTransporte(CONFIG, 1000), jsonTransport: true });
    const html = '<img src="file:///etc/passwd"><img src="http://127.0.0.1:9/x">';
    const base = { from: REMITENTE, to: CORREO.para };
    const info = await json.sendMail({ ...base, html, text: 'file:///etc/passwd' });
    const m = JSON.parse(info.message) as Record<string, unknown>;
    assert.equal(m.html, html);
    assert.equal(m.text, 'file:///etc/passwd');

    // Even a message that asks nodemailer to read a file or a URL is refused.
    await assert.rejects(json.sendMail({ ...base, html: { path: 'package.json' } }), {
      code: 'EFILEACCESS',
    });
    await assert.rejects(json.sendMail({ ...base, html: { href: 'http://127.0.0.1:9/x' } }), {
      code: 'EURLACCESS',
    });
  });
});

// ---- 4.6 the outer time limit (R2 under DEC-19) -----------------------------------------

/** A transport that answers after `ms`, or never; it counts its `close()` calls. */
function lento(ms: number | null, cierre: () => void = () => {}) {
  const t = {
    cerrado: 0,
    sendMail: () =>
      new Promise<unknown>((resolve) => {
        if (ms !== null) setTimeout(() => resolve({}), ms);
      }),
    close: () => {
      t.cerrado += 1;
      cierre();
    },
  };
  return t;
}

describe('notificadorDesdeTransporte — a send never outlives its budget', () => {
  test('4.6 a transport that never answers ends as tiempo-agotado and is closed', async () => {
    const t = lento(null);
    const inicio = performance.now();
    const r = await notificadorDesdeTransporte(t, { de: REMITENTE, timeoutMs: 20 }).enviar(CORREO);
    const ms = performance.now() - inicio;

    assert.deepEqual(r, { resultado: 'fallo', categoria: 'tiempo-agotado', codigo: null });
    assert.equal(t.cerrado, 1);
    assert.ok(ms >= 15 && ms < 1000, `ended after ${ms} ms`);
  });

  test('4.6 a send inside the budget is enviada and the transport stays open', async () => {
    const t = lento(5);
    const r = await notificadorDesdeTransporte(t, { de: REMITENTE, timeoutMs: 500 }).enviar(CORREO);
    assert.deepEqual(r, { resultado: 'enviada' });
    assert.equal(t.cerrado, 0);
  });

  test('4.6 a throwing close() and a late rejection still never make enviar throw', async () => {
    const t = lento(null, () => {
      throw new Error('close failed');
    });
    const tardio: Transporte = {
      sendMail: () => new Promise((_, reject) => setTimeout(() => reject(new Error('tarde')), 40)),
      close: () => t.close(),
    };
    const notificador = notificadorDesdeTransporte(tardio, { de: REMITENTE, timeoutMs: 10 });
    const r = await notificador.enviar(CORREO);
    assert.deepEqual(r, { resultado: 'fallo', categoria: 'tiempo-agotado', codigo: null });
    assert.equal(t.cerrado, 1);
    await new Promise((resolve) => setTimeout(resolve, 60)); // the late rejection lands here
  });
});

// ---- 4.7 the real SMTP notifier ---------------------------------------------------------

/** A local TCP server that accepts connections and never says a word. */
async function servidorMudo(): Promise<{ puerto: number; cerrar: () => Promise<void> }> {
  const sockets = new Set<net.Socket>();
  const servidor = net.createServer((s) => sockets.add(s));
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const { port } = servidor.address() as net.AddressInfo;
  return {
    puerto: port,
    cerrar: () =>
      new Promise((resolve) => {
        for (const s of sockets) s.destroy();
        servidor.close(() => resolve());
      }),
  };
}

describe('crearNotificadorSmtp — null when unset, bounded SMTP delivery when set', () => {
  test('4.7 SMTP unset gives no notifier; an invalid setting stops the boot', () => {
    assert.equal(crearNotificadorSmtp({ timeoutMs: 1000 }, {}), null);
    assert.equal(crearNotificadorSmtp({ timeoutMs: 1000 }, { SMTP_HOST: '' }), null);
    const incompleto = { SMTP_HOST: '127.0.0.1' };
    assert.throws(() => crearNotificadorSmtp({ timeoutMs: 1000 }, incompleto), /SMTP_FROM/);
  });

  test('4.7 a closed port is servidor-inalcanzable', async () => {
    const { puerto, cerrar } = await servidorMudo();
    await cerrar(); // the port is now free: nothing listens on it
    const notificador = crearNotificadorSmtp(
      { timeoutMs: 2000 },
      { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(puerto), SMTP_FROM: REMITENTE },
    );
    assert.deepEqual(await notificador?.enviar(CORREO), {
      resultado: 'fallo',
      categoria: 'servidor-inalcanzable',
      codigo: null,
    });
  });

  test('4.7 a server that never greets is tiempo-agotado within the budget', async () => {
    const { puerto, cerrar } = await servidorMudo();
    try {
      const notificador = crearNotificadorSmtp(
        { timeoutMs: 100 },
        { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(puerto), SMTP_FROM: REMITENTE },
      );
      const inicio = performance.now();
      const r = await notificador?.enviar(CORREO);
      const ms = performance.now() - inicio;
      assert.deepEqual(r, { resultado: 'fallo', categoria: 'tiempo-agotado', codigo: null });
      assert.ok(ms < 2000, `ended after ${ms} ms`);
    } finally {
      await cerrar();
    }
  });
});
