/** Etiqueta de alcance: dice si la pantalla es GLOBAL (borde punteado, globo) o DEL TENANT ACTIVO (borde sólido, edificio, nombre). Sin violeta: el violeta es exclusivo de la TenantBar. */
export interface ScopeTagProps {
  scope?: 'global' | 'tenant';
  /** Para scope="tenant"; vacío = "Sin tenant activo" (advertencia). */
  tenantName?: string;
}
export declare function ScopeTag(props: ScopeTagProps): JSX.Element;
