import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from './generated/prisma/client.js';
import { probeConnection } from './db-probe.js';

/**
 * The only projection any response path is allowed to read from `Conexion`.
 * `credencial` is absent by construction, so a read path never even fetches the
 * column and no response can echo it. The test path selects it explicitly and
 * hands it straight to the probe.
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
}

interface PruebaParams {
  id: string;
}

/**
 * Strict registration schema: every domain field is required and no unknown
 * property is accepted. `motor` stays free text — gate D-4 is still open, and the
 * test path never branches on it.
 */
const registroConexionSchema = {
  type: 'object',
  additionalProperties: false,
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
  },
} as const;

/**
 * Maps a validation failure to field paths only. The submitted values — the
 * credential among them — are never read back into the response. Fastify types
 * `validationError.validation` as `any`, so each entry is narrowed by hand.
 */
export function camposInvalidos(error: { validation?: unknown }): string[] {
  if (!Array.isArray(error.validation)) {
    return ['/'];
  }
  return error.validation.map((detalle: unknown) => {
    const instancePath =
      typeof detalle === 'object' && detalle !== null
        ? (detalle as { instancePath?: unknown }).instancePath
        : undefined;
    return typeof instancePath === 'string' && instancePath !== '' ? instancePath : '/';
  });
}

export function registerConexionRoutes(app: FastifyInstance, prisma: PrismaClient): void {
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

      // The tenant is resolved server-side; the client never supplies a tenantId.
      const tenant = await prisma.tenant.findFirst({
        orderBy: { creadoEn: 'asc' },
        select: { id: true },
      });
      if (tenant === null) {
        return reply.code(503).send({ error: 'tenant-no-inicializado' });
      }

      const body = request.body;
      const conexion = await prisma.conexion.create({
        data: {
          tenantId: tenant.id,
          nombre: body.nombre,
          motor: body.motor,
          host: body.host,
          puerto: body.puerto,
          baseDeDatos: body.baseDeDatos,
          usuarioDb: body.usuarioDb,
          credencial: body.credencial,
          soloLectura: body.soloLectura ?? true,
        },
        select: ConexionPublica,
      });

      return reply.code(201).send({ conexion });
    },
  );

  app.post<{ Params: PruebaParams }>(
    '/conexiones/:id/prueba',
    async (request, reply) => {
      const conexion = await prisma.conexion.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          host: true,
          puerto: true,
          baseDeDatos: true,
          usuarioDb: true,
          credencial: true,
        },
      });
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      // The probe is fixed and unconditional: `motor` is stored but never consulted
      // here, so a non-PostgreSQL target fails legibly instead of being refused.
      const prueba = await probeConnection({
        host: conexion.host,
        port: conexion.puerto,
        database: conexion.baseDeDatos,
        user: conexion.usuarioDb,
        password: conexion.credencial,
      });

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
        puerto: conexion.puerto,
        duracionMs: prueba.duracionMs,
      });
    },
  );
}
