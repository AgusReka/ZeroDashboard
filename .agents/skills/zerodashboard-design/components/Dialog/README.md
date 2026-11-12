Confirmación modal para acciones destructivas o irreversibles; el botón nombra la acción y el objeto.

```jsx
<Dialog title="Revocar el token de PC administración" onClose={cancelar}
  actions={<><Button onClick={cancelar}>Cancelar</Button><Button variant="danger" icon="key-round">Revocar token</Button></>}>
  El agente deja de conectarse de inmediato.
</Dialog>
```

**Niveles de confirmación** (`guidelines/admin.md` §8): C1 reversible con impacto (botón primario) · C2 irreversible ("No se puede deshacer.", consecuencias, botón danger, foco inicial en «Cancelar») · C3 irreversible y amplio (C2 + escribir el nombre). Título "¿{Acción} {objeto}?"; «Cancelar» a la izquierda, acción a la derecha. Usalo solo para confirmar o para 1 a 3 campos: el trabajo largo va en página (P5). El foco queda dentro y vuelve al control que lo abrió; Esc cierra. Si hay que mostrar el resultado de una acción mientras está abierto, va dentro del diálogo, nunca detrás del velo.
