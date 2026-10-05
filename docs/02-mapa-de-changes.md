# 02 — Mapa de changes

Secuencia de trabajo. Cada change es una unidad de especificación e implementación.

**Este documento se reordena a medida que se avanza.** Es el menos estable de los tres.

---

## Cómo usar esto

**Una especificación por change, no una por release.** El mapa de historias completo no se pasa como entrada de una sola spec: produce un plan inabarcable y código que no se alcanza a revisar.

**Criterio de tamaño.** Un change debería poder revisarse entero en una sentada. Si al leer el plan generado no podés seguir qué hace cada parte, el change es demasiado grande y hay que partirlo.

**Antes de cada change:** verificar que las decisiones que toca ya estén en `01-decisiones.md`. Si aparece una decisión de arquitectura no registrada, se frena y se registra primero.

**Después de cada change:** entrada en la bitácora con fecha, fricciones encontradas y tiempo invertido.

---

## R0 — Consola mínima

No depende de ninguna compuerta salvo D-3 (stack). Se puede empezar hoy.
**Cierre del release:** conectarse a la base de Food Store desde la herramienta propia, escribir una consulta, guardarla y ejecutarla.

| ID | Change | Historias | Notas |
|---|---|---|---|
| CH-01 | Esqueleto de aplicación y entorno | — | Docker Compose, base propia, migraciones, configuración por variables de entorno, secretos fuera del repositorio |
| CH-02 | Modelo de datos inicial | — | **Escribir el modelo antes de este change.** Entidades de la sección 8 del contexto |
| CH-03 | Registro y prueba de conexiones | A1 | Alta de conexión, prueba con resultado visible |
| CH-04 | Ejecución de consultas de solo lectura | A3, B1 | Rechazo de sentencias que no sean de lectura en aplicación **y** usuario de base sin escritura. Editor, ejecución, tabla paginada, error legible |
| CH-05 | Consultas guardadas | B2 | Nombre, descripción, persistencia en base propia |

---

## R1 — Tenants, contrato, motor mínimo, segundo esquema

**Es el release que sostiene el capítulo de resultados.** Cierra con dos tenants aislados, un esquema ajeno mapeado y validado, y una automatización corriendo sola de punta a punta.

| ID | Change | Historias | Notas |
|---|---|---|---|
| CH-06 | Tenants y aislamiento | T1, T2, T4 | T2 exige prueba automatizada con dos tenants cargados. T4 (indicador de tenant activo) no es cosmético: mitiga el error humano más probable del sistema |
| CH-07 | Cifrado de credenciales y límites de consulta | A2, A4 | Clave maestra fuera de la base. Timeout y tope de filas |
| CH-08 | Contrato canónico | M1, M5 | Definición de entidades obligatorias y opcionales, y qué automatización depende de cada una. Excluir campos personales innecesarios |
| CH-09 | Mapeo de esquema por tenant | M2 | Vistas canónicas registradas o generadas por tenant |
| CH-10 | Validación de mapeo | M3, M4 | Falla ruidosa ante columnas o tipos faltantes. Lista explícita de automatizaciones inaplicables con su motivo |
| CH-11 | Parámetros en consultas | B3 | Por parámetros del driver, nunca concatenación |
| CH-12 | Plantillas de automatización | D1 | Consulta + parámetros + condición + formato + tolerancia de frescura |
| CH-13 | Motor: planificación y ejecución | X1, X2 | Planificador por horario. Registro de ejecución con inicio, fin, duración, filas, estado |
| CH-14 | Motor: condición y notificación por correo | X3, N1, N2 | Sin filas no se envía. Reutilizar el HTML ya validado. Degradación elegante sin datos |
| CH-15 | Instrumentación de tiempos de alta | G1 | Marcas de tiempo de conexión, mapeo, validación y primera ejecución |
| CH-16 | **Mapeo del segundo esquema** | — | No es desarrollo: es el experimento. Registrar horas, qué mapeó por traducción, qué quedó inaplicable por ausencia de datos. Depende de D-4 y D-5 |

> CH-16 no produce pantallas y es el change más importante del proyecto. Es el que responde la pregunta sobre genericidad.

### Experimentos agregados durante R1

No estaban en el plan original de R1. Se agregaron después de CH-16, como experimentos fuera de la aplicación: no producen código del prototipo ni tienen propuesta, spec o tareas. Se listan acá para que el mapa refleje todo lo ejecutado. Sus resultados están en las bitácoras.

