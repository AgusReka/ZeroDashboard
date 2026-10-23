import type { FastifyInstance } from 'fastify';
import { registrarEjecucion, veredictoDePrueba } from '../auditoria/auditoria.js';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { conTenantInyectado } from '../aislamiento/aislamiento-prisma.js';
import { SIN_AGENTES, type AbridorDeCanales } from '../agente/canal-agente.js';
import { camposDeDestino, destinoDeConexion } from './conexion-destino.js';
import { camposInvalidos } from '../compartido/campos-invalidos.js';
import { cifrarCredencial, ErrorCredencialIlegible } from '../compartido/cripto-credencial.js';
import { probeConnection, SENTENCIA_PRUEBA } from '../ejecucion/db-probe.js';
import { LIMITE_LISTADO } from '../compartido/listados.js';

/**
 * The only projection any response path is allowed to read from `Conexion`.
 * `credencial` is absent by construction, so a read path never even fetches the
 * column and no response can echo it. Since CH-07 the test path does not select it
 * either: `destinoDeConexion()` is the one read that does, and it returns a destination
 * rather than a row.
 */
export const ConexionPublica = {
  id: true,
  nombre: true,
  motor: true,
  host: true,
  puerto: true,
  baseDeDatos: true,
  usuarioDb: true,
  soloLectura: true,
  // CH-19b: the bound agent's id, or `null` for a direct connection (DEC-115). An id,
  // not a personal field, and never the agent's token or its hash.
  agenteId: true,
  creadaEn: true,
  actualizadaEn: true,
} as const;


interface RegistroConexionBody {
  nombre: string;
  motor: string;
  host: string;
  puerto: number;
  baseDeDatos: string;
  usuarioDb: string;
  credencial: string;
  soloLectura?: boolean;
  agenteId?: string;
}

interface PruebaParams {
  id: string;
}

/**
 * Strict registration schema: every domain field is required and no unknown
 * property is accepted. `motor` stays free text — gate D-4 is still open, and the
 * test path never branches on it.
 *
 * `propertyNames` was added in CH-06, and it is what actually rejects an unknown key.
 * CH-05 measured that Fastify configures AJV with `removeAdditional: true` by default,
 * under which `additionalProperties: false` makes AJV **delete** the unknown key and
 * validate what is left — so a body carrying `tenantId` was answered `201` here, with
 * the key silently dropped. `registroConsultaGuardadaSchema` was corrected at the time
 * and this schema was not; CH-06's rule-2 sweep is what caught the gap, because it
 * exercises both create routes rather than one. `additionalProperties: false` is kept
 * so the intent still reads at a glance, and the two lists must be kept in step when
 * a property is added.
 *
 * CH-19b added the optional `agenteId` to both lists (DEC-121). It is not required:
 * omitting it registers a direct connection.
 */
const registroConexionSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: {
    enum: [
      'nombre',
      'motor',
      'host',
      'puerto',
      'baseDeDatos',
      'usuarioDb',
      'credencial',
      'soloLectura',
      'agenteId',
    ],
  },
  required: [
    'nombre',
    'motor',
    'host',
    'puerto',
    'baseDeDatos',
    'usuarioDb',
    'credencial',
  ],
  properties: {
    nombre: { type: 'string', minLength: 1 },
    motor: { type: 'string', minLength: 1 },
    host: { type: 'string', minLength: 1 },
    puerto: { type: 'integer', minimum: 1, maximum: 65535 },
    baseDeDatos: { type: 'string', minLength: 1 },
    usuarioDb: { type: 'string', minLength: 1 },
    credencial: { type: 'string', minLength: 1 },
    soloLectura: { type: 'boolean' },
    agenteId: { type: 'string', minLength: 1 },
  },
} as const;

