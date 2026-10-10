# Prompt para Claude Design: rediseño de la consola del implementador (P1)

Prompt para pegar en Claude Design y obtener la arquitectura de información, la especificación de pantallas y un mockup de la **consola** (superficie del administrador/implementador). No cubre el panel del cliente (P2), que ya tiene su diseño.

## Cómo usarlo
1. Adjuntar la carpeta de la skill (`.claude/skills/zerodashboard-design/`) para que respete los tokens y los componentes `.zd-*`.
2. Adjuntar una captura de `/consola` completa (página entera, no solo lo visible): es el punto de partida real.
3. Pegar el bloque de la sección "Prompt".
4. Revisar lo que devuelva contra el anti-alcance de `AGENTS.md` y contra "Qué no hacer" de abajo. Si propone una pantalla que no esté en el inventario, es una decisión de producto: no se implementa sin registrarla en `docs/01-decisiones.md`.

## Estado de referencia (2026-10-09)
Archivados CH-01 a CH-24 y CH-25 implementado a la espera de verificación visual. El inventario de abajo sale de leer `src/consola.ts` y las rutas del servidor, no de la skill anterior.

## Prompt

````text
Necesito que rediseñes la CONSOLA de ZeroDashboard: la superficie del implementador/administrador (persona P1). No toques el panel del cliente. Un agente de código va a implementar lo que entregues, así que tiene que ser preciso y accionable, no inspiracional.

## El producto en dos líneas
Plataforma multi-tenant que se conecta en solo lectura a la base de datos de un negocio (e-commerce PYME), corre automatizaciones programadas con un patrón fijo (consulta -> condición -> notificación -> registro) y manda el resultado por correo. P1 es quien implementa el servicio para cada cliente: ve TODOS los tenants, es técnico, y trabaja con SQL, conexiones y ejecuciones.

## Por qué hay que rediseñarla (problemas reales de hoy)
La consola actual es UNA sola página larga, sin navegación. Se fue armando change por change y se nota:
1. No hay navegación ni jerarquía: el orden de arriba abajo es editor de consultas, consultas guardadas (con historial de versiones), automatizaciones (alta en dos pasos, lista, ejecuciones) y frescura de datos.
2. El RESULTADO de ejecutar una consulta aparece al final de la página, debajo de todo lo demás: quien ejecuta tiene que bajar hasta el fondo para ver lo que acaba de pedir.
3. Secciones de naturaleza distinta (explorar datos, configurar un tenant, operar automatizaciones) conviven en la misma pantalla sin separarse.
4. Tareas de administración que ya existen en la API NO tienen pantalla (ver inventario): el implementador las hace con herramientas externas.
5. La densidad y el espaciado no son consistentes entre secciones: cada una se agregó con su propio criterio.

## Lo que necesito de vos
A. Una ARQUITECTURA DE INFORMACIÓN para la consola: navegación principal (barra lateral de 232 px, como define la skill), agrupación de pantallas, y el recorrido natural de P1: alta de tenant -> conexión -> mapeo -> validación -> automatización -> verificar la primera ejecución. Mostrá qué es global y qué es del tenant activo.
B. La ESPECIFICACIÓN de cada pantalla en el formato de `guidelines/pantallas.md` (datos, estados, acciones, historia, change, estado).
C. Un MOCKUP HTML estático navegable (HTML + CSS + JS plano, sin build) del esqueleto de la consola y de tres pantallas: Consultas (editor + resultado + guardadas con versiones), Automatizaciones (lista, ejecuciones, alta en dos pasos) y Conexiones y agentes.
D. Los COMPONENTES nuevos que haga falta (navegación lateral, encabezado de página, panel lateral para versiones, lista de definiciones clave-valor, pestañas si las justificás), cada uno mapeado a clases `.zd-*` y con sus estados.
E. NOTAS DE ADOPCIÓN INCREMENTAL: la consola hoy se sirve como un string de TypeScript (`src/consola.ts`) y se implementa de a un change por vez. Decime qué pantallas pueden entrar solas sin romper las demás y en qué orden.

## Inventario de pantallas (estado real)

### Existe hoy en la interfaz (rediseñala; mantené el comportamiento)
- Barra de tenant activo, permanente, violeta, con selector. Es una mitigación de seguridad: el error humano más probable es operar contra el tenant equivocado. Estados: ningún tenant elegido (advertencia), tenant elegido.
- Editor de consultas de solo lectura: id de conexión, SQL, parámetros declarados (nombre, tipo, valor), filas por página, Ejecutar. Resultado: tabla paginada, línea de estado (filas, duración, "cortado en el tope"), errores legibles con SQLSTATE.
- Consultas guardadas: guardar la del editor (nombre, descripción), listar, Cargar al editor.
- Versiones de una consulta guardada (CH-25): al cargar una consulta se puede "Guardar como nueva versión" con una nota opcional; "Versiones" abre el historial (versión, fecha, nota, "Vigente" con ícono y texto); "Comparar con la actual" muestra dos bloques de texto lado a lado SIN diff; "Restaurar" pide confirmación con el botón «Restaurar versión N» y crea una versión nueva (nunca borra).
- Automatizaciones: lista (plantilla, conexión, cron, estado, alta, acciones), alta en DOS pasos (1: conexión y plantilla con tarjetas, algunas deshabilitadas con su motivo; 2: parámetros, frecuencia y hora con vista del cron resultante, destinatario y vista previa del correo), desactivar, ver ejecuciones.
- Ejecuciones de una automatización: inicio, fin, duración, filas, estado (ok, fallo, omitida por solapamiento, interrumpida, reintentando), notificación, error, intentos.
- Frescura de datos (CH-24): ventana de desactualización del tenant, última actualización de la réplica (relativa), "Marcar réplica actualizada ahora", y tabla de plantillas con su tolerancia y estado (Al día / Desactualizada / Sin declarar, con ícono y texto).

