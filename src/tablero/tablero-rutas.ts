import type { FastifyInstance } from 'fastify';
import { Prisma } from '../generated/prisma/client.js';
import { conTenantInyectado, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { camposInvalidos } from '../compartido/campos-invalidos.js';
import { pendientesDe, tableroSchema, type TableroBody } from './tablero.js';

/**
 * CH-46 (DEC-199): the active tenant's dashboard, read and saved from the console. Both routes
 * sit behind the operator guard (DEC-152) and are scoped by the `X-Tenant-Id` header (DEC-15):
 * `Tablero`, `Conexion` and `VistaCanonica` are scoped models, so every read and write is the
 * header tenant's and the tenant never comes from the body (rule 2). Neither route is exempt.
 *
 * Nothing here dials the replica or writes an audit row: `pendientes` is computed from the
 * connection's stored mapping rows (DEC-71) and is informative only.
 */

/** One report of the dashboard, as both routes answer it. */
export interface EntradaTablero {
  id: string;
  nombre: string;
  titulo: string;
  visualizacion: string;
  pendientes: string[];
}

export interface RespuestaTablero {
  conexionId: string | null;
  reportes: EntradaTablero[];
}

/** `P2002` is Prisma's unique-constraint violation; here `Tablero_tenantId_key` raises it. */
function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * The answer for a connection and an ordered list of ids: the reports from the global
 * catalog, then the connection's view rows once, then the entries in stored order. An id with
 * no report is skipped, which cannot happen because reports are never deleted (DEC-68).
 */
async function respuestaDe(prisma: PrismaAislado, conexionId: string, ids: readonly string[]): Promise<RespuestaTablero> {
  if (ids.length === 0) {
    return { conexionId, reportes: [] };
  }
  const reportes = await prisma.reporte.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, nombre: true, titulo: true, visualizacion: true, entidades: true },
  });
  // Scoped: the tenant's own rows of its own connection, `sql` included because the DEC-71
  // gate reads the row it approves.
  const filas = await prisma.vistaCanonica.findMany({
    where: { conexionId },
    select: { entidad: true, sql: true, estadoValidacion: true },
  });
  const porId = new Map(reportes.map((reporte) => [reporte.id, reporte]));
  return {
    conexionId,
    reportes: ids.flatMap((id) => {
      const reporte = porId.get(id);
      if (reporte === undefined) return [];
      const { entidades, ...resumen } = reporte;
      return [{ ...resumen, pendientes: pendientesDe(entidades, filas) }];
    }),
  };
}

/**
 * One transaction on the scoped client (design §2): lock the named reports with
 * `FOR KEY SHARE`, refuse the unknown ids, then find the tenant's row and update it or create
 * it. The lock conflicts with the `FOR UPDATE` of `tablero.reemplazarReporteLibre`, so a report
 * cannot be replaced between this check and this write. It is a tagged `$queryRaw` over the
 * global `Reporte`: the ids go as one driver parameter (rule 4), and no tenant filter applies.
 * The isolation extension refuses `upsert`, hence find, then update or create. Answers the
 * unknown ids in body order, and an empty list once the dashboard is written.
 */
async function guardarTablero(prisma: PrismaAislado, conexionId: string, ids: string[]): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      const existentes = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Reporte" WHERE "id" = ANY(${ids}) FOR KEY SHARE`;
      const conocidos = new Set(existentes.map((fila) => fila.id));
      const desconocidos = ids.filter((id) => !conocidos.has(id));
      if (desconocidos.length > 0) {
        return desconocidos;
      }
    }
    const actual = await tx.tablero.findFirst({ select: { id: true } });
    if (actual === null) {
      await tx.tablero.create({ data: conTenantInyectado({ conexionId, reportes: ids }) });
    } else {
      await tx.tablero.update({ where: { id: actual.id }, data: { conexionId, reportes: ids } });
    }
    return [];
  });
}

export function registerTableroRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  /** The active tenant's dashboard; a tenant that never saved one reads as none. */
  app.get('/tablero', async (_request, reply) => {
    const tablero = await prisma.tablero.findFirst({ select: { conexionId: true, reportes: true } });
    if (tablero === null) {
      return reply.code(200).send({ conexionId: null, reportes: [] } satisfies RespuestaTablero);
    }
    return reply.code(200).send(await respuestaDe(prisma, tablero.conexionId, tablero.reportes));
  });

  /**
   * Replaces the whole dashboard, creating it if there is none. The checks run in the spec's
   * order and the first refusal wins: 1. the shape (AJV); 2. the connection is the tenant's
   * (a scoped read, so another tenant's id is `404` like an unknown one); 3. every report
   * exists, under the lock. Unapproved views never refuse. A racing first save of the same
   * tenant loses the unique `tenantId` and gets one more attempt, which then finds the row.
   */
  app.put<{ Body: TableroBody }>(
    '/tablero',
    { schema: { body: tableroSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: camposInvalidos(request.validationError) });
      }
      const { conexionId, reportes } = request.body;
      const conexion = await prisma.conexion.findUnique({ where: { id: conexionId }, select: { id: true } });
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }
      let desconocidos: string[];
      try {
        desconocidos = await guardarTablero(prisma, conexionId, reportes);
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) throw error;
        desconocidos = await guardarTablero(prisma, conexionId, reportes);
      }
      if (desconocidos.length > 0) {
        return reply
          .code(400)
          .send({ error: 'solicitud-invalida', campos: ['/reportes'], desconocidos });
      }
      return reply.code(200).send(await respuestaDe(prisma, conexionId, reportes));
    },
  );
}
