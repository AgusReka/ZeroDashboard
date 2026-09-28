# Bitácora — CH-12: Plantillas de automatización

**Fecha de inicio:** 2026-09-27 (exploración, propuesta, specs, diseño y tareas)
**Fecha de cierre:** 2026-09-28 — implementado en siete ramas encadenadas, verificado y archivado
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive). El commit de planificación es de las 22:38 del 27; los cuatro primeros commits de implementación caen entre las 22:43 y las 22:59 del 27, y los tres restantes entre las 11:03 y las 11:43 del 28; el de verificación, a las 11:55 del 28. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones.

> Se escribe al cierre (2026-09-28), apoyada en los artefactos archivados (`openspec/changes/archive/2026-09-28-CH-12-automation-templates/`), en los mensajes de commit y en DEC-61 a DEC-73. No reconstruida de memoria.

---

## Qué se construyó

D1 pide una plantilla reutilizable: consulta sobre vistas canónicas, parámetros, condición, formato y tolerancia de frescura. Antes de este change la plantilla no existía: `AUTOMATIZACIONES` en `contrato.ts` eran etiquetas sueltas (DEC-22) y el armado de los `WITH` sobre las vistas canónicas estaba asignado a CH-12 sin construir (DEC-31).

- **Modelo global `Plantilla`** (DEC-61, DEC-73): sin `tenantId` ni relaciones; campos `nombre`, `sql`, `parametros` (JSON), `entidades` (JSON), `automatizacion`, `formato`, `toleranciaFrescuraMinutos`. Migración aditiva `20260927100000_plantilla`. Queda fuera de `MODELOS_AISLADOS`: es el primer modelo con datos en la base, además de `Tenant`, que no pasa por el aislamiento.
- **Catálogo** (`src/plantillas-rutas.ts`): `POST /plantillas`, `GET /plantillas`, `GET /plantillas/:id`, `PUT /plantillas/:id` (reemplazo en el lugar, DEC-68; sin borrado). No exigen `x-tenant-id`: la exención son cuatro filas exactas de método + ruta en `esExenta`, no un prefijo. El registrador recibe solo el delegado `plantilla`, no el cliente completo.
- **Validación al guardar**: parámetros con las reglas de CH-11 (DEC-52, DEC-56 a DEC-60); `entidades` contra el contrato canónico (DEC-63); `automatizacion` tomada de `AUTOMATIZACIONES` (DEC-67, cierra DEC-22); `formato` con un único valor, `correo-html` (DEC-65); `toleranciaFrescuraMinutos` entero no negativo, guardado y sin efecto (DEC-66). No hay campo de condición (DEC-64).
- **Módulo puro** (`src/plantillas.ts`): `evaluarVistas` (compuerta de DEC-71) y `componerSentencia`, que antepone cada vista como `WITH v_<entidad> AS (...)` en orden del contrato y anida la plantilla como subconsulta (DEC-70). Los alias salen del contrato, nunca del texto guardado; cada pieza pasa una sola vez por `sanearSql`.
- **Ruta de prueba** `POST /plantillas/:id/prueba` (`src/plantilla-prueba.ts`, DEC-62): exige `x-tenant-id`; busca la conexión solo entre las del tenant activo; exige validación aprobada de cada vista (409 `vista-canonica-no-aprobada` con cada entidad y su estado); compone, prepara con `prepararSentencia`, descifra la credencial y ejecuta por `ejecutarConsulta` (solo lectura). No se abre ninguna conexión antes de pasar todos los controles.

## Decisiones tomadas

DEC-61 a DEC-73 (`docs/01-decisiones.md`), todas decididas por el usuario el 2026-09-27, aceptando las opciones recomendadas. Se presentaron en dos rondas: exploración (DEC-61 a DEC-69) y propuesta (DEC-70 a DEC-73). Las alternativas y los motivos están en ese archivo; no se repiten acá.

