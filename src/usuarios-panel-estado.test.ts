import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  accion,
  alcanzable,
  cookiePanel,
  correoUnico,
  crear,
  desmontar,
  ingresarPanel,
  montar,
  motivoSkip,
  type Montaje,
} from './usuarios-panel-apoyo.js';

describe(
  'CH-28 reset, deactivate and reactivate panel users — live PostgreSQL target (DEC-156, DEC-158)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let m!: Montaje;

    before(async () => {
      m = await montar('estado');
    });

    after(async () => {
      await desmontar(m);
    });

    /** Creates a user in `tenant`, logs it into the panel, and returns its id, password and cookie. */
    async function usuarioConSesion(tenant: string) {
      const correo = correoUnico('estado');
      const { usuario, clave } = (await crear(m, tenant, { correo })).json();
      const ingreso = await ingresarPanel(m, correo, clave);
      assert.equal(ingreso.statusCode, 200, ingreso.body);
      return { id: usuario.id as string, correo, clave: clave as string, cookie: cookiePanel(ingreso.headers['set-cookie']) };
    }

    async function sesionViva(cookie: string): Promise<number> {
      const r = await m.app.inject({ method: 'GET', url: '/api/panel/auth/sesion', headers: { cookie } });
      return r.statusCode;
    }

    test('reset answers a new password once, no-store; the old password and session die, the new one logs in', async () => {
      const u = await usuarioConSesion(m.tenantA);
      const respuesta = await accion(m, m.tenantA, u.id, 'clave');
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.equal(respuesta.headers['cache-control'], 'no-store');
      const { usuario, clave } = respuesta.json();
      assert.equal(usuario.id, u.id);
      assert.deepEqual(Object.keys(usuario).sort(), ['activo', 'correo', 'creadoEn', 'id', 'nombre']);
      assert.match(clave, /^[A-Za-z0-9_-]{24}$/);
      assert.notEqual(clave, u.clave);
      assert.equal(await m.db.sesionPanel.count({ where: { usuarioId: u.id } }), 0);
      assert.equal(await sesionViva(u.cookie), 401);
      assert.equal((await ingresarPanel(m, u.correo, u.clave)).statusCode, 401);
      assert.equal((await ingresarPanel(m, u.correo, clave)).statusCode, 200);
      assert.ok(!m.log().includes(clave));
    });

    test('reset works on an inactive user, which stays inactive', async () => {
      const u = await usuarioConSesion(m.tenantA);
      assert.equal((await accion(m, m.tenantA, u.id, 'desactivar')).statusCode, 200);
      const respuesta = await accion(m, m.tenantA, u.id, 'clave');
      assert.equal(respuesta.statusCode, 200);
      assert.equal(respuesta.json().usuario.activo, false);
      assert.equal((await ingresarPanel(m, u.correo, respuesta.json().clave)).statusCode, 401);
    });

    test('deactivate deletes every session and refuses login; a second time is 409 usuario-inactivo', async () => {
      const u = await usuarioConSesion(m.tenantA);
      await ingresarPanel(m, u.correo, u.clave);
      assert.equal(await m.db.sesionPanel.count({ where: { usuarioId: u.id } }), 2);
      const respuesta = await accion(m, m.tenantA, u.id, 'desactivar');
      assert.equal(respuesta.statusCode, 200);
      assert.equal(respuesta.json().usuario.activo, false);
      assert.equal(await m.db.sesionPanel.count({ where: { usuarioId: u.id } }), 0);
      assert.equal(await sesionViva(u.cookie), 401);
      assert.equal((await ingresarPanel(m, u.correo, u.clave)).statusCode, 401);
      const otra = await accion(m, m.tenantA, u.id, 'desactivar');
      assert.deepEqual([otra.statusCode, otra.json()], [409, { error: 'usuario-inactivo' }]);
    });

    test('reactivate restores access with the same password; on an active user it is 409 usuario-activo', async () => {
      const u = await usuarioConSesion(m.tenantA);
      const activo = await accion(m, m.tenantA, u.id, 'reactivar');
      assert.deepEqual([activo.statusCode, activo.json()], [409, { error: 'usuario-activo' }]);
      await accion(m, m.tenantA, u.id, 'desactivar');
      const respuesta = await accion(m, m.tenantA, u.id, 'reactivar');
      assert.equal(respuesta.statusCode, 200);
      assert.equal(respuesta.json().usuario.activo, true);
      assert.ok(!('clave' in respuesta.json()), 'reactivating generates no password');
      assert.equal((await ingresarPanel(m, u.correo, u.clave)).statusCode, 200);
    });

    test('an unknown id is 404 usuario-no-encontrado on all three routes', async () => {
      for (const verbo of ['clave', 'desactivar', 'reactivar'] as const) {
        const r = await accion(m, m.tenantA, '00000000-0000-4000-8000-000000000000', verbo);
        assert.deepEqual([r.statusCode, r.json()], [404, { error: 'usuario-no-encontrado' }], verbo);
      }
    });

    test('tenant A cannot reset, deactivate or reactivate a user of tenant B, and B is untouched', async () => {
      const u = await usuarioConSesion(m.tenantB);
      const antes = await m.db.usuario.findUniqueOrThrow({ where: { id: u.id } });
      for (const verbo of ['clave', 'desactivar', 'reactivar'] as const) {
        const r = await accion(m, m.tenantA, u.id, verbo);
        assert.deepEqual([r.statusCode, r.json()], [404, { error: 'usuario-no-encontrado' }], verbo);
      }
      const despues = await m.db.usuario.findUniqueOrThrow({ where: { id: u.id } });
      assert.equal(despues.claveHash, antes.claveHash);
      assert.equal(despues.activo, true);
      assert.equal(await m.db.sesionPanel.count({ where: { usuarioId: u.id } }), 1);
      assert.equal(await sesionViva(u.cookie), 200);
    });
  },
);
