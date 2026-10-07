/**
 * CH-22b (DEC-137): the pure half of the panel's "mis automatizaciones" read. Business
 * copy, the readable frequency, the neutral run outcome and the allow-list projections
 * live here with no Prisma and no I/O, so every rule is unit-testable without a database.
 * The route that feeds these functions is a later work unit.
 */

/** What the client reads about one automation kind: a title and a one-line description. */
export interface CopyNegocio {
  titulo: string;
  descripcion: string;
}

/**
 * Business wording keyed by the template's `automatizacion` slug (DEC-128), the `TEMAS`
 * precedent of `src/correo.ts`. A `Map` lookup, so a slug such as `constructor` never
 * reaches `Object.prototype`. Insertion order is the order of `disponibles`.
 */
export const COPY_NEGOCIO: ReadonlyMap<string, CopyNegocio> = new Map([
  [
    'stock-fisico',
    {
      titulo: 'Aviso de stock bajo',
      descripcion: 'Te avisamos por correo cuando un producto se está quedando sin stock.',
    },
  ],
  [
    'stock-producible',
    {
      titulo: 'Aviso de productos que ya casi no podés armar',
      descripcion:
        'Te avisamos por correo cuando, con los insumos que tenés, ya casi no podés armar un producto.',
    },
  ],
]);

/** Any other slug on an existing automation: neutral text, never the template `nombre`. */
export const COPY_NEUTRO: CopyNegocio = {
  titulo: 'Automatización de tu negocio',
  descripcion: 'Una revisión automática que te mandamos por correo.',
};

/** The business copy of `slug`, or the neutral fallback. Never throws. */
export function copyDe(slug: string): CopyNegocio {
  return COPY_NEGOCIO.get(slug) ?? COPY_NEUTRO;
}

// ---- frequency (DEC-129) ------------------------------------------------------------

/** `M H * * D` with `D` one of the three day sets the console offers (DEC-129). */
const PATRON_FRECUENCIA = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|1-6)$/;

const DIAS_FRECUENCIA: ReadonlyMap<string, string> = new Map([
  ['*', 'Todos los días'],
  ['1-5', 'De lunes a viernes'],
  ['1-6', 'De lunes a sábado'],
]);

/**
 * Business text for the three DEC-129 patterns, such as `Todos los días a las 08:30`, in
 * the deployment zone. Any other expression gives `null` and the item omits the key, so
 * the stored expression never reaches the client.
 */
export function frecuenciaDeCron(cron: string): string | null {
  const partes = PATRON_FRECUENCIA.exec(cron.trim().split(/\s+/).join(' '));
  if (partes === null) {
    return null;
  }
  const minuto = Number(partes[1]);
  const hora = Number(partes[2]);
  const dias = DIAS_FRECUENCIA.get(partes[3] as string);
  if (minuto > 59 || hora > 23 || dias === undefined) {
    return null;
  }
  const hhmm = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
  return `${dias} a las ${hhmm}`;
}