| Decisión | Qué fija |
|---|---|
| DEC-61 | Plantilla como catálogo global persistido, rutas exentas de `x-tenant-id` |
| DEC-62 | Composición `WITH` más un endpoint de prueba por el pipeline de solo lectura |
| DEC-63 | Lista explícita de `entidades`, validada contra el contrato |
| DEC-64 | "Condición" no agrega campo: `WHERE` parametrizado + regla "sin filas no se envía" de CH-14 |
| DEC-65 | `formato` es un enum con un único valor, `correo-html` |
| DEC-66 | `toleranciaFrescuraMinutos` guardada y no aplicada hasta CH-24 |
| DEC-67 | `automatizacion` vinculada a `AUTOMATIZACIONES`; cierra DEC-22 |
| DEC-68 | Reemplazo en el lugar por id, sin borrado |
| DEC-69 | La consulta canónica de `reporte-diario` no entra en CH-12 |
| DEC-70 | Alias de cada vista compuesta: `v_<entidad>` |
| DEC-71 | La prueba exige validación aprobada de cada vista compuesta |
| DEC-72 | La excepción de campos personales de M5 se posterga |
| DEC-73 | `parametros` y `entidades` se guardan como JSON validado en la aplicación |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Dos rondas de preguntas frenaron la cadena automática (9 en exploración, 4 en propuesta) | AGENTS.md: ninguna decisión de arquitectura la toma un agente | Se presentaron al usuario y se registraron antes de seguir | no medido |
| 2 | El agente de exploración no pudo escribir `exploration.md` | Esa fase corre sin herramienta de escritura | El orquestador copió el contenido desde Engram | no medido |
| 3 | La unidad 3 (catálogo) se commiteó en 494 líneas, sobre el presupuesto de 400 | El pronóstico (~380) no contó el volumen de tests | Antes de publicar se partió en 3a (393) y 3b (114). El registro de intentos de `gentle-ai` había cargado las dos partes a un solo intento (507) y necesitó un reset auditado aprobado por el usuario | no medido |
| 4 | El slice 5a (compuerta de la ruta de prueba) quedó en 413 líneas | 401 de código y tests más 12 de casillas en `tasks.md` | El usuario aceptó `size:exception` y un segundo reset auditado del registro de intentos | no medido |
| 5 | La spec de mapeo decía que la vista entra "sin modificar", pero el código aplica `sanearSql` una vez | Redacción de la spec más estricta que el diseño ("Piece sanitizing") | Se corrigió la redacción de la spec (`dc10011`); el código no cambió | no medido |
| 6 | Aparecieron archivos vacíos sin trackear en la raíz (`d.nombre))`, `cerrar(false))`, `404`) | Comandos de shell con paréntesis o redirecciones sin comillas | Quedaron fuera de los commits; pendiente de borrar | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| Sin excepción para campos personales | DEC-72 | Ninguna plantilla puede usar domicilio, teléfono ni correo hasta que se decida el mecanismo de M5 |
| `reporte-diario` sin consulta canónica | DEC-69 | Queda para el catálogo inicial (D3/CH-21) |
| `toleranciaFrescuraMinutos` sin efecto | DEC-66 | Se aplica recién con F1/F2 (CH-24) |
| Una plantilla puede leer tablas nativas del cliente | DEC-63 | Si el SQL nombra una tabla real que no es una vista declarada, la lee sin aviso. Con el prefijo `v_` (DEC-70), olvidar declarar una entidad sí falla: `200 fallo`, `42P01` |
| Una plantilla puede definir su propio `v_x` | DEC-70 | Un `WITH v_x` interno tapa la vista validada del mismo nombre |
| Cambios de esquema o de contrato después de validar | DEC-40 | No se detectan; la validación es un resultado guardado |
| Escritura del catálogo sin autorización | — | Igual que el resto de la API hoy |

## Cambios a especificaciones existentes

- **domain-data-model**: se reemplazó el requisito que prohibía una tabla `Plantilla`.
- **tenant-isolation**: se agregó la exención exacta de las cuatro rutas del catálogo; la ruta de prueba no está exenta.
- **canonical-contract**: se agregó que `AUTOMATIZACIONES` es la fuente de `Plantilla.automatizacion` (cierra DEC-22).
- **tenant-schema-mapping**: se agregó que el SQL registrado se reutiliza como cuerpo de un CTE, normalizado una vez por `sanearSql`.
- **query-parameters**: se agregó la plantilla como tercera fuente de declaración de parámetros.
- **automation-templates**: spec nueva.

## Verificación

**PASS WITH WARNINGS**: 471/471 tests (406 antes de CH-12, 65 nuevos), `tsc` sin errores, `prisma validate` válido, 17/17 requisitos y 26/26 escenarios con tests, las 7 reglas de AGENTS.md sostenidas, 0 críticos.

- **WARNING-1** (deuda aceptada): el escenario "Value has no effect on test execution" de `toleranciaFrescuraMinutos` no tiene un test de ejecución propio. Hoy está garantizado porque la ruta de prueba no lee el campo. Test barato para un change futuro: dos plantillas que difieran solo en ese campo, mismo veredicto.
- **WARNING-2**: la redacción "sin modificar" de la spec de mapeo; corregida en `dc10011`.

Comportamientos aceptados en la verificación: lista `rechazados` opcional en los 400; listado ordenado por `nombre` y después `id` (`Plantilla` no tiene marcas de fecha); `PUT` con cuerpo inválido a un id inexistente devuelve 400 antes que 404; `parametros` guardados corruptos devuelven 400; la rama `destino === null` (fila borrada entre controles) no tiene test.

## Pendientes fuera de CH-12

- `AGENTS.md` sigue listando D-4 y D-5 como compuertas abiertas; en `docs/01-decisiones.md` están cerradas (DEC-25, DEC-26) y la abierta es D-6. No se editó `AGENTS.md`.
- Ramas `ch12/*` sin publicar; los PRs encadenados quedan para cuando se decida.

---

**Archivado**: 2026-09-28 — specs sincronizadas, carpeta del change movida a `openspec/changes/archive/2026-09-28-CH-12-automation-templates/`.
