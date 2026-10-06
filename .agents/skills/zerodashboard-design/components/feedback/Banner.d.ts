/**
 * Banner / alerta. error y warn usan role="alert" automáticamente. Para fallas en el panel (P3h), errores de consulta (CH-04), duplicado evitado (CH-18), frescura (CH-26).
 */
export interface BannerProps {
  tone?: 'info' | 'ok' | 'warn' | 'error' | 'neutral';
  title?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: string;
  /** Versión compacta dentro de tarjetas/formularios. */
  inline?: boolean;
  onDismiss?: () => void;
  role?: 'alert' | 'status';
}
export declare function Banner(props: BannerProps): JSX.Element;
