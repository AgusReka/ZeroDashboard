import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { conTenantInyectado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { sanearSql } from './consulta-ejecucion.js';

/**
 * The metadata projection every list row is built from. Unlike `ConexionPublica`,
 * which exists to keep `credencial` un-fetched, this is a **payload-shape** device:
 * `ConsultaGuardada` has no secret column. `sql` is left out because the list renders
 * names, and a list payload should not grow with the length of every stored
 * statement — loading a statement is a second, explicit get-by-id call.
 *
 * `tenantId` is absent from both projections for a different reason: it is
 * server-resolved state, and no response has any use for it.
 */
export const ConsultaGuardadaResumen = {
  id: true,
  nombre: true,
  descripcion: true,
  creadaEn: true,
  actualizadaEn: true,
} as const;

/** The metadata projection plus the stored statement: create and get-by-id only. */
export const ConsultaGuardadaCompleta = {
  ...ConsultaGuardadaResumen,
  sql: true,
} as const;

/**
 * Hard cap on the list. DEC-10 removes delete, so this table only ever grows and an
 * uncapped `findMany` would be unbounded over the product's life. 200 matches the
 * `limite` ceiling of `/consultas/ejecutar`. There is no pagination parameter to see
 * past it (DEC-10), which is exactly why the response says `truncado` out loud
 * instead of silently returning a short list.
 */
export const LIMITE_LISTADO = 200;

interface RegistroConsultaGuardadaBody {
  nombre: string;
  descripcion?: string | null;
  sql: string;
}

interface ConsultaGuardadaParams {
  id: string;
}

/**
 * Strict creation schema: `nombre` and `sql` are required and non-empty, `descripcion`
 * is optional and nullable, and no unknown property is accepted.
 *
 * `propertyNames` — not `additionalProperties: false` on its own — is what enforces
 * "a request cannot set `tenantId`". Fastify configures AJV with
 * `removeAdditional: true` by default, and under that option `additionalProperties:
 * false` makes AJV **delete** the unknown key and validate what is left, so a body
 * carrying `tenantId` was accepted with a `201` instead of being rejected. Measured,
 * not assumed: see the note in `camposInvalidos`. `removeAdditional` is an
 * app-construction option, so forcing it off would mean every caller that builds a
 * Fastify instance — `src/server.ts` and each test — had to agree, and this route
 * module could not guarantee its own contract. `propertyNames` is evaluated
 * regardless of that option and keeps the rule inside the schema it belongs to.
 * `additionalProperties: false` is kept so the intent still reads at a glance.
 *
 * The two lists must be kept in step when a property is added.
 *
 * There is no `maxLength` anywhere, matching `conexiones.ts`: Fastify's default
 * 1 MiB `bodyLimit` already rejects an oversized body.
 */
const registroConsultaGuardadaSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['nombre', 'descripcion', 'sql'] },
  required: ['nombre', 'sql'],
  properties: {
    nombre: { type: 'string', minLength: 1 },
    descripcion: { type: ['string', 'null'] },
    sql: { type: 'string', minLength: 1 },
  },
} as const;

export function registerConsultaGuardadaRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
): void {
  app.post<{ Body: RegistroConsultaGuardadaBody }>(
    '/consultas-guardadas',
    { schema: { body: registroConsultaGuardadaSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }

      const body = request.body;
      // `sanearSql` is used here **as a predicate only**, the same guard
      // `src/consultas.ts` applies before execution: a statement that is empty once
      // trimmed could never execute, so it can never be saved either.
      if (sanearSql(body.sql) === '') {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/sql'] });
      }

      // No tenant resolution here any more. The active tenant was validated by the
      // `onRequest` hooks before this handler ran, and `tenantId` is injected into the
      // `create` below by the isolation extension (DEC-13) — which is why the
      // `503 tenant-no-inicializado` this route used to raise is gone rather than
      // renamed: the condition it described is unreachable on this path.

      // One representation of absence: omitted, explicit null and blank-or-whitespace
      // all persist as null, the same treatment `sanearSql` gives a blank statement.
      const descripcion =
        (body.descripcion ?? '').trim() === '' ? null : (body.descripcion ?? null);

      const consultaGuardada = await prisma.consultaGuardada.create({
        data: conTenantInyectado({
          nombre: body.nombre,
          descripcion,
          // Stored verbatim. `sanearSql` strips one trailing `;`, which is an
          // execution-path concern owned by the pagination wrapper; applying it here
          // would silently rewrite the operator's statement in the database. The
          // stored text is re-sanitized at execution time instead.
          sql: body.sql,
        }),
        select: ConsultaGuardadaCompleta,
      });

      return reply.code(201).send({ consultaGuardada });
    },
  );

  app.get('/consultas-guardadas', async (_request, reply) => {
    // `take: LIMITE_LISTADO + 1` is the same bounding trick the execution path uses:
    // one query decides both the page and whether anything was cut off, with no
    // second `count(*)`. The tenant filter is not written here and never will be: the
    // isolation extension conjoins it into this `where` (DEC-13), so the cap applies
    // to the active tenant's rows and another tenant's rows are not even counted.
    const filas = await prisma.consultaGuardada.findMany({
      select: ConsultaGuardadaResumen,
      // `creadaEn` is millisecond-precision, so two creates in the same millisecond
      // need `id` as a tiebreaker to have any total order at all.
      orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
      take: LIMITE_LISTADO + 1,
    });

    const truncado = filas.length > LIMITE_LISTADO;
    return reply.code(200).send({
      consultasGuardadas: truncado ? filas.slice(0, LIMITE_LISTADO) : filas,
      truncado,
    });
  });

  // No params schema, following `POST /conexiones/:id/prueba` literally.
  // `ConsultaGuardada.id` is `String @id @default(uuid())` with no `@db.Uuid`, so the
  // column is `text` and this lookup cannot throw on a malformed id: a nonexistent id
  // and a malformed one are both honestly "no such saved query".
  app.get<{ Params: ConsultaGuardadaParams }>(
    '/consultas-guardadas/:id',
    async (request, reply) => {
      const consultaGuardada = await prisma.consultaGuardada.findUnique({
        where: { id: request.params.id },
        select: ConsultaGuardadaCompleta,
      });
      if (consultaGuardada === null) {
        return reply.code(404).send({ error: 'consulta-guardada-no-encontrada' });
      }

      return reply.code(200).send({ consultaGuardada });
    },
  );
}
