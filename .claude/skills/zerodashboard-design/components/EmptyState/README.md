Estado vacío centrado con ícono, título, explicación y una acción; usalo cuando una lista/tabla no tiene elementos.

```jsx
<EmptyState icon="calendar-clock" title="Todavía no hay ejecuciones" actions={<Button variant="primary">Crear automatización</Button>}>
  Las ejecuciones aparecen acá cuando una automatización corre por primera vez.
</EmptyState>
```

Variantes de consola (`admin.md` W7, E6): **sin ejecutar** (en el área de resultado: "Ejecutá la consulta para ver el resultado acá (Ctrl + Enter)") · **bloqueado por prerrequisito** (ícono `lock`, "Primero {paso}", por qué, «Ir a {vista}») · **filtrado sin resultados** («Limpiar filtros»).
