/**
 * Campo de formulario con etiqueta asociada, ayuda y error (aria-describedby / aria-invalid). Cubre input, select y textarea; mono para SQL o identificadores (solo consola).
 * @startingPoint section="Componentes" subtitle="Campos con etiqueta, ayuda, error y sufijo" viewport="700x340"
 */
export interface FieldProps {
  label: React.ReactNode;
  id?: string;
  as?: 'input' | 'select' | 'textarea';
  help?: React.ReactNode;
  /** Mensaje de error; marca aria-invalid y se anuncia junto a la ayuda. */
  error?: React.ReactNode;
  optional?: boolean;
  /** Unidad pegada al input: "unidades", "hs", "filas". */
  suffix?: React.ReactNode;
  /** Monoespaciada sobre fondo de código. Solo en CONSOLA. */
  mono?: boolean;
  /** Opciones <option> cuando as="select". */
  children?: React.ReactNode;
  value?: any; defaultValue?: any; onChange?: (e: any) => void; type?: string; placeholder?: string; rows?: number; disabled?: boolean; required?: boolean; min?: number; max?: number;
  className?: string;
}
export declare function Field(props: FieldProps): JSX.Element;
