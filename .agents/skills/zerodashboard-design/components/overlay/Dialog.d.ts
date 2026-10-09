/** Diálogo modal de confirmación. El velo empieza debajo de la barra de tenant (sigue visible). Regla: el botón de confirmación repite acción + objeto («Revocar token», «Restaurar versión 2», «Dar de baja Panadería La Espiga»); nunca "Sí"/"Aceptar". */
export interface DialogProps {
  open?: boolean;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Cancelar + confirmación (primary o danger). */
  actions?: React.ReactNode;
  onClose?: () => void;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
