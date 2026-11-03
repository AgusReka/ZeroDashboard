import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { registrarEjecucion, veredictoDeEjecucion } from '../auditoria/auditoria.js';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { loadConfig } from '../compartido/config.js';
import { camposInvalidos } from '../compartido/campos-invalidos.js';
import { SIN_AGENTES, type AbridorDeCanales } from '../agente/canal-agente.js';
import { camposDeDestino, destinoDeConexion } from '../conexiones/conexion-destino.js';
import { ejecutarConsulta } from '../ejecucion/consulta-ejecucion.js';
import { ErrorCredencialIlegible } from '../compartido/cripto-credencial.js';
import { prepararSentencia } from '../ejecucion/parametros.js';
import { componerSentencia, evaluarVistas, type VistaAComponer } from './plantillas.js';
import {
  datosDePlantilla,
  rechazoDePlantilla,
  registroPlantillaSchema,
  type RegistroPlantillaBody,
} from './plantillas-rutas.js';

/**
 * CH-12: `POST /plantillas/:id/prueba`, the template test route (DEC-62). CH-38 (DEC-191) adds
 * its sibling `POST /plantillas/prueba`, which tests a template that is not saved yet; both
 * share the gates in `probarContraConexion`. Unlike the
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
 * asks for the first page only. `propertyNames.enum` lists every key (eleven), and `required`
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

/** What every check before execution has established, handed on as one value. */
interface PruebaAprobada {
  /**
   * Stored operator SQL and its stored declaration (DEC-31, DEC-73), or, for the unsaved
   * template of CH-38, the form's own already-validated pair with a `null` id.
   */
  plantilla: { id: string | null; sql: string; parametros: unknown };
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
  request: FastifyRequest,
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
  // CH-20 (DEC-159, DEC-160): the composed statement as executed, never the values.
  await registrarEjecucion(prisma, app.log, request, {
    origen: 'plantilla-prueba',
    conexionId: destino.id,
    sql,
    consulta: null,
    plantillaId: plantilla.id,
  }, veredictoDeEjecucion(ejecucion));
  // A completed attempt is `200` whatever its verdict (the CH-04 contract).
  return reply.code(200).send(ejecucion);
}

/**
 * The gates the two test routes share, in this order: the connection is owned by the active
 * tenant (`404`), the views of the declared entities are approved (`409`), and then
 * `ejecutarPrueba` checks the values and the credential and runs the composed statement. Every
 * one of them answers before anything is dialed.
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
  const conexionId = cuerpo.conexionId;
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

  return ejecutarPrueba(app, prisma, request, reply, {
    plantilla: { id: plantilla.id, sql: plantilla.sql, parametros: plantilla.parametros },
    vistas: compuerta.vistas,
    cuerpo,
  }, canales);
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
      // The same refusal, with the same body, as `POST /plantillas`. A violation on
      // `conexionId` or `valores` is reported by the same AJV path (`campos` names it), and
      // nothing executes before every check has passed.
      const rechazo = rechazoDePlantilla(request.validationError, request.body);
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
