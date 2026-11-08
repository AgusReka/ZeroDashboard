import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { SIN_AGENTES, type AbridorDeCanales } from '../agente/canal-agente.js';
import { camposInvalidos } from '../compartido/campos-invalidos.js';
import { ejecutarSobreVistas } from '../ejecucion/ejecucion-sobre-vistas.js';
import { rechazoDeReporte, registroReporteSchema, type RegistroReporteBody } from './reportes-rutas.js';
import {
  declaracionDelPeriodo,
  faltantesEn,
  fechaDelPeriodo,
  leerReporte,
  topeEfectivo,
  type ColumnaAsignada,
  type Periodo,
  type Visualizacion,
} from './reportes.js';

/**
 * CH-45 (DEC-183, DEC-198): `POST /reportes/:id/prueba` tests a stored report and
 * `POST /reportes/prueba` an unsaved one, on a connection of the active tenant. Unlike the
 * catalog in `reportes-rutas.ts`, they are **not** exempt from `x-tenant-id`: they resolve a
 * tenant-owned `Conexion`, so they take the full scoped client and live in their own file.
 *
 * The period is the only input besides the connection: the request names one of the declared
 * numbers of days, and the server computes the date in the deployment zone (DEC-77) and binds
 * it as a driver parameter (rule 4). No request carries a date. Every execution asks for the
 * first page only, capped by the visualization (DEC-198), and no returned row is stored (DEC-93).
 */

interface PruebaParams {
  id: string;
}

interface PruebaBody {
  conexionId: string;
  dias?: number;
}

/** The stored-report test: the connection and, optionally, one of the declared days. */
const pruebaSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['conexionId', 'dias'] },
  required: ['conexionId'],
  properties: {
    conexionId: { type: 'string', minLength: 1 },
    dias: { type: 'integer' },
  },
} as const;

/**
 * The unsaved-report test: the report's own properties come from `registroReporteSchema`, so
 * the two can never drift, plus the test fields. `columnas` is optional here (this test is
 * what produces the columns), and so is `columnasPrueba`, which is ignored.
 */
const pruebaSinGuardarSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: {
    enum: [...registroReporteSchema.propertyNames.enum, 'conexionId', 'dias'],
  },
  required: [...registroReporteSchema.required.filter((campo) => campo !== 'columnas'), 'conexionId'],
  properties: {
    ...registroReporteSchema.properties,
    conexionId: pruebaSchema.properties.conexionId,
    dias: pruebaSchema.properties.dias,
  },
} as const;

interface PruebaSinGuardarBody extends RegistroReporteBody {
  conexionId: string;
  dias?: number;
}

/** What a test runs: a stored report read back fail-closed, or the form's validated body. */
interface ReporteAProbar {
  id: string | null;
  sql: string;
  entidades: unknown;
  visualizacion: Visualizacion;
  columnas: readonly ColumnaAsignada[];
  periodo: Periodo | null;
}

/**
 * The days to use: the requested value when it is declared, the first declared value when
 * none is requested. A value on a report with no period, or one it did not declare, is
 * refused (`null`).
 */
function diasDeLaPrueba(periodo: Periodo | null, dias: number | undefined): number | null | 'rechazo' {
  if (periodo === null) return dias === undefined ? null : 'rechazo';
  if (dias === undefined) return periodo.dias[0];
  return periodo.dias.includes(dias) ? dias : 'rechazo';
}

async function probarReporte(
  app: FastifyInstance,
  prisma: PrismaAislado,
  request: FastifyRequest,
  reply: FastifyReply,
  reporte: ReporteAProbar,
  cuerpo: PruebaBody,
  contexto: { zonaHoraria: string; topeFilas: number; canales: AbridorDeCanales },
) {
  const dias = diasDeLaPrueba(reporte.periodo, cuerpo.dias);
  if (dias === 'rechazo') {
    return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/dias'] });
  }
  const periodo = dias === null ? null : { dias, desde: fechaDelPeriodo(new Date(), contexto.zonaHoraria, dias) };
  const valores: Record<string, unknown> =
    reporte.periodo === null || periodo === null ? {} : { [reporte.periodo.parametro]: periodo.desde };
  const tope = topeEfectivo(reporte.visualizacion, contexto.topeFilas);

  const respuesta = await ejecutarSobreVistas(app, prisma, request, {
    conexionId: cuerpo.conexionId,
    sql: reporte.sql,
    parametros: declaracionDelPeriodo(reporte.periodo),
    entidades: reporte.entidades,
    valores,
    // One more than the cap is asked for, so the engine reports `corte` when the cap is what
    // ended the result (DEC-18): the page served and the ceiling are both `tope`.
    limite: tope + 1,
    desplazamiento: 0,
    topeFilas: tope,
    auditoria: { origen: 'reporte-prueba', plantillaId: null, reporteId: reporte.id },
    mensajeFallo: 'report test execution failed',
  }, contexto.canales);
  if (respuesta.codigo !== 200) {
    return reply.code(respuesta.codigo).send(respuesta.cuerpo);
  }
  const ejecucion = respuesta.cuerpo;
  return reply.code(200).send({
    ...ejecucion,
    periodo,
    ...(ejecucion.resultado === 'ok' ? { faltantes: faltantesEn(reporte.columnas, ejecucion.columnas) } : {}),
  });
}

/**
 * `zonaHoraria` and `topeFilas` come from the entry point's one `loadConfig()`: the zone the
 * scheduler reads in (DEC-77) and the deployment's `maxFilasPorConsulta`.
 */
export function registerReportePruebaRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
  zonaHoraria: string,
  topeFilas: number,
  canales: AbridorDeCanales = SIN_AGENTES,
): void {
  const contexto = { zonaHoraria, topeFilas, canales };

  // Fastify matches the static `/reportes/prueba` ahead of `/reportes/:id/prueba` (different
  // depth, so there is no clash). Not in `REPORTES_EXENTOS`: it needs the active tenant.
  app.post<{ Body: PruebaSinGuardarBody }>(
    '/reportes/prueba',
    { schema: { body: pruebaSinGuardarSchema }, attachValidation: true },
    async (request, reply) => {
      // The same refusal as `POST /reportes`, except the test-columns check: this test is what
      // produces the columns. Nothing executes before every check has passed.
      const motivo = rechazoDeReporte(request.validationError, request.body, { exigirColumnas: false });
      if (motivo !== null) {
        return reply.code(400).send(motivo);
      }
      const { conexionId, dias, sql, entidades, visualizacion, periodo } = request.body;
      return probarReporte(
        app,
        prisma,
        request,
        reply,
        { id: null, sql, entidades, visualizacion, columnas: request.body.columnas ?? [], periodo },
        { conexionId, dias },
        contexto,
      );
    },
  );

  app.post<{ Params: PruebaParams; Body: PruebaBody }>(
    '/reportes/:id/prueba',
    { schema: { body: pruebaSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: camposInvalidos(request.validationError) });
      }
      // `Reporte` is global (DEC-183): this read is not scoped, and `id` is `text`, so a
      // malformed id is simply not found.
      const fila = await prisma.reporte.findUnique({ where: { id: request.params.id } });
      if (fila === null) {
        return reply.code(404).send({ error: 'reporte-no-encontrado' });
      }
      // A stored value outside the rules throws here (500): a corrupt report never runs.
      const reporte = leerReporte(fila);
      return probarReporte(app, prisma, request, reply, reporte, request.body, contexto);
    },
  );
}
