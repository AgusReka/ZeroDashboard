/** Indicador de conectividad del agente (C2 · CH-19d1/CH-19d2 · PENDIENTE). Punto + texto + último latido; el texto lleva el significado. */
export interface ConnectivityIndicatorProps {
  estado: 'conectado' | 'desconectado' | 'sin_datos';
  /** Texto relativo: "hace 12 s", "hace 3 h". */
  ultimoLatido?: string;
  label?: string;
  /** Sobre la barra de tenant (texto blanco). */
  onDark?: boolean;
}
export declare function ConnectivityIndicator(props: ConnectivityIndicatorProps): JSX.Element;
