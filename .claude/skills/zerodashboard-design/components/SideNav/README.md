Barra lateral de la consola que separa pantallas globales de las del tenant activo; usala en el esqueleto de toda pantalla de la consola, debajo de la TenantBar.

```jsx
<SideNav current="consultas" tenantName="Almacén Don Tito"
  global={[{ id:'tenants', label:'Tenants', icon:'building-2', meta:'API' }]}
  tenantGroups={[{ label:'Trabajo diario', items:[{ id:'consultas', label:'Consultas', icon:'database' }] }]} />
```

HTML plano: `nav.zd-sidenav` > `.zd-sidenav__group` (global) + `.zd-sidenav__scope` (tenant) > `a.zd-sidenav__item[aria-current="page"]`. Orden del tenant = recorrido de P1.
**Reglas** (`admin.md` N1–N6): cada bloque tiene título; el del tenant se titula con su nombre (id en mono) o "Ningún tenant". Orden de "Puesta en marcha" por dependencia: Agentes (opcional) → Conexiones → Mapeo y validación → Usuarios del panel → Tablero del cliente. Plantillas y Reportes siguen en Global con meta "Se prueba con el tenant activo". "Tiempos de alta" va al pie, bajo "Investigación". Los ítems nunca se ocultan ni se deshabilitan por prerrequisitos: la pantalla lo explica. Marca de avance opcional (ícono + texto) solo con datos que ya existen. Estado activo con `aria-current="page"` (atributo, no clase: guarda G3').
