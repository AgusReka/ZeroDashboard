Aviso contextual con ícono, título y cuerpo; error/warn llevan role="alert". Título = qué pasó; cuerpo = qué significa y qué hacer.

```jsx
<Banner tone="error" title="No pudimos revisar tu stock esta mañana" actions={<Button size="sm">Ver detalle</Button>}>
  Tu tienda no respondió a las 08:00. Volvemos a intentar a las 09:00; no tenés que hacer nada.
</Banner>
```

**Único sistema de avisos de la consola** (`admin.md` E1): reemplaza al `.banner` propio. Ubicación: resultado de una acción → pegado al control; estado de la pantalla → bajo el `PageHeader`; estado global → barra de tenant. Con un diálogo abierto, el banner va dentro del diálogo. Variante "una sola vez" (token, clave): valor en mono + «Copiar» + "No se vuelve a mostrar", igual en todas las vistas.
