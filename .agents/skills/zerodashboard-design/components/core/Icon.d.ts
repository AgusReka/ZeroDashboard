/** Ícono Lucide (lucide-static@0.460.0) renderizado como SVG inline (copiado en components/core/iconData.js y assets/icons/); hereda currentColor. Adición intencional: envoltorio del set de íconos. */
export interface IconProps {
  /** Nombre kebab-case de Lucide, p. ej. "circle-check", "database", "refresh-cw". */
  name: string;
  /** Tamaño CSS (por defecto 1.15em). */
  size?: number | string;
  /** Si se pasa, el ícono es significativo (role="img"); si no, es decorativo (aria-hidden). */
  label?: string;
  /** Rotación continua (estados "en curso"). */
  spin?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
