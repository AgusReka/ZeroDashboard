import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { conTenantActivo } from '../aislamiento/contexto-tenant.js';
import type { AbridorDeCanales } from '../agente/canal-agente.js';
import { diasDelPedido, ejecutarReporte, type ContextoReporte } from '../reportes/reporte-ejecucion.js';
import { leerReporte, type ReporteLeido } from '../reportes/reportes.js';
import { levantarSesionPanel } from './panel-auth.js';
import {
  crearCompuerta,
  DESCARTADO,
  entradaDeConfiguracion,
  leerDiasDeConsulta,
  respuestaDeEjecucion,
  type Compuerta,
  type RespuestaReporte,
} from './panel-tablero.js';

/**
 * CH-48 (DEC-201, DEC-202): the client panel's dashboard API. Two session-guarded rows of
 * `RUTAS_PANEL_PUBLICAS`: the tenant comes only from the session (DEC-135, rule 2), and the
 * only client inputs are `:reporteId` and `dias`, both checked against the session tenant's
 * own dashboard. The connection is the dashboard's, never a request value. A run writes no
 * audit row (DEC-202) and leaves one `info` line with six closed fields. Every answer carries
 * `Cache-Control: no-store`, and no row is kept (DEC-93).
 */

export interface DependenciasPanelTablero {
  prisma: PrismaAislado;
  /** The deployment zone (DEC-77): the period's date and the page's date formatting. */
  zonaHoraria: string;
  /** `maxFilasPorConsulta`, the ceiling over the visualization's cap (DEC-198). */
  topeFilas: number;
  canales: AbridorDeCanales;
  /** The run gate; one per process by default (DEC-201). Tests inject their own. */
  compuerta?: Compuerta;
  /** The clock the period's date is computed with. */
  ahora?: () => Date;
}

interface ResultadoParams {
  reporteId: string;
}

const RECHAZO_DIAS = { error: 'solicitud-invalida', campos: ['/dias'] } as const;

/** The row count the `info` line carries: the rows answered, zero with no data, else null. */
function filasDe(respuesta: RespuestaReporte): number | null {
  if (respuesta.estado === 'ok') return respuesta.filas.length;
  return respuesta.estado === 'sin-datos' ? 0 : null;
}

