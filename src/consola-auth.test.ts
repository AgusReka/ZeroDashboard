import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  EXENCIONES_OPERADOR,
  NOMBRE_COOKIE_CONSOLA,
  SEGUNDOS_VIDA_SESION_CONSOLA,
  cookieDeSesionConsola,
  cookieVaciaConsola,
  requiereOperador,
} from './consola-auth.js';
import { ESTILOS_EXENTOS, RUTAS_PANEL_PUBLICAS } from './contexto-tenant.js';
import { leerCookie } from './cookies.js';

describe('CH-29 console session cookie (DEC-151)', () => {
  test('the cookie has its own name, apart from the panel cookie', () => {
    assert.equal(NOMBRE_COOKIE_CONSOLA, 'zd_consola_session');
    assert.notEqual(NOMBRE_COOKIE_CONSOLA, 'zd_panel_session');
  });

  test('the session lasts 12 hours', () => {
    assert.equal(SEGUNDOS_VIDA_SESION_CONSOLA, 12 * 60 * 60);
  });

  test('the session cookie carries every attribute and a Max-Age equal to the lifetime', () => {
    const cookie = cookieDeSesionConsola('abc');
    assert.ok(cookie.startsWith('zd_consola_session=abc; '));
    for (const atributo of ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Secure', `Max-Age=${12 * 60 * 60}`]) {
      assert.ok(cookie.split('; ').includes(atributo), `missing ${atributo} in ${cookie}`);
    }
  });

  test('the logout cookie is empty and expires at once', () => {
    const cookie = cookieVaciaConsola();
    assert.ok(cookie.startsWith('zd_consola_session=; '));
    for (const atributo of ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Secure', 'Max-Age=0']) {
      assert.ok(cookie.split('; ').includes(atributo), `missing ${atributo} in ${cookie}`);
    }
  });

  test('the shared reader finds the console token next to the panel token', () => {
    const cabecera = 'zd_panel_session=p1; zd_consola_session=c1';
    assert.equal(leerCookie(cabecera, NOMBRE_COOKIE_CONSOLA), 'c1');
    assert.equal(leerCookie(cabecera, 'zd_panel_session'), 'p1');
    assert.equal(leerCookie('zd_panel_session=p1', NOMBRE_COOKIE_CONSOLA), null);
    assert.equal(leerCookie(undefined, NOMBRE_COOKIE_CONSOLA), null);
  });

  test('a repeated cookie name yields the first value, and a value may contain "="', () => {
    assert.equal(leerCookie('zd_consola_session=a; zd_consola_session=b', NOMBRE_COOKIE_CONSOLA), 'a');
    assert.equal(leerCookie('zd_consola_session==x', NOMBRE_COOKIE_CONSOLA), '=x');
  });
});

describe('CH-29 operator guard exemptions (DEC-152)', () => {
  test('the console login, the page, health and the panel page are exempt', () => {
    for (const fila of ['GET /health', 'GET /consola', 'POST /consola/ingresar', 'GET /panel']) {
      assert.ok(EXENCIONES_OPERADOR.has(fila), `${fila} should be exempt`);
    }
  });

  test('every stylesheet row and every public panel row is exempt, built from their own sets', () => {
    for (const fila of [...ESTILOS_EXENTOS, ...RUTAS_PANEL_PUBLICAS]) {
      assert.ok(EXENCIONES_OPERADOR.has(fila), `${fila} should be exempt`);
    }
    assert.equal(EXENCIONES_OPERADOR.size, 4 + ESTILOS_EXENTOS.size + RUTAS_PANEL_PUBLICAS.size);
  });

  test('logout and the routes exempt only from the tenant header stay guarded', () => {
    for (const [metodo, patron] of [
      ['POST', '/consola/salir'],
      ['GET', '/tenants'],
      ['POST', '/tenants'],
      ['GET', '/tenants/:id'],
      ['GET', '/contrato'],
      ['GET', '/plantillas'],
      ['PUT', '/plantillas/:id'],
      ['GET', '/consultas-guardadas'],
    ] as const) {
      assert.equal(requiereOperador(metodo, patron), true, `${metodo} ${patron}`);
    }
  });

  test('exempt rows are exact: another method or a look-alike path is guarded', () => {
    assert.equal(requiereOperador('GET', '/consola'), false);
    assert.equal(requiereOperador('POST', '/consola'), true);
    assert.equal(requiereOperador('GET', '/consola-falsa'), true);
    assert.equal(requiereOperador('GET', '/consola/ingresar'), true);
    assert.equal(requiereOperador('HEAD', '/health'), true);
    assert.equal(requiereOperador('GET', '/panel/'), true);
  });

  test('a request that matched no route is guarded', () => {
    assert.equal(requiereOperador('GET', undefined), true);
  });
});
