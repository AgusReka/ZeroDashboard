/**
 * Selector de plantilla en radio-cards (D2/D3 · CH-21 · PENDIENTE). Paso 1 del alta en dos pasos. Navegable con flechas (radio nativo).
 * @startingPoint section="Consola" subtitle="Selector de plantilla del catálogo" viewport="700x240"
 */
export interface TemplateOption { id: string; nombre: string; descripcion: string; icon?: string; meta?: React.ReactNode; }
export interface TemplatePickerProps {
  options: TemplateOption[];
  value?: string;
  onChange?: (id: string) => void;
  name?: string;
  legend?: string;
}
export declare function TemplatePicker(props: TemplatePickerProps): JSX.Element;
