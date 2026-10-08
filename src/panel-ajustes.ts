import type { FastifyInstance } from 'fastify';
import { Prisma } from './generated/prisma/client.js';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { cronValido, proximaEjecucion } from './automatizaciones.js';
import { destinatarioDe } from './automatizaciones-rutas.js';
import { camposInvalidos } from './conexiones.js';
import { conTenantActivo } from './contexto-tenant.js';
import { sanearSql } from './consulta-ejecucion.js';
import { direccionValida } from './correo.js';
import { prepararSentencia, validarDeclaracion } from './parametros.js';
import { levantarSesionPanel } from './panel-auth.js';
import { DIAS_PRESET, horarioPresetDeCron, type Dias } from './panel-automatizaciones.js';

/**
 * CH-23 (DEC-138 to DEC-141): the pure half of the panel's "ajustar" feature. It maps the
 * form's `{hora, dias}` to the cron the scheduler reads and back, projects the editable
 * values with an explicit allow-list, and validates an update body, with no Prisma and no
 * I/O so every rule is unit-testable without a database. The client never sends a cron, a
 * `valores` map or SQL (rules 1 and 2): the server rebuilds both from the four fields.
 */

/** The stored columns the adjust read and write need; nothing else is selected. */
export interface FilaAjustes {
  activo: boolean;
  cron: string;
  valores: unknown;
  destinatario: string | null;
}

/** The template columns the value rules read: the statement and its declaration. */
export interface PlantillaAjustes {
  sql: string;
  parametros: unknown;
}

/** What `GET .../ajustes` returns (DEC-141); every key but the last two is conditional. */
export interface AjustesLeidos {
  umbral?: number;
  hora?: string;
  dias?: Dias;
  destinatario: string | null;
  zonaHoraria: string;
}

/** The update body as the route hands it over: only the four keys, values still untrusted. */
export interface CuerpoAjustes {
  umbral?: unknown;
  hora?: unknown;
  dias?: unknown;
  destinatario?: unknown;
}

/** Columns to write: only the ones the body changed. `valores` is always the merged map. */
export interface DatosAjustes {
  cron?: string;
  valores?: Record<string, unknown>;
  destinatario?: string;
}

export type ResolucionAjustes =
  | { ok: true; datos: DatosAjustes }
  | { ok: false; estado: 400; campos: string[] }
  | { ok: false; estado: 409; error: 'horario-no-editable' };

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Whether the template declares the `umbral` parameter as a number (the only editable one). */
function declaraUmbral(parametros: unknown): boolean {
  const declaracion = validarDeclaracion(parametros);
  return declaracion.ok && declaracion.valor.some((d) => d.nombre === 'umbral' && d.tipo === 'numero');
}

/** The stored `valores` as an own-key copy, or an empty map if it is not an object. */
function valoresComoMapa(valores: unknown): Record<string, unknown> {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) {
    return {};
  }
  return Object.fromEntries(Object.entries(valores));
}

/**
 * The cron for an hour (`HH:MM`, 24 hours) and a day set, as `M H * * D` with no leading
 * zeros, the same text the console builds (DEC-129). `null` for an invalid hour or day set.
 */
export function cronDeHorario(hora: unknown, dias: unknown): string | null {
  const partes = typeof hora === 'string' ? HORA.exec(hora) : null;
  const preset = typeof dias === 'string' ? DIAS_PRESET.get(dias as Dias) : undefined;
  if (partes === null || preset === undefined) {
    return null;
  }
  return `${Number(partes[2])} ${Number(partes[1])} * * ${preset.cron}`;
}

/**
 * The editable values of one automation, written literally from named inputs and never by
 * spreading a row, so a column added later cannot leak. `umbral` only if the template
 * declares it and the stored value is a finite number; `hora` and `dias` only if the stored
 * cron is one of the three DEC-129 patterns, so a custom cron never reaches the client.
 */
export function proyectarAjustes(
  fila: FilaAjustes,
  plantilla: PlantillaAjustes,
  zona: string,
): AjustesLeidos {
  const ajustes: AjustesLeidos = { destinatario: fila.destinatario, zonaHoraria: zona };
  const umbral = valoresComoMapa(fila.valores).umbral;
  if (declaraUmbral(plantilla.parametros) && typeof umbral === 'number' && Number.isFinite(umbral)) {
    ajustes.umbral = umbral;
  }
  const horario = horarioPresetDeCron(fila.cron);
  if (horario !== null) {
    ajustes.hora = `${String(horario.hora).padStart(2, '0')}:${String(horario.minuto).padStart(2, '0')}`;
    ajustes.dias = horario.dias;
  }
  return ajustes;
}

