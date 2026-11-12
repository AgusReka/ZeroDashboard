Pestañas dentro de una pantalla para vistas hermanas del mismo tema; justificadas solo en "Conexiones y agentes" (dos maneras de llegar a la réplica).

```jsx
<Tabs value={tab} onChange={setTab} tabs={[{ id:'cx', label:'Conexiones', icon:'cable', count:2 }, { id:'ag', label:'Agentes', icon:'server', count:1 }]} />
```

HTML plano: `.zd-tabs[role=tablist] > .zd-tab[role=tab][aria-selected]` (pueden ser `<a>` con hash).
También se permiten para **dos vistas del mismo resultado** (Tabla | Gráfico en la vista previa de Reportes). No usar para partir un formulario: un error en una pestaña oculta no se ve (`admin.md` F1). Estado con `aria-selected` (guarda G3').
