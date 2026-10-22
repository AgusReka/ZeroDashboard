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

**Numeración.** Los números siguen corriendo desde la v1: el próximo change nuevo es CH-36 y la próxima decisión, DEC-181. No se reinician, para que ningún identificador signifique dos cosas. Los candidatos que vienen de la v1 conservan el suyo.

---

## Versión 2 — en planificación

Todavía no tiene alcance decidido. Un candidato pasa a la tabla de changes recién cuando se explora y se decide; si toca una decisión de arquitectura, se registra antes en `01-decisiones.md` (`AGENTS.md`).

### Candidatos que dejó la v1

| ID | Qué resuelve | Historia | Estado | Notas |
|---|---|---|---|---|
| CH-19d1 | Latido y sondeo TCP del agente, con el estado persistido | C2 | Trabajo a futuro (DEC-179) | Diseño en DEC-112 a DEC-120 |
| CH-19d2 | Categoría `agente-desconectado`, estado visible en la consola y automatizaciones en riesgo | C2 | Trabajo a futuro (DEC-179) | Depende de CH-19d1 |
| CH-19e | Script de costo de conectividad, plantilla de bitácora y runbook de alta | C3 | Trabajo a futuro (DEC-179) | Al cerrarlo se reevalúa el modo directo (DEC-115) |
| CH-27 | Últimos resultados en el panel | P4h | Fuera de alcance (DEC-93) | Exige reabrir D-1: hoy no se persisten las filas |
| — | La advertencia de frescura, también en el panel | F3 | Opción (b) de DEC-180 | Solo si el cliente necesita verla |

### Changes de la v2

| ID | Change | Historias |
|---|---|---|
| — | Todavía no hay. | — |

---

## Pendientes fuera del código

No son changes, pero condicionan la entrega.

- [ ] D-6: consultar el reglamento institucional (desarrollo propio, formato de citación, anexos y declaración de uso de IA) antes de la entrega.
- [ ] Bloque 2 del checklist de correcciones de la tesis (formales).
- [ ] Datos de demo: la semilla de CH-31 (`SEED_DEMO=1`) deja un tenant listo. Si la demo necesita dos, falta el segundo; entra como un change chico.
- [ ] Guion y ensayo de la demo contra Mailpit (`localhost:8026`): consola con tenant activo, conexión por agente, consulta de solo lectura y su rechazo, alta desde plantilla, ejecución y correo, panel del cliente con ajuste de umbral, falla provocada y aislamiento entre tenants.

Se quitaron de esta lista, por estar resueltos en la v1: cerrar D-3 (DEC-05), escribir el modelo de datos (CH-02) y verificar los candidatos de D-5 (DEC-26).
