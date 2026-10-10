Panel lateral para detalle o edición sin perder el contexto de la pantalla; versiones (CH-25), detalle de ejecución, conexión.

```jsx
<Drawer eyebrow="CH-25" title="Versiones" onClose={cerrar}>…</Drawer>
<Drawer wide title="Versión 2 y versión vigente" footer={<Button variant="primary">Restaurar versión 2</Button>}>…</Drawer>
```

HTML plano: `aside.zd-drawer` > `.zd-drawer__head`, `.zd-drawer__body`, `.zd-drawer__foot`.
