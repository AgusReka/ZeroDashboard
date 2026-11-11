import { ENTIDADES_CANONICAS } from '../../mapeo/vistas-canonicas.js';
import {
  datosDeReporte,
  rechazoDeReporte,
  registroReporteSchema,
  type RegistroReporteBody,
} from '../../reportes/reportes-rutas.js';
import {
  LARGO_MAXIMO_COLUMNA,
  MAXIMO_COLUMNAS_TABLA,
  ROLES,
  VISUALIZACIONES,
  type ColumnaAsignada,
} from '../../reportes/reportes.js';
import { crearSiFalta, type ClienteSemilla } from './comun.js';

/**
 * CH-49 (b2): the four reports every demo dashboard draws from. `Reporte` is global (DEC-183),
 * so they are seeded once, by fixed id, whatever tenant uses them: each one reads only the
 * canonical views, so the same text runs on Food Store's replica and on Café del Puerto's.
 * Each entry is ordinary report content that `POST /reportes` would also accept, and goes
 * through the same save-time checks (`rechazoDeEntradaReporte`) before anything is written.
 *
 * Every value is cast `::numeric`, so the chart reads a number whatever the source type is;
 * the line's label is `to_char(…::date, 'YYYY-MM-DD')`, a text the chart can sort and show.
 */

/** One report as the seed writes it: the route's body without `columnasPrueba`, plus the fixed id. */
export type EntradaReporte = Omit<RegistroReporteBody, 'columnasPrueba' | 'columnas'> & {
  readonly id: string;
  /** Required on save, so required here. */
  columnas: ColumnaAsignada[];
};

/** Fixed ids (`49d…`, see `IDS_DEMO`): the seed never reads a report by name. */
export const IDS_REPORTES_DEMO = {
  ventas: '49d00000-0000-4000-8000-000000000041',
  masVendido: '49d00000-0000-4000-8000-000000000042',
  ventasPorDia: '49d00000-0000-4000-8000-000000000043',
  stock: '49d00000-0000-4000-8000-000000000044',
} as const;

const PERIODO_CORTO = { parametro: 'desde', dias: [7, 30, 90] };

const ENTRADAS: EntradaReporte[] = [
  {
    id: IDS_REPORTES_DEMO.ventas,
    nombre: 'Ventas del período',
    titulo: 'Ventas',
    descripcion: 'Lo que vendiste en el período elegido, sin contar los pedidos cancelados.',
    sql: `SELECT SUM(p.total)::numeric AS ventas
FROM v_pedido p
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :desde`,
    entidades: ['pedido'],
    visualizacion: 'numero',
    columnas: [{ rol: 'valor', columna: 'ventas', titulo: 'Ventas' }],
    periodo: PERIODO_CORTO,
  },
  {
    id: IDS_REPORTES_DEMO.masVendido,
    nombre: 'Productos más vendidos',
    titulo: 'Lo más vendido',
    descripcion: 'Los productos que más salieron en el período elegido.',
    sql: `SELECT pr.nombre AS producto, SUM(i.cantidad)::numeric AS unidades
FROM v_item_pedido i
JOIN v_pedido p ON p.id = i."pedidoId"
JOIN v_producto pr ON pr.id = i."productoId"
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :desde
GROUP BY pr.id, pr.nombre
ORDER BY unidades DESC, pr.nombre ASC, pr.id ASC
LIMIT 8`,
    entidades: ['pedido', 'item_pedido', 'producto'],
    visualizacion: 'barras',
    columnas: [
      { rol: 'etiqueta', columna: 'producto', titulo: 'Producto' },
      { rol: 'valor', columna: 'unidades', titulo: 'Unidades' },
    ],
    periodo: PERIODO_CORTO,
  },
  {
    id: IDS_REPORTES_DEMO.ventasPorDia,
    nombre: 'Ventas por día',
    titulo: 'Ventas por día',
    descripcion: 'Cuánto vendiste cada día del período elegido.',
    sql: `SELECT to_char(p."fechaCreacion"::date, 'YYYY-MM-DD') AS dia, SUM(p.total)::numeric AS ventas
FROM v_pedido p
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :desde
GROUP BY dia
ORDER BY dia ASC`,
    entidades: ['pedido'],
    visualizacion: 'linea',
    columnas: [
      { rol: 'etiqueta', columna: 'dia', titulo: 'Día' },
      { rol: 'valor', columna: 'ventas', titulo: 'Ventas' },
    ],
    periodo: { parametro: 'desde', dias: [30, 60] },
  },
  {
    id: IDS_REPORTES_DEMO.stock,
    nombre: 'Stock de productos',
    titulo: 'Stock de tus productos',
    descripcion: 'Cuántas unidades te quedan de cada producto activo.',
    sql: `SELECT pr.nombre AS producto, pr."stockDisponible"::numeric AS stock
FROM v_producto pr
WHERE pr.activo = true
ORDER BY pr."stockDisponible" ASC, pr.nombre ASC, pr.id ASC`,
    entidades: ['producto'],
    visualizacion: 'tabla',
    columnas: [
      { rol: 'columna', columna: 'producto', titulo: 'Producto' },
      { rol: 'columna', columna: 'stock', titulo: 'Stock' },
    ],
    periodo: null,
  },
];

export const REPORTES_DEMO: readonly EntradaReporte[] = Object.freeze(ENTRADAS.map((entrada) => Object.freeze(entrada)));

/** The keys of `registroReporteSchema` an entry may carry: `columnasPrueba` is added by the check itself. */
const CLAVES_ADMITIDAS: readonly string[] = registroReporteSchema.propertyNames.enum.filter(
  (clave) => clave !== 'columnasPrueba',
);

