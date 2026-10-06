/**
 * Tarjeta de automatización del PANEL (P1h · CH-22 · PENDIENTE): nombre de negocio, estado, última y próxima ejecución, acciones. Variante "disponible" para plantillas aún no activadas.
 * @startingPoint section="Panel" subtitle="Tarjeta de automatización activa / disponible" viewport="700x380"
 */
export interface AutomationCardProps {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  estado?: 'activa' | 'pausada' | 'con_falla' | 'en_riesgo' | 'desactualizada' | string;
  estadoLabel?: string;
  /** "Hoy 08:00 · Enviado" — nodo libre, puede incluir un StatusBadge. */
  ultima?: React.ReactNode;
  proxima?: React.ReactNode;
  frecuencia?: React.ReactNode;
  /** Acciones (Buttons). */
  children?: React.ReactNode;
  /** Slot para un Banner inline (falla en lenguaje de negocio, P3h). */
  alert?: React.ReactNode;
  disponible?: boolean;
}
export declare function AutomationCard(props: AutomationCardProps): JSX.Element;
