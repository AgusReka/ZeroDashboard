import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { PrismaAislado } from './aislamiento-prisma.js';
import {
  alcanzable,
  borrarOperadores,
  crearCliente,
  crearOperador,
  crearSesion,
  motivoSkip,
  nombreUnico,
} from './consola-auth-apoyo.js';
import { NOMBRE_COOKIE_CONSOLA, resolverSesionConsola } from './consola-auth.js';

describe(
  'CH-29 resolverSesionConsola — live PostgreSQL target (DEC-151)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let prisma!: PrismaAislado;
    const nombre = nombreUnico('op-sesion');
    let operadorId = '';

    before(async () => {
      prisma = crearCliente();
      operadorId = (await crearOperador(prisma, nombre, 'clave-de-prueba-larga')).id;
    });

    after(async () => {
      await borrarOperadores(prisma, [nombre]);
      await prisma.$disconnect();
    });

    test('no cookie, an empty value, or only the panel cookie resolve to sin-cookie', async () => {
      for (const cabecera of [undefined, '', `${NOMBRE_COOKIE_CONSOLA}=`, 'zd_panel_session=abc']) {
        const desenlace = await resolverSesionConsola(prisma, cabecera);
        assert.equal(desenlace.motivo, 'sin-cookie', String(cabecera));
        assert.equal(desenlace.operador, null);
      }
    });

    test('an unknown token resolves to token-desconocido', async () => {
      const desenlace = await resolverSesionConsola(prisma, `${NOMBRE_COOKIE_CONSOLA}=no-existe`);
      assert.equal(desenlace.motivo, 'token-desconocido');
    });

    test('a live session names its operator, found by the hash of the token', async () => {
      const { sesion, tokenPlano } = await crearSesion(prisma, operadorId, new Date(Date.now() + 60_000));
      assert.notEqual(sesion.tokenHash, tokenPlano);
      const desenlace = await resolverSesionConsola(prisma, `otra=1; ${NOMBRE_COOKIE_CONSOLA}=${tokenPlano}`);
      assert.equal(desenlace.motivo, 'valida');
      assert.deepEqual(desenlace.operador, { id: operadorId, nombre });
      assert.equal(desenlace.sesionId, sesion.id);
    });

    test('an expired session resolves to expirada and its row is deleted on use', async () => {
      const { sesion, tokenPlano } = await crearSesion(prisma, operadorId, new Date(Date.now() - 1000));
      const desenlace = await resolverSesionConsola(prisma, `${NOMBRE_COOKIE_CONSOLA}=${tokenPlano}`);
      assert.equal(desenlace.motivo, 'expirada');
      assert.equal(await prisma.sesionConsola.findUnique({ where: { id: sesion.id } }), null);
    });

    test('deleting the operator deletes its sessions', async () => {
      const otro = nombreUnico('op-cascada');
      const { id } = await crearOperador(prisma, otro, 'clave-de-prueba-larga');
      const { sesion } = await crearSesion(prisma, id, new Date(Date.now() + 60_000));
      await borrarOperadores(prisma, [otro]);
      assert.equal(await prisma.sesionConsola.findUnique({ where: { id: sesion.id } }), null);
    });
  },
);
