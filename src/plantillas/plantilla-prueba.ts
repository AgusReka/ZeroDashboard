import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { camposInvalidos } from '../compartido/campos-invalidos.js';
import { SIN_AGENTES, type AbridorDeCanales } from '../agente/canal-agente.js';
import { ejecutarSobreVistas } from '../ejecucion/ejecucion-sobre-vistas.js';
import {
  datosDePlantilla,
  rechazoDePlantilla,
  registroPlantillaSchema,
  type RegistroPlantillaBody,
} from './plantillas-rutas.js';

/**
 * CH-12: `POST /plantillas/:id/prueba`, the template test route (DEC-62). CH-38 (DEC-191) adds
 * its sibling `POST /plantillas/prueba`, which tests a template that is not saved yet; both
 * share the gates in `probarContraConexion`, which since CH-45 calls `ejecutarSobreVistas`. Unlike the
 * catalog in `src/plantillas/plantillas-rutas.ts`, it is **not** exempt from `x-tenant-id`: it
 * resolves a tenant-owned `Conexion`, so it takes the full scoped client and lives in
 * its own file, where that capability is visible to grep.
 */

interface PruebaParams {
  id: string;
}

interface PruebaBody {
  conexionId: string;
  /** Checked against the stored declaration by `prepararSentencia`. */
  valores: Record<string, unknown>;
  limite: number;
  desplazamiento: number;
}

/**
 * Strict body, `propertyNames` included for the reason `registroConsultaGuardadaSchema`
 * documents (an unknown key would otherwise be stripped, not rejected). There is no
 * `parametros`: the stored template is the declaration. There is no `tenantId` either:
 * the tenant is the one the hooks resolved from the header (rule 2). `valores` is a
 * container only, as on `/consultas/ejecutar`, so AJV cannot coerce a value (DEC-60).
 */
const pruebaSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['conexionId', 'valores', 'limite', 'desplazamiento'] },
  required: ['conexionId'],
  properties: {
    conexionId: { type: 'string', minLength: 1 },
    valores: { type: 'object', default: {} },
    limite: { type: 'integer', minimum: 1, default: 50 },
    desplazamiento: { type: 'integer', minimum: 0, default: 0 },
  },
} as const;

/**
 * CH-38 (DEC-191): the body of `POST /plantillas/prueba`. The template's own properties come
 * from `registroPlantillaSchema` so the two can never drift, plus `conexionId` and `valores`
 * with the shape of `pruebaSchema`. `limite` and `desplazamiento` are not accepted: the console
 * asks for the first page only. `propertyNames.enum` lists every key (fourteen), and `required`
 * is the union of both schemas: an unlisted key would be stripped by `removeAdditional`.
 */
const pruebaSinGuardarSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: {
    enum: [...registroPlantillaSchema.propertyNames.enum, 'conexionId', 'valores'],
  },
  required: [...registroPlantillaSchema.required, 'conexionId'],
  properties: {
    ...registroPlantillaSchema.properties,
    conexionId: pruebaSchema.properties.conexionId,
    valores: pruebaSchema.properties.valores,
  },
} as const;

interface PruebaSinGuardarBody extends RegistroPlantillaBody {
  conexionId: string;
  valores: Record<string, unknown>;
}

/**
 * The gates the two test routes share, now in `ejecutarSobreVistas` (CH-45): the connection
 * is owned by the active tenant (`404`), the views of the declared entities are approved
 * (`409`), then the values and the credential are checked and the composed statement runs.
 * Every one of them answers before anything is dialed. The row cap stays the deployment's
 * `maxFilasPorConsulta`, read at execution as before.
 */
async function probarContraConexion(
  app: FastifyInstance,
  prisma: PrismaAislado,
  request: FastifyRequest,
  reply: FastifyReply,
  plantilla: { id: string | null; sql: string; parametros: unknown; entidades: unknown },
  cuerpo: PruebaBody,
  canales: AbridorDeCanales,
) {
  const respuesta = await ejecutarSobreVistas(app, prisma, request, {
    conexionId: cuerpo.conexionId,
    sql: plantilla.sql,
    parametros: plantilla.parametros,
    entidades: plantilla.entidades,
    valores: cuerpo.valores,
    limite: cuerpo.limite,
    desplazamiento: cuerpo.desplazamiento,
    auditoria: { origen: 'plantilla-prueba', plantillaId: plantilla.id, reporteId: null },
    mensajeFallo: 'template test execution failed',
  }, canales);
  return reply.code(respuesta.codigo).send(respuesta.cuerpo);
}

export function registerPlantillaPruebaRoute(
  app: FastifyInstance,
  prisma: PrismaAislado,
  canales: AbridorDeCanales = SIN_AGENTES,
): void {
  // CH-38 (DEC-191): test a template that is not saved yet. Registered before the parametric
  // route for readability only: Fastify matches the static `/plantillas/prueba` ahead of
  // `/plantillas/:id/prueba` (different depth, so there is no clash either way). Not in
  // `PLANTILLAS_EXENTAS`: it needs the active tenant, like its sibling.
  app.post<{ Body: PruebaSinGuardarBody }>(
    '/plantillas/prueba',
    { schema: { body: pruebaSinGuardarSchema }, attachValidation: true },
    async (request, reply) => {
      // The same refusal, with the same body, as `POST /plantillas`, except the test-columns
      // check (CH-39): this test is what produces the columns. A violation on
      // `conexionId` or `valores` is reported by the same AJV path (`campos` names it), and
      // nothing executes before every check has passed.
      const rechazo = rechazoDePlantilla(request.validationError, request.body, { exigirColumnas: false });
      if (rechazo !== null) {
        return reply.code(400).send(rechazo);
      }
      const { conexionId, valores } = request.body;
      const datos = datosDePlantilla(request.body);
      // First page only, with the defaults of the stored-template route.
      return probarContraConexion(
        app,
        prisma,
        request,
        reply,
        { id: null, sql: datos.sql, parametros: datos.parametros, entidades: datos.entidades },
        { conexionId, valores, limite: 50, desplazamiento: 0 },
        canales,
      );
    },
  );

  app.post<{ Params: PruebaParams; Body: PruebaBody }>(
    '/plantillas/:id/prueba',
    { schema: { body: pruebaSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }
      // `Plantilla` is global (DEC-61): this read is not scoped, and `id` is `text`, so a
      // malformed id is simply not found.
      const plantilla = await prisma.plantilla.findUnique({
        where: { id: request.params.id },
        select: { sql: true, parametros: true, entidades: true },
      });
      if (plantilla === null) {
        return reply.code(404).send({ error: 'plantilla-no-encontrada' });
      }
      return probarContraConexion(
        app,
        prisma,
        request,
        reply,
        { ...plantilla, id: request.params.id },
        request.body,
        canales,
      );
    },
  );
}