| ID | Experimento | Fecha | Evidencia |
|---|---|---|---|
| CH-16b | Vistas canónicas sobre Food Store y Medusa (bases reales) y WooCommerce (*fixture*); equivalencia de `stock-producible` con la consulta original | 2026-09-21 y 2026-09-23 (`fc54f19`, `c6ef5a0`) | `docs/bitacora/bitacora_CH-16b_tres_esquemas.md`, `openspec/changes/CH-16b-vistas-canonicas/sql/`. Origen de DEC-28 y DEC-29 |
| CH-16c | Saleor como caso negativo ejecutado | 2026-09-24 (`ab93586`) | `docs/bitacora/bitacora_CH-16c_saleor.md`, `openspec/changes/CH-16c-saleor-caso-negativo/`. Origen de DEC-37 y DEC-38 |
| CH-16d | Segunda automatización (stock físico) y composición con `WITH` | 2026-09-25 (`a6e605a`), posterior al congelamiento de la tesis | `docs/bitacora/bitacora_CH-16d.md`, `openspec/changes/CH-16d-segunda-automatizacion-y-with/` |

---

## R2 — Endurecimiento, catálogo, panel, conectividad

Requiere D-1 y D-2 cerradas. Los changes de este bloque están definidos en grueso y se van a partir al llegar.

| ID | Change | Historias |
|---|---|---|
| CH-17 | Motor: solapamientos, reintentos, ejecuciones interrumpidas. Partido en CH-17a (X7, X4) y CH-17b (X5), ver DEC-101 | X4, X5, X7 |
| CH-18 | Motor: control de notificaciones duplicadas y aislamiento de fallos entre tenants | X6, X8 |
| CH-19 | Conectividad definitiva según D-2. Partido en seis cortes, ver abajo y DEC-112 a DEC-120 | C1, C2, C3 |
| CH-20 | Auditoría de ejecución de consultas | A5 |
| CH-21 | Catálogo: instanciación de plantillas y casos iniciales. Partido en CH-21a, CH-21b y CH-21c, ver abajo | D2, D3, N3 |
| CH-22 | Panel del cliente: autenticación y vista de automatizaciones. Partido en CH-22a, CH-22b y CH-22c, ver abajo | T3, P1h, P3h |
| CH-23 | Panel: ajuste de umbrales y horarios | P2h |
| CH-24 | Frescura de datos por tenant y por plantilla | F1, F2 |

### Partición de CH-19

Cada corte apunta a unas 300 líneas estimadas. Las estimaciones de tests se multiplican por ~1,7: en CH-19a el código salió dentro de lo estimado y los tests se pasaron un 70%. El duplex falso y su fixture ya existen en `src/db-probe-canal.test.ts`; los cortes siguientes lo importan o lo extraen a un helper compartido, no lo recrean.

| ID | Corte | Historias | Estado |
|---|---|---|---|
| CH-19a | Canal opcional en `iniciarConexion`, tipos del protocolo, spike con duplex falso | C1 | Archivado (PR #58, `size:exception`) |
| CH-19b | Migración `Agente` y `Conexion.agenteId`, alta, listado y revocación de token con hash, aislamiento, prueba con dos tenants (DEC-121). Un change, tres PR encadenados (el diseño subió la unidad 1 de ~360 a ~524 líneas): 1a (esquema, migración, modelo aislado, lookup, módulo de token, ~210), 1b (tres rutas `/agentes` y su prueba con dos tenants, ~314) y 2 (`agenteId` en `POST /conexiones` con chequeo de tenant, ~114) | C1 | Archivado |
| CH-19c1 | Lado motor (DEC-122). Un change, seis PR encadenados (el diseño subió el PR 3 a ~434 líneas y se partió en 3a y 3b; los tests ampliados de `CanalAgente` salieron a su propio PR): 1) dependencia `ws`, tipos del catálogo, `CanalAgente` y pruebas de contrato (331); 1b) tests ampliados de `CanalAgente` (152); 2) registro de sesiones (340); 3a) listener de upgrade, autenticación, rechazos, alta en el registro y cierre en `preClose` (~317); 3b) ping de 20 s y cierre 4002 al revocar o dar de baja (~110); 4) `destinoDeConexion` devuelve un canal y prueba de punta a punta (~216). El duplex falso no se extrae salvo que aparezca un segundo consumidor | C1 | Archivado |
| CH-19c2 | Proceso del agente (DEC-123): reconexión con espera creciente, lista de destinos, puente, imagen Docker y Compose aparte, prueba de punta a punta. Un change, cinco PR encadenados: 1) configuración, política TLS, lista de destinos y límites (~320); 2) logger y puente (~340); 3) reconexión, bucle de control, clasificación de cierres y vigilancia de ping (~355); 4) `main`, apagado, códigos de salida, test de frontera, tsconfig, etapa de Docker, Compose y ejemplo (~300); 5) matriz de punta a punta (~300) | C1 | Archivado |
| CH-19d1 | C2, parte 1: latido y sondeo TCP, columnas de estado, persistencia de transiciones | C2 | Pendiente |
| CH-19d2 | C2, parte 2: categorías `agente-desconectado`, enmienda a DEC-97, endpoint de estado, indicador en consola, vista de automatizaciones en riesgo | C2 | Pendiente |
| CH-19e | C3: `scripts/conectividad-alta.sql`, plantilla de bitácora, marca de DEC-88, runbook de alta. Cierre: reevaluar el modo directo (DEC-115) | C3 | Pendiente |

