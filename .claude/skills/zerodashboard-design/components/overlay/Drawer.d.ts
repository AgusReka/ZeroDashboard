/** Panel lateral derecho (420 px; wide = 900 px para comparar texto). Empieza debajo de la barra de tenant: nunca la tapa. Para versiones de una consulta, detalle de ejecución, detalle/alta de conexión. Esc cierra. */
export interface DrawerProps {
  open?: boolean;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  wide?: boolean;
}
export declare function Drawer(props: DrawerProps): JSX.Element | null;
