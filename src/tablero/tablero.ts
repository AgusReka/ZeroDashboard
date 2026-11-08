import { evaluarVistas, type FilaVista } from '../plantillas/plantillas.js';

/**
 * CH-46 (DEC-199): the pure half of the tenant dashboard. The cap, the strict body and the
 * pending views of a report. No Fastify, no Prisma, no connection: `tablero-rutas.ts` owns
 * every side effect.
 */

/** At most 8 reports: every view of the dashboard runs them all live (DEC-183, DEC-199). */
export const TOPE_REPORTES_TABLERO = 8;

export interface TableroBody {
  conexionId: string;
  reportes: string[];
}

/**
 * Strict body, `propertyNames` included for the reason `registroConsultaGuardadaSchema`
 * documents: under Fastify's `removeAdditional` an unknown key (a `tenantId` among them) would
 * otherwise be stripped and the body accepted. Every key is in `properties` too. Both fields
 * are required, so an empty dashboard still names its connection. A repeated report and a
 * ninth one are refused here, naming `/reportes`; whether each id exists is checked in the
 * route, under the lock.
 */
export const tableroSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['conexionId', 'reportes'] },
  required: ['conexionId', 'reportes'],
  properties: {
    conexionId: { type: 'string', minLength: 1 },
    reportes: {
      type: 'array',
      maxItems: TOPE_REPORTES_TABLERO,
      uniqueItems: true,
      items: { type: 'string' },
    },
  },
} as const;

/**
 * The report's entities whose views are not approved on the connection, in contract order,
 * by the DEC-71 rule (`evaluarVistas`). Empty when every view is approved. Informative only
 * (DEC-199): nothing is refused or run with it.
 */
export function pendientesDe(entidades: unknown, filas: readonly FilaVista[]): string[] {
  const compuerta = evaluarVistas(entidades, filas);
  return compuerta.ok ? [] : compuerta.entidades.map(({ entidad }) => entidad);
}