### Camino a la demo grabable (CH-21 a CH-23)

Objetivo: poder grabar el producto de punta a punta: consola del implementador, correo recibido y panel del cliente. El resultado de una automatización llega por correo; el panel muestra estado y metadatos de ejecución, no filas (DEC-93). El diseño visual está en la skill `.claude/skills/zerodashboard-design`: cada pantalla lleva su historia, change y estado en `guidelines/pantallas.md`.

Orden de ejecución. Los cortes apuntan a unas 300 líneas; los marcados con ⚠ tienen una decisión abierta que se trata en la exploración, no la resuelve un agente por su cuenta (`AGENTS.md`).

| Orden | ID | Corte | Historias | Notas |
|---|---|---|---|---|
| 1 | CH-21a | Sistema visual compartido: hoja de estilos con los tokens de la skill, aplicada a la consola existente sin cambiar su comportamiento | — | Los ids de `src/consola.ts` y `src/consola.test.ts` no cambian. ⚠ Registrar antes en `01-decisiones.md` cómo se sirven los archivos de la interfaz (hoy, un string de TypeScript) |
| 2 | CH-21b | Catálogo inicial: stock físico, stock producible, reporte diario | D3 | ⚠ Verificar en la exploración qué cubren ya `src/plantillas.ts` (CH-12, CH-16d). Si el corte queda casi vacío, se fusiona con CH-21c |
| 3 | CH-21c | Alta en dos pasos en la consola y formato de correo asociado a la plantilla | D2, N3 | Reutiliza el HTML de correo de CH-14. ⚠ La skill define el horario como frecuencia más hora; la consola usa cron (DEC-76): decidir si el formulario traduce a cron |
| 4 | CH-22a | Autenticación del panel: usuario del cliente, ingreso y salida, sesión, tenant tomado siempre de la sesión | T3 | ⚠ Registrar antes el mecanismo de autenticación. Prueba automatizada con dos tenants (regla 2) |
| 5 | CH-22b | Panel: "mis automatizaciones" (activas y disponibles; estado, última y próxima ejecución) | P1h | Rutas de lectura con alcance de tenant, separadas de la consola (DEC-04). Sin SQL ni términos técnicos |
| 6 | CH-22c | Panel: estado de error visible y aviso de falla al cliente | P3h | ⚠ Un aviso de falla por correo es una notificación nueva y el motor produce una por ejecución: confirmar que encaja, o limitar el corte al estado visible |
| 7 | CH-23 | Panel: ajuste de umbrales y horarios (formulario validado; rige desde la próxima ejecución) | P2h | Valida valores contra la plantilla y el cron contra el planificador. Se parte en ruta y formulario si pasa de 400 líneas |

Opcionales para la demo, que suman al argumento de "sin puertos entrantes": CH-19d1 y CH-19d2.

Fuera del camino de la demo: CH-19e, CH-20, CH-24, CH-25, CH-26.

---

## R3 — Refinamiento

| ID | Change | Historias |
|---|---|---|
| CH-25 | Versionado de consultas guardadas | B4 |
| CH-26 | Advertencia de frescura insuficiente al activar | F3 |
| CH-27 | Visualización de últimos resultados en el panel. **Fuera de alcance** mientras D-1 siga cerrada en DEC-93: el sistema no persiste las filas | P4h |

---

## Pendientes fuera del código

No son changes, pero bloquean o condicionan el trabajo.

- [ ] Cerrar D-3 (stack). Una jornada, no más.
- [ ] Escribir el modelo de datos antes de CH-02.
- [ ] Verificar motores de base y modelo de insumos de los candidatos de D-5.
- [ ] Consultar reglamento institucional: desarrollo propio, formato de citación, anexos, declaración de uso de IA.
- [ ] Bloque 2 del checklist de correcciones de la tesis (formales). No depende de nada y despeja la lectura.
- [ ] Datos de demo: dos tenants cargados con datos de la tienda de alimentos y automatizaciones ya creadas. Verificar qué cubre `prisma/seed.ts`; si hay que tocar código, entra como un change chico.
- [ ] Guion y ensayo de la demo contra Mailpit (`localhost:8026`): consola con tenant activo, conexión por agente, consulta de solo lectura y su rechazo, alta desde plantilla, ejecución y correo, panel del cliente con ajuste de umbral, falla provocada y aislamiento entre tenants.
