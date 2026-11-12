Tabla paginada para resultados y listados; usala en consola (densa, `compact`) y en el panel (último resultado, sin SQL).

```jsx
<DataTable caption="Ejecuciones" columns={[{key:'inicio',label:'Inicio',align:'mono'},{key:'filas',label:'Filas',align:'num'},{key:'estado',label:'Estado',render:v=><StatusBadge estado={v}/>}]}
  rows={rows} page={page} pageSize={25} total={312} onPageChange={setPage} />
```

Números con separador es-AR (1.240). En el panel pasá `nullLabel="—"`.

**Consola** (`admin.md` T1–T8): toolbar arriba (búsqueda si hay más de ~10 filas, filtros, contador); identidad primero (nombre + id mono), estado, datos, fechas, acciones al final; hasta ~7 columnas visibles y el resto al `Drawer` de detalle; filtrado sin resultados distinto de vacío; zona horaria rotulada una vez.
