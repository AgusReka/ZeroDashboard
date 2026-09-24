/**
 * The canonical contract: the minimum set of entities and fields a candidate
 * e-commerce platform must expose for the three generic automations to run without
 * being rewritten per client (`docs/00-contexto.md` §1).
 *
 * It lives here, as a static module, and **not** as a Prisma model (DEC-21). The
 * contract is identical for every tenant, so it is not tenant data: there is no
 * migration, no row, and no entry in `MODELOS_AISLADOS`. `src/contrato-rutas.ts`
 * projects this constant verbatim over `GET /contrato`, which is what keeps the
 * endpoint from ever drifting away from the definition.
 *
 * Two independent optionality dimensions live here, and neither propagates into the
 * other. `EntidadCanonica.obligatoriedad` says whether the *entity itself* has to be
 * present — that is the signal CH-10/M4 reads to report `stock-producible`
 * inapplicable for a platform that models no insumos. `CampoCanonico.obligatoriedad`
 * is read only once the entity is known to be present. An optional entity therefore
 * still carries required fields (`insumo.nombre`), and a required entity still carries
 * optional ones (`producto.sku`).
 *
 * **No personal field and no buyer entity appears below, by construction** (DEC-23).
 * None of the three automations needs a buyer identity, so there is no `cliente`
 * entity to hang a domicilio, a teléfono or a correo off. This is a structural
 * absence, not a filter applied at read time, and `src/contrato.test.ts` sweeps every
 * name in the catalog to keep it that way.
 *
 * Naming, stated once and permanently because CH-09's mapeo will key off these exact
 * strings: field identifiers are Spanish camelCase (`stockDisponible`), cross-entity
 * references are `<entidad>Id` (`pedidoId`), and entity identifiers are Spanish
 * lowercase snake_case (`item_pedido`). The asymmetry is deliberate — entity names
 * denote a tenant replica's *tables*, field names are read back as TS/JSON identifiers.
 */

/**
 * The automations each field traces to. An object rather than inline string literals
 * (DEC-22): the labels are free text until CH-12's real `Plantilla` rows exist, so
 * deriving the type from this one object is what turns a typo into a compile error and
 * makes CH-12's reconciliation a single-object edit instead of a repository-wide grep.
 */
export const AUTOMATIZACIONES = {
  STOCK_FISICO: 'stock-fisico',
  STOCK_PRODUCIBLE: 'stock-producible',
  REPORTE_DIARIO: 'reporte-diario',
} as const;

export type Automatizacion = (typeof AUTOMATIZACIONES)[keyof typeof AUTOMATIZACIONES];

export type Obligatoriedad = 'obligatorio' | 'opcional';

export interface CampoCanonico {
  readonly nombre: string;
  /** Independent of the entity's own mark; read only once the entity is present. */
  readonly obligatoriedad: Obligatoriedad;
  /**
   * Never empty. A field that traces to no automation is not admitted into the
   * catalog at all — the non-empty tuple type is that rule, expressed to the compiler.
   */
  readonly automatizaciones: readonly [Automatizacion, ...Automatizacion[]];
}

export interface EntidadCanonica {
  readonly nombre: string;
  /** Presence of the entity itself, which is what M4 reports as inapplicable. */
  readonly obligatoriedad: Obligatoriedad;
  readonly campos: readonly CampoCanonico[];
}

/**
 * The catalog. Order is part of the projection: `GET /contrato` serves this array as
 * it stands, and a stable order is what lets CH-16's genericity test diff a second
 * platform's shape against it.
 */
