import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { conTenantInyectado } from './aislamiento-prisma.js';
import { destinoDeConexion } from './conexion-destino.js';
import { cifrarCredencial, ErrorCredencialIlegible } from './cripto-credencial.js';
import { probeConnection } from './db-probe.js';

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
  },
} as const;

/**
 * Reads the offending field name out of an AJV error entry, or `null` when the entry
 * is about a value rather than a key. `propertyNames` reports the name both as a
 * top-level field on the inner error and in `params` on the wrapper error.
 */
function nombreDelCampo(params: unknown, propertyName: unknown): string | null {
  if (typeof propertyName === 'string' && propertyName !== '') {
    return propertyName;
  }
  if (typeof params !== 'object' || params === null) {
    return null;
  }
  const claves = params as {
    missingProperty?: unknown;
    additionalProperty?: unknown;
    propertyName?: unknown;
  };
  for (const valor of [claves.missingProperty, claves.additionalProperty, claves.propertyName]) {
    if (typeof valor === 'string' && valor !== '') {
      return valor;
    }
  }
  return null;
}

/**
 * Maps a validation failure to field paths only. The submitted values — the
 * credential among them — are never read back into the response. Fastify types
 * `validationError.validation` as `any`, so each entry is narrowed by hand.
 *
 * AJV reports *key*-level violations — `required`, `additionalProperties`,
 * `propertyNames` — with an **empty** `instancePath`, because the key it is
 * complaining about does not exist at a path yet. The offending name lives in
 * `params.missingProperty` / `params.additionalProperty` / `params.propertyName`
 * instead. Reading `instancePath` alone therefore collapsed every one of those to a
 * bare `/`, which told the caller that something was wrong but never which field.
 * Measured against Fastify 5 while implementing CH-05, whose spec requires the field
 * name to appear. The path is rebuilt as `<instancePath>/<nombre>` so a violation
 * nested inside an object still resolves to a full path, and value-level errors keep
 * using the `instancePath` AJV already provides.
 */
export function camposInvalidos(error: { validation?: unknown }): string[] {
  if (!Array.isArray(error.validation)) {
    return ['/'];
  }
  const campos = error.validation.map((detalle: unknown) => {
    if (typeof detalle !== 'object' || detalle === null) {
      return '/';
    }
    const { instancePath, params, propertyName } = detalle as {
      instancePath?: unknown;
      params?: unknown;
      propertyName?: unknown;
    };
    const base = typeof instancePath === 'string' ? instancePath : '';
    const nombre = nombreDelCampo(params, propertyName);
    if (nombre !== null) {
      return `${base}/${nombre}`;
    }
    return base !== '' ? base : '/';
  });
  // One rejected key can raise more than one entry (`propertyNames` raises two), and
  // the caller wants each offending field named once.
  return [...new Set(campos)];
}

export function registerConexionRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
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
        }),
        select: ConexionPublica,
      });

      return reply.code(201).send({ conexion });
    },
  );

  app.post<{ Params: PruebaParams }>(
    '/conexiones/:id/prueba',
    async (request, reply) => {
      // One call, and the credential is deciphered inside it (CH-07). The route never
      // sees the stored envelope and never names the column.
      let conexion;
      try {
        conexion = await destinoDeConexion(prisma, request.params.id);
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
      const prueba = await probeConnection({
        host: conexion.host,
        port: conexion.port,
        database: conexion.database,
        user: conexion.user,
        password: conexion.password,
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
        puerto: conexion.port,
        duracionMs: prueba.duracionMs,
      });
    },
  );
}
