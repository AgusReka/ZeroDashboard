import type { FastifyInstance } from 'fastify';
import { Prisma } from './generated/prisma/client.js';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { conTenantInyectado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { sanearSql } from './consulta-ejecucion.js';
import { CONTRATO_CANONICO } from './contrato.js';

/**
 * CH-09: operator-authored canonical-view SQL, one definition per `Conexion` ×
 * canonical entity (DEC-30, DEC-32, DEC-33). Pure persistence (DEC-31): the statement
 * is stored as inert text. Nothing in this module parses it, composes it, previews it
 * or opens a connection to the tenant's database — the only database it talks to is the
 * application's own, through the isolation-extended client.
 */

/**
 * The five entity names a definition may map, derived from the contract rather than
 * repeated: DEC-21 keeps the contract in code, so a second list here would be a second
 * source of truth to drift. `contrato.ts` is only imported, never edited.
 *
 * This is the whole of DEC-32's validation: the entity name is checked, the SQL's
 * columns and shape are not.
 */
export const ENTIDADES_CANONICAS: readonly string[] = CONTRATO_CANONICO.map((e) => e.nombre);

/**
 * List projection. `sql` is left out for the same reason `ConsultaGuardadaResumen`
 * leaves it out: a list payload should not grow with every stored statement. The list is
 * bounded structurally — the unique pair times a five-name enum caps it at five rows per
 * connection — so there is no `truncado` here.
 *
 * `tenantId` and `conexionId` are absent from both projections: the first is
 * server-resolved state, the second is already in the URL the caller used.
 */
export const VistaCanonicaResumen = {
  id: true,
  entidad: true,
  creadaEn: true,
  actualizadaEn: true,
} as const;

/** The summary plus the stored statement: register and read-one only. */
export const VistaCanonicaCompleta = {
  ...VistaCanonicaResumen,
  sql: true,
} as const;

interface ConexionParams {
  id: string;
}

interface VistaCanonicaParams extends ConexionParams {
  entidad: string;
}

interface RegistroVistaCanonicaBody {
  sql: string;
}

/**
 * The entity is addressed by the URL (DEC-32 natural key), so it is validated as a
 * params `enum`. A name outside the contract still answers `400 solicitud-invalida`,
 * with `campos: ['/entidad']`, through the same `camposInvalidos` mapping the bodies use.
 */
const vistaCanonicaParamsSchema = {
  type: 'object',
  required: ['entidad'],
  properties: {
    entidad: { enum: ENTIDADES_CANONICAS },
  },
} as const;

/**
 * Strict registration body: `sql` only, required and non-empty. `propertyNames` is what
 * actually rejects a `tenantId` (or any unknown key) — under Fastify's default
 * `removeAdditional: true`, `additionalProperties: false` alone would silently drop the
 * key and accept the request. See `registroConsultaGuardadaSchema` for the measurement.
 *
 * No `maxLength`, matching `consultas-guardadas.ts` and `conexiones.ts`: Fastify's
 * default 1 MiB `bodyLimit` already rejects an oversized body.
 */
const registroVistaCanonicaSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['sql'] },
  required: ['sql'],
  properties: {
    sql: { type: 'string', minLength: 1 },
  },
} as const;

/** `P2002` is Prisma's unique-constraint violation; here only the (conexionId, entidad) pair can raise it. */
function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function registerVistaCanonicaRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  /**
   * `true` when the connection exists **for the active tenant**. The isolation
   * extension adds `tenantId` to this unique selector (DEC-13), so another tenant's
   * connection and a nonexistent one are the same answer: absent. Only `id` is selected
   * — this lookup is an ownership check, never a way to the connection's coordinates.
   */
  async function conexionPropia(id: string): Promise<boolean> {
    const conexion = await prisma.conexion.findUnique({ where: { id }, select: { id: true } });
    return conexion !== null;
  }

  /** The scoped lookup of one pair; `findFirst` is AND-wrapped with the tenant filter. */
  function buscarPar(conexionId: string, entidad: string) {
    return prisma.vistaCanonica.findFirst({
      where: { conexionId, entidad },
      select: { id: true },
    });
  }

  /** Replaces the statement of an existing row, by id; `update` gets the tenant too. */
  function reemplazar(id: string, sql: string) {
    return prisma.vistaCanonica.update({
      where: { id },
      data: { sql },
      select: VistaCanonicaCompleta,
    });
  }

  app.put<{ Params: VistaCanonicaParams; Body: RegistroVistaCanonicaBody }>(
    '/conexiones/:id/vistas-canonicas/:entidad',
    {
      schema: { params: vistaCanonicaParamsSchema, body: registroVistaCanonicaSchema },
      attachValidation: true,
    },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }

      const { id: conexionId, entidad } = request.params;
      const { sql } = request.body;
      // `sanearSql` is a predicate here and nothing more — the same "empty once
      // trimmed" guard CH-05 applies before saving. The statement is stored verbatim.
      if (sanearSql(sql) === '') {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/sql'] });
      }

      // Ownership first, before any read or write of a definition: a request naming
      // another tenant's connection never reaches the table below.
      if (!(await conexionPropia(conexionId))) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      // DEC-34 idempotent replace, built only from operations the isolation extension
      // already maps (`findFirst`, `update`, `create`): `upsert` stays refused there.
      const existente = await buscarPar(conexionId, entidad);
      if (existente !== null) {
        const vistaCanonica = await reemplazar(existente.id, sql);
        return reply.code(200).send({ vistaCanonica });
      }

      try {
        const vistaCanonica = await prisma.vistaCanonica.create({
          data: conTenantInyectado({ conexionId, entidad, sql }),
          select: VistaCanonicaCompleta,
        });
        return reply.code(201).send({ vistaCanonica });
      } catch (error) {
        // A concurrent first write to the same pair won the insert between the lookup
        // above and this `create`; the unique constraint is the arbiter. This request
        // becomes a replace, once — last writer wins, which is DEC-34. Anything else,
        // or a row that is still not visible, propagates as a `500`.
        if (!esViolacionDeUnicidad(error)) {
          throw error;
        }
        const ganador = await buscarPar(conexionId, entidad);
        if (ganador === null) {
          throw error;
        }
        const vistaCanonica = await reemplazar(ganador.id, sql);
        return reply.code(200).send({ vistaCanonica });
      }
    },
  );

  app.get<{ Params: ConexionParams }>(
    '/conexiones/:id/vistas-canonicas',
    async (request, reply) => {
      const conexionId = request.params.id;
      if (!(await conexionPropia(conexionId))) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      const vistasCanonicas = await prisma.vistaCanonica.findMany({
        where: { conexionId },
        select: VistaCanonicaResumen,
        orderBy: { entidad: 'asc' },
      });
      return reply.code(200).send({ vistasCanonicas });
    },
  );

  app.get<{ Params: VistaCanonicaParams }>(
    '/conexiones/:id/vistas-canonicas/:entidad',
    { schema: { params: vistaCanonicaParamsSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }

      const { id: conexionId, entidad } = request.params;
      if (!(await conexionPropia(conexionId))) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      const vistaCanonica = await prisma.vistaCanonica.findFirst({
        where: { conexionId, entidad },
        select: VistaCanonicaCompleta,
      });
      if (vistaCanonica === null) {
        return reply.code(404).send({ error: 'vista-canonica-no-encontrada' });
      }
      return reply.code(200).send({ vistaCanonica });
    },
  );
}