export function registerConexionRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
  canales: AbridorDeCanales = SIN_AGENTES,
): void {
  app.post<{ Body: RegistroConexionBody }>(
    '/conexiones',
    { schema: { body: registroConexionSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }

      // No tenant resolution here any more. The active tenant was validated by the
      // `onRequest` hooks before this handler ran, and `tenantId` is injected into the
      // `create` below by the isolation extension (DEC-13) — which is why the
      // `503 tenant-no-inicializado` this route used to raise is gone rather than
      // renamed: the condition it described is unreachable on this path.
      const body = request.body;

      // CH-19b (DEC-121): the agent is resolved through the scoped client, so another
      // tenant's id is `null` exactly like an unknown one and both get the same 404
      // (rule 2). There is deliberately no `revocadoEn` filter: revocation is a state
      // of the credential, not of ownership, so a revoked agent stays bindable and the
      // binding survives a re-issue.
      if (body.agenteId !== undefined) {
        const agente = await prisma.agente.findUnique({
          where: { id: body.agenteId },
          select: { id: true },
        });
        if (agente === null) {
          return reply.code(404).send({ error: 'agente-no-encontrado' });
        }
      }

      const conexion = await prisma.conexion.create({
        data: conTenantInyectado({
          nombre: body.nombre,
          motor: body.motor,
          host: body.host,
          puerto: body.puerto,
          baseDeDatos: body.baseDeDatos,
          usuarioDb: body.usuarioDb,
          // A2/DEC-16: the credential is enciphered here, before the row reaches the
          // application's own database, so no plaintext credential is ever persisted.
          // This is the single write path; there is no other place a `Conexion` is
          // created, which is what makes "the column only ever holds an envelope" true
          // rather than aspirational.
          credencial: cifrarCredencial(body.credencial),
          soloLectura: body.soloLectura ?? true,
          agenteId: body.agenteId ?? null,
        }),
        select: ConexionPublica,
      });

      return reply.code(201).send({ conexion });
    },
  );

  /**
   * CH-21c (DEC-132): the active tenant's connections, for the console's step 1. Not
   * exempt from `x-tenant-id`, and no `where`: the isolation extension conjoins the
   * resolved tenant to this `findMany` (DEC-13), as on every scoped list. Ordered by name,
   * as the template picker's feed is, with `id` as the tie-break; `LIMITE_LISTADO + 1`
   * decides the page and `truncado` in one query.
   */
  app.get('/conexiones', async (_request, reply) => {
    const filas = await prisma.conexion.findMany({
      // CH-30b (DEC-167): the public fields, for the console's Conexiones screen; the
      // automation picker of CH-21c still reads only id and nombre. Never `credencial`.
      select: ConexionPublica,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      take: LIMITE_LISTADO + 1,
    });
    const truncado = filas.length > LIMITE_LISTADO;
    return reply.code(200).send({
      conexiones: truncado ? filas.slice(0, LIMITE_LISTADO) : filas,
      truncado,
    });
  });

  app.post<{ Params: PruebaParams }>(
    '/conexiones/:id/prueba',
    async (request, reply) => {
      // One call, and the credential is deciphered inside it (CH-07). The route never
      // sees the stored envelope and never names the column.
      let conexion;
      try {
        conexion = await destinoDeConexion(prisma, request.params.id, canales);
      } catch (error) {
        if (error instanceof ErrorCredencialIlegible) {
          // `409`, not `404` (the row exists) and not `500` (nothing is broken): the row
          // conflicts with the current key regime. A connection registered before CH-07
          // still holds plaintext and answers this until it is registered again (DEC-20).
          // The envelope, the key and any partial plaintext stay inside the crypto
          // module — this body carries a code and nothing else (regla 7).
          return reply.code(409).send({ error: 'credencial-ilegible' });
        }
        throw error;
      }
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      // The probe is fixed and unconditional: `motor` is stored but never consulted
      // here, so a non-PostgreSQL target fails legibly instead of being refused.
      const prueba = await probeConnection(camposDeDestino(conexion));
      // CH-20 (DEC-159): the probe dials the client's database too, so it is recorded.
      await registrarEjecucion(prisma, app.log, request, {
        origen: 'conexion-prueba',
        conexionId: conexion.id,
        sql: SENTENCIA_PRUEBA,
        consulta: null,
        plantillaId: null,
      }, veredictoDePrueba(prueba));

      if (prueba.resultado === 'fallo') {
        // Sanitized summary only. The `app.log.error(error, …)` form used by
        // src/health.ts would serialize the driver error, which carries the
        // plaintext password in `connectionParameters`.
        app.log.warn(
          {
            conexionId: conexion.id,
            categoria: prueba.categoria,
            codigo: prueba.codigo,
            durationMs: prueba.duracionMs,
          },
          'connection test failed',
        );
      }

      return reply.code(200).send({
        resultado: prueba.resultado,
        categoria: prueba.categoria,
        codigo: prueba.codigo,
        host: conexion.host,
        puerto: conexion.port,
        duracionMs: prueba.duracionMs,
      });
    },
  );
}
