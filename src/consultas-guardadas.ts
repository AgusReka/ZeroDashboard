import type { FastifyInstance } from 'fastify';
import { Prisma } from './generated/prisma/client.js';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { conTenantInyectado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { LIMITE_LISTADO } from './listados.js';
import {
  analizarVersion,
  leerCuerpoRestauracion,
  mismoContenido,
  resolverNota,
  validarCuerpoConsulta,
} from './consultas-versiones.js';
import { TIPOS_PARAMETRO } from './parametros.js';

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

/**
 * The metadata projection plus the stored statement and its parameter declaration
 * (CH-11, DEC-55): create and get-by-id only. The declaration belongs with `sql`, since
 * neither means anything without the other, so it stays out of the list as well.
 */
export const ConsultaGuardadaCompleta = {
  ...ConsultaGuardadaResumen,
  sql: true,
  parametros: true,
} as const;

/**
 * The list cap now lives in `listados.ts` (CH-21c). It is imported for this module's own
 * list and re-exported, so every existing importer of it from here keeps working.
 */
export { LIMITE_LISTADO };

interface RegistroConsultaGuardadaBody {
  nombre: string;
  descripcion?: string | null;
  sql: string;
  /** The declaration (DEC-48). Its content is checked by `validarDeclaracion`. */
  parametros: unknown[];
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
 *
 * CH-11: `parametros` has the same shape as on `/consultas/ejecutar` — containers and
 * keys only, `nombre` untyped and `tipo` an `enum` — for the same reason: a declared
 * `type` would let AJV coerce the scalar before `validarDeclaracion` could name it. There
 * is no `valores`: a saved query stores its declaration, never values (DEC-48).
 */
const registroConsultaGuardadaSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['nombre', 'descripcion', 'sql', 'parametros'] },
  required: ['nombre', 'sql'],
  properties: {
    nombre: { type: 'string', minLength: 1 },
    descripcion: { type: ['string', 'null'] },
    sql: { type: 'string', minLength: 1 },
    parametros: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'tipo'],
        properties: { nombre: {}, tipo: { enum: TIPOS_PARAMETRO } },
      },
    },
  },
} as const;

/**
 * CH-25 (DEC-146, DEC-148): the full row plus the number and the note of its current
 * version. Used by the edit answer and by the version routes; the create and get-by-id
 * projections above stay as they were.
 */
export const ConsultaGuardadaConVersion = {
  ...ConsultaGuardadaCompleta,
  version: true,
  nota: true,
} as const;

/**
 * The edit body (DEC-150): the create body plus an optional `nota`. Same reasoning as the
 * create schema for `propertyNames`; `nota` is listed in `properties` (or
 * `additionalProperties: false` would strip it silently) and carries no `type`, so AJV
 * cannot coerce a number into text and `resolverNota` is the one place its type is checked.
 */
const edicionConsultaGuardadaSchema = {
  ...registroConsultaGuardadaSchema,
  propertyNames: { enum: ['nombre', 'descripcion', 'sql', 'parametros', 'nota'] },
  properties: { ...registroConsultaGuardadaSchema.properties, nota: {} },
} as const;

interface EdicionConsultaGuardadaBody extends RegistroConsultaGuardadaBody {
  nota?: unknown;
}

interface VersionParams {
  id: string;
  version: string;
}

/** The two delegates an archive touches, as the transaction client exposes them. */
type ClienteTransaccion = Pick<PrismaAislado, 'consultaGuardada' | 'consultaGuardadaVersion'>;

/** The row as the archive step reads it: everything that defines a version. */
const FilaVigente = {
  id: true,
  nombre: true,
  descripcion: true,
  sql: true,
  parametros: true,
  nota: true,
  version: true,
  actualizadaEn: true,
} as const;

/**
 * Moves the row's current state into the history, inside the caller's transaction. The
 * unique `(consultaGuardadaId, version)` is what turns two concurrent edits of the same
 * version into a conflict (`P2002`) instead of a forked history. `desde` is the instant
 * that state became current, which for a row is its `actualizadaEn`.
 */
async function archivarVersion(
  tx: ClienteTransaccion,
  vigente: {
    id: string;
    nombre: string;
    descripcion: string | null;
    sql: string;
    parametros: Prisma.JsonValue;
    nota: string | null;
    version: number;
    actualizadaEn: Date;
  },
): Promise<void> {
  await tx.consultaGuardadaVersion.create({
    data: conTenantInyectado({
      consultaGuardadaId: vigente.id,
      version: vigente.version,
      nombre: vigente.nombre,
      descripcion: vigente.descripcion,
      sql: vigente.sql,
      parametros: vigente.parametros as Prisma.InputJsonValue,
      nota: vigente.nota,
      desde: vigente.actualizadaEn,
    }),
  });
}

