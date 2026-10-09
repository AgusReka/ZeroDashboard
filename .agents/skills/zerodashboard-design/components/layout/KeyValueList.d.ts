/** Lista de definiciones clave-valor (dl/dt/dd). rows = dos columnas (paneles laterales), grid = resumen horizontal que se reacomoda, stack = etiqueta arriba. Valor vacío = "—". */
export interface KeyValueListProps {
  items: { label: React.ReactNode; value?: React.ReactNode; mono?: boolean }[];
  layout?: 'rows' | 'grid' | 'stack';
}
export declare function KeyValueList(props: KeyValueListProps): JSX.Element;
