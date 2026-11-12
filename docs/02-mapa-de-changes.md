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

**Numeración.** Los números siguen corriendo desde la v1: el próximo change nuevo es CH-58 y la próxima decisión, DEC-210. No se reinician, para que ningún identificador signifique dos cosas. Los candidatos que vienen de la v1 conservan el suyo.

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

### Candidatos que surgieron en la v2

| ID | Qué resuelve | Historia | Estado | Notas |
|---|---|---|---|---|
| — | En el alta y el ajuste de la consola, el umbral y el mínimo de filas se confunden | D2 | Pasó a CH-57 el 2026-11-12 | DEC-209 |

### Changes de la v2

Orden de ejecución pensado para grabar el video cuanto antes: primero las automatizaciones (consola, mensaje y canales), después los reportes y al final los datos de demo. Cada change lleva su exploración. Los marcados con ⚠ probablemente pasen de 400 líneas y se parten en cortes al explorarlos.

| Orden | ID | Change | Historias | Depende de | Notas |
|---|---|---|---|---|---|
| 0 | CH-36 | Reorganización de `src/` en carpetas por dominio, sin cambiar el comportamiento | — | — | DEC-181. PRs #199 a #202 |
| 1 | CH-37 | Textos para el cliente en la plantilla: título y descripción en la base, con una migración. Los dos textos fijos de DEC-137 pasan a la semilla, y el panel los lee de la base | D4 | CH-36 | DEC-182, DEC-190. Requisito de CH-38: sin estos textos, una plantilla nueva no aparece en el panel. PR #211 |
| 2 | CH-38 | Pantalla de plantillas en la consola: crear, probar contra una conexión, guardar y «Duplicar y editar» una plantilla en uso | D4, D5 | CH-37 | ⚠ DEC-182, DEC-191. Bloquea el `PUT` sobre una plantilla con automatizaciones activas y suma `POST /plantillas/prueba` para probar antes de guardar. PR #214 |
| 3 | CH-39 | Texto del mensaje: encabezado y línea por fila con marcadores `{columna}`, validados contra la última prueba, en el correo | N7 | CH-38 | DEC-188, DEC-192. Los campos se cargan en la pantalla de CH-38; la ejecución registra el respaldo a la tabla en `Ejecucion.mensajeRespaldo`. PRs #215 y #216 |
| 4 | CH-40 | Mínimo de filas por automatización y resultado `omitida-bajo-minimo` | X9 | CH-36 | DEC-186. Se carga en el alta de la consola. PR #219 |
| 5 | CH-41 | Varios destinatarios: lista de hasta 5 direcciones en un solo mensaje, en el alta de la consola y en el ajuste del panel (P-04) | N6 | CH-36 | DEC-187. La migración conserva la dirección actual. PR #223 |
| 6 | CH-42 | Vista previa del mensaje de una automatización, en la consola, sin enviar: una acción de la fila y un pop-up, no una pantalla de detalle | X10 | CH-39, CH-40 | DEC-189, DEC-195. Queda en la auditoría con su propio origen, como la prueba de plantilla. CH-44 le suma la vista de Telegram |
| 7 | CH-43 | Vínculo de Telegram: bot global, código de un solo uso desde el panel y consulta saliente a `getUpdates` | N5 | CH-36 | ⚠ DEC-185, DEC-196. Primer ciclo en segundo plano fuera del planificador. Tres PRs encadenados: CH-43a (datos y API del panel), CH-43b (sondeo) y CH-43c (tarjeta P-07). PRs #229, #230 y #231 |
| 8 | CH-44 | Canal Telegram: la automatización elige su canal, mensaje de texto por ejecución y resultado `sin-vinculo` | N4 | CH-39, CH-43 | DEC-185, DEC-197. Reutiliza el texto de CH-39. También suma el canal al panel, el aviso sin chat y la vista de Telegram en la vista previa. Un solo PR con `size:exception`. PR #234 |
| 9 | CH-45 | Reportes: modelo, catálogo global sobre `v_*` con tipo de visualización y pantalla de definición y prueba en la consola | R1h | CH-36 | DEC-183, DEC-198. Guía `docs/guia/09-reportes.md`. Un solo PR con `size:exception`. PR #237 |
| 10 | CH-46 | Tablero del tenant: P1 elige qué reportes ve el cliente y en qué orden | R2h | CH-45 | DEC-183, DEC-199. Una conexión por tablero, hasta 8 reportes, un reporte en uso se duplica en lugar de editarse y las vistas no aprobadas solo se avisan. Guía en `docs/guia/09-reportes.md`. Un solo PR con `size:exception`. PR #240 |
| 11 | CH-47 | Chart.js copiado en `public/ui/vendor/`, con su fila en la lista fija de DEC-124 | — | CH-36 | DEC-184, DEC-200. Excepción de tamaño por el archivo de terceros, como la copia de la skill en CH-21a. Un solo PR con `size:exception`. PR #243 |
| 12 | CH-48 | Panel: tablero con ejecución en vivo, período declarado, frescura y tabla accesible por gráfico | R3h, R4h, R5h | CH-46, CH-47 | ⚠ DEC-183, DEC-184, DEC-201, DEC-202. Prueba automatizada con dos tenants (regla 2). Una llamada por reporte con hasta 3 ejecuciones a la vez por tenant, y sin fila de auditoría. Tres PRs encadenados: CH-48a (API del panel), CH-48b (pantalla, números y tablas) y CH-48c (gráficos). Guía en `docs/guia/09-reportes.md`. PRs #250, #251 y #252 |
| 13 | CH-49 | Datos de demo: segundo tenant, una automatización cada minuto, Telegram vinculado y tablero con reportes | — | CH-44, CH-48 | Reemplaza el pendiente de datos de demo. Es la base del guion del video. DEC-206, DEC-207. Cinco PRs encadenados: CH-49a (réplica con fechas recientes), CH-49b1 (segundo tenant), CH-49b2 (reportes y tableros), CH-49c (Telegram y automatizaciones cada minuto) y CH-49d (agente de la demo). PRs #259, #260, #261, #262 y #263 |

