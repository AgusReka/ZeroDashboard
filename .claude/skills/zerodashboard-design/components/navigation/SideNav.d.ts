/**
 * Navegación lateral de la CONSOLA (232 px, sticky bajo la barra de tenant). Separa lo GLOBAL (todos los tenants) de lo DEL TENANT ACTIVO, con subgrupos en el orden del recorrido de P1. Marcado: nav.zd-sidenav > a.zd-sidenav__item[aria-current="page"].
 * @startingPoint section="Consola" subtitle="Navegación lateral global / tenant activo" viewport="700x420"
 */
export interface SideNavItem {
  id: string;
  label: string;
  /** Nombre de ícono Lucide. */
  icon?: string;
  href?: string;
  /** Marca chica a la derecha: "API" (pantalla nueva sobre API existente) o "Pendiente". */
  meta?: string;
}
export interface SideNavProps {
  brand?: string;
  surfaceLabel?: string;
  /** Ítems globales (tenants, plantillas, contrato). */
  global?: SideNavItem[];
  /** Nombre del tenant activo; "Ninguno" si no hay. */
  tenantName?: string;
  /** Subgrupos del tenant activo, p. ej. "Puesta en marcha", "Trabajo diario". */
  tenantGroups?: { label: string; items: SideNavItem[] }[];
  current?: string;
  /** Si se pasa, intercepta el clic (navegación por estado). */
  onNavigate?: (id: string) => void;
  footer?: React.ReactNode;
}
export declare function SideNav(props: SideNavProps): JSX.Element;
