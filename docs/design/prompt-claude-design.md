# Prompt para Claude Design: skill de diseño de ZeroDashboard

Prompt para pegar en Claude Design y obtener una skill de diseño (sistema visual y especificación de pantallas) de las dos superficies: consola (P1) y panel (P2).

## Cómo usarlo
1. Pegar el bloque de la sección "Prompt" en Claude Design.
2. Si querés que respete lo existente, adjuntar un screenshot de `/consola`.
3. Revisar la skill generada contra el anti-alcance antes de usarla. Que no haya pantallas fuera de la matriz, y nada que le dé SQL al panel (regla 1 de `AGENTS.md`).
4. Cuando un change implemente una pantalla, actualizar su estado en la matriz de la skill.

## Estado de referencia
Estados tomados de `openspec/changes/archive` al 2026-10-03: archivados CH-01 a CH-15, CH-17a, CH-17b, CH-18 y CH-19a. CH-19b en curso. La columna "UI sin verificar" indica que hay API pero no se comprobó que exista pantalla.

## Decisión pendiente relacionada
Cómo se sirven los archivos de la interfaz (hoy, un string de TypeScript en `src/consola.ts`; alternativa, archivos estáticos aparte) es una decisión de arquitectura. Se registra en `docs/01-decisiones.md` antes de implementar CH-22. Este prompt no la toma.

## Prompt

````text
Necesito que crees una SKILL de diseño (sistema visual y especificación de pantallas) para ZeroDashboard, una plataforma multi-tenant de automatización de reportes y alertas para e-commerce PYME. Después, otro agente de código va a implementar las pantallas leyendo la skill, así que tiene que ser precisa y accionable, no inspiracional.

## Qué es el producto
ZeroDashboard se conecta en solo lectura a la base de datos de un negocio (tienda online), ejecuta automatizaciones programadas con un único patrón fijo (consulta → condición → notificación → registro) y envía el resultado por correo. Ejemplos del catálogo inicial: alerta de stock físico, alerta de stock producible, reporte diario. Se vende como servicio a PYMEs. Tono de marca: confiable, sobrio, claro, "herramienta seria para gente que no es técnica". Idioma de la interfaz: español rioplatense neutro.

## Dos superficies con permisos distintos
1. CONSOLA (persona P1, "Implementador"): herramienta interna del proveedor, ve TODOS los tenants. Usuario técnico.
2. PANEL (persona P2, "Administrador PYME"): el cliente. Ve únicamente su tenant. NO técnico: nunca ve SQL ni términos de base de datos.

Las dos deben compartir el mismo sistema visual (tokens y componentes) pero verse como superficies distintas. La consola es densa y utilitaria; el panel es más amable, con más aire y lenguaje de negocio.

## Pantallas, con su change y su estado

Leyenda de estado:
- EXISTE: ya implementada. Rediseñala y mantené sus ids y su comportamiento.
- PARCIAL: hay API o una versión básica. Diseñá la pantalla completa.
- PENDIENTE: diseño anticipado. Implementa el change indicado.

### CONSOLA (P1)
| Pantalla | Historia | Change | Estado |
|---|---|---|---|
| Barra de tenant activo, permanente e inequívoca. Es una mitigación de seguridad: el error humano más probable es operar contra el tenant equivocado | T4 | CH-06 | EXISTE |
| Editor de consultas de solo lectura, con tabla paginada y errores legibles (rechazo de sentencias que no son de lectura, timeout, tope de filas) | B1 | CH-04 | EXISTE |
| Parámetros de consulta declarados | B3 | CH-11 | EXISTE |
| Consultas guardadas (nombre, descripción, listar, cargar) | B2 | CH-05 | EXISTE |
| Historial de versiones de una consulta guardada | B4 | CH-25 | PENDIENTE |
| Alta y prueba de conexión, con resultado visible | A1 | CH-03 | PARCIAL (API sí, UI sin verificar) |
| Contrato canónico: entidades, campos y dependencias | M1 | CH-08 | PARCIAL (API sí, UI sin verificar) |
| Mapeo de esquema por tenant | M2 | CH-09 | PARCIAL (API sí, UI sin verificar) |
| Validación de mapeo e inaplicables con motivo | M3, M4 | CH-10 | PARCIAL (API sí, UI sin verificar) |
| Automatizaciones: listado y alta | D1 | CH-12 y CH-13 | EXISTE |
| Alta en dos pasos (elegir plantilla, completar parámetros) | D2 | CH-21 | PENDIENTE |
| Catálogo inicial de plantillas (stock físico, stock producible, reporte diario) | D3 | CH-21 | PENDIENTE |
| Formato de correo asociado a la plantilla | N3 | CH-21 | PENDIENTE |
| Ejecuciones (inicio, fin, duración, filas, estado, error) | X2 | CH-13 | EXISTE |
| Estados de ejecución: omitida por solapamiento, interrumpida, reintentando | X4, X5, X7 | CH-17a y CH-17b | EXISTE |
| Aviso de notificación duplicada evitada | X6 | CH-18 | EXISTE |
| Tiempos de alta de un tenant | G1 | CH-15 | PARCIAL |
| Agentes: alta, listado y revocación de token | C1 | CH-19b | PENDIENTE (en curso) |
| Estado de conectividad (conectado, desconectado, último latido) | C2 | CH-19d1 y CH-19d2 | PENDIENTE |
| Automatizaciones en riesgo por tenant inalcanzable | C2 | CH-19d2 | PENDIENTE |
| Auditoría de consultas ejecutadas (solo lectura) | A5 | CH-20 | PENDIENTE |
| Frescura: ventana de desactualización por tenant y tolerancia por plantilla | F1, F2 | CH-24 | PENDIENTE |

