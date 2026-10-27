# 02 — Mapa de changes

Secuencia de trabajo de la **versión 2**. Cada change es una unidad de especificación e implementación.

**Este documento se reordena a medida que se avanza.** Es el menos estable de los tres.

La versión 1.0 está cerrada: tag `v1.0.0`. Su mapa, con CH-01 a CH-35 y la sección «Versión 1.0» que dice qué dejó afuera, está congelado en [`versiones/v1/02-mapa-de-changes.md`](versiones/v1/02-mapa-de-changes.md).

---

## Cómo usar esto

**Una especificación por change, no una por release.** El mapa de historias completo no se pasa como entrada de una sola spec: produce un plan inabarcable y código que no se alcanza a revisar.

**Criterio de tamaño.** Un change debería poder revisarse entero en una sentada. Si al leer el plan generado no podés seguir qué hace cada parte, el change es demasiado grande y hay que partirlo.

**Antes de cada change:** verificar que las decisiones que toca ya estén en `01-decisiones.md`. Si aparece una decisión de arquitectura no registrada, se frena y se registra primero.

**Después de cada change:** entrada en la bitácora con fecha, fricciones encontradas y tiempo invertido.

**Numeración.** Los números siguen corriendo desde la v1: el próximo change nuevo es CH-50 y la próxima decisión, DEC-190. No se reinician, para que ningún identificador signifique dos cosas. Los candidatos que vienen de la v1 conservan el suyo.

---

## Versión 2 — en curso

**Objetivo.** Llegar a la entrega de la tesis con un producto que se pueda mostrar en un video promocional de punta a punta. Para eso suma tres cosas:
- Plantillas escritas desde la consola, siempre sobre el contrato canónico.
- Avisos más útiles: mensaje legible, varios destinatarios, mínimo de filas y Telegram.
- Reportes para el cliente en el panel.

Alcance decidido el 2026-10-23 (DEC-181 a DEC-189). Las historias son las de R4 en `mapa-historias.md` §5.

Un candidato pasa a la tabla de changes recién cuando se explora y se decide. Si toca una decisión de arquitectura, se registra antes en `01-decisiones.md` (`AGENTS.md`).

### Candidatos que dejó la v1

| ID | Qué resuelve | Historia | Estado | Notas |
|---|---|---|---|---|
| CH-19d1 | Latido y sondeo TCP del agente, con el estado persistido | C2 | Trabajo a futuro (DEC-179) | Diseño en DEC-112 a DEC-120 |
| CH-19d2 | Categoría `agente-desconectado`, estado visible en la consola y automatizaciones en riesgo | C2 | Trabajo a futuro (DEC-179) | Depende de CH-19d1 |
| CH-19e | Script de costo de conectividad, plantilla de bitácora y runbook de alta | C3 | Trabajo a futuro (DEC-179) | Al cerrarlo se reevalúa el modo directo (DEC-115) |
| CH-27 | Últimos resultados en el panel | P4h | Fuera de alcance (DEC-93) | Exige reabrir D-1: hoy no se persisten las filas |
| — | La advertencia de frescura, también en el panel | F3 | Opción (b) de DEC-180 | Solo si el cliente necesita verla |

### Changes de la v2

Orden de ejecución pensado para grabar el video cuanto antes: primero las automatizaciones (consola, mensaje y canales), después los reportes y al final los datos de demo. Cada change lleva su exploración. Los marcados con ⚠ probablemente pasen de 400 líneas y se parten en cortes al explorarlos.

