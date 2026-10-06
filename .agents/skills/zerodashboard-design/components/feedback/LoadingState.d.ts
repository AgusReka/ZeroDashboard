/** Estado de carga: spinner con texto, o esqueleto de filas. Siempre con texto para lectores de pantalla. */
export interface LoadingStateProps {
  label?: string;
  variant?: 'spinner' | 'skeleton';
  rows?: number;
}
export declare function LoadingState(props: LoadingStateProps): JSX.Element;