### PANEL (P2): toda la superficie es nueva
| Pantalla | Historia | Change | Estado |
|---|---|---|---|
| Ingreso (el tenant se deduce de la sesión, nunca se elige) | T3 | CH-22 | PENDIENTE |
| Mis automatizaciones: activas y disponibles, con estado, última y próxima ejecución | P1h | CH-22 | PENDIENTE |
| Aviso de falla en lenguaje de negocio | P3h | CH-22 | PENDIENTE |
| Ajuste de umbrales y horarios (rige desde la próxima ejecución). Sin campos de SQL | P2h | CH-23 | PENDIENTE |
| Advertencia al activar algo que la frescura no sostiene (decide el cliente, informado) | F3 | CH-26 | PENDIENTE |
| Último resultado como tabla o gráfico | P4h | CH-27 | FUERA DE ALCANCE (DEC-93: no se persisten las filas) |

### CORREO
Reporte HTML con versión "sin datos" (degradación elegante: mensaje claro, sin campos rotos), compatible con clientes de correo: tablas y estilos inline. Historias N1 y N2, CH-14, EXISTE: rediseñalo manteniendo su contenido.

## Reglas para marcar el diseño
- Cada pantalla y cada componente de la skill debe llevar en su especificación su historia, su change y su estado.
- En el HTML de referencia agregá `data-change="CH-22"` y `data-estado="pendiente"` al contenedor de cada pantalla, para poder buscarlas.
- Para cada pantalla PENDIENTE o PARCIAL, listá los datos que necesita mostrar (nombre, tipo, ejemplo). No definas endpoints ni rutas: los decide el change que la implementa.
- Los datos de ejemplo de los mockups van en un bloque aparte, claramente rotulado como DATOS DE MUESTRA, para que se reemplacen sin tocar el diseño.
- Al final, incluí una tabla resumen "change → pantallas que le corresponden", para que el agente que implemente un change sepa qué diseño leer.

## RESTRICCIONES DE ALCANCE (no negociables, no diseñes nada de esto)
- Nada de editor de SQL, constructor visual de consultas ni consola en el PANEL del cliente.
- Nada de editor visual de flujos, nodos, ramificaciones, bucles ni transformaciones encadenadas: el patrón es lineal y fijo.
- Nada de capa de IA, chat ni asistente.
- Nada de facturación, planes ni cobro.
- Nada de ejecución disparada por webhook: todo es programado.
- No agregues pantallas ni funciones fuera de las listadas. Si algo te parece faltar, anotalo en una sección "Sugerencias fuera de alcance" al final, sin diseñarlo.

## Restricciones técnicas (para que sea implementable)
- La interfaz actual es HTML + CSS + JavaScript plano servido por un servidor Fastify (Node.js + TypeScript). No hay framework ni paso de build. Diseñá para eso: HTML semántico, CSS con variables personalizadas (custom properties), JS plano. No uses React, Tailwind, ni librerías que requieran compilación. Si necesitás un ícono o gráfico, que sea SVG inline.
- Entregá el HTML de referencia de forma que pueda separarse en archivos (una hoja de estilos compartida, un HTML por pantalla), sin depender de que todo viva en un solo archivo.
- Una sola hoja de estilos compartida entre consola y panel, con tokens: colores (incluyendo semánticos: ok, advertencia, error, información, tenant-activo), tipografía (system-ui más una monoespaciada para SQL), espaciado, radios, sombras, bordes.
- Modo claro y oscuro con prefers-color-scheme.
- Accesibilidad: contraste AA, foco visible, etiquetas asociadas a los campos, role="alert" en los banners de error, el estado nunca se comunica solo por color.
- Responsive: el panel debe funcionar bien en móvil; la consola prioriza escritorio.

## Qué debe contener la skill
1. Principios de diseño y tono (qué hace distinta a la consola del panel).
2. Tokens (en un bloque CSS listo para copiar).
3. Biblioteca de componentes con HTML+CSS de referencia: barra de tenant, botones, campos y formularios, tabla paginada, badges de estado de ejecución, banners/alertas, tarjeta de automatización, selector de plantilla, pasos del alta en dos pasos, indicador de conectividad, estado vacío, estado de carga, estado de error.
4. Especificación de cada pantalla de las dos tablas: propósito, datos que muestra, estados (vacío, cargando, error, éxito), acciones, persona a la que pertenece, y su historia, change y estado.
5. Mockups navegables en HTML de las pantallas clave, con datos de ejemplo realistas de una tienda de alimentos (productos, stock, umbrales, ejecuciones con distintos estados).
6. Reglas de lenguaje: glosario de términos de negocio para el panel (por ejemplo: "automatización" en vez de "job", "conexión con tu tienda" en vez de "réplica") y de términos técnicos permitidos solo en la consola.
7. Una sección de qué NO hacer (anti-alcance y anti-patrones).
8. La tabla resumen "change → pantallas".
````
