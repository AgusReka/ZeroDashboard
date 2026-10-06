Badge de estado de ejecución/automatización con ícono + texto; usalo en tablas de ejecuciones, tarjetas de automatización y conectividad.

```jsx
<StatusBadge estado="exitosa" />
<StatusBadge estado="reintentando" attempt="2/3" />
<StatusBadge estado="omitida" />
<StatusBadge estado="con_falla" label="No se pudo enviar" />
```

Estados de ejecución: exitosa · fallida · en_curso · reintentando · omitida (por solapamiento, X4) · interrumpida (X5) · duplicado_evitado (X6, CH-18) · sin_datos.
