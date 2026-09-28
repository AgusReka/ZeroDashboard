import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { evaluarVistas, type VistaAComponer } from './plantillas.js';

/**
 * CH-12: `POST /plantillas/:id/prueba`, the template test route (DEC-62). Unlike the
 * catalog in `src/plantillas-rutas.ts`, it is **not** exempt from `x-tenant-id`: it
 * resolves a tenant-owned `Conexion`, so it takes the full scoped client and lives in
 * its own file, where that capability is visible to grep.
 */

interface PruebaParams {
  id: string;
}

interface PruebaBody {
  conexionId: string;
  /** Checked against the stored declaration by `prepararSentencia` (unit 5b). */
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

/** What every check before execution has established, handed on as one value. */
interface PruebaAprobada {
  /** Stored operator SQL and its stored declaration (DEC-31, DEC-73). */
  plantilla: { sql: string; parametros: unknown };
  /** The views the DEC-71 gate approved, in contract order. */
  vistas: VistaAComponer[];
  /** The request, already shape-checked; its `conexionId` is owned by the active tenant. */
  cuerpo: PruebaBody;
}

/**
 * Where execution goes once every check has passed. Unit 5b replaces this body with
 * `componerSentencia` → `prepararSentencia` → `destinoDeConexion` → `ejecutarConsulta`.
 * Until then it answers `501` rather than pretend a result: nothing is dialed.
 */
function ejecutarPrueba(reply: FastifyReply, _aprobada: PruebaAprobada) {
  return reply.code(501).send({ error: 'ejecucion-no-implementada' });
}

export function registerPlantillaPruebaRoute(app: FastifyInstance, prisma: PrismaAislado): void {
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

      const conexionId = request.body.conexionId;
      // An ownership check only, as on `GET /conexiones/:id/validacion-mapeo`: the
      // extension adds `tenantId` to this selector (DEC-13), so another tenant's connection
      // is `null` here. No credential is deciphered and no mapping row is read before it.
      const conexion = await prisma.conexion.findUnique({
        where: { id: conexionId },
        select: { id: true },
      });
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      // DEC-71: `sql` and its verdict come from one scoped read, so the SQL the gate
      // approves is exactly the SQL the verdict covers. Only this connection's rows count.
      const filas = await prisma.vistaCanonica.findMany({
        where: { conexionId },
        select: { entidad: true, sql: true, estadoValidacion: true },
      });
      const compuerta = evaluarVistas(plantilla.entidades, filas);
      if (!compuerta.ok) {
        return reply
          .code(409)
          .send({ error: 'vista-canonica-no-aprobada', entidades: compuerta.entidades });
      }

      return ejecutarPrueba(reply, { plantilla, vistas: compuerta.vistas, cuerpo: request.body });
    },
  );
}
