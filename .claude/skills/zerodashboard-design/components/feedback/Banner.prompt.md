Aviso contextual con ícono, título y cuerpo; error/warn llevan role="alert". Título = qué pasó; cuerpo = qué significa y qué hacer.

```jsx
<Banner tone="error" title="No pudimos revisar tu stock esta mañana" actions={<Button size="sm">Ver detalle</Button>}>
  Tu tienda no respondió a las 08:00. Volvemos a intentar a las 09:00; no tenés que hacer nada.
</Banner>
```
