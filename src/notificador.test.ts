import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { leerSmtp } from './notificador.js';

/**
 * Unit cases for CH-14 Phase 4: the notifier (DEC-81, DEC-86 and its addendum). `leerSmtp`
 * reads an explicit environment object, so no case touches `process.env` or the network.
 */

const REMITENTE = 'avisos@empresa-demo.com';

// ---- 4.1 / 4.2 SMTP_* parsing (DEC-86 addendum) --------------------------------------

describe('leerSmtp — SMTP is optional, and complete and valid once SMTP_HOST is set', () => {
  test('4.1 an absent or empty SMTP_HOST means not configured, whatever else is set', () => {
    assert.equal(leerSmtp({}), null);
    assert.equal(leerSmtp({ SMTP_HOST: '' }), null);
    // Nothing else is read when SMTP is unset: a stray invalid value cannot stop the boot.
    assert.equal(leerSmtp({ SMTP_HOST: '', SMTP_PORT: 'x', SMTP_SECURE: 'si', SMTP_USER: 'u' }), null);
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
