import type { FastifyInstance } from 'fastify';
import { Prisma } from './generated/prisma/client.js';
import { conTenantInyectado, type PrismaAislado } from './aislamiento/aislamiento-prisma.js';
import { cronValido, proximaEjecucion } from './automatizaciones.js';
import { camposInvalidos } from './compartido/campos-invalidos.js';
import { sanearSql } from './ejecucion/consulta-ejecucion.js';
import { LIMITE_LISTADO } from './consultas-guardadas.js';
import { direccionValida } from './correo.js';
import { prepararSentencia, type ProblemaParametro } from './ejecucion/parametros.js';

/**
 * CH-13: the automation lifecycle routes — create, list, get, deactivate (DEC-74,
 * DEC-78, DEC-79) — and the runs listing (DEC-80). None is exempt from `x-tenant-id`: `Automatizacion` is a scoped model,
 * so every read and write below is filtered by the tenant the hooks resolved from the
 * header (DEC-13), and the body never names one (rule 2). CH-33 (DEC-174) adds the
 * adjust: values, schedule and recipient change in place, on the same row. There is no
 * delete and no reactivation route, and the template and the connection never change: for
 * those, the automation is deactivated and created again.
 */

/**
 * The list projection. `valores` stays out, as `sql` stays out of a saved-query list:
 * a list renders what runs and when, and the full row is a second, explicit get-by-id.
 */
export const AutomatizacionResumen = {
  id: true,
  plantillaId: true,
  conexionId: true,
  cron: true,
  activo: true,
  creadaEn: true,
} as const;

/**
 * Every column except `tenantId`, which the caller already knows: create, get, deactivate.
 * CH-14: `destinatario` is here only, never on the list (DEC-82).
 */
export const AutomatizacionCompleta = { ...AutomatizacionResumen, valores: true, destinatario: true } as const;

/**
 * One run as the runs listing shows it (X2): every column except `tenantId` and
 * `automatizacionId`, which the URL already names. The row holds metadata only, never
 * the rows a run read, so there is nothing else to leave out.
 */
export const EjecucionListada = {
  id: true,
  estado: true,
  iniciadaEn: true,
  finalizadaEn: true,
  duracionMs: true,
  filas: true,
  corte: true,
  fase: true,
  error: true,
  codigoError: true,
  /** CH-14 (DEC-83): the closed notification outcome, never a body or a recipient. */
  notificacion: true,
  /** CH-17b (DEC-103): real connection attempts; null when the run never dialled. */
  intentos: true,
} as const;

interface RegistroAutomatizacionBody {
  plantillaId: string;
  conexionId: string;
  /** Checked against the template's stored declaration by `prepararSentencia`. */
  valores: Record<string, unknown>;
  cron: string;
  /** CH-14 (DEC-82): one address, settable only here. Absent means no notification. */
  destinatario?: string;
}

interface AutomatizacionParams {
  id: string;
}

/**
 * Strict body, `propertyNames` included for the reason `registroConsultaGuardadaSchema`
 * documents: under Fastify's `removeAdditional` an unknown key would otherwise be
 * stripped and the body accepted. So a `tenantId` or an `activo` in the body is a `400`,
 * never a silent drop. `valores` is a container only, as on `/plantillas/:id/prueba`, so
 * AJV cannot coerce a value (DEC-60).
 */
const registroAutomatizacionSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['plantillaId', 'conexionId', 'valores', 'cron', 'destinatario'] },
  required: ['plantillaId', 'conexionId', 'cron'],
  properties: {
    plantillaId: { type: 'string', minLength: 1 },
    conexionId: { type: 'string', minLength: 1 },
    valores: { type: 'object', default: {} },
    cron: { type: 'string', minLength: 1 },
    destinatario: { type: 'string', minLength: 1, maxLength: 254 },
  },
} as const;

/**
 * CH-14: the recipient as stored. Only surrounding spaces and tabs are trimmed (design
 * "trimmed"); a CR or LF anywhere stays in, so `direccionValida` refuses it (Threat
 * Matrix: CRLF in recipient is a `400`). `null` when the body has none.
 */
export function destinatarioDe(valor: string | undefined): string | null {
  return valor === undefined ? null : valor.replace(/^[ \t]+|[ \t]+$/g, '');
}

