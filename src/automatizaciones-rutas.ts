import type { FastifyInstance } from 'fastify';
import type { Prisma } from './generated/prisma/client.js';
import { conTenantInyectado, type PrismaAislado } from './aislamiento-prisma.js';
import { cronValido } from './automatizaciones.js';
import { camposInvalidos } from './conexiones.js';
import { sanearSql } from './consulta-ejecucion.js';
import { prepararSentencia } from './parametros.js';

/**
 * CH-13: the automation lifecycle routes — create, list, get, deactivate (DEC-74,
 * DEC-78, DEC-79). None is exempt from `x-tenant-id`: `Automatizacion` is a scoped model,
 * so every read and write below is filtered by the tenant the hooks resolved from the
 * header (DEC-13), and the body never names one (rule 2). There is no edit, no delete
 * and no reactivation route; a mistaken automation is deactivated and created again.
 */

/**
 * The list projection. `valores` stays out, as `sql` stays out of a saved-query list:
 * a list renders what runs and when, and the full row is a second, explicit get-by-id.
 */
export const AutomatizacionResumen = {
  id: true,
  plantillaId: true,
  conexionId: true,
  cron: true,
  activo: true,
  creadaEn: true,
} as const;

/** Every column except `tenantId`, which the caller already knows: create, get, deactivate. */
export const AutomatizacionCompleta = { ...AutomatizacionResumen, valores: true } as const;

interface RegistroAutomatizacionBody {
  plantillaId: string;
  conexionId: string;
  /** Checked against the template's stored declaration by `prepararSentencia`. */
  valores: Record<string, unknown>;
  cron: string;
}

/**
 * Strict body, `propertyNames` included for the reason `registroConsultaGuardadaSchema`
 * documents: under Fastify's `removeAdditional` an unknown key would otherwise be
 * stripped and the body accepted. So a `tenantId` or an `activo` in the body is a `400`,
 * never a silent drop. `valores` is a container only, as on `/plantillas/:id/prueba`, so
 * AJV cannot coerce a value (DEC-60).
 */
const registroAutomatizacionSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['plantillaId', 'conexionId', 'valores', 'cron'] },
  required: ['plantillaId', 'conexionId', 'cron'],
  properties: {
    plantillaId: { type: 'string', minLength: 1 },
    conexionId: { type: 'string', minLength: 1 },
    valores: { type: 'object', default: {} },
    cron: { type: 'string', minLength: 1 },
  },
} as const;

/**
 * `zonaHoraria` is the deployment-wide zone (DEC-77), passed in by `src/server.ts` from
 * its one `loadConfig()`, so a schedule is accepted only if it resolves in the zone the
 * scheduler will read it in.
 */
export function registerAutomatizacionRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
  zonaHoraria: string,
): void {
  app.post<{ Body: RegistroAutomatizacionBody }>(
    '/automatizaciones',
    { schema: { body: registroAutomatizacionSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }
      const { plantillaId, conexionId, valores, cron } = request.body;
      // Pure and first (DEC-76): a schedule the scheduler could never read is refused
      // before any row is looked up.
      if (!cronValido(cron, zonaHoraria)) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/cron'] });
      }

      // `Plantilla` is global (DEC-61): this read is not scoped, and `id` is `text`, so a
      // malformed id is simply not found.
      const plantilla = await prisma.plantilla.findUnique({
        where: { id: plantillaId },
        select: { sql: true, parametros: true },
      });
      if (plantilla === null) {
        return reply.code(404).send({ error: 'plantilla-no-encontrada' });
      }

      // Ownership check only: the extension adds `tenantId` to this selector (DEC-13), so
      // another tenant's connection is `null` here and nothing is written. The foreign key
      // alone would accept it, since it does not know about tenants.
      const conexion = await prisma.conexion.findUnique({
        where: { id: conexionId },
        select: { id: true },
      });
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      // The CH-11 value rules against the stored declaration, exactly as the test route
      // applies them. Only the verdict is used here: the statement is composed again on
      // every run, because DEC-68 lets the template change in place after this check.
      const preparada = prepararSentencia(sanearSql(plantilla.sql), plantilla.parametros, valores);
      if (!preparada.ok) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: [...new Set(preparada.problemas.map((problema) => problema.campo))],
          problemas: preparada.problemas,
        });
      }

      // `activo` is not written here: the schema default (`true`) is the single place
      // "a new automation is active" is stated, as with `Tenant`. The cast is sound:
      // `prepararSentencia` just accepted every key as declared and every value as a
      // string, finite number or boolean, so the map is a flat JSON object.
      const automatizacion = await prisma.automatizacion.create({
        data: conTenantInyectado({
          plantillaId,
          conexionId,
          valores: valores as Prisma.InputJsonObject,
          cron,
        }),
        select: AutomatizacionCompleta,
      });
      return reply.code(201).send({ automatizacion });
    },
  );
}
