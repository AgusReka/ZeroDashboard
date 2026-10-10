import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { EXENCIONES_OPERADOR } from './consola-auth.js';
import { cargarEstilos } from './estilos-rutas.js';
import { crearRegistroAgentes } from './registro-agentes.js';
import { registrarRutas } from './rutas.js';

process.env.APP_PORT ??= '3000';
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-29 (DEC-152, spec "Every Registered Route Is Guarded or Listed"): builds the app
 * with the same `registrarRutas` the entry point calls and checks the real route table.
 *
 * No database is needed. The client points at a closed local port on purpose: a request
 * the guard refuses never reaches the database (it has no cookie to look up), and an
 * exempt request that does reach a handler fails fast on the connection instead of
 * hanging. What is asserted is who answered, not what the handler would return.
 */
const URL_CERRADA = 'postgresql://nadie:nada@127.0.0.1:1/ninguna';

/** Turns a route pattern into a concrete URL: every parameter and wildcard becomes `x`. */
function urlConcreta(patron: string): string {
  return patron.replace(/:[A-Za-z0-9_]+/g, 'x').replace(/\*/g, 'x');
}

describe('CH-29 route table — every registered route is guarded or listed (DEC-152)', () => {
  let app!: FastifyInstance;
  const rutas = new Set<string>();

  before(async () => {
    app = Fastify({ logger: false });
    app.addHook('onRoute', (opciones) => {
      const metodos = Array.isArray(opciones.method) ? opciones.method : [opciones.method];
      for (const metodo of metodos) {
        rutas.add(`${metodo} ${opciones.url}`);
      }
    });
    const prisma = extenderConAislamiento(new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_CERRADA }) }));
    registrarRutas(app, {
      prisma,
      registro: crearRegistroAgentes(),
      estilos: cargarEstilos(),
      zonaHoraria: 'America/Argentina/Buenos_Aires',
    });
    // Registered after the guard, so it only runs for a request the guard let through;
    // the response header is how the test tells a guard refusal from a handler's own 401
    // (the panel answers `sesion-invalida` too, for its own cookie).
    app.addHook('onRequest', async (request) => {
      (request as { pasoGuard?: boolean }).pasoGuard = true;
    });
    app.addHook('onSend', async (request, reply) => {
      if ((request as { pasoGuard?: boolean }).pasoGuard === true) {
        reply.header('x-paso-guard', '1');
      }
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('the table is not empty and holds the routes this test is about', () => {
    assert.ok(rutas.size > 40, `only ${rutas.size} routes registered`);
    for (const fila of ['GET /consultas-guardadas', 'POST /consola/ingresar', 'POST /consola/salir', 'GET /tenants']) {
      assert.ok(rutas.has(fila), `${fila} is not registered`);
    }
  });

  test('every exempt row names a registered route', () => {
    for (const fila of EXENCIONES_OPERADOR) {
      assert.ok(rutas.has(fila), `${fila} is exempt but no such route is registered`);
    }
  });

  test('every non-exempt route without a cookie is refused by the guard with 401', async () => {
    const protegidas = [...rutas].filter((fila) => !EXENCIONES_OPERADOR.has(fila));
    assert.ok(protegidas.length > 30);
    for (const fila of protegidas) {
      const [metodo, patron] = fila.split(' ') as [string, string];
      const respuesta = await app.inject({
        method: metodo as 'GET',
        url: urlConcreta(patron),
        headers: { 'x-tenant-id': 'cualquiera' },
      });
      assert.equal(respuesta.statusCode, 401, `${fila} answered ${respuesta.statusCode}`);
      assert.equal(respuesta.headers['x-paso-guard'], undefined, `${fila} got past the guard`);
      if (metodo !== 'HEAD') {
        assert.deepEqual(respuesta.json(), { error: 'sesion-invalida' }, fila);
      }
    }
  });

  test('every exempt route without a cookie gets past the guard', async () => {
    for (const fila of EXENCIONES_OPERADOR) {
      const [metodo, patron] = fila.split(' ') as [string, string];
      const respuesta = await app.inject({ method: metodo as 'GET', url: urlConcreta(patron) });
      assert.equal(respuesta.headers['x-paso-guard'], '1', `${fila} was stopped by the guard`);
    }
  });

  test('an unmatched URL is refused by the guard, not answered 404', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/no-existe' });
    assert.equal(respuesta.statusCode, 401);
    assert.equal(respuesta.headers['x-paso-guard'], undefined);
  });
});
