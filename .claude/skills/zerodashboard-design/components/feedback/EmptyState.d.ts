/** Estado vacío: qué falta y cuál es el próximo paso. */
export interface EmptyStateProps {
  icon?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
