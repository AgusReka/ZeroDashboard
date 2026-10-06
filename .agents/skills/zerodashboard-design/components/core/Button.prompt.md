Botón para acciones; primary para la acción principal de la vista (una sola), secondary para el resto, ghost en barras/tablas, danger solo para acciones destructivas (revocar token).

```jsx
<Button variant="primary" icon="play">Ejecutar consulta</Button>
<Button variant="secondary" icon="save">Guardar</Button>
<Button variant="danger" icon="key-round">Revocar token</Button>
<Button iconOnly icon="refresh-cw" label="Actualizar" variant="ghost" />
```

Verbos en infinitivo, sentence case. HTML plano: `<button class="zd-btn zd-btn--primary">…</button>`.
