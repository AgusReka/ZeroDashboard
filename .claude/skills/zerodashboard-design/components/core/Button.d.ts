/**
 * Botón de acción. Una sola acción primaria por vista.
 * @startingPoint section="Componentes" subtitle="Botones primario, secundario, ghost y peligro" viewport="700x260"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** sm = 28px, md = altura de control de la superficie (34px consola / 44px panel), lg = 44px. */
  size?: 'sm' | 'md' | 'lg';
  /** Nombre de ícono Lucide a la izquierda. */
  icon?: string;
  iconRight?: string;
  /** Solo ícono: requiere label (se usa como aria-label y title). */
  iconOnly?: boolean;
  label?: string;
  block?: boolean;
  /** Muestra spinner y deshabilita. */
  loading?: boolean;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