/** `P2002` is Prisma's unique-constraint violation: here, only the archive of a version that already exists. */
function esConflictoDeVersion(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

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

      // The content checks live in `validarCuerpoConsulta` since CH-25 so `PUT` applies the
      // very same ones: a statement empty once sanitized is refused, and a declaration that
      // does not fit the statement is refused at save time instead of on every execution.
      const validado = validarCuerpoConsulta(request.body);
      if (!validado.ok) {
        return reply.code(400).send(validado.cuerpo);
      }
      const { datos } = validado;

      // No tenant resolution here any more. The active tenant was validated by the
      // `onRequest` hooks before this handler ran, and `tenantId` is injected into the
      // `create` below by the isolation extension (DEC-13) — which is why the
      // `503 tenant-no-inicializado` this route used to raise is gone rather than
      // renamed: the condition it described is unreachable on this path.

      const consultaGuardada = await prisma.consultaGuardada.create({
        data: conTenantInyectado({
          nombre: datos.nombre,
          // One representation of absence: omitted, explicit null and blank-or-whitespace
          // all persist as null (decided in `validarCuerpoConsulta`).
          descripcion: datos.descripcion,
          // Stored verbatim. `sanearSql` strips one trailing `;`, which is an
          // execution-path concern owned by the pagination wrapper; applying it here
          // would silently rewrite the operator's statement in the database. The
          // stored text is re-sanitized at execution time instead.
          sql: datos.sql,
          // The validated copy: only `nombre` and `tipo` of each entry, in order. The cast
          // is only because an interface carries no index signature; the value is plain JSON.
          parametros: datos.parametros as unknown as Prisma.InputJsonValue,
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

  /**
   * CH-25 (DEC-146, DEC-150): a full edit. The previous state is archived, the row takes the
   * new content and its `version` goes up, all in one interactive transaction, so a failure
   * midway leaves neither a gap in the history nor a half-updated row. The scoping holds
   * inside the transaction (`src/aislamiento-versiones.test.ts`). The checks are the create
   * route's own (`validarCuerpoConsulta`), and an edit that changes nothing is a `409` that
   * writes nothing: a note alone never makes a version.
   */
  app.put<{ Params: ConsultaGuardadaParams; Body: EdicionConsultaGuardadaBody }>(
    '/consultas-guardadas/:id',
    { schema: { body: edicionConsultaGuardadaSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }
      const validado = validarCuerpoConsulta(request.body);
      if (!validado.ok) {
        return reply.code(400).send(validado.cuerpo);
      }
      const nota = resolverNota(request.body.nota);
      if (!nota.ok) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: nota.campos });
      }
      const { datos } = validado;
      const id = request.params.id;

      try {
        const resultado = await prisma.$transaction(async (tx) => {
          const vigente = await tx.consultaGuardada.findUnique({ where: { id }, select: FilaVigente });
          if (vigente === null) {
            return { estado: 404 as const };
          }
          if (mismoContenido(vigente, datos)) {
            return { estado: 409 as const };
          }
          await archivarVersion(tx, vigente);
          const consultaGuardada = await tx.consultaGuardada.update({
            where: { id },
            data: {
              nombre: datos.nombre,
              descripcion: datos.descripcion,
              sql: datos.sql,
              parametros: datos.parametros as unknown as Prisma.InputJsonValue,
              nota: nota.nota,
              version: { increment: 1 },
            },
            select: ConsultaGuardadaConVersion,
          });
          return { estado: 200 as const, consultaGuardada };
        });

        if (resultado.estado === 404) {
          return reply.code(404).send({ error: 'consulta-guardada-no-encontrada' });
        }
        if (resultado.estado === 409) {
          return reply.code(409).send({ error: 'sin-cambios' });
        }
        return reply.code(200).send({ consultaGuardada: resultado.consultaGuardada });
      } catch (error) {
        if (esConflictoDeVersion(error)) {
          return reply.code(409).send({ error: 'conflicto-de-edicion' });
        }
        throw error;
      }
    },
  );

  /**
   * The history of one saved query, newest first. The current version comes from the row
   * (its date is `actualizadaEn`) and the past ones from the history table (their date is
   * `desde`); no statement travels in a list. The cap keeps the current version and the
   * most recent `LIMITE_LISTADO - 1` past ones.
   */
  app.get<{ Params: ConsultaGuardadaParams }>('/consultas-guardadas/:id/versiones', async (request, reply) => {
    const vigente = await prisma.consultaGuardada.findUnique({
      where: { id: request.params.id },
      select: { id: true, version: true, nota: true, actualizadaEn: true },
    });
    if (vigente === null) {
      return reply.code(404).send({ error: 'consulta-guardada-no-encontrada' });
    }
    const pasadas = await prisma.consultaGuardadaVersion.findMany({
      where: { consultaGuardadaId: vigente.id },
      select: { version: true, nota: true, desde: true },
      orderBy: { version: 'desc' },
      take: LIMITE_LISTADO,
    });
    const truncado = pasadas.length > LIMITE_LISTADO - 1;
    const versiones = [
      { version: vigente.version, fecha: vigente.actualizadaEn, nota: vigente.nota, esActual: true },
      ...pasadas
        .slice(0, LIMITE_LISTADO - 1)
        .map((fila) => ({ version: fila.version, fecha: fila.desde, nota: fila.nota, esActual: false })),
    ];
    return reply.code(200).send({ versiones, truncado });
  });

  /**
   * One version with its full content, the current one included, for the comparison of
   * DEC-149. The query is resolved first through the scoped model, so another tenant's id
   * is `consulta-guardada-no-encontrada` whatever the version says; a `:version` that is not
   * a positive integer or has no entry is `version-no-encontrada`.
   */
  app.get<{ Params: VersionParams }>('/consultas-guardadas/:id/versiones/:version', async (request, reply) => {
    const vigente = await prisma.consultaGuardada.findUnique({
      where: { id: request.params.id },
      select: ConsultaGuardadaConVersion,
    });
    if (vigente === null) {
      return reply.code(404).send({ error: 'consulta-guardada-no-encontrada' });
    }
    const numero = analizarVersion(request.params.version);
    if (numero === null) {
      return reply.code(404).send({ error: 'version-no-encontrada' });
    }
    if (numero === vigente.version) {
      return reply.code(200).send({
        version: {
          version: vigente.version,
          fecha: vigente.actualizadaEn,
          nota: vigente.nota,
          esActual: true,
          nombre: vigente.nombre,
          descripcion: vigente.descripcion,
          sql: vigente.sql,
          parametros: vigente.parametros,
        },
      });
    }
    const pasada = await prisma.consultaGuardadaVersion.findUnique({
      where: { consultaGuardadaId_version: { consultaGuardadaId: vigente.id, version: numero } },
      select: { version: true, desde: true, nota: true, nombre: true, descripcion: true, sql: true, parametros: true },
    });
    if (pasada === null) {
      return reply.code(404).send({ error: 'version-no-encontrada' });
    }
    return reply.code(200).send({
      version: {
        version: pasada.version,
        fecha: pasada.desde,
        nota: pasada.nota,
        esActual: false,
        nombre: pasada.nombre,
        descripcion: pasada.descripcion,
        sql: pasada.sql,
        parametros: pasada.parametros,
      },
    });
  });

  /**
   * CH-25 (DEC-147, DEC-150): restoring version N is an edit whose content comes from the
   * history. The current state is archived and the row takes the chosen version's content
   * copied exactly as stored, with `version` going up by one: nothing is deleted and the
   * history only grows. Same transaction and same conflict mapping as the edit. The current
   * version cannot be restored (`409 version-vigente`), and the chosen version must exist in
   * this query's own history (`404 version-no-encontrada`), which another tenant's cannot.
   */
  app.post<{ Params: VersionParams; Body: unknown }>(
    '/consultas-guardadas/:id/versiones/:version/restaurar',
    async (request, reply) => {
      // No body schema on purpose: "no body at all" must mean "no note", which a schema of
      // type object cannot say. `leerCuerpoRestauracion` is the strict check instead.
      const cuerpo = leerCuerpoRestauracion(request.body);
      if (!cuerpo.ok) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: cuerpo.campos });
      }
      const nota = resolverNota(cuerpo.nota);
      if (!nota.ok) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: nota.campos });
      }
      const id = request.params.id;
      const numero = analizarVersion(request.params.version);

      try {
        const resultado = await prisma.$transaction(async (tx) => {
          const vigente = await tx.consultaGuardada.findUnique({ where: { id }, select: FilaVigente });
          if (vigente === null) {
            return { estado: 404 as const, error: 'consulta-guardada-no-encontrada' };
          }
          if (numero === null) {
            return { estado: 404 as const, error: 'version-no-encontrada' };
          }
          if (numero === vigente.version) {
            return { estado: 409 as const, error: 'version-vigente' };
          }
          const elegida = await tx.consultaGuardadaVersion.findUnique({
            where: { consultaGuardadaId_version: { consultaGuardadaId: id, version: numero } },
            select: { nombre: true, descripcion: true, sql: true, parametros: true },
          });
          if (elegida === null) {
            return { estado: 404 as const, error: 'version-no-encontrada' };
          }
          await archivarVersion(tx, vigente);
          const consultaGuardada = await tx.consultaGuardada.update({
            where: { id },
            data: {
              nombre: elegida.nombre,
              descripcion: elegida.descripcion,
              // Copied as stored, byte for byte: nothing is trimmed, sanitized or revalidated.
              sql: elegida.sql,
              parametros: elegida.parametros as Prisma.InputJsonValue,
              nota: nota.nota,
              version: { increment: 1 },
            },
            select: ConsultaGuardadaConVersion,
          });
          return { estado: 200 as const, consultaGuardada };
        });

        if (resultado.estado === 200) {
          return reply.code(200).send({ consultaGuardada: resultado.consultaGuardada });
        }
        return reply.code(resultado.estado).send({ error: resultado.error });
      } catch (error) {
        if (esConflictoDeVersion(error)) {
          return reply.code(409).send({ error: 'conflicto-de-edicion' });
        }
        throw error;
      }
    },
  );
}