/**
 * Checks an update body against the stored automation and its template (DEC-141) and
 * returns the columns to write. Order: no key at all is a 400 with no field; a schedule
 * change over a non-preset cron is a 409, never a silent overwrite; then every field is
 * checked and all offenders are named together, in business names (`umbral`, `hora`,
 * `dias`, `destinatario`), never as JSON pointers or `cron`.
 *
 * `umbral` is merged into the stored `valores` and the result goes through the same
 * `prepararSentencia` the alta uses, so the DEC-60 shape rules apply unchanged. When only
 * one of `hora` and `dias` is sent, the other comes from the stored preset.
 */
export function resolverAjustes(
  cuerpo: CuerpoAjustes,
  fila: FilaAjustes,
  plantilla: PlantillaAjustes,
  zona: string,
): ResolucionAjustes {
  const { umbral, hora, dias, destinatario } = cuerpo;
  if ([umbral, hora, dias, destinatario].every((valor) => valor === undefined)) {
    return { ok: false, estado: 400, campos: [] };
  }
  const base = horarioPresetDeCron(fila.cron);
  const cambiaHorario = hora !== undefined || dias !== undefined;
  if (cambiaHorario && base === null) {
    return { ok: false, estado: 409, error: 'horario-no-editable' };
  }

  const campos: string[] = [];
  const datos: DatosAjustes = {};

  if (umbral !== undefined) {
    const valores = { ...valoresComoMapa(fila.valores), umbral };
    const preparada = declaraUmbral(plantilla.parametros)
      ? prepararSentencia(sanearSql(plantilla.sql), plantilla.parametros, valores)
      : null;
    if (preparada === null || !preparada.ok) {
      campos.push('umbral');
    } else {
      datos.valores = valores;
    }
  }

  if (cambiaHorario && base !== null) {
    const baseHora = `${String(base.hora).padStart(2, '0')}:${String(base.minuto).padStart(2, '0')}`;
    const horaFinal = hora === undefined ? baseHora : hora;
    const diasFinal = dias === undefined ? base.dias : dias;
    const cron = cronDeHorario(horaFinal, diasFinal);
    if (hora !== undefined && cronDeHorario(hora, base.dias) === null) {
      campos.push('hora');
    }
    if (dias !== undefined && cronDeHorario(baseHora, dias) === null) {
      campos.push('dias');
    }
    if (cron !== null && cronValido(cron, zona)) {
      datos.cron = cron;
    } else if (!campos.includes('hora') && !campos.includes('dias')) {
      campos.push('hora');
    }
  }

  if (destinatario !== undefined) {
    const limpio = typeof destinatario === 'string' ? destinatarioDe(destinatario) : null;
    if (limpio === null || !direccionValida(limpio)) {
      campos.push('destinatario');
    } else {
      datos.destinatario = limpio;
    }
  }

  return campos.length > 0 ? { ok: false, estado: 400, campos } : { ok: true, datos };
}

// ---- routes (DEC-141, DEC-135) ------------------------------------------------------

/**
 * Strict body, `propertyNames` included for the reason `registroAutomatizacionSchema`
 * documents: under Fastify's `removeAdditional` an unknown key would otherwise be stripped
 * and the body accepted, so a `tenantId`, `cron`, `sql` or `valores` is a `400`. `umbral`
 * is declared with an empty schema on purpose: it must be listed in `properties` or
 * `additionalProperties: false` would strip it silently, and it has no type so AJV cannot
 * coerce it and `prepararSentencia` applies DEC-60.
 */
const ajustesSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  propertyNames: { enum: ['umbral', 'hora', 'dias', 'destinatario'] },
  properties: {
    umbral: {},
    hora: { type: 'string', maxLength: 5 },
    dias: { type: 'string', maxLength: 16 },
    destinatario: { type: 'string', maxLength: 254 },
  },
} as const;

interface ParamsAjustes {
  id: string;
}

type RespuestaAjustes = { estado: number; cuerpo: unknown };

const NO_ENCONTRADA: RespuestaAjustes = { estado: 404, cuerpo: { error: 'automatizacion-no-encontrada' } };