type Detalle = { keyword: string; instancePath: string; params?: Record<string, string> };

/** The keys of `objeto` outside `admitidas`, then the `requeridas` it lacks, as AJV reports them. */
function detallesDeClaves(
  objeto: Record<string, unknown>,
  admitidas: readonly string[],
  requeridas: readonly string[],
  instancePath: string,
): Detalle[] {
  const claves = Object.keys(objeto);
  return [
    ...claves
      .filter((clave) => !admitidas.includes(clave))
      .map((clave) => ({ keyword: 'additionalProperties', instancePath, params: { additionalProperty: clave } })),
    ...requeridas
      .filter((clave) => !claves.includes(clave))
      .map((clave) => ({ keyword: 'required', instancePath, params: { missingProperty: clave } })),
  ];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * The save-time checks of `POST /reportes`, without HTTP. Fastify owns the route's AJV, so its
 * half is restated here at runtime against the same constants the schema enumerates (a type
 * cannot stop a spread from adding a key) and reported as AJV-shaped details.
 * `rechazoDeReporte` then builds the envelope exactly as the route does, with
 * `columnasPrueba` equal to the assigned column names (this seed is what "tested" the
 * columns) and the columns required. Returns the `400` envelope, or `null` when the entry
 * would be accepted.
 */
export function rechazoDeEntradaReporte(entrada: EntradaReporte): Record<string, unknown> | null {
  const { id: _id, ...e } = entrada as unknown as Record<string, unknown>;
  const detalles = detallesDeClaves(e, CLAVES_ADMITIDAS, registroReporteSchema.required, '');
  const exigir = (instancePath: string, ok: boolean, keyword = 'type'): void => {
    if (!ok) detalles.push({ keyword, instancePath });
  };
  if (detalles.length === 0) {
    const { entidades, columnas, periodo } = e;
    exigir('/nombre', typeof e.nombre === 'string');
    exigir('/titulo', typeof e.titulo === 'string');
    exigir('/descripcion', e.descripcion === undefined || typeof e.descripcion === 'string');
    exigir('/sql', typeof e.sql === 'string' && e.sql !== '');
    exigir('/entidades', Array.isArray(entidades) && entidades.length > 0 && new Set(entidades).size === entidades.length);
    if (Array.isArray(entidades)) {
      entidades.forEach((x, i) => exigir(`/entidades/${i}`, ENTIDADES_CANONICAS.includes(x as string), 'enum'));
    }
    exigir('/visualizacion', (VISUALIZACIONES as readonly string[]).includes(e.visualizacion as string), 'enum');
    exigir('/columnas', Array.isArray(columnas) && columnas.length <= MAXIMO_COLUMNAS_TABLA);
    if (Array.isArray(columnas)) {
      columnas.forEach((c, i) => {
        const ruta = `/columnas/${i}`;
        if (!esObjeto(c)) return exigir(ruta, false);
        detalles.push(...detallesDeClaves(c, ['rol', 'columna', 'titulo'], ['rol', 'columna', 'titulo'], ruta));
        exigir(`${ruta}/rol`, c.rol === undefined || (ROLES as readonly string[]).includes(c.rol as string), 'enum');
        exigir(
          `${ruta}/columna`,
          c.columna === undefined ||
            (typeof c.columna === 'string' && c.columna.length >= 1 && c.columna.length <= LARGO_MAXIMO_COLUMNA),
        );
        exigir(`${ruta}/titulo`, c.titulo === undefined || typeof c.titulo === 'string');
      });
    }
    if (periodo !== null) {
      if (!esObjeto(periodo)) {
        exigir('/periodo', false);
      } else {
        detalles.push(...detallesDeClaves(periodo, ['parametro', 'dias'], ['parametro', 'dias'], '/periodo'));
        exigir('/periodo/parametro', periodo.parametro === undefined || typeof periodo.parametro === 'string');
        exigir(
          '/periodo/dias',
          periodo.dias === undefined || (Array.isArray(periodo.dias) && periodo.dias.every(Number.isInteger)),
        );
      }
    }
  }
  const cuerpo = e as unknown as RegistroReporteBody;
  // The columns this seed "tested" are the ones it assigns, so the coverage check passes by construction.
  const columnasPrueba = Array.isArray(cuerpo.columnas)
    ? cuerpo.columnas.map((c) => (esObjeto(c) ? String(c.columna) : ''))
    : [];
  return rechazoDeReporte(detalles.length > 0 ? { validation: detalles } : undefined, { ...cuerpo, columnasPrueba }, {
    exigirColumnas: true,
  });
}

/**
 * Seeds the reports the demo is missing. Every entry is checked first: a rejected one throws
 * naming the report and writes nothing, not even the entries before it. A report that exists
 * is never read back, updated or deleted, whatever its content (DEC-68, DEC-125).
 */
export async function sembrarReportes(
  prisma: Pick<ClienteSemilla, 'reporte'>,
  creadas: string[],
  catalogo: readonly EntradaReporte[] = REPORTES_DEMO,
): Promise<void> {
  for (const entrada of catalogo) {
    const rechazo = rechazoDeEntradaReporte(entrada);
    if (rechazo !== null) {
      throw new Error(`demo report ${entrada.nombre} rejected: ${JSON.stringify(rechazo)}`);
    }
  }
  for (const entrada of catalogo) {
    await crearSiFalta(
      creadas,
      `reporte:${entrada.nombre}`,
      () => prisma.reporte.findUnique({ where: { id: entrada.id }, select: { id: true } }),
      () => prisma.reporte.create({ data: { id: entrada.id, ...datosDeReporte(entrada) } }),
    );
  }
}
