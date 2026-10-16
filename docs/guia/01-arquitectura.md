# Arquitectura y conceptos

ZeroDashboard permite ofrecer automatizaciones operativas a e-commerce pequeños sin modificar su plataforma de venta. El cliente expone una réplica de solo lectura de su base; la aplicación se conecta, mapea ese esquema a un contrato canónico y ejecuta sobre él un catálogo de automatizaciones. Esta guía fija los términos que usan las demás.

## Conceptos

| Concepto | Qué es | Dónde se ve en la consola |
|---|---|---|
| Tenant | Un negocio cliente. Conexiones, consultas guardadas, automatizaciones, usuarios del panel y agente cuelgan de un tenant. Darlo de baja lo congela por completo (DEC-14). | Tenants |
| Conexión | Cómo llega la aplicación a la réplica de un tenant: servidor, puerto, base, usuario y contraseña. La contraseña se guarda cifrada (DEC-16, DEC-17). Solo PostgreSQL (DEC-25). | Conexiones |
| Agente | Proceso que corre en la red del cliente y abre la conexión hacia la aplicación: el cliente no expone puertos (DEC-94). Hay uno por tenant (DEC-115). | Agentes |
| Contrato canónico | Entidades y campos mínimos que un tenant debe exponer: `producto`, `pedido`, `item_pedido`, `insumo` y `receta_componente`. Es igual para todos los tenants y no incluye campos personales (DEC-21, DEC-23). | Contrato canónico |
| Vista canónica | El `SELECT` que el operador escribe para una entidad del contrato sobre la réplica de una conexión (DEC-30, DEC-169). | Mapeo y validación |
| Plantilla | Entrada del catálogo global: un SQL escrito contra las vistas canónicas, los parámetros que declara y las entidades que necesita (DEC-61). | Plantillas |
| Consulta guardada | SQL propio de un tenant, con parámetros declarados y versiones. No se ata a una conexión (DEC-11). | Consultas |
| Automatización | Instancia de una plantilla en un tenant: plantilla, conexión, valores, horario cron y destinatario opcional. | Automatizaciones |
| Ejecución | Registro de una corrida programada: inicio, fin, filas, estado y resultado del correo. No guarda las filas (DEC-93). | Automatizaciones, «Ejecuciones» |
| Operador | Persona que usa la consola (P1). Es global: ve todos los tenants. | Barra superior |
| Usuario del panel | Administrador del negocio (P2). Ve un solo tenant y no escribe SQL. | Usuarios del panel |

## Cómo fluyen los datos

**Desde la consola.** El operador elige un tenant en la barra superior; cada solicitud lleva ese tenant en la cabecera `X-Tenant-Id` (DEC-15). La aplicación abre una conexión de corta vida hacia la réplica y devuelve el resultado.

```
Operador ─► consola (/consola) ─► aplicación ─┬─ directa ─────────────► réplica del cliente
                                              └─ agente (saliente) ───► (solo lectura)
```

**Desde el planificador.** Un planificador dentro de la aplicación revisa las automatizaciones cada minuto (DEC-75). El motor solo ejecuta el patrón consulta, condición, notificación y registro (regla 6).

```
planificador ─► motor ─► réplica ─► ¿hay filas? ─► correo (SMTP) ─► registro de la ejecución
                                        └─ no: no se envía correo
```

## Dos superficies

| | Consola | Panel del cliente |
|---|---|---|
| Ruta | `/consola` | `/panel` |
| Quién | Operador | Usuario del panel |
| Ingreso | Nombre y clave; sesión de 12 horas | Correo y contraseña; sesión de 30 días |
| Tenant | Elegido por el operador, en cada solicitud | Tomado de la sesión, nunca de la solicitud |
| Alcance | Todos los tenants, SQL de solo lectura | Su tenant, solo sus automatizaciones |

**Límite.** No hay roles dentro de cada superficie: todo operador puede lo mismo, y todo usuario del panel de un tenant también (DEC-04). El operador puede actuar sobre cualquier tenant cambiando la elección; la única protección contra el error humano es el indicador del tenant activo y las confirmaciones.

## Garantías que se mantienen

| Garantía | Cómo se cumple |
|---|---|
| El panel nunca ejecuta SQL arbitrario | El panel no tiene editor; solo ajusta umbral, hora, días y destinatario. |
| Aislamiento entre tenants | La extensión de acceso a datos agrega el tenant a cada consulta y falla si no hay tenant (DEC-13). Un `tenantId` en el cuerpo se rechaza. |
| Solo lectura en dos capas | Antes de enviar, la aplicación verifica que el rol no pueda escribir (DEC-08); luego ejecuta dentro de una transacción `READ ONLY` (DEC-09). No hay parser de SQL. |
| Sin concatenación de SQL | Los valores viajan como parámetros del driver (`:nombre` se reescribe a `$n`, DEC-47). |
| Minimización de datos | El contrato no tiene campos personales; las filas de un resultado no se guardan (DEC-93). |
| Secretos fuera del repositorio | La clave maestra (DEC-17), el SMTP y las claves de la demo salen del entorno. |

## Siguiente paso

[Alta de tenant y conexión](02-alta-de-tenant-y-conexion.md).