### Existe la API pero NO hay pantalla (diseñá la pantalla completa)
- Alta y listado de tenants, y baja lógica (hoy solo se puede ELEGIR uno del selector).
- Alta y prueba de conexión a la réplica, con resultado visible (credenciales cifradas: nunca se muestran de vuelta).
- Agentes (conexión saliente del cliente): alta con token que se muestra UNA vez, listado, revocación.
- Contrato canónico (entidades, campos, dependencias), mapeo de esquema por tenant y validación del mapeo con las entidades inaplicables y su motivo.
- Plantillas: ver el catálogo y su tolerancia de frescura.
- Tiempos de alta de un tenant (marcas de tiempo por etapa).

### Todavía no existe (diseño anticipado, marcalo como PENDIENTE)
- Estado de conectividad del tenant (conectado, desconectado, último latido) y automatizaciones en riesgo por tenant inalcanzable.
- Registro de auditoría de ejecuciones de consultas (qué se ejecutó, cuándo, contra qué tenant).

## Roles y tenants: cómo tratarlos en el diseño
- Hay DOS superficies con permisos distintos: la consola (P1, todos los tenants) y el panel (P2, un solo tenant). No se mezclan.
- La consola NO tiene autenticación ni usuarios hoy: el tenant activo es un selector del lado del navegador que se reenvía en cada pedido. No diseñes pantalla de ingreso ni de roles. Sí dejá RESERVADO en el encabezado un lugar para la identidad del operador, marcado como "no implementado", porque la auditoría futura necesita saber quién ejecutó.
- Toda pantalla que opera datos debe mostrar de forma inequívoca sobre qué tenant está operando, y comportarse bien cuando no hay tenant elegido o el elegido está dado de baja (la baja es lógica y congela todo).
- Distinguí visualmente lo GLOBAL (catálogo de plantillas, contrato canónico, lista de tenants) de lo DEL TENANT ACTIVO (conexiones, consultas guardadas, automatizaciones, ejecuciones, frescura).

## Restricciones técnicas (no negociables)
- HTML + CSS + JS plano servido por Fastify. Sin React, Tailwind ni dependencias con build en la implementación real. Una hoja compartida (`styles.css`) y las clases `.zd-*`; `data-surface="consola"` en `<body>`.
- Los `id` actuales del marcado son un contrato con el script y con los tests: podés MOVER elementos, no renombrar ids. Agregá `data-change` y `data-estado` al contenedor de cada pantalla.
- Todo valor que viene de datos se escribe como texto, nunca como marcado. Ningún estado se comunica solo con color: siempre ícono + texto. Sin emoji.
- El violeta del tenant es EXCLUSIVO de la barra de tenant.
- Español rioplatense con voseo, sentence case, sin exclamaciones. En la consola se permiten términos técnicos (tenant, consulta, SQL, réplica, agente, token, latido, timeout, SQLSTATE); está en `guidelines/lenguaje.md`.
- Escritorio primero (la consola es una herramienta de trabajo); que no se rompa a 1024 px. Modo claro y oscuro por tokens. Foco visible en todo elemento interactivo.
- Confirmaciones destructivas o irreversibles: el botón repite la acción y el objeto («Revocar token», «Dar de baja Panadería La Espiga»); nunca "Sí" ni "Aceptar".

## Qué NO hacer
- Nada de editor visual de flujos, nodos, ramificaciones ni bucles. Nada de IA, chat ni asistente. Nada de facturación ni planes. Nada de ejecución por webhook.
- Nada de SQL, tablas de resultados ni términos de base en el PANEL (no lo toques).
- No inventes pantallas fuera del inventario ni funciones nuevas (gestión de usuarios, roles, permisos): si creés que falta algo, listalo aparte como "propuesta" sin diseñarlo.
- No diseñes un diff visual de versiones: la comparación es de texto plano.
- No uses gradientes, ilustraciones, tarjetas con borde de color a la izquierda ni sombras decorativas.

## Entrega
1. Arquitectura de información (diagrama de navegación y mapa de pantallas).
2. Especificación por pantalla en el formato de `pantallas.md`, con la tabla change -> pantallas actualizada.
3. Mockup HTML navegable del esqueleto y las tres pantallas pedidas.
4. Lista de componentes nuevos con sus clases `.zd-*`.
5. Notas de adopción incremental, en orden.
6. Una lista aparte de PROPUESTAS que detectaste y que no diseñaste.
````
