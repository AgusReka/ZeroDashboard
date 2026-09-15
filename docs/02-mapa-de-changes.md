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

---

## R2 — Endurecimiento, catálogo, panel, conectividad

Requiere D-1 y D-2 cerradas. Los changes de este bloque están definidos en grueso y se van a partir al llegar.

| ID | Change | Historias |
|---|---|---|
| CH-17 | Motor: solapamientos, reintentos, ejecuciones interrumpidas | X4, X5, X7 |
| CH-18 | Motor: control de notificaciones duplicadas y aislamiento de fallos entre tenants | X6, X8 |
| CH-19 | Conectividad definitiva según D-2 | C1, C2, C3 |
| CH-20 | Auditoría de ejecución de consultas | A5 |
| CH-21 | Catálogo: instanciación de plantillas y casos iniciales | D2, D3, N3 |
| CH-22 | Panel del cliente: autenticación y vista de automatizaciones | T3, P1h, P3h |
| CH-23 | Panel: ajuste de umbrales y horarios | P2h |
| CH-24 | Frescura de datos por tenant y por plantilla | F1, F2 |

---

## R3 — Refinamiento

| ID | Change | Historias |
|---|---|---|
| CH-25 | Versionado de consultas guardadas | B4 |
| CH-26 | Advertencia de frescura insuficiente al activar | F3 |
| CH-27 | Visualización de últimos resultados en el panel | P4h, sujeto a D-1 |

---

## Pendientes fuera del código

No son changes, pero bloquean o condicionan el trabajo.

- [ ] Cerrar D-3 (stack). Una jornada, no más.
- [ ] Escribir el modelo de datos antes de CH-02.
- [ ] Verificar motores de base y modelo de insumos de los candidatos de D-5.
- [ ] Consultar reglamento institucional: desarrollo propio, formato de citación, anexos, declaración de uso de IA.
- [ ] Bloque 2 del checklist de correcciones de la tesis (formales). No depende de nada y despeja la lectura.
