import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { loadConfig } from './config.js';
import { camposInvalidos } from './conexiones.js';
import { SIN_AGENTES, type AbridorDeCanales } from './canal-agente.js';
import { camposDeDestino, destinoDeConexion } from './conexion-destino.js';
import { ejecutarConsulta } from './consulta-ejecucion.js';
import { ErrorCredencialIlegible } from './cripto-credencial.js';
import { prepararSentencia } from './parametros.js';
import { componerSentencia, evaluarVistas, type VistaAComponer } from './plantillas.js';

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
 * Execution, once every check has passed: `componerSentencia` → `prepararSentencia` →
 * `destinoDeConexion` → `ejecutarConsulta` (design "Data Flow — Test Route"). The composed
 * text is built from stored operator SQL only (DEC-70) and the whole of it goes through the
 * scanner a saved query goes through, so a request value reaches the driver as a bind and
 * never as text (rule 4). Every 4xx below still answers before anything is dialed.
 */
async function ejecutarPrueba(
  app: FastifyInstance,
  prisma: PrismaAislado,
  reply: FastifyReply,
  { plantilla, vistas, cuerpo }: PruebaAprobada,
  canales: AbridorDeCanales,
) {
  // The stored declaration is re-checked here, not trusted (DEC-73), and the values are
  // checked against it: the same `400 {campos, problemas}` as `/consultas/ejecutar`.
  const sql = componerSentencia(plantilla.sql, vistas);
  const preparada = prepararSentencia(sql, plantilla.parametros, cuerpo.valores);
  if (!preparada.ok) {
    return reply.code(400).send({
      error: 'solicitud-invalida',
      campos: [...new Set(preparada.problemas.map((problema) => problema.campo))],
      problemas: preparada.problemas,
    });
  }

  // The one read that names `credencial` (CH-07), made only now that nothing is left to
  // reject. It is tenant-scoped like the ownership check above (DEC-13).
  let destino;
  try {
    destino = await destinoDeConexion(prisma, cuerpo.conexionId, canales);
  } catch (error) {
    if (error instanceof ErrorCredencialIlegible) {
      // As on `/consultas/ejecutar`: the row exists but cannot be read under the current
      // key (DEC-20), and nothing about the envelope or the key reaches the body.
      return reply.code(409).send({ error: 'credencial-ilegible' });
    }
    throw error;
  }
  if (destino === null) {
    // Only reachable if the row was deleted after the ownership check.
    return reply.code(404).send({ error: 'conexion-no-encontrada' });
  }

  const ejecucion = await ejecutarConsulta({
    ...camposDeDestino(destino),
    sentencia: preparada.valor,
    limite: cuerpo.limite,
    desplazamiento: cuerpo.desplazamiento,
    topeFilas: loadConfig().maxFilasPorConsulta,
  });
  if (ejecucion.resultado === 'fallo') {
    // Sanitized summary only, for the reason `/consultas/ejecutar` gives: the driver error
    // carries the plaintext password. Values are never logged either (rule 5).
    app.log.warn(
      {
        conexionId: destino.id,
        fase: ejecucion.fase,
        categoria: ejecucion.categoria,
        codigo: ejecucion.codigo,
        durationMs: ejecucion.duracionMs,
      },
      'template test execution failed',
    );
  }
  // A completed attempt is `200` whatever its verdict (the CH-04 contract).
  return reply.code(200).send(ejecucion);
}

export function registerPlantillaPruebaRoute(
  app: FastifyInstance,
  prisma: PrismaAislado,
  canales: AbridorDeCanales = SIN_AGENTES,
): void {
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

      return ejecutarPrueba(app, prisma, reply, {
        plantilla,
        vistas: compuerta.vistas,
        cuerpo: request.body,
      }, canales);
    },
  );
}
