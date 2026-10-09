/** Pestañas para dividir UNA pantalla en vistas hermanas del mismo objeto (Conexiones | Agentes). No usar para navegación entre pantallas. Flechas izquierda/derecha cambian de pestaña. */
export interface TabsProps {
  tabs: { id: string; label: string; icon?: string; count?: number }[];
  value: string;
  onChange?: (id: string) => void;
  label?: string;
}
export declare function Tabs(props: TabsProps): JSX.Element;
