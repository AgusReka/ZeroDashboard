import { datosDePlantilla, PlantillaCompleta, rechazoDePlantilla, type RegistroPlantillaBody } from './plantillas-rutas.js';
import { FORMATOS, VALORES_AUTOMATIZACION } from './plantillas.js';
import { ENTIDADES_CANONICAS } from './vistas-canonicas.js';

/**
 * CH-21b: the initial template catalog (D3). A closed list of two verified templates,
 * `stock-fisico` and `stock-producible` (DEC-126: no `reporte-diario`), seeded by fixed id
 * and create-if-absent (DEC-125). Rule 6: nothing here widens the engine. Each entry is
 * ordinary template content that `POST /plantillas` would also accept.
 *
 * SQL deltas vs the verified CH-16 queries (`11_`, `04_`), none of which changes a row set:
 * `:umbral` replaces the literal `20` (DEC-127) and is added as `HAVING ... <= :umbral`
 * (DEC-128); `stock-fisico` compares `"stockDisponible"::numeric` so a decimal `umbral`
 * binds against an integer column; both `ARRAY_AGG`s break ties on `ins.id`, so name and
 * stock come from the same ingredient; `nombre`, `id` make every `ORDER BY` total; the
 * `id` column is dropped and the columns carry Spanish aliases, because they become the
 * email headers. No trailing `;` and no comments: the stored text is what the console shows.
 *
 * Order: the engine nests the template as `SELECT * FROM (<sql>) AS _plantilla` and then
 * pages it. PostgreSQL does not pull up a subquery that has `ORDER BY`, and no enclosing
 * level reorders rows, so `LIMIT` keeps the lowest-stock rows. That is observed planner
 * behavior, not a documented guarantee, and test L4 pins it. If it ever breaks, "order not
 * guaranteed" is documented as an artifact limit; the engine is never changed for it.
 *
 * Tolerances (60 and 120 minutes) are provisional (DEC-128): stored, never enforced (DEC-66).
 */

export const ID_STOCK_FISICO = '21b00000-0000-4000-8000-000000000001';
export const ID_STOCK_PRODUCIBLE = '21b00000-0000-4000-8000-000000000002';

export interface EntradaCatalogo extends RegistroPlantillaBody {
  readonly id: string;
}

export const CATALOGO_INICIAL: readonly EntradaCatalogo[] = Object.freeze(
  [
    {
      id: ID_STOCK_FISICO,
      nombre: 'Alerta de stock físico',
      sql: `SELECT
  pr.nombre AS "Producto",
  pr."stockDisponible" AS "Stock disponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible"::numeric <= :umbral
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC, pr.nombre ASC, pr.id ASC`,
      parametros: [{ nombre: 'umbral', tipo: 'numero' }],
      entidades: ['producto', 'receta_componente'],
      automatizacion: 'stock-fisico',
      formato: 'correo-html',
      toleranciaFrescuraMinutos: 60,
    },
    {
      id: ID_STOCK_PRODUCIBLE,
      nombre: 'Alerta de stock producible',
      sql: `SELECT
  pr.nombre AS "Producto",
  FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) AS "Stock producible",
  (ARRAY_AGG(ins.nombre
     ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS "Insumo limitante",
  (ARRAY_AGG(ins."stockDisponible"
     ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC, ins.id ASC))[1] AS "Stock del insumo limitante"
FROM v_producto pr
JOIN v_receta_componente rc ON rc."productoId" = pr.id
JOIN v_insumo ins           ON ins.id = rc."insumoId"
WHERE pr.activo = true
  AND rc."cantidadPorUnidad" > 0
GROUP BY pr.id, pr.nombre
HAVING FLOOR(MIN(ins."stockDisponible"::numeric / rc."cantidadPorUnidad")) <= :umbral
ORDER BY "Stock producible" ASC, pr.nombre ASC, pr.id ASC`,
      parametros: [{ nombre: 'umbral', tipo: 'numero' }],
      entidades: ['producto', 'insumo', 'receta_componente'],
      automatizacion: 'stock-producible',
      formato: 'correo-html',
      toleranciaFrescuraMinutos: 120,
    },
  ].map((entrada) => Object.freeze(entrada)),
);