export function registerPanelTableroRoutes(app: FastifyInstance, deps: DependenciasPanelTablero): void {
  const { prisma, zonaHoraria } = deps;
  const compuerta = deps.compuerta ?? crearCompuerta();
  const contexto: ContextoReporte = {
    zonaHoraria,
    topeFilas: deps.topeFilas,
    canales: deps.canales,
    ...(deps.ahora === undefined ? {} : { ahora: deps.ahora }),
  };
  // `onRequest` rather than in the handler, so the session hook's `401` carries it too.
  const sinCache: onRequestHookHandler = (_request, reply, listo) => {
    reply.header('Cache-Control', 'no-store');
    listo();
  };
  const opciones = { onRequest: [sinCache], preHandler: [levantarSesionPanel(prisma)] };

  app.get('/api/panel/tablero', opciones, async (request, reply) => {
    const sesion = request.sesionPanel!;
    const cuerpo = await conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, async () => {
      // Scoped: the session tenant's one dashboard, or none.
      const tablero = await prisma.tablero.findFirst({ select: { reportes: true } });
      const ids = tablero?.reportes ?? [];
      // `Reporte` is global (DEC-183): the ids come from the scoped dashboard above.
      const filas = ids.length === 0 ? [] : await prisma.reporte.findMany({ where: { id: { in: ids } } });
      const porId = new Map(filas.map((fila) => [fila.id, fila]));
      // `Tenant` is global, and the id is the session's.
      const tenant = await prisma.tenant.findUnique({
        where: { id: sesion.tenantId },
        select: { replicaActualizadaEn: true },
      });
      return {
        reportes: ids.flatMap((id) => {
          const fila = porId.get(id);
          return fila === undefined ? [] : [entradaDeConfiguracion(fila)];
        }),
        datos: { actualizadosEn: tenant?.replicaActualizadaEn?.toISOString() ?? null },
        zonaHoraria,
      };
    });
    return reply.code(200).send(cuerpo);
  });

  app.get<{ Params: ResultadoParams }>('/api/panel/tablero/:reporteId/resultado', opciones, async (request, reply) => {
    const sesion = request.sesionPanel!;
    const tenantId = sesion.tenantId;
    const tenant = { id: tenantId, nombre: sesion.tenantNombre };
    const dias = leerDiasDeConsulta(request.query);
    if (dias === 'rechazo') {
      return reply.code(400).send(RECHAZO_DIAS);
    }
    const reporteId = request.params.reporteId;

    // Every refusal below answers before anything is dialed or queued.
    const previo = await conTenantActivo(tenant, async () => {
      const tablero = await prisma.tablero.findFirst({ select: { conexionId: true, reportes: true } });
      if (tablero === null || !tablero.reportes.includes(reporteId)) {
        return { tipo: 'no-encontrado' } as const;
      }
      const fila = await prisma.reporte.findUnique({ where: { id: reporteId } });
      if (fila === null) {
        // Unreachable while reports are never deleted (DEC-68).
        return { tipo: 'no-encontrado' } as const;
      }
      try {
        return { tipo: 'listo', reporte: leerReporte(fila), conexionId: tablero.conexionId } as const;
      } catch {
        app.log.error({ reporteId }, 'stored report out of rules');
        return { tipo: 'corrupto' } as const;
      }
    });
    if (previo.tipo === 'no-encontrado') {
      return reply.code(404).send({ error: 'reporte-no-encontrado' });
    }
    if (previo.tipo === 'corrupto') {
      return reply.code(200).send({ estado: 'no-disponible' } satisfies RespuestaReporte);
    }
    const reporte: ReporteLeido = previo.reporte;
    const { conexionId } = previo;
    const diasUsados = diasDelPedido(reporte.periodo, dias);
    if (diasUsados === 'rechazo') {
      return reply.code(400).send(RECHAZO_DIAS);
    }

    // `request.raw.destroyed` is already true once a GET's empty body is read, so the open
    // check is on the response: destroyed when the client went away, ended once answered.
    const sigueAbierto = () => !reply.raw.destroyed && !reply.raw.writableEnded;
    const tarea = () =>
      // Its own context: a queued run starts from the end of another request's run.
      conTenantActivo(tenant, async (): Promise<RespuestaReporte> => {
        const inicio = Date.now();
        const resultado = await ejecutarReporte(
          app,
          prisma,
          request,
          reporte,
          { conexionId, ...(dias === undefined ? {} : { dias }) },
          contexto,
          null,
          'panel report execution failed',
        );
        // The days were checked above, so `dias-rechazados` cannot happen here.
        const respuesta: RespuestaReporte =
          resultado.tipo === 'respuesta'
            ? respuestaDeEjecucion(reporte, resultado.respuesta, resultado.periodo)
            : { estado: 'no-disponible' };
        // DEC-202: six closed fields, never SQL, the computed date nor a value.
        app.log.info(
          { tenantId, reporteId, conexionId, estado: respuesta.estado, filas: filasDe(respuesta), duracionMs: Date.now() - inicio },
          'panel report run',
        );
        return respuesta;
      });

    const pedido = compuerta.pedir(tenantId, `${tenantId}|${reporte.id}|${diasUsados ?? '-'}`, sigueAbierto, tarea);
    if (pedido === 'lleno') {
      return reply.code(429).send({ error: 'demasiadas-solicitudes' });
    }
    const respuesta = await pedido;
    // `descartado` only reaches a request that already closed: nothing goes out.
    return reply.code(200).send(respuesta === DESCARTADO ? ({ estado: 'error' } satisfies RespuestaReporte) : respuesta);
  });
}