| Orden | ID | Change | Historias | Depende de | Notas |
|---|---|---|---|---|---|
| 0 | CH-36 | Reorganización de `src/` en carpetas por dominio, sin cambiar el comportamiento | — | — | DEC-181. PRs #199 a #202 |
| 1 | CH-37 | Textos para el cliente en la plantilla: título y descripción en la base, con una migración. Los dos textos fijos de DEC-137 pasan a la semilla, y el panel los lee de la base | D4 | CH-36 | DEC-182. Requisito de CH-38: sin estos textos, una plantilla nueva no aparece en el panel |
| 2 | CH-38 | Pantalla de plantillas en la consola: crear, probar contra una conexión, guardar y «Duplicar y editar» una plantilla en uso | D4, D5 | CH-37 | ⚠ DEC-182. Usa las rutas que ya existen (`POST` y `PUT /plantillas`, `/prueba`). Hay que bloquear el `PUT` sobre una plantilla en uso |
| 3 | CH-39 | Texto del mensaje: encabezado y línea por fila con marcadores `{columna}`, validados contra la última prueba, en el correo | N7 | CH-38 | DEC-188. Los campos se cargan en la pantalla de CH-38 |
| 4 | CH-40 | Mínimo de filas por automatización y resultado `omitida-bajo-minimo` | X9 | CH-36 | DEC-186. Se carga en el alta de la consola |
| 5 | CH-41 | Varios destinatarios: lista de hasta 5 direcciones en un solo mensaje, en el alta de la consola y en el ajuste del panel (P-04) | N6 | CH-36 | DEC-187. La migración conserva la dirección actual |
| 6 | CH-42 | Vista previa del mensaje en el detalle de la automatización, en la consola, sin enviar | X10 | CH-39, CH-40 | DEC-189. Queda en la auditoría como la prueba de plantilla. CH-44 le suma la vista de Telegram |
| 7 | CH-43 | Vínculo de Telegram: bot global, código de un solo uso desde el panel y consulta saliente a `getUpdates` | N5 | CH-36 | ⚠ DEC-185. Primer ciclo en segundo plano fuera del planificador |
| 8 | CH-44 | Canal Telegram: la automatización elige su canal, mensaje de texto por ejecución y resultado `sin-vinculo` | N4 | CH-39, CH-43 | DEC-185. Reutiliza el texto de CH-39 |
| 9 | CH-45 | Reportes: modelo, catálogo global sobre `v_*` con tipo de visualización y pantalla de definición y prueba en la consola | R1h | CH-36 | ⚠ DEC-183 |
| 10 | CH-46 | Tablero del tenant: P1 elige qué reportes ve el cliente y en qué orden | R2h | CH-45 | DEC-183 |
| 11 | CH-47 | Chart.js copiado en `public/ui/vendor/`, con su fila en la lista fija de DEC-124 | — | CH-36 | DEC-184. Excepción de tamaño por el archivo de terceros, como la copia de la skill en CH-21a |
| 12 | CH-48 | Panel: tablero con ejecución en vivo, período declarado, frescura y tabla accesible por gráfico | R3h, R4h, R5h | CH-46, CH-47 | ⚠ DEC-183, DEC-184. Prueba automatizada con dos tenants (regla 2) |
| 13 | CH-49 | Datos de demo: segundo tenant, una automatización cada minuto, Telegram vinculado y tablero con reportes | — | CH-44, CH-48 | Reemplaza el pendiente de datos de demo. Es la base del guion del video |

**Independientes entre sí:** CH-40, CH-41, CH-43, CH-45 y CH-47 solo dependen de CH-36, así que pueden adelantarse si uno se traba.

**Fuera del camino del video:** los candidatos que dejó la v1. CH-19d1 y CH-19d2 suman al argumento de «sin puertos entrantes» y entran si sobra tiempo.

---

## Pendientes fuera del código

No son changes, pero condicionan la entrega.

- [ ] D-6: consultar el reglamento institucional (desarrollo propio, formato de citación, anexos y declaración de uso de IA) antes de la entrega.
- [ ] Bloque 2 del checklist de correcciones de la tesis (formales).
- [ ] Guion y ensayo del video contra Mailpit (`localhost:8026`) y un bot de Telegram de prueba. El recorrido:
  - Consola con tenant activo y conexión por agente.
  - Consulta de solo lectura y su rechazo.
  - Plantilla nueva escrita desde la consola y su vista previa.
  - Alta con varios destinatarios y mínimo de filas.
  - Correo y Telegram recibidos.
  - Panel del cliente con ajuste de umbral y tablero de reportes.
  - Falla provocada y aislamiento entre tenants.

  Los datos salen de CH-49.
- [ ] Entrada de CH-36 en la bitácora.

Se quitaron de esta lista, por estar resueltos en la v1: cerrar D-3 (DEC-05), escribir el modelo de datos (CH-02) y verificar los candidatos de D-5 (DEC-26).
