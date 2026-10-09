import { cronValido } from './automatizaciones.js';
import { destinatarioDe } from './automatizaciones-rutas.js';
import { sanearSql } from './consulta-ejecucion.js';
import { direccionValida } from './correo.js';
import { prepararSentencia, validarDeclaracion } from './parametros.js';
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
