/**
 * CH-24 (DEC-142 to DEC-145): the pure half of the freshness feature. It compares a
 * tenant's declared window with a template's tolerance and validates the body of
 * `PUT /tenants/:id/frescura`, with no Prisma and no I/O so every rule is unit-testable
 * without a database. Declare and show only: nothing here, or anywhere it is called from,
 * blocks or alters a run (DEC-142, rule 6).
 */

/** One year in minutes: keeps absurd windows out without inventing a business rule. */
export const LIMITE_VENTANA_MINUTOS = 525600;

export type EstadoFrescura = 'sin-declarar' | 'al-dia' | 'desactualizada';

/**
 * `sin-declarar` when the tenant has not declared a window (null is never "fresh"),
 * `desactualizada` when the window is greater than the template's tolerance, `al-dia`
 * otherwise. Equal is `al-dia`. The console applies the same rule on the client, pinned by
 * the same vectors (DEC-145).
 */
export function evaluarFrescura(ventana: number | null, tolerancia: number): EstadoFrescura {
  if (ventana === null) {
    return 'sin-declarar';
  }
  return ventana > tolerancia ? 'desactualizada' : 'al-dia';
}

/** The request body as the route hands it over: only the two keys, values still untrusted. */
export interface CuerpoFrescura {
  ventanaMinutos?: unknown;
  actualizadaAhora?: unknown;
}

/** Columns to write: only the ones the body asked for. */
export interface DatosFrescura {
  ventanaDesactualizacionMinutos?: number | null;
  replicaActualizadaEn?: Date;
}

export type ResolucionFrescura =
  | { ok: true; datos: DatosFrescura }
  | { ok: false; campos: string[] };

/**
 * Checks the body and returns the columns to write. `ventanaMinutos` is `null` (clear the
 * declaration) or an integer from 0 to `LIMITE_VENTANA_MINUTOS`; `actualizadaAhora` is a
 * strict boolean, `true` meaning "the server's `ahora`" and `false` meaning "leave it".
 * The types are checked here and not by the route schema on purpose: a schema type would
 * let AJV coerce `"5"` into `5` and `"true"` into `true` (the CH-23 lesson, DEC-60).
 *
 * A body with neither key is a failure with no field, and every offending field is named
 * together. `ahora` is injected so the "server clock" rule is testable.
 */
export function resolverFrescura(cuerpo: CuerpoFrescura, ahora: Date): ResolucionFrescura {
  const { ventanaMinutos, actualizadaAhora } = cuerpo;
  if (ventanaMinutos === undefined && actualizadaAhora === undefined) {
    return { ok: false, campos: [] };
  }
  const campos: string[] = [];
  const datos: DatosFrescura = {};

  if (ventanaMinutos !== undefined) {
    const valida =
      ventanaMinutos === null ||
      (typeof ventanaMinutos === 'number' &&
        Number.isInteger(ventanaMinutos) &&
        ventanaMinutos >= 0 &&
        ventanaMinutos <= LIMITE_VENTANA_MINUTOS);
    if (valida) {
      datos.ventanaDesactualizacionMinutos = ventanaMinutos as number | null;
    } else {
      campos.push('ventanaMinutos');
    }
  }

  if (actualizadaAhora !== undefined) {
    if (typeof actualizadaAhora !== 'boolean') {
      campos.push('actualizadaAhora');
    } else if (actualizadaAhora) {
      datos.replicaActualizadaEn = ahora;
    }
  }

  return campos.length > 0 ? { ok: false, campos } : { ok: true, datos };
}