/** One row as the seeder writes it: the route's own column mapping plus the fixed id. */
export type FilaCatalogo = ReturnType<typeof datosDePlantilla> & { id: string };

/** Only `createMany`: the seeder can reach no other model and no other method (rule 2). */
export interface DelegadoSiembra {
  createMany(args: { data: FilaCatalogo[]; skipDuplicates: true }): Promise<{ count: number }>;
}

/** The body keys `POST /plantillas` accepts, which are the model's columns minus `id`. */
const CLAVES: readonly string[] = Object.keys(PlantillaCompleta).filter((clave) => clave !== 'id');

/**
 * The save-time checks of `POST /plantillas`, without HTTP. Fastify owns the route's AJV,
 * so its half is restated here at runtime against the same constants the schema
 * enumerates (a type cannot stop a spread from adding a key) and reported as AJV-shaped
 * details. `rechazoDePlantilla` then builds the envelope exactly as the route does, and
 * with no detail runs its own blank-SQL and CH-11 parameter rules unchanged.
 */
export function rechazoDeEntrada(entrada: EntradaCatalogo): Record<string, unknown> | null {
  const e = entrada as unknown as Record<string, unknown>;
  const claves = Object.keys(e).filter((clave) => clave !== 'id');
  const detalles: { keyword: string; instancePath: string; params?: Record<string, string> }[] = [
    ...claves
      .filter((clave) => !CLAVES.includes(clave))
      .map((clave) => ({ keyword: 'additionalProperties', instancePath: '', params: { additionalProperty: clave } })),
    ...CLAVES.filter((clave) => !claves.includes(clave)).map((clave) => ({
      keyword: 'required',
      instancePath: '',
      params: { missingProperty: clave },
    })),
  ];
  const exigir = (instancePath: string, ok: boolean, keyword = 'type'): void => {
    if (!ok) detalles.push({ keyword, instancePath });
  };
  if (detalles.length === 0) {
    const entidades = e.entidades;
    exigir('/nombre', typeof e.nombre === 'string' && e.nombre !== '');
    exigir('/sql', typeof e.sql === 'string' && e.sql !== '');
    exigir('/entidades', Array.isArray(entidades) && entidades.length > 0 && new Set(entidades).size === entidades.length);
    if (Array.isArray(entidades)) {
      entidades.forEach((x, i) => exigir(`/entidades/${i}`, ENTIDADES_CANONICAS.includes(x as string), 'enum'));
    }
    exigir('/automatizacion', VALORES_AUTOMATIZACION.includes(e.automatizacion as string), 'enum');
    exigir('/formato', (FORMATOS as readonly string[]).includes(e.formato as string), 'enum');
    const tolerancia = e.toleranciaFrescuraMinutos;
    exigir('/toleranciaFrescuraMinutos', Number.isInteger(tolerancia) && (tolerancia as number) >= 0);
  }
  return rechazoDePlantilla(detalles.length > 0 ? { validation: detalles } : undefined, entrada);
}

/**
 * Validates every entry, then writes every absent row in one `createMany` with
 * `skipDuplicates` (`INSERT ... ON CONFLICT DO NOTHING` on `id`, the only unique key). An
 * existing row is never read, updated or deleted (DEC-68), whatever its content. Returns
 * how many rows were created. Throws, writing nothing, on a rejected entry or a repeated id.
 */
export async function sembrarCatalogoInicial(
  plantillas: DelegadoSiembra,
  catalogo: readonly EntradaCatalogo[] = CATALOGO_INICIAL,
): Promise<number> {
  const vistos = new Set<string>();
  for (const entrada of catalogo) {
    if (vistos.has(entrada.id)) throw new Error(`catálogo inicial: id duplicado ${entrada.id}`);
    vistos.add(entrada.id);
    const rechazo = rechazoDeEntrada(entrada);
    if (rechazo !== null) {
      throw new Error(`catálogo inicial: ${entrada.id} rechazada: ${JSON.stringify(rechazo)}`);
    }
  }
  const data = catalogo.map((entrada) => ({ id: entrada.id, ...datosDePlantilla(entrada) }));
  const { count } = await plantillas.createMany({ data, skipDuplicates: true });
  return count;
}
