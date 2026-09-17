import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';

/**
 * The only projection any response path reads from `Tenant`.
 *
 * Unlike `ConexionPublica`, which exists to keep `credencial` un-fetched, this is a
 * **payload-shape** device in the `ConsultaGuardadaResumen` sense: `Tenant` has no
 * secret column. Declaring it anyway keeps every tenant response one shape, so a
 * column added later has to be admitted here deliberately rather than leaking into
 * the console by default.
 */
export const TenantPublico = {
  id: true,
  nombre: true,
  activo: true,
  creadoEn: true,
} as const;

interface RegistroTenantBody {
  nombre: string;
}

interface TenantParams {
  id: string;
}

interface ListadoQuery {
  incluirInactivos?: string;
}

/**
 * Strict creation schema, copying `registroConsultaGuardadaSchema`'s shape verbatim.
 *
 * `propertyNames` — not `additionalProperties: false` on its own — is what actually
 * rejects an unknown key. Fastify configures AJV with `removeAdditional: true` by
 * default, and under that option `additionalProperties: false` makes AJV **delete**
 * the unknown key and validate what is left, so an unknown property was accepted with
 * a `201` instead of being rejected. Measured while implementing CH-05; see the note
 * in `camposInvalidos`. `additionalProperties: false` is kept so the intent still
 * reads at a glance, and the two lists must be kept in step when a property is added.
 *
 * `activo` is deliberately absent from both lists: a tenant is born active (DEC-14)
 * and the only transition is `POST /tenants/:id/baja`, so a request has no say in it.
 */
const registroTenantSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['nombre'] },
  required: ['nombre'],
  properties: {
    nombre: { type: 'string', minLength: 1 },
  },
} as const;

/**
 * Takes the extended client like every other route module, even though `Tenant` is
 * deliberately absent from `MODELOS_AISLADOS`: there is no un-scoped handle anywhere
 * in the application, so this module cannot be the accidental escape hatch.
 */
export function registerTenantRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  app.post<{ Body: RegistroTenantBody }>(
    '/tenants',
    { schema: { body: registroTenantSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }

      // `activo` is not written here: the schema default (`true`) is the single place
      // "a new tenant is active" is stated, so the column and the route cannot drift.
      const tenant = await prisma.tenant.create({
        data: { nombre: request.body.nombre },
        select: TenantPublico,
      });

      return reply.code(201).send({ tenant });
    },
  );

  app.get<{ Querystring: ListadoQuery }>('/tenants', async (request, reply) => {
    // Exactly the string `true` opts in. Anything else — absent, empty, `1`, `false`,
    // a repeated parameter Fastify collapses into an array — falls through to the
    // active-only default, which is the fail-closed reading of DEC-14: a deactivated
    // tenant stays out of the picker unless it was asked for unambiguously.
    const incluirInactivos = request.query.incluirInactivos === 'true';

    const tenants = await prisma.tenant.findMany({
      where: incluirInactivos ? undefined : { activo: true },
      select: TenantPublico,
      // Ascending, unlike the saved-queries listing: this list is a selector, and the
      // tenant the operator has been working with for months should not be pushed
      // down the control every time a new one is created. `creadoEn` is
      // millisecond-precision, so `id` is needed for any total order at all.
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
    });

    return reply.code(200).send({ tenants });
  });

  /**
   * Deactivation is `POST /tenants/:id/baja`, not `DELETE /tenants/:id`: DEC-14's baja
   * is a state transition that keeps the row and all of its `Conexion` and
   * `ConsultaGuardada` rows for audit, and `DELETE` would promise removal.
   *
   * There is no mirror-image `alta` route. DEC-14 has no reactivation, so no route in
   * this module ever writes `activo: true`.
   */
  app.post<{ Params: TenantParams }>('/tenants/:id/baja', async (request, reply) => {
    // Read first rather than `update`-and-catch: an already-inactive tenant has to be
    // told apart from an unknown one, and `update` reports both as the same P2025.
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.params.id },
      select: TenantPublico,
    });
    if (tenant === null) {
      return reply.code(404).send({ error: 'tenant-no-encontrado' });
    }
    if (!tenant.activo) {
      // The same `409` the request hook answers for a deactivated active tenant: the
      // request conflicts with the resource's current state, and repeating the baja
      // must not report a second, fictitious transition.
      return reply.code(409).send({ error: 'tenant-desactivado' });
    }

    const actualizado = await prisma.tenant.update({
      where: { id: request.params.id },
      data: { activo: false },
      select: TenantPublico,
    });

    return reply.code(200).send({ tenant: actualizado });
  });
}
