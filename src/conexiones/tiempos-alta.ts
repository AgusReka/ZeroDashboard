import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { exigirTenantActivo } from '../aislamiento/contexto-tenant.js';
import { LIMITE_LISTADO } from '../compartido/listados.js';

/**
 * CH-30e2 (DEC-178, G1): the onboarding timing marks of DEC-89 for the active tenant, one
 * entry per connection, for the console's Tiempos de alta screen.
 *
 * This is a second implementation of the CH-15 marks script, which stays the P4 tool
 * across every tenant (DEC-90) and is never read here (its static guard forbids naming it). The two must not drift:
 * `src/conexiones/tiempos-alta-rutas.test.ts` runs both on one fixture and requires the same marks.
 * Orderings and tie-breaks run in PostgreSQL, as the script's do, so both use the same
 * collation. The script's limits hold here too: the connection mark is the registration
 * (DEC-88), the validation mark is mutable, and marks measure elapsed time, not effort.
 */
export function registerTiemposAltaRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  app.get('/tiempos-alta', async (_request, reply) => {
    // `Tenant` is global, read by the id the header hooks resolved, never one from the query.
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: exigirTenantActivo().id },
      select: { creadoEn: true },
    });
    const filas = await prisma.conexion.findMany({
      select: { id: true, nombre: true, creadaEn: true },
      orderBy: [{ creadaEn: 'asc' }, { id: 'asc' }],
      take: LIMITE_LISTADO + 1,
    });
    const truncado = filas.length > LIMITE_LISTADO;
    const conexiones = truncado ? filas.slice(0, LIMITE_LISTADO) : filas;
    const mapeos = await prisma.vistaCanonica.groupBy({
      by: ['conexionId'],
      _min: { creadaEn: true },
      _max: { actualizadaEn: true },
    });
    const automatizaciones = await prisma.automatizacion.groupBy({ by: ['conexionId'], _min: { creadaEn: true } });

    const marcas = await Promise.all(
      conexiones.map(async (conexion) => {
        const mapeo = mapeos.find((m) => m.conexionId === conexion.id);
        const automatizacion = automatizaciones.find((a) => a.conexionId === conexion.id);
        const [validacion, primera, primeraOk] = await Promise.all([
          prisma.vistaCanonica.findFirst({
            where: { conexionId: conexion.id, validadaEn: { not: null } },
            orderBy: [{ validadaEn: 'desc' }, { entidad: 'asc' }, { id: 'asc' }],
            select: { validadaEn: true, estadoValidacion: true },
          }),
          prisma.ejecucion.findFirst({
            where: { automatizacion: { conexionId: conexion.id } },
            orderBy: [{ iniciadaEn: 'asc' }, { id: 'asc' }],
            select: { iniciadaEn: true, estado: true, fase: true },
          }),
          prisma.ejecucion.findFirst({
            where: { automatizacion: { conexionId: conexion.id }, estado: 'ok' },
            orderBy: [{ iniciadaEn: 'asc' }, { id: 'asc' }],
            select: { iniciadaEn: true },
          }),
        ]);
        return {
          conexionId: conexion.id,
          conexionNombre: conexion.nombre,
          altaInicio: tenant.creadoEn,
          conexionRegistrada: conexion.creadaEn,
          mapeoInicio: mapeo?._min.creadaEn ?? null,
          mapeoFin: mapeo?._max.actualizadaEn ?? null,
          validacionUltima: validacion?.validadaEn ?? null,
          validacionEstado: validacion?.estadoValidacion ?? null,
          automatizacionCreada: automatizacion?._min.creadaEn ?? null,
          primeraEjecucion: primera?.iniciadaEn ?? null,
          primeraEjecucionEstado: primera?.estado ?? null,
          primeraEjecucionFase: primera?.fase ?? null,
          primeraEjecucionOk: primeraOk?.iniciadaEn ?? null,
        };
      }),
    );
    return reply.code(200).send({ conexiones: marcas, truncado });
  });
}
