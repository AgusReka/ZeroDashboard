Barra lateral de la consola que separa pantallas globales de las del tenant activo; usala en el esqueleto de toda pantalla de la consola, debajo de la TenantBar.

```jsx
<SideNav current="consultas" tenantName="Almacén Don Tito"
  global={[{ id:'tenants', label:'Tenants', icon:'building-2', meta:'API' }]}
  tenantGroups={[{ label:'Trabajo diario', items:[{ id:'consultas', label:'Consultas', icon:'database' }] }]} />
```

HTML plano: `nav.zd-sidenav` > `.zd-sidenav__group` (global) + `.zd-sidenav__scope` (tenant) > `a.zd-sidenav__item[aria-current="page"]`. Orden del tenant = recorrido de P1.
