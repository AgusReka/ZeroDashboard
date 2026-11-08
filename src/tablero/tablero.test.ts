import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { TOPE_REPORTES_TABLERO, pendientesDe } from './tablero.js';
import { registerTableroRoutes } from './tablero-rutas.js';

/**
 * CH-46 (DEC-199) task 3.4: the dashboard's pure half. The body's shape is checked through
 * Fastify's own AJV (the configuration `removeAdditional` runs under), with a client that
 * throws on any use, so a refused body that reached the database fails the case loudly.
 */

/** Every method throws, at any depth: a refused body must never reach a query. */
const clienteQueNuncaDebeConsultarse: PrismaAislado = new Proxy({}, {
  get: (_objetivo, modelo) =>
    new Proxy({}, {
      get: (_otro, metodo) => async () => {
        throw new Error(`un cuerpo rechazado llegó a ${String(modelo)}.${String(metodo)}`);
      },
    }),
}) as PrismaAislado;

const ids = (cantidad: number) => Array.from({ length: cantidad }, (_, i) => `r-${i}`);

describe('CH-46 dashboard body — the shape is refused before any read (DEC-199)', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    registerTableroRoutes(app, clienteQueNuncaDebeConsultarse);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  async function rechazar(payload: unknown): Promise<string[]> {
    const respuesta = await app.inject({ method: 'PUT', url: '/tablero', payload: payload as object });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    const cuerpo = respuesta.json() as { error: string; campos: string[] };
    assert.equal(cuerpo.error, 'solicitud-invalida');
    return cuerpo.campos;
  }

  test(`the cap is ${TOPE_REPORTES_TABLERO} reports, and a ninth is refused on /reportes`, async () => {
    assert.equal(TOPE_REPORTES_TABLERO, 8);
    assert.deepEqual(await rechazar({ conexionId: 'c-a', reportes: ids(9) }), ['/reportes']);
  });

  test('a repeated report is refused on /reportes', async () => {
    assert.deepEqual(await rechazar({ conexionId: 'c-a', reportes: ['r-1', 'r-1'] }), ['/reportes']);
  });

  test('an unknown key is refused, never stripped: a tenantId in the body names itself', async () => {
    assert.deepEqual(await rechazar({ conexionId: 'c-a', reportes: [], tenantId: 'otro' }), ['/tenantId']);
  });

  test('both fields are required, even for an empty dashboard', async () => {
    assert.deepEqual(await rechazar({ reportes: [] }), ['/conexionId']);
    assert.deepEqual(await rechazar({ conexionId: 'c-a' }), ['/reportes']);
    assert.deepEqual(await rechazar({ conexionId: '', reportes: [] }), ['/conexionId']);
  });

  test('a report id is a string: an object in the list names its index', async () => {
    assert.deepEqual(await rechazar({ conexionId: 'c-a', reportes: [{ id: 'r-1' }] }), ['/reportes/0']);
  });
});

describe('CH-46 pendientesDe — the DEC-71 rule as an informative list (DEC-199)', () => {
  const valida = (entidad: string) => ({ entidad, sql: `SELECT * FROM ${entidad}`, estadoValidacion: 'valida' });

  test('every view approved: nothing is pending', () => {
    assert.deepEqual(pendientesDe(['producto', 'pedido'], [valida('producto'), valida('pedido')]), []);
  });

  test('a view not validated, invalid or missing is pending', () => {
    const filas = [
      valida('producto'),
      { entidad: 'pedido', sql: 'SELECT 1', estadoValidacion: 'no-validado' },
      { entidad: 'insumo', sql: 'SELECT 1', estadoValidacion: 'invalida' },
    ];
    assert.deepEqual(pendientesDe(['producto', 'pedido'], filas), ['pedido']);
    assert.deepEqual(pendientesDe(['insumo'], filas), ['insumo']);
    assert.deepEqual(pendientesDe(['item_pedido'], filas), ['item_pedido']);
  });

  test('the list is in contract order, whatever order the report declares', () => {
    assert.deepEqual(pendientesDe(['receta_componente', 'pedido', 'producto'], []), [
      'producto',
      'pedido',
      'receta_componente',
    ]);
  });

  test('rows of entities the report does not declare are ignored', () => {
    assert.deepEqual(pendientesDe(['producto'], [valida('producto'), { entidad: 'pedido', sql: 'x', estadoValidacion: 'invalida' }]), []);
  });

  test('a stored entity list outside the contract fails closed', () => {
    assert.throws(() => pendientesDe(['cliente'], []));
    assert.throws(() => pendientesDe([], []));
  });
});
