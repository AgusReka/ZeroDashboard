import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { registerAgenteRoutes } from './agentes-rutas.js';

/**
 * CH-19b: the `/agentes` header and body checks. They answer before any database read,
 * so they run against a client that throws on every model but `tenant` and need no
 * PostgreSQL. The routes that read and write are covered in `agentes-rutas.test.ts`.
 */

/** A client on which every model method throws, except the tenant lookup the hooks make. */
function clienteSoloTenant(tenant: { id: string; nombre: string; activo: boolean }): PrismaAislado {
  const modeloQueLanza = (modelo: string) =>
    new Proxy({}, {
      get: (_objetivo, metodo) => async () => {
        throw new Error(`la ruta leyó ${modelo}.${String(metodo)} antes de tiempo`);
      },
    });
  return new Proxy({}, {
    get: (_objetivo, modelo) =>
      modelo === 'tenant' ? { findUnique: async () => tenant } : modeloQueLanza(String(modelo)),
  }) as PrismaAislado;
}

describe('agent routes — tenant header and body shape, before any read (CH-19b R3)', () => {
  let sinLecturas!: FastifyInstance;

  before(async () => {
    sinLecturas = Fastify({ logger: false });
    const cliente = clienteSoloTenant({ id: 't-activo', nombre: 'Activo', activo: true });
    registrarContextoTenant(sinLecturas, cliente);
    registerAgenteRoutes(sinLecturas, cliente);
    await sinLecturas.ready();
  });

  after(async () => {
    await sinLecturas.close();
  });

  test('every agent route exists and is not exempt: no x-tenant-id answers 400 tenant-no-indicado', async () => {
    const rutas: ['GET' | 'POST', string, string][] = [
      ['POST', '/agentes', '/agentes'],
      ['GET', '/agentes', '/agentes'],
      ['POST', '/agentes/:id/revocar', '/agentes/cualquiera/revocar'],
    ];
    for (const [method, patron, url] of rutas) {
      assert.equal(sinLecturas.hasRoute({ method, url: patron }), true, `${method} ${patron}`);
      const respuesta = await sinLecturas.inject({ method, url, payload: method === 'POST' ? {} : undefined });
      assert.equal(respuesta.statusCode, 400, `${method} ${url}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    }
  });

  test('R3 a body naming a tenant, or any other key, is 400 naming it; nothing is read or written', async () => {
    // The throwing client proves no `Agente` row can have been created: any read or
    // write would have surfaced as a 500 instead of this 400 (rule 2).
    for (const [payload, campos] of [
      [{ tenantId: 'otro-tenant' }, ['/tenantId']],
      [{ token: 'zda_x' }, ['/token']],
    ] as const) {
      const respuesta = await sinLecturas.inject({
        method: 'POST',
        url: '/agentes',
        headers: { 'x-tenant-id': 't-activo' },
        payload,
      });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'solicitud-invalida', campos });
    }
  });
});
