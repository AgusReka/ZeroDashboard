/**
 * Badge de estado de ejecución o de automatización. Siempre ícono + texto: el estado nunca depende solo del color.
 * Ejecución (CH-13, CH-17a, CH-17b, CH-18): exitosa, fallida, en_curso, reintentando, omitida, interrumpida, duplicado_evitado, sin_datos.
 * Automatización / frescura: activa, pausada, con_falla, disponible, en_riesgo, desactualizada, borrador.
 */
export interface StatusBadgeProps {
  estado: 'exitosa' | 'fallida' | 'en_curso' | 'reintentando' | 'omitida' | 'interrumpida' | 'duplicado_evitado' | 'sin_datos' | 'activa' | 'pausada' | 'con_falla' | 'disponible' | 'en_riesgo' | 'desactualizada' | 'borrador' | string;
  /** Sobrescribe el tono del mapa. */
  tone?: 'ok' | 'warn' | 'error' | 'info' | 'neutral' | 'tenant';
  icon?: string;
  /** Sobrescribe el texto. En el PANEL usá textos de negocio. */
  label?: string;
  square?: boolean;
  /** Para reintentando: "2/3". */
  attempt?: string;
}
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;