/** Field names for a schema error: the offending key, never a JSON pointer. */
function camposDeEsquema(error: { validation?: unknown }): string[] {
  return camposInvalidos(error)
    .map((campo) => campo.replace(/^\//, ''))
    .filter((campo) => campo !== '');
}

/** `P2025` is Prisma's "no row to update": the row vanished between the read and the write. */
function esFilaInexistente(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** The next fire as ISO UTC, or `null` when a stored custom expression cannot be resolved. */
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
 * `GET` and `PUT /api/panel/automatizaciones/:id/ajustes`: session-guarded, tenant only
 * from the session (DEC-135). `:id` goes through the scoped `findUnique`, so another
 * tenant's id is `null` here and answers the same `404` as an unknown one. `PUT` writes
 * only what `resolverAjustes` returns, with one scoped `update`; the scheduler re-reads
 * `cron` and `valores` on every tick, so the change applies from the next run.
 */
export function registerPanelAjustesRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
  zonaHoraria: string,
  ahora: () => Date = () => new Date(),
): void {
  /** The stored automation and its template, or `null` for an unknown or foreign id. */
  async function leer(id: string) {
    const fila = await prisma.automatizacion.findUnique({
      where: { id },
      select: { activo: true, cron: true, valores: true, destinatario: true, plantillaId: true },
    });
    if (fila === null) {
      return null;
    }
    // `Plantilla` is global (DEC-61): this read is not scoped, and the id comes from a
    // row the extension already scoped.
    const plantilla = await prisma.plantilla.findUnique({
      where: { id: fila.plantillaId },
      select: { sql: true, parametros: true },
    });
    return plantilla === null ? null : { fila, plantilla };
  }

  app.get<{ Params: ParamsAjustes }>(
    '/api/panel/automatizaciones/:id/ajustes',
    { preHandler: [levantarSesionPanel(prisma)] },
    async (request, reply) => {
      const sesion = request.sesionPanel!;
      const respuesta = await conTenantActivo(
        { id: sesion.tenantId, nombre: sesion.tenantNombre },
        async (): Promise<RespuestaAjustes> => {
          const leida = await leer(request.params.id);
          return leida === null
            ? NO_ENCONTRADA
            : { estado: 200, cuerpo: proyectarAjustes(leida.fila, leida.plantilla, zonaHoraria) };
        },
      );
      return reply.code(respuesta.estado).send(respuesta.cuerpo);
    },
  );

  app.put<{ Params: ParamsAjustes; Body: CuerpoAjustes }>(
    '/api/panel/automatizaciones/:id/ajustes',
    {
      schema: { body: ajustesSchema },
      attachValidation: true,
      preHandler: [levantarSesionPanel(prisma)],
    },
    async (request, reply) => {
      const sesion = request.sesionPanel!;
      if (request.validationError) {
        return reply
          .code(400)
          .send({ error: 'solicitud-invalida', campos: camposDeEsquema(request.validationError) });
      }
      const respuesta = await conTenantActivo(
        { id: sesion.tenantId, nombre: sesion.tenantNombre },
        async (): Promise<RespuestaAjustes> => {
          const leida = await leer(request.params.id);
          if (leida === null) {
            return NO_ENCONTRADA;
          }
          if (!leida.fila.activo) {
            return { estado: 409, cuerpo: { error: 'automatizacion-pausada' } };
          }
          const resolucion = resolverAjustes(request.body, leida.fila, leida.plantilla, zonaHoraria);
          if (!resolucion.ok) {
            return resolucion.estado === 409
              ? { estado: 409, cuerpo: { error: resolucion.error } }
              : { estado: 400, cuerpo: { error: 'solicitud-invalida', campos: resolucion.campos } };
          }
          const { cron, valores, destinatario } = resolucion.datos;
          try {
            const guardada = await prisma.automatizacion.update({
              where: { id: request.params.id },
              data: {
                ...(cron === undefined ? {} : { cron }),
                // Sound cast: `prepararSentencia` accepted every key as declared and every
                // value as a string, finite number or boolean (as in the alta route).
                ...(valores === undefined ? {} : { valores: valores as Prisma.InputJsonObject }),
                ...(destinatario === undefined ? {} : { destinatario }),
              },
              select: { activo: true, cron: true, valores: true, destinatario: true },
            });
            return {
              estado: 200,
              cuerpo: {
                ...proyectarAjustes(guardada, leida.plantilla, zonaHoraria),
                proximaEjecucion: proximaIso(guardada.cron, ahora(), zonaHoraria),
              },
            };
          } catch (error) {
            if (esFilaInexistente(error)) {
              return NO_ENCONTRADA;
            }
            throw error;
          }
        },
      );
      return reply.code(respuesta.estado).send(respuesta.cuerpo);
    },
  );
}
