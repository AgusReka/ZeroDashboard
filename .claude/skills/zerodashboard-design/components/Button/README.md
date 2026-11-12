Botón para acciones; primary para la acción principal de la vista (una sola), secondary para el resto, ghost en barras/tablas, danger solo para acciones destructivas (revocar token).

```jsx
<Button variant="primary" icon="play">Ejecutar consulta</Button>
<Button variant="secondary" icon="save">Guardar</Button>
<Button variant="danger" icon="key-round">Revocar token</Button>
<Button iconOnly icon="refresh-cw" label="Actualizar" variant="ghost" />
```

Verbos en infinitivo, sentence case. HTML plano: `<button class="zd-btn zd-btn--primary">…</button>`.

**En tablas** (`admin.md` T4): hasta 2 acciones `ghost` por fila; la destructiva va última, separada y en `danger`, nunca con el mismo aspecto que una inocua. **Deshabilitado**: siempre con el motivo visible al lado ("Guardar se habilita con una prueba exitosa"). **Cargando**: verbo en gerundio ("Probando…"), sin cambiar el ancho. **Solo ícono**: solo para acciones universales (cerrar, copiar, actualizar), con `label`. Ejecutar siempre con texto y atajo ("Ctrl + Enter").