// ---- CH-33 (DEC-174): the operator's adjust ------------------------------------------

/** The adjust body as the route hands it over: only the three keys, values still untrusted. */
export interface CuerpoAjusteOperador {
  valores?: Record<string, unknown>;
  cron?: string;
  /** `null` clears it: the automation stops sending email (DEC-174, CH-33 D2). */
  destinatario?: string | null;
}

/** Columns to write: only the ones the body sent. */
export interface DatosAjusteOperador {
  valores?: Record<string, unknown>;
  cron?: string;
  destinatario?: string | null;
}

export type ResolucionAjusteOperador =
  | { ok: true; datos: DatosAjusteOperador }
  | { ok: false; campos: string[]; problemas?: ProblemaParametro[] };

/**
 * Checks an adjust body with the alta's own rules and returns the columns to write. It is
 * not the panel's `resolverAjustes`: that one knows only `umbral` and the three preset
 * schedules, while the operator edits whatever the alta sets (CH-33 D1). Every offender is
 * named together, as JSON pointers like the alta's, so the console reads them unchanged.
 * `valores` replaces the stored map as a whole: nothing is merged, so a key the template no
 * longer declares cannot linger, and the stored row is not needed here.
 */
export function resolverAjusteOperador(
  cuerpo: CuerpoAjusteOperador,
  plantilla: { sql: string; parametros: unknown },
  zona: string,
): ResolucionAjusteOperador {
  const campos: string[] = [];
  const datos: DatosAjusteOperador = {};
  let problemas: ProblemaParametro[] | undefined;

  if (cuerpo.cron !== undefined) {
    if (cronValido(cuerpo.cron, zona)) {
      datos.cron = cuerpo.cron;
    } else {
      campos.push('/cron');
    }
  }

  if (cuerpo.destinatario === null) {
    datos.destinatario = null;
  } else if (cuerpo.destinatario !== undefined) {
    const limpio = destinatarioDe(cuerpo.destinatario);
    if (limpio !== null && direccionValida(limpio)) {
      datos.destinatario = limpio;
    } else {
      campos.push('/destinatario');
    }
  }

  if (cuerpo.valores !== undefined) {
    // Only the verdict is used, as in the alta: every run composes the statement again.
    const preparada = prepararSentencia(sanearSql(plantilla.sql), plantilla.parametros, cuerpo.valores);
    if (preparada.ok) {
      datos.valores = cuerpo.valores;
    } else {
      problemas = preparada.problemas;
      for (const campo of new Set(preparada.problemas.map((problema) => problema.campo))) {
        campos.push(campo);
      }
    }
  }

  if (campos.length > 0) {
    return problemas === undefined ? { ok: false, campos } : { ok: false, campos, problemas };
  }
  return { ok: true, datos };
}

/**
 * Strict body, `propertyNames` included for the reason `registroAutomatizacionSchema`
 * documents, so `plantillaId`, `conexionId`, `activo` or `tenantId` are a `400`, never a
 * silent drop. `valores` is a container only, as in the alta (DEC-60), and has no `default`:
 * an absent key must stay absent, or every adjust would rewrite the map. `destinatario`
 * admits `null`, which clears it.
 */
const ajusteOperadorSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  propertyNames: { enum: ['valores', 'cron', 'destinatario'] },
  properties: {
    valores: { type: 'object' },
    cron: { type: 'string', minLength: 1 },
    destinatario: { type: ['string', 'null'], maxLength: 254 },
  },
} as const;

