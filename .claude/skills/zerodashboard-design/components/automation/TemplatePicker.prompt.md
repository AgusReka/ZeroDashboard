Grilla de tarjetas-radio para elegir una plantilla del catálogo (stock físico, stock producible, reporte diario).

```jsx
<TemplatePicker value={sel} onChange={setSel} options={[
  { id:'stock_fisico', nombre:'Alerta de stock físico', descripcion:'Avisa cuando un producto baja del mínimo.', icon:'package' },
  { id:'stock_producible', nombre:'Alerta de stock producible', descripcion:'Avisa cuando los insumos no alcanzan.', icon:'boxes' },
  { id:'reporte_diario', nombre:'Reporte diario', descripcion:'Resumen del día por correo.', icon:'file-text' }]} />
```
