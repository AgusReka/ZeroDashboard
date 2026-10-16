# Guía de ZeroDashboard

Ocho guías sobre lo que la aplicación hace hoy, escritas contra el código y las decisiones registradas (`docs/01-decisiones.md`). Se muestran las etiquetas de la consola tal como aparecen. Lo que el producto no hace figura como **Límite**.

Los lectores son quienes usan la consola, que corresponde al usuario P1 de `docs/00-contexto.md`. La columna «Para» sigue la navegación de la consola: *Implementador* es quien pone en marcha un tenant (grupo «Puesta en marcha»); *Operador* es quien trabaja con él a diario (grupo «Trabajo diario»). Puede ser la misma persona.

| Guía | De qué trata | Para |
|---|---|---|
| [01 Arquitectura](01-arquitectura.md) | Conceptos (tenant, conexión, agente, contrato, plantilla…) y cómo fluyen los datos. | Todos; leerla primero |
| [02 Alta de tenant y conexión](02-alta-de-tenant-y-conexion.md) | Crear un tenant y conectarlo a la réplica, directo o por agente. | Implementador |
| [03 Mapeo y validación](03-mapeo-y-validacion.md) | Un `SELECT` por entidad del contrato, estados y sugerencias de cast. | Implementador |
| [04 Consultas](04-consultas.md) | Ejecutar y guardar SQL de solo lectura; plantilla frente a consulta guardada. | Operador |
| [05 Plantillas](05-plantillas.md) | Catálogo global, solo lectura, y «Probar en el tenant activo». | Operador |
| [06 Automatizaciones](06-automatizaciones.md) | Horario, correo, ejecuciones, ajuste en el lugar y frescura. | Operador |
| [07 Usuarios y permisos](07-usuarios-y-permisos.md) | Operadores, usuarios del panel, secretos de un solo uso, baja de tenant, auditoría. | Implementador |
| [08 Diagnóstico](08-diagnostico.md) | Catálogo de errores con su causa y qué hacer. | Operador, cuando algo falla |

## Orden de lectura para una puesta en marcha

1. 01, para los términos.
2. 07, solo la sección del operador, para tener una cuenta.
3. 02 y 03, hasta tener un mapeo válido.
4. 05 y 06, para crear la primera automatización.
5. 08, a mano durante todo el proceso.

## Fuera de estas guías

| Tema | Dónde |
|---|---|
| Levantar el entorno, scripts y pruebas | [`README.md`](../../README.md) |
| Por qué algo es como es | `docs/01-decisiones.md` |
| Estado del trabajo y trabajo a futuro | `docs/02-mapa-de-changes.md` |
| Reglas del proyecto para quien lo modifica | [`AGENTS.md`](../../AGENTS.md) |
