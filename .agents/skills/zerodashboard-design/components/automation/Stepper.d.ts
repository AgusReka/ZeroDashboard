/** Pasos del alta en dos pasos (D2 · CH-21 · PENDIENTE): 1 Elegir plantilla · 2 Completar parámetros. */
export interface StepperProps {
  steps: string[];
  /** Índice 0-based del paso actual. */
  current?: number;
  label?: string;
}
export declare function Stepper(props: StepperProps): JSX.Element;
