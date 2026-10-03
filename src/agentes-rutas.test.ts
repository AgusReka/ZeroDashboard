import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { hashTokenAgente } from './agente-token.js';
import { registerAgenteRoutes } from './agentes-rutas.js';

/**
 * CH-19b unit 1b: the `/agentes` routes that read and write (R1-R8), against a live
 * PostgreSQL; skipped when none is reachable. The header and body checks that answer
 * before any read live in `agentes-rutas-sin-db.test.ts`.
 */

const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};
const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

const motivoSkip: string | false = (await esAlcanzable(objetivo.host, objetivo.port, 1000))
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

/** The agent projection: exactly these keys, never the token, its hash or `tenantId`. */
const CLAVES_PUBLICAS = ['creadoEn', 'id', 'revocadoEn', 'tokenEmitidoEn'];

describe('agent routes — emit, re-issue, list, revoke on a live PostgreSQL (CH-19b R1-R8)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures, row reads and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  let aislado!: PrismaAislado;
  const marca = `CH-19b u1b ${Date.now()}`;
  let tenantA!: string;
  let tenantB!: string;
  /** A's first token, kept to prove the re-issue supersedes it. */
  let tokenA!: string;

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    tenantA = (await prisma.tenant.create({ data: { nombre: `${marca} A` } })).id;
    tenantB = (await prisma.tenant.create({ data: { nombre: `${marca} B` } })).id;
    app = Fastify({ logger: false });
    aislado = extenderConAislamiento(prisma);
    registrarContextoTenant(app, aislado);
    registerAgenteRoutes(app, aislado);
    await app.ready();
  });

  after(async () => {
    // FK order: Conexion, Agente, Tenant.
    for (const tenantId of [tenantA, tenantB]) {
      if (tenantId === undefined) continue;
      await prisma.conexion.deleteMany({ where: { tenantId } });
      await prisma.agente.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  function pedir(method: 'GET' | 'POST', url: string, tenantId: string) {
    return app.inject({ method, url, headers: { 'x-tenant-id': tenantId }, payload: method === 'POST' ? {} : undefined });
  }

  /** Asserts a response carries no secret: not the token, not a hash, not a tenant id. */
  function sinSecretos(cuerpo: string, ...secretos: string[]): void {
    for (const secreto of [...secretos, tenantA, tenantB, 'tokenHash', 'tenantId']) {
      assert.equal(cuerpo.includes(secreto), false, `the response leaks ${secreto.slice(0, 8)}…`);
    }
  }

  test('R1 the first create is 201 with no-store, the four-key projection and a stored hash only', async () => {
    const respuesta = await pedir('POST', '/agentes', tenantA);
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    const { agente, token } = respuesta.json();
    assert.match(token, /^zda_[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(Object.keys(agente).sort(), CLAVES_PUBLICAS);
    assert.equal(agente.revocadoEn, null);
    const fila = await prisma.agente.findUniqueOrThrow({ where: { id: agente.id } });
    assert.equal(fila.tenantId, tenantA);
    assert.equal(fila.tokenHash, hashTokenAgente(token));
    assert.notEqual(fila.tokenHash, token);
    sinSecretos(JSON.stringify(agente), token, fila.tokenHash);
    tokenA = token;
  });

  test('R2 a create over an active agent is 409 agente-existente and leaves the hash unchanged', async () => {
    const antes = await prisma.agente.findUniqueOrThrow({ where: { tenantId: tenantA } });
    const respuesta = await pedir('POST', '/agentes', tenantA);
    assert.equal(respuesta.statusCode, 409, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'agente-existente' });
    const despues = await prisma.agente.findUniqueOrThrow({ where: { tenantId: tenantA } });
    assert.equal(despues.tokenHash, antes.tokenHash);
    assert.equal(despues.tokenHash, hashTokenAgente(tokenA));
  });

  test("R4 the list is scoped: B's is empty, A's holds its one agent with no secret", async () => {
    const deB = await pedir('GET', '/agentes', tenantB);
    assert.equal(deB.statusCode, 200, deB.body);
    assert.deepEqual(deB.json(), { agentes: [] });
    const deA = await pedir('GET', '/agentes', tenantA);
    assert.equal(deA.statusCode, 200, deA.body);
    const { agentes } = deA.json();
    assert.equal(agentes.length, 1);
    assert.deepEqual(Object.keys(agentes[0]).sort(), CLAVES_PUBLICAS);
    sinSecretos(deA.body, tokenA, hashTokenAgente(tokenA));
  });

  test("R5 B revoking A's agent, or an unknown id, is 404; A's revoke keeps the row; a repeat is 409", async () => {
    const { id } = await prisma.agente.findUniqueOrThrow({ where: { tenantId: tenantA } });
    for (const url of [`/agentes/${id}/revocar`, '/agentes/no-existe/revocar']) {
      const ajena = await pedir('POST', url, tenantB);
      assert.equal(ajena.statusCode, 404, ajena.body);
      assert.deepEqual(ajena.json(), { error: 'agente-no-encontrado' });
    }
    assert.equal((await prisma.agente.findUniqueOrThrow({ where: { id } })).revocadoEn, null);

    const propia = await pedir('POST', `/agentes/${id}/revocar`, tenantA);
    assert.equal(propia.statusCode, 200, propia.body);
    const { agente } = propia.json();
    assert.deepEqual(Object.keys(agente).sort(), CLAVES_PUBLICAS);
    assert.equal(agente.id, id);
    assert.notEqual(agente.revocadoEn, null);
    sinSecretos(propia.body, tokenA, hashTokenAgente(tokenA));
    const fila = await prisma.agente.findUniqueOrThrow({ where: { id } });
    assert.equal(fila.revocadoEn?.toISOString(), agente.revocadoEn);

    const repetida = await pedir('POST', `/agentes/${id}/revocar`, tenantA);
    assert.equal(repetida.statusCode, 409, repetida.body);
    assert.deepEqual(repetida.json(), { error: 'agente-revocado' });
    assert.equal((await prisma.agente.findUniqueOrThrow({ where: { id } })).revocadoEn?.toISOString(), agente.revocadoEn);
  });

  test("R6 a revoked agent's hash looks up null", async () => {
    assert.equal(await aislado.agente.buscarPorTokenHash(hashTokenAgente(tokenA)), null);
  });

  test('R7 a revoked agent is re-issued in place: same id and creadoEn, new token, old one dead', async () => {
    const antes = await prisma.agente.findUniqueOrThrow({ where: { tenantId: tenantA } });
    assert.notEqual(antes.revocadoEn, null);
    const respuesta = await pedir('POST', '/agentes', tenantA);
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    const { agente, token } = respuesta.json();
    assert.deepEqual(Object.keys(agente).sort(), CLAVES_PUBLICAS);
    assert.equal(agente.id, antes.id);
    assert.equal(agente.creadoEn, antes.creadoEn.toISOString());
    assert.equal(agente.revocadoEn, null);
    assert.ok(new Date(agente.tokenEmitidoEn) > antes.tokenEmitidoEn);
    assert.notEqual(token, tokenA);
    assert.equal(await aislado.agente.buscarPorTokenHash(hashTokenAgente(tokenA)), null);
    assert.deepEqual(await aislado.agente.buscarPorTokenHash(hashTokenAgente(token)), {
      id: antes.id,
      tenantId: tenantA,
      tenantActivo: true,
    });
    sinSecretos(JSON.stringify(agente), token, hashTokenAgente(token));
    tokenA = token;
  });

  test('R7 of two concurrent re-issues only one wins; the other is 409 and its token never stored', async () => {
    const { id } = await prisma.agente.findUniqueOrThrow({ where: { tenantId: tenantA } });
    assert.equal((await pedir('POST', `/agentes/${id}/revocar`, tenantA)).statusCode, 200);
    const respuestas = await Promise.all([pedir('POST', '/agentes', tenantA), pedir('POST', '/agentes', tenantA)]);
    assert.deepEqual(respuestas.map((r) => r.statusCode).sort(), [200, 409]);
    const ganador = respuestas.find((r) => r.statusCode === 200)!.json().token;
    const fila = await prisma.agente.findUniqueOrThrow({ where: { tenantId: tenantA } });
    assert.equal(fila.tokenHash, hashTokenAgente(ganador));
    tokenA = ganador;
  });

  test("R8 B's concurrent creates yield one agent; each tenant's token resolves only to its own tenant", async () => {
    const respuestas = await Promise.all([pedir('POST', '/agentes', tenantB), pedir('POST', '/agentes', tenantB)]);
    assert.deepEqual(respuestas.map((r) => r.statusCode).sort(), [201, 409]);
    const tokenB = respuestas.find((r) => r.statusCode === 201)!.json().token;
    assert.equal((await aislado.agente.buscarPorTokenHash(hashTokenAgente(tokenB)))?.tenantId, tenantB);
    assert.equal((await aislado.agente.buscarPorTokenHash(hashTokenAgente(tokenA)))?.tenantId, tenantA);
    assert.equal((await pedir('GET', '/agentes', tenantB)).json().agentes.length, 1);
  });
});