/** `P2025` is Prisma's "no row to update": the row vanished between the read and the write. */
function esFilaInexistente(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** The next fire as ISO UTC, or `null` when a stored expression no longer resolves. */
function proximaIso(cron: string, ahora: Date, zona: string): string | null {
  if (!cronValido(cron, zona)) {
    return null;
  }
  try {
    return proximaEjecucion(cron, ahora, zona).toISOString();
  } catch {
    return null;
  }
}

/**
 * `zonaHoraria` is the deployment-wide zone (DEC-77), passed in by `src/server.ts` from
 * its one `loadConfig()`, so a schedule is accepted only if it resolves in the zone the
 * scheduler will read it in.
 */
export function registerAutomatizacionRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
  zonaHoraria: string,
): void {
  app.post<{ Body: RegistroAutomatizacionBody }>(
    '/automatizaciones',
    { schema: { body: registroAutomatizacionSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }
      const { plantillaId, conexionId, valores, cron } = request.body;
      // Pure and first (DEC-76): a schedule the scheduler could never read is refused
      // before any row is looked up.
      if (!cronValido(cron, zonaHoraria)) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/cron'] });
      }
      // CH-14: pure as well, so a bad address is refused before any read (DEC-82).
      const destinatario = destinatarioDe(request.body.destinatario);
      if (destinatario !== null && !direccionValida(destinatario)) {
        return reply.code(400).send({ error: 'solicitud-invalida', campos: ['/destinatario'] });
      }

      // `Plantilla` is global (DEC-61): this read is not scoped, and `id` is `text`, so a
      // malformed id is simply not found.
      const plantilla = await prisma.plantilla.findUnique({
        where: { id: plantillaId },
        select: { sql: true, parametros: true },
      });
      if (plantilla === null) {
        return reply.code(404).send({ error: 'plantilla-no-encontrada' });
      }

      // Ownership check only: the extension adds `tenantId` to this selector (DEC-13), so
      // another tenant's connection is `null` here and nothing is written. The foreign key
      // alone would accept it, since it does not know about tenants.
      const conexion = await prisma.conexion.findUnique({
        where: { id: conexionId },
        select: { id: true },
      });
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      // The CH-11 value rules against the stored declaration, exactly as the test route
      // applies them. Only the verdict is used here: the statement is composed again on
      // every run, because DEC-68 lets the template change in place after this check.
      const preparada = prepararSentencia(sanearSql(plantilla.sql), plantilla.parametros, valores);
      if (!preparada.ok) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: [...new Set(preparada.problemas.map((problema) => problema.campo))],
          problemas: preparada.problemas,
        });
      }

      // `activo` is not written here: the schema default (`true`) is the single place
      // "a new automation is active" is stated, as with `Tenant`. The cast is sound:
      // `prepararSentencia` just accepted every key as declared and every value as a
      // string, finite number or boolean, so the map is a flat JSON object.
      const automatizacion = await prisma.automatizacion.create({
        data: conTenantInyectado({
          plantillaId,
          conexionId,
          valores: valores as Prisma.InputJsonObject,
          cron,
          destinatario,
        }),
        select: AutomatizacionCompleta,
      });
      // CH-21c (DEC-129): two additive fields. The first run is computed from the stored
      // `creadaEn`, the scheduler's own lower edge, and sent as a UTC instant with the
      // zone it was resolved in, so the client formats it in that zone, not its own.
      return reply.code(201).send({
        automatizacion,
        proximaEjecucion: proximaEjecucion(cron, automatizacion.creadaEn, zonaHoraria).toISOString(),
        zonaHoraria,
      });
    },
  );

  app.get('/automatizaciones', async (_request, reply) => {
    // Deactivated rows are listed too (DEC-79): their past runs stay reachable. Newest
    // first, as saved queries are; `LIMITE_LISTADO + 1` decides the page and `truncado`
    // in one query.
    const filas = await prisma.automatizacion.findMany({
      select: AutomatizacionResumen,
      orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
      take: LIMITE_LISTADO + 1,
    });
    const truncado = filas.length > LIMITE_LISTADO;
    return reply.code(200).send({
      automatizaciones: truncado ? filas.slice(0, LIMITE_LISTADO) : filas,
      truncado,
    });
  });

  // Scoped by the extension: another tenant's id is `null`, the same as an unknown one.
  app.get<{ Params: AutomatizacionParams }>('/automatizaciones/:id', async (request, reply) => {
    const automatizacion = await prisma.automatizacion.findUnique({
      where: { id: request.params.id },
      select: AutomatizacionCompleta,
    });
    if (automatizacion === null) {
      return reply.code(404).send({ error: 'automatizacion-no-encontrada' });
    }
    return reply.code(200).send({ automatizacion });
  });

  /**
   * The same shape as `/tenants/:id/baja`: read first, because an already-inactive row
   * has to be told apart from an unknown one and `update` reports both as P2025. There
   * is no mirror-image route; nothing in this module ever writes `activo: true` (DEC-79).
   */
  app.post<{ Params: AutomatizacionParams }>(
    '/automatizaciones/:id/desactivar',
    async (request, reply) => {
      const actual = await prisma.automatizacion.findUnique({
        where: { id: request.params.id },
        select: { activo: true },
      });
      if (actual === null) {
        return reply.code(404).send({ error: 'automatizacion-no-encontrada' });
      }
      if (!actual.activo) {
        return reply.code(409).send({ error: 'automatizacion-desactivada' });
      }
      const automatizacion = await prisma.automatizacion.update({
        where: { id: request.params.id },
        data: { activo: false },
        select: AutomatizacionCompleta,
      });
      return reply.code(200).send({ automatizacion });
    },
  );

  /**
   * CH-33 (DEC-174): adjust in place. Read first through the scoped model, as `desactivar`
   * does: another tenant's id is `null`, the same `404` as an unknown one, and a deactivated
   * row is a `409` (DEC-79: nothing reactivates or edits it). `Plantilla` is global (DEC-61)
   * and its id comes from a row the extension already scoped. The scheduler re-reads `cron`
   * and `valores` on every tick, so the change applies from the next run.
   */
  app.put<{ Params: AutomatizacionParams; Body: CuerpoAjusteOperador }>(
    '/automatizaciones/:id/ajustes',
    { schema: { body: ajusteOperadorSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }
      const actual = await prisma.automatizacion.findUnique({
        where: { id: request.params.id },
        select: { activo: true, plantillaId: true },
      });
      if (actual === null) {
        return reply.code(404).send({ error: 'automatizacion-no-encontrada' });
      }
      if (!actual.activo) {
        return reply.code(409).send({ error: 'automatizacion-desactivada' });
      }
      const plantilla = await prisma.plantilla.findUnique({
        where: { id: actual.plantillaId },
        select: { sql: true, parametros: true },
      });
      if (plantilla === null) {
        return reply.code(404).send({ error: 'plantilla-no-encontrada' });
      }

      const resolucion = resolverAjusteOperador(request.body, plantilla, zonaHoraria);
      if (!resolucion.ok) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: resolucion.campos,
          ...(resolucion.problemas === undefined ? {} : { problemas: resolucion.problemas }),
        });
      }
      const { valores, cron, destinatario } = resolucion.datos;
      try {
        const automatizacion = await prisma.automatizacion.update({
          where: { id: request.params.id },
          data: {
            // Sound cast: `prepararSentencia` accepted every key as declared and every value
            // as a string, finite number or boolean (as in the alta).
            ...(valores === undefined ? {} : { valores: valores as Prisma.InputJsonObject }),
            ...(cron === undefined ? {} : { cron }),
            ...(destinatario === undefined ? {} : { destinatario }),
          },
          select: AutomatizacionCompleta,
        });
        return reply.code(200).send({
          automatizacion,
          proximaEjecucion: proximaIso(automatizacion.cron, new Date(), zonaHoraria),
          zonaHoraria,
        });
      } catch (error) {
        if (esFilaInexistente(error)) {
          return reply.code(404).send({ error: 'automatizacion-no-encontrada' });
        }
        throw error;
      }
    },
  );

  /**
   * The runs of one automation, newest first (DEC-80). The automation is resolved first,
   * through the scoped model, so another tenant's id is `404` before any run is read, the
   * same answer as an unknown id. A deactivated automation still resolves: its past runs
   * stay reachable (DEC-79). The run read is scoped by the extension as well.
   */
  app.get<{ Params: AutomatizacionParams }>(
    '/automatizaciones/:id/ejecuciones',
    async (request, reply) => {
      const automatizacion = await prisma.automatizacion.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });
      if (automatizacion === null) {
        return reply.code(404).send({ error: 'automatizacion-no-encontrada' });
      }
      const filas = await prisma.ejecucion.findMany({
        where: { automatizacionId: automatizacion.id },
        select: EjecucionListada,
        orderBy: [{ iniciadaEn: 'desc' }, { id: 'asc' }],
        take: LIMITE_LISTADO + 1,
      });
      const truncado = filas.length > LIMITE_LISTADO;
      return reply.code(200).send({
        ejecuciones: truncado ? filas.slice(0, LIMITE_LISTADO) : filas,
        truncado,
      });
    },
  );
}
