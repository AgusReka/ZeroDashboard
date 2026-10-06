/**
 * Tabla paginada con encabezado fijo, columnas numéricas alineadas a la derecha (tabular-nums) y paginador accesible. Resultados de consulta (CH-04), ejecuciones (CH-13), último resultado (CH-27).
 * @startingPoint section="Componentes" subtitle="Tabla paginada con estados por fila" viewport="700x320"
 */
export interface DataTableColumn {
  key: string;
  label: React.ReactNode;
  /** num = derecha + mono tabular; mono = monoespaciada (ids, SQL). */
  align?: 'num' | 'mono';
  width?: number | string;
  render?: (value: any, row: any) => React.ReactNode;
}
export interface DataTableProps {
  columns: DataTableColumn[];
  rows: Record<string, any>[];
  /** Descripción para lectores de pantalla. */
  caption?: string;
  page?: number;
  pageSize?: number;
  /** Total de filas (si se pagina del lado del servidor). */
  total?: number;
  onPageChange?: (page: number) => void;
  compact?: boolean;
  /** Texto para valores null (consola: "NULL"; panel: "—"). */
  nullLabel?: string;
  emptyMessage?: React.ReactNode;
  rowKey?: string;
  onRowClick?: (row: any, index: number) => void;
  selectedKey?: any;
  /** Nota en el pie, p. ej. "Tope de 1.000 filas alcanzado". */
  footerNote?: React.ReactNode;
  maxHeight?: number | string;
}
export declare function DataTable(props: DataTableProps): JSX.Element;
