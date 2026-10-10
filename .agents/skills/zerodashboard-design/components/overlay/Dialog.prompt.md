Confirmación modal para acciones destructivas o irreversibles; el botón nombra la acción y el objeto.

```jsx
<Dialog title="Revocar el token de PC administración" onClose={cancelar}
  actions={<><Button onClick={cancelar}>Cancelar</Button><Button variant="danger" icon="key-round">Revocar token</Button></>}>
  El agente deja de conectarse de inmediato.
</Dialog>
```
