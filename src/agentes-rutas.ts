import type { FastifyInstance } from 'fastify';
import { Prisma } from './generated/prisma/client.js';
import { conTenantInyectado, type PrismaAislado } from './aislamiento-prisma.js';
import { generarTokenAgente, hashTokenAgente } from './agente-token.js';
import { camposInvalidos } from './conexiones.js';
import type { RegistroAgentes } from './registro-agentes.js';

/**
 * CH-19b (DEC-114, DEC-115, DEC-121): the tenant's one agent and its token — emit,
 * re-issue in place, list, revoke. None of these routes is exempt from `x-tenant-id`:
 * `Agente` is a scoped model, so every read and write below is filtered by the tenant the
 * hooks resolved from the header (DEC-13), and the body never names one (rule 2). The
 * `/agente/` prefix, slash-terminated, stays reserved for the agent's own routes (DEC-116).
 *
 * There is no operator authentication, as on every other admin route; DEC-121 accepts it.
 */

/**
 * The only projection any response reads from `Agente`. `tokenHash` and `tenantId` are
 * absent by construction, so no response can echo them; the token itself is never stored,
 * and it appears only in the one response that emits it.
 */
export const AgentePublico = {
  id: true,
  creadoEn: true,
  tokenEmitidoEn: true,
  revocadoEn: true,
} as const;

interface AgenteParams {
  id: string;
}

/**
 * The body carries nothing: the tenant comes from the header and the token is generated
 * here. `propertyNames: false` rejects every key, `tenantId` included, for the reason
 * `registroConexionSchema` documents (under `removeAdditional`, `additionalProperties`
 * alone would strip the key and accept the body). The design's `{ enum: [] }` is not
 * used: AJV refuses an empty `enum` when the schema is compiled. A request with no body
 * at all is a `400` too, since the schema demands an object: send `{}`.
 */
const emisionAgenteSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: false,
} as const;

/** `P2002` is Prisma's unique-constraint violation; here `Agente_tenantId_key` raises it. */
function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Built without a session registry, revoking closes no socket (CH-19c1). */
const SIN_REGISTRO: Pick<RegistroAgentes, 'cerrarAgente'> = { cerrarAgente: () => {} };

export function registerAgenteRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
  agentes: Pick<RegistroAgentes, 'cerrarAgente'> = SIN_REGISTRO,
): void {
  /**
   * Creates the tenant's agent when it has none. The token is generated per request and
   * answered once with `Cache-Control: no-store`; only its hash reaches the database, and
   * neither is ever logged or put in an error body.
   */
  app.post('/agentes', { schema: { body: emisionAgenteSchema }, attachValidation: true }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({
        error: 'solicitud-invalida',
        campos: camposInvalidos(request.validationError),
      });
    }

    // Scoped by the extension, so this is the header tenant's row or nothing.
    const actual = await prisma.agente.findFirst({ select: { id: true, revocadoEn: true } });
    if (actual !== null && actual.revocadoEn === null) {
      return reply.code(409).send({ error: 'agente-existente' });
    }

    const token = generarTokenAgente();
    if (actual !== null) {
      // Re-issue in place (DEC-121): same id, so `Conexion.agenteId` stays valid; the old
      // hash is overwritten, so the old token stops resolving. The `revocadoEn` guard makes
      // the write the arbiter: of two concurrent re-issues only one matches, and the
      // loser's token is answered nowhere and stored nowhere.
      const { count } = await prisma.agente.updateMany({
        where: { id: actual.id, revocadoEn: { not: null } },
        data: { tokenHash: hashTokenAgente(token), tokenEmitidoEn: new Date(), revocadoEn: null },
      });
      if (count === 0) {
        return reply.code(409).send({ error: 'agente-existente' });
      }
      const agente = await prisma.agente.findUniqueOrThrow({ where: { id: actual.id }, select: AgentePublico });
      return reply.code(200).header('cache-control', 'no-store').send({ agente, token });
    }

    let agente;
    try {
      agente = await prisma.agente.create({
        data: conTenantInyectado({ tokenHash: hashTokenAgente(token) }),
        select: AgentePublico,
      });
    } catch (error) {
      // A concurrent create won between the read and this insert: the database is the
      // arbiter, and the answer is the one a later request would get.
      if (esViolacionDeUnicidad(error)) {
        return reply.code(409).send({ error: 'agente-existente' });
      }
      throw error;
    }
    return reply.code(201).header('cache-control', 'no-store').send({ agente, token });
  });

  // Zero or one entry (`Agente_tenantId_key`); a revoked agent is listed too. The order
  // is stated anyway, ascending like the tenant selector, so the shape never depends on
  // the planner.
  app.get('/agentes', async (_request, reply) => {
    const agentes = await prisma.agente.findMany({
      select: AgentePublico,
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
    });
    return reply.code(200).send({ agentes });
  });

  /**
   * Soft revocation (DEC-121): `revocadoEn` is set and the row stays, so its connections
   * keep their `agenteId` and a later `POST /agentes` re-issues in place. The same shape
   * as `/tenants/:id/baja` (read first, so an already-revoked row is told apart from an
   * unknown one), with the write guarded on `revocadoEn: null` so a concurrent revoke
   * cannot report a second, fictitious transition.
   */
  app.post<{ Params: AgenteParams }>('/agentes/:id/revocar', async (request, reply) => {
    // Scoped by the extension: another tenant's id is `null`, the same as an unknown one.
    const actual = await prisma.agente.findUnique({
      where: { id: request.params.id },
      select: { revocadoEn: true },
    });
    if (actual === null) {
      return reply.code(404).send({ error: 'agente-no-encontrado' });
    }
    if (actual.revocadoEn !== null) {
      return reply.code(409).send({ error: 'agente-revocado' });
    }
    const { count } = await prisma.agente.updateMany({
      where: { id: request.params.id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    if (count === 0) {
      return reply.code(409).send({ error: 'agente-revocado' });
    }
    // The row is written, and the scoped write proves the id is this tenant's: the agent's
    // live control and data sockets close with 4002 (DEC-122 Q6).
    agentes.cerrarAgente(request.params.id);
    const agente = await prisma.agente.findUniqueOrThrow({
      where: { id: request.params.id },
      select: AgentePublico,
    });
    return reply.code(200).send({ agente });
  });
}