**Independientes entre sí:** CH-40, CH-41, CH-43, CH-45 y CH-47 solo dependen de CH-36, así que pueden adelantarse si uno se traba.

**Fuera del camino del video:** los candidatos que dejó la v1. CH-19d1 y CH-19d2 suman al argumento de «sin puertos entrantes» y entran si sobra tiempo.

### Changes de UX de la consola

Salen de la auditoría de UX de la consola (EXPLORE del 2026-11-11) y de `guidelines/admin.md` de la skill de diseño. El usuario aprobó las siete propuestas el 2026-11-11.

Todos son de front. No cambian reglas de negocio, endpoints ni datos, y ninguno incorpora las decisiones de producto que quedaron abiertas. Los marcados con ⚠ se parten en cortes en la etapa de tareas.

| Orden | ID | Change | Depende de | Notas |
|---|---|---|---|---|
| 14 | CH-50 | Navegación y orientación: el bloque del tenant lleva el nombre del tenant como título, el orden sigue la dependencia real, Tiempos de alta pasa al pie, un solo camino para cambiar de tenant y aviso de sección inexistente | — | Solo front. PR #266. Archivado el 2026-11-12. |
| 15 | CH-51 | Confirmaciones graduadas (C0 a C3) en un solo diálogo, desactivar una automatización con confirmación, acciones destructivas en el tono de error y foco en los diálogos | — | ⚠ PR #267. Archivado el 2026-11-12. |
| 16 | CH-52 | Un solo sistema de avisos (`zd-banner`), errores en lenguaje humano, voseo en todo y zona horaria rotulada | — | ⚠ PRs #268, #269. Archivado el 2026-11-12. |
| 17 | CH-54 | Mapeo con los campos esperados del contrato, veredicto por campo y resumen de la validación | CH-52 | Sin API nueva. PR #270. Archivado el 2026-11-12. |
| 18 | CH-53 | Consultas como subvista de página con el esqueleto de banco de trabajo | CH-51, CH-52 | ⚠ DEC-208 (enmienda DEC-173). Sin el cambio de backend de la versión en la lista. PRs #271, #272. Archivado el 2026-11-12. |
| 19 | CH-55 | Guía de puesta en marcha como capa visual, no obligatoria: franja de etapas, marcas en la navegación y «Siguiente» | CH-50 | Solo lee datos que la consola ya obtiene. PR #273. Archivado el 2026-11-12. |
| 20 | CH-56 | Editor de Plantillas y Reportes en una subvista con secciones numeradas | CH-53 | ⚠ DEC-208. Dos cortes: CH-56a (Plantillas) y CH-56b (Reportes). PRs #274, #275, #276. Archivado el 2026-11-12. |
| 21 | CH-57 | El umbral y el mínimo de filas se distinguen: rótulo y ayuda opcionales por parámetro de plantilla, cargados en el editor, y la ayuda del mínimo completa en el alta y el ajuste | CH-56 | DEC-209. Toca la API de plantillas (sin migración) y la consola. El panel no cambia. |

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

Se quitaron de esta lista, por estar resueltos en la v1: cerrar D-3 (DEC-05), escribir el modelo de datos (CH-02) y verificar los candidatos de D-5 (DEC-26).
