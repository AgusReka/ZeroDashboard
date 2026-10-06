Tabla paginada para resultados y listados; usala en la consola (densa, `compact`). En el panel no se usa para resultados: DEC-93 no persiste las filas.

```jsx
<DataTable caption="Ejecuciones" columns={[{key:'inicio',label:'Inicio',align:'mono'},{key:'filas',label:'Filas',align:'num'},{key:'estado',label:'Estado',render:v=><StatusBadge estado={v}/>}]}
  rows={rows} page={page} pageSize={25} total={312} onPageChange={setPage} />
```

Números con separador es-AR (1.240). En el panel pasá `nullLabel="—"`.
