import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { verificarClave } from './crypto-auth.js';
import { LIMITE_LISTADO } from './listados.js';
import {
  alcanzable,
  correoUnico,
  crear,
  desmontar,
  ingresarPanel,
  montar,
  motivoSkip,
  type Montaje,
} from './usuarios-panel-apoyo.js';

describe(
  'CH-28 create and list panel users — live PostgreSQL target (DEC-155, DEC-157)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let m!: Montaje;

    before(async () => {
      m = await montar('rutas');
    });

    after(async () => {
      await desmontar(m);
    });

    test('create answers 201 with the normalized email and a password, once and no-store', async () => {
      const correo = correoUnico('Ana').toUpperCase();
      const respuesta = await crear(m, m.tenantA, { correo: `  ${correo} `, nombre: '  Ana  ' });
      assert.equal(respuesta.statusCode, 201, respuesta.body);
      assert.equal(respuesta.headers['cache-control'], 'no-store');
      const { usuario, clave } = respuesta.json();
      assert.equal(usuario.correo, correo.toLowerCase());
      assert.equal(usuario.nombre, 'Ana');
      assert.equal(usuario.activo, true);
      assert.deepEqual(Object.keys(usuario).sort(), ['activo', 'correo', 'creadoEn', 'id', 'nombre']);
      assert.match(clave, /^[A-Za-z0-9_-]{24}$/);
      const fila = await m.db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
      assert.equal(fila.tenantId, m.tenantA);
      assert.notEqual(fila.claveHash, clave);
      assert.equal(await verificarClave(clave, fila.claveHash), true);
    });

    test('the generated password logs into the panel, whatever case the email is typed in', async () => {
      const correo = correoUnico('caso');
      const { clave } = (await crear(m, m.tenantA, { correo })).json();
      const ingreso = await ingresarPanel(m, `  ${correo.toUpperCase()} `, clave);
      assert.equal(ingreso.statusCode, 200, ingreso.body);
      assert.equal(ingreso.json().tenant.id, m.tenantA);
    });

    test('a blank or absent name is stored as null', async () => {
      for (const cuerpo of [{ correo: correoUnico('sin-nombre') }, { correo: correoUnico('blanco'), nombre: '   ' }]) {
        const respuesta = await crear(m, m.tenantA, cuerpo);
        assert.equal(respuesta.statusCode, 201, respuesta.body);
        assert.equal(respuesta.json().usuario.nombre, null);
      }
    });

    test('an email taken in another tenant is 409 correo-en-uso, names no tenant, and creates nothing', async () => {
      const correo = correoUnico('compartido');
      assert.equal((await crear(m, m.tenantB, { correo })).statusCode, 201);
      const antes = await m.db.usuario.count({ where: { tenantId: m.tenantA } });
      const respuesta = await crear(m, m.tenantA, { correo: correo.toUpperCase() });
      assert.equal(respuesta.statusCode, 409);
      assert.deepEqual(respuesta.json(), { error: 'correo-en-uso' });
      assert.ok(!respuesta.body.includes(m.tenantB));
      assert.equal(await m.db.usuario.count({ where: { tenantId: m.tenantA } }), antes);
      const mismo = await crear(m, m.tenantB, { correo });
      assert.deepEqual([mismo.statusCode, mismo.json()], [409, { error: 'correo-en-uso' }], 'same answer in its own tenant');
    });

    test('the body is strict: a tenantId, a clave, a bad email or a long name is a 400 and creates nothing', async () => {
      const antes = await m.db.usuario.count({ where: { tenantId: m.tenantA } });
      for (const [cuerpo, campo] of [
        [{ correo: correoUnico('t'), tenantId: m.tenantB }, null],
        [{ correo: correoUnico('c'), clave: 'elegida-por-mi' }, null],
        [{ correo: 'sin-arroba' }, '/correo'],
        [{ correo: 'a@b@c' }, '/correo'],
        [{ correo: correoUnico('n'), nombre: 'x'.repeat(121) }, '/nombre'],
        [{}, null],
      ] as const) {
        const respuesta = await crear(m, m.tenantA, cuerpo);
        assert.equal(respuesta.statusCode, 400, JSON.stringify(cuerpo));
        assert.equal(respuesta.json().error, 'solicitud-invalida');
        if (campo !== null) {
          assert.ok(respuesta.json().campos.includes(campo), `${campo} in ${respuesta.body}`);
        }
      }
      assert.equal(await m.db.usuario.count({ where: { tenantId: m.tenantA } }), antes);
    });

    test('the list holds only the tenant users, by email, never a hash nor a password', async () => {
      const deA = correoUnico('lista-a');
      const deB = correoUnico('lista-b');
      const { clave } = (await crear(m, m.tenantA, { correo: deA })).json();
      await crear(m, m.tenantB, { correo: deB });
      const respuesta = await m.app.inject({ method: 'GET', url: '/usuarios', headers: { 'x-tenant-id': m.tenantA } });
      assert.equal(respuesta.statusCode, 200);
      const { usuarios, truncado } = respuesta.json();
      assert.equal(truncado, false);
      const correos = usuarios.map((u: { correo: string }) => u.correo);
      assert.ok(correos.includes(deA));
      assert.ok(!correos.includes(deB));
      assert.deepEqual(correos, [...correos].sort());
      for (const u of usuarios) {
        assert.deepEqual(Object.keys(u).sort(), ['activo', 'correo', 'creadoEn', 'id', 'nombre']);
      }
      assert.ok(!respuesta.body.includes(clave));
      assert.ok(!respuesta.body.includes('scrypt'));
    });

    test('the list is capped at the listing limit and says so', async () => {
      const filas = Array.from({ length: LIMITE_LISTADO + 1 }, (_, i) => ({
        tenantId: m.tenantB,
        correo: correoUnico(`tope-${i}`),
        claveHash: 'no-es-una-clave',
      }));
      await m.db.usuario.createMany({ data: filas });
      const respuesta = await m.app.inject({ method: 'GET', url: '/usuarios', headers: { 'x-tenant-id': m.tenantB } });
      const { usuarios, truncado } = respuesta.json();
      assert.equal(usuarios.length, LIMITE_LISTADO);
      assert.equal(truncado, true);
    });

    test('no generated password ever reached the log', async () => {
      const { clave } = (await crear(m, m.tenantA, { correo: correoUnico('log') })).json();
      assert.ok(clave.length > 0);
      assert.ok(!m.log().includes(clave));
    });
  },
);
