/**
 * Encabezado de pantalla de la consola: ruta, alcance (global / tenant activo), change, título, descripción y acción primaria a la derecha.
 * @startingPoint section="Consola" subtitle="Encabezado de pantalla con alcance y acciones" viewport="700x200"
 */
export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  scope?: 'global' | 'tenant';
  tenantName?: string;
  /** Migas: nodos con enlaces, p. ej. "Automatizaciones › au_11". */
  crumbs?: React.ReactNode;
  /** "CH-04 · CH-05" — trazabilidad de diseño. */
  change?: string;
  estado?: string;
  /** Una sola acción primaria + secundarias. */
  actions?: React.ReactNode;
}
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
