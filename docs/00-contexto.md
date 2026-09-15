# 00 — Contexto del proyecto

Documento estable. Cambia poco. Si cambia, es porque cambió el producto, no porque avanzó el desarrollo.

Lo leen: el autor, el director de tesis, y cualquier agente que trabaje sobre el repositorio.

---

## 1. Qué es esto

Una plataforma que permite ofrecer automatizaciones operativas a e-commerce pequeños **sin modificar su plataforma de venta**. El cliente expone una réplica de solo lectura de su base; la plataforma se conecta, mapea ese esquema a un contrato canónico, y ejecuta sobre él un catálogo de automatizaciones preconfiguradas.

**La contribución no es el catálogo ni el dashboard.** Es el contrato canónico: el conjunto mínimo de entidades y campos que una plataforma de e-commerce debe exponer para que automatizaciones genéricas funcionen sin reescribirse por cliente.

## 2. Qué problema resuelve

Procesos operativos que permanecen manuales aunque la plataforma de venta funcione bien: control de stock, reportes de gestión, respuesta a consultas frecuentes. La plataforma computa el estado pero no lo vigila ni avisa.

> **Nota sobre el estatus de esta afirmación:** proviene de la observación profesional del autor, no de un relevamiento sistemático. Se asume como hipótesis de trabajo para orientar el diseño. Su contrastación queda como línea de trabajo futuro. No debe presentarse como hallazgo.

## 3. Usuarios

| ID | Persona | Superficie | Visión |
|---|---|---|---|
| P1 | Implementador (autor, consultor) | Consola | Todos los tenants |
| P2 | Administrador de la PYME | Panel | Su tenant únicamente |
| P3 | Cliente final | Telegram | Su propio pedido |
| P4 | Investigador (autor, tesista) | Registro | Tiempos y fricciones |

El usuario principal del sistema es **P1**. P2 consume valor, no opera la herramienta.

## 4. Arquitectura

```
   INFRAESTRUCTURA PROPIA                    INFRA DEL CLIENTE
┌──────────────────────────┐              ┌─────────────────────┐
│ Consola (P1)             │              │  Réplica read-only  │
│ Panel (P2)               │◄────D-2─────►│                     │
│ Base propia              │              └─────────────────────┘
│ Motor de ejecución       │◄────D-2─────►│  ... otros tenants  │
└──────────────────────────┘              └─────────────────────┘
```

**Motor propio**, acotado a un único patrón: *consulta → condición → notificación → registro*.

## 5. Reglas no negociables

Valen para toda feature. Un agente que trabaje sobre este repositorio debe respetarlas sin que se le recuerde.

1. **P2 nunca ejecuta SQL arbitrario.** El panel del cliente no tiene editor de consultas.
2. **Aislamiento entre tenants.** Ninguna consulta originada en el panel puede devolver datos de otro tenant. El identificador de tenant nunca se toma de la petición del cliente.
3. **Solo lectura, en dos capas.** Rechazo de sentencias que no sean de lectura en la aplicación, más usuario de base sin permisos de escritura.
4. **Sin concatenación de SQL.** Toda parametrización es por parámetros del driver.
5. **Minimización de datos.** El contrato canónico no expone campos personales que ninguna automatización necesite.
6. **El motor solo ejecuta el patrón.** Si un caso no encaja, se documenta como límite del artefacto; no se amplía el motor.
7. **Secretos fuera del repositorio.** Variables de entorno y archivo de ejemplo sin valores reales.

## 6. Anti-alcance

**Del producto:** SQL arbitrario en el panel, constructor visual de consultas, capa de IA, facturación.

**Del motor:** editor visual de flujos, nodos de integración genéricos, ramificaciones y bucles, ejecución por items, disparadores por webhook.

El anti-alcance del motor es el más frágil: cada límite va a parecer arbitrario el día que aparezca un caso que casi encaja. Respetarlo es lo que evita terminar con un orquestador genérico peor que los existentes.

## 7. Restricciones tecnológicas

- Base del cliente: relacional. Motores admitidos, ver D-4.
- Acceso: réplica de solo lectura. Nunca la base primaria.
- Despliegue: Docker Compose.
- Canales de notificación del catálogo inicial: correo y Telegram.

## 8. Entidades del dominio

Nombradas acá para que el modelo de datos sea consistente entre features. **El modelo detallado todavía no está escrito** y debe redactarse antes del primer change que toque persistencia.

`tenant` · `conexion` · `consulta_guardada` · `plantilla` · `automatizacion` (instancia de plantilla en un tenant) · `ejecucion` · `mapeo` · `usuario`

## 9. Relación con la tesis

Este repositorio es el artefacto de un trabajo final. Eso impone dos requisitos que no son de producto:

- **Bitácora fechada durante el desarrollo** (`/docs/bitacora/`), no reconstruida al final.
- **Toda decisión de arquitectura registrada con su alternativa evaluada** (`01-decisiones.md`). El capítulo de arquitectura se escribe desde ahí.

## 10. Documentos relacionados

| Archivo | Contenido | Estabilidad |
|---|---|---|
| `00-contexto.md` | Este documento | Alta |
| `01-decisiones.md` | Decisiones tomadas y compuertas abiertas | Media, crece |
| `02-mapa-de-changes.md` | Secuencia de trabajo | Baja, se reordena |
| `mapa-historias.md` | Historias de usuario completas | Media |
| `bitacora/` | Registro fechado de desarrollo | Crece |
