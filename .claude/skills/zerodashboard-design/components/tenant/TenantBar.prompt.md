Banda violeta fija en la parte superior de toda pantalla de la consola, con el nombre e id del tenant sobre el que se opera; nunca se oculta ni se desplaza.

```jsx
<TenantBar tenant={{ nombre: 'Almacén Don Tito', id: 'ten_7f3a' }} onChange={abrirSelector}>
  <ConnectivityIndicator estado="conectado" ultimoLatido="hace 12 s" onDark />
</TenantBar>
```

Reglas: el color --tenant es exclusivo de esta barra; al cambiar de tenant, confirmar con el nombre completo. No existe en el PANEL (el tenant se deduce de la sesión).
