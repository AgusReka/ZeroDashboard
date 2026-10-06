/** Estado de error de bloque completo (role="alert"). detail técnico solo en CONSOLA. */
export interface ErrorStateProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Detalle técnico en monoespaciada (código de error, mensaje del motor). Nunca en el panel. */
  detail?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: string;
}
export declare function ErrorState(props: ErrorStateProps): JSX.Element;