export const CONTRATO_CANONICO: readonly EntidadCanonica[] = [
  {
    nombre: 'producto',
    obligatoriedad: 'obligatorio',
    campos: [
      {
        nombre: 'id',
        obligatoriedad: 'obligatorio',
        automatizaciones: [
          AUTOMATIZACIONES.STOCK_FISICO,
          AUTOMATIZACIONES.STOCK_PRODUCIBLE,
          AUTOMATIZACIONES.REPORTE_DIARIO,
        ],
      },
      {
        nombre: 'nombre',
        obligatoriedad: 'obligatorio',
        automatizaciones: [
          AUTOMATIZACIONES.STOCK_FISICO,
          AUTOMATIZACIONES.STOCK_PRODUCIBLE,
          AUTOMATIZACIONES.REPORTE_DIARIO,
        ],
      },
      {
        // The quantity `stock-fisico` reports and a column of the daily report.
        // `stock-producible` does not read it (DEC-36): it computes from
        // insumo.stockDisponible only.
        nombre: 'stockDisponible',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_FISICO, AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // Optional: an external identifier reconciles stock against a catalog kept
        // outside the platform, but neither automation stops without it.
        nombre: 'sku',
        obligatoriedad: 'opcional',
        automatizaciones: [AUTOMATIZACIONES.STOCK_FISICO, AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // Required (DEC-36): the stock-producible query filters on activo = true, so a
        // mapping that leaves it NULL returns zero rows with no error. Also lets
        // `stock-fisico` skip discontinued products instead of reporting them at zero.
        nombre: 'activo',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_FISICO, AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
    ],
  },
  {
    nombre: 'pedido',
    obligatoriedad: 'obligatorio',
    campos: [
      {
        nombre: 'id',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // What makes the report *daily*: without it there is no day to group by.
        nombre: 'fechaCreacion',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // Cancelled and pending orders cannot be counted as sales.
        nombre: 'estado',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        nombre: 'total',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // Optional: the human-facing order number. The report reads fine identifying
        // an order by `id`; the number only makes a line legible to an operator.
        nombre: 'numero',
        obligatoriedad: 'opcional',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // Optional: a single-currency platform needs no column for it.
        nombre: 'moneda',
        obligatoriedad: 'opcional',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
    ],
  },
  {
    nombre: 'item_pedido',
    obligatoriedad: 'obligatorio',
    campos: [
      {
        nombre: 'id',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        nombre: 'pedidoId',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        nombre: 'productoId',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // How many units moved: the per-product half of the daily report.
        nombre: 'cantidad',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
      {
        // Optional: `pedido.total` already carries the amount the report needs. A
        // per-line price only refines the breakdown.
        nombre: 'precioUnitario',
        obligatoriedad: 'opcional',
        automatizaciones: [AUTOMATIZACIONES.REPORTE_DIARIO],
      },
    ],
  },
  {
    // Optional entity: D-5 records that a candidate platform may model no insumos at
    // all, and that outcome is expected and reportable rather than a failure.
    nombre: 'insumo',
    obligatoriedad: 'opcional',
    campos: [
      {
        nombre: 'id',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
      {
        nombre: 'nombre',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
      {
        nombre: 'stockDisponible',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
      {
        // Optional (DEC-29): no current automation reads this field. The
        // stock-producible query divides insumo.stockDisponible by
        // cantidadPorUnidad directly, without checking unit compatibility.
        nombre: 'unidadMedida',
        obligatoriedad: 'opcional',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
      {
        // Optional: an internal code for the supply. `id` already identifies it.
        nombre: 'codigo',
        obligatoriedad: 'opcional',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
    ],
  },
  {
    // Optional entity, for the same reason as `insumo`: no recipes means
    // `stock-producible` is inapplicable, which M4 reports rather than treats as an error.
    nombre: 'receta_componente',
    obligatoriedad: 'opcional',
    campos: [
      {
        nombre: 'productoId',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
      {
        nombre: 'insumoId',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
      {
        // The whole arithmetic of `stock-producible`: how much of the insumo one unit
        // of the product consumes.
        nombre: 'cantidadPorUnidad',
        obligatoriedad: 'obligatorio',
        automatizaciones: [AUTOMATIZACIONES.STOCK_PRODUCIBLE],
      },
    ],
  },
] as const;
