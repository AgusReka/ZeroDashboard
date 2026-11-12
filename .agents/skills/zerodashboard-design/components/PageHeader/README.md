Encabezado único de cada pantalla de la consola con alcance, change y acción primaria; reemplaza los títulos sueltos de la página larga actual.

```jsx
<PageHeader scope="tenant" tenantName="Almacén Don Tito" title="Consultas" change="CH-04 · CH-05" estado="EXISTE"
  description="SQL de solo lectura sobre una conexión del tenant activo." actions={<Button variant="primary" icon="plus">Nueva consulta</Button>} />
```

`description` es obligatoria en la consola: qué se hace acá + para qué sirve en el flujo (`admin.md` P2, M1). El título no se repite en un h2. Plantillas y Reportes: `ScopeTag global` + "Prueba sobre: {tenant} · {conexión}" (N4). Subvistas con migas.
