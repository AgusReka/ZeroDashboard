/**
 * Barra de tenant activo (T4 · CH-06 · EXISTE). Mitigación de seguridad: permanente (sticky, siempre arriba), color exclusivo --tenant que no se usa para nada más, nombre + id. Solo CONSOLA.
 * @startingPoint section="Consola" subtitle="Barra de tenant activo, permanente" viewport="700x150"
 */
export interface TenantBarProps {
  /** null = ningún tenant elegido (barra en modo advertencia). */
  tenant: { nombre: string; id?: string } | null;
  onChange?: () => void;
  /** Contenido extra a la derecha (p. ej. ConnectivityIndicator). */
  children?: React.ReactNode;
}
export declare function TenantBar(props: TenantBarProps): JSX.Element;
