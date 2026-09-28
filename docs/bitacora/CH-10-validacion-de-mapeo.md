# Bitácora — CH-10: Validación de mapeo

**Fecha de inicio:** 2026-09-26 (exploración, propuesta, specs y diseño)
**Fecha de cierre:** 2026-09-27 — implementado en seis ramas encadenadas, verificado y archivado
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive). El commit de planificación es de las 14:03 del 27; los seis commits de implementación caen entre las 14:07 y las 14:25; el de verificación, a las 14:36. Las fases de planificación corrieron desde la noche del 26. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones.

> Se escribe al cierre (2026-09-27), apoyada en los artefactos archivados (`openspec/changes/archive/2026-09-27-CH-10-mapping-validation/`), en los mensajes de commit y en DEC-39 a DEC-46. No reconstruida de memoria.

---

## Qué se construyó

M3 pedía validar el mapeo de un tenant antes de activar automatizaciones, con falla ruidosa ante columnas o tipos faltantes. M4 pedía la lista explícita de automatizaciones inaplicables con su motivo. Antes de este change, CH-09 guardaba el SQL de cada vista canónica como texto inerte: nada comprobaba que la vista expusiera las columnas del contrato, y el contrato no declaraba ningún tipo contra el cual comparar.

- **Tipo semántico por campo** (`src/contrato.ts`, DEC-39): `texto`, `numero`, `booleano`, `fecha` o `identificador`. `GET /contrato` lo proyecta.
- **Acción de validación** (`POST /conexiones/:id/validacion-mapeo`, DEC-40, DEC-42): abre la conexión del tenant una vez, dentro de una transacción de solo lectura y después del control de permisos de DEC-08, y sondea cada entidad mapeada con `SELECT * FROM (<sql>) AS _validacion LIMIT 0`, aislada por `SAVEPOINT`. Solo lee los metadatos de columnas (nombre y OID), nunca filas.
- **Diagnóstico por campo:** columna ausente, tipo incorrecto, alias sin comillas (Postgres pasa a minúsculas `stockDisponible`), columna duplicada; columnas que el contrato no define (DEC-43); tipos sin categoría con una pista de cast (DEC-45).
- **Resultado persistido** en tres columnas nuevas de `VistaCanonica` (DEC-44). Si falla la conexión o el control de permisos, no se guarda nada. La escritura se condiciona al SQL sondeado, para que un re-registro concurrente no reciba un veredicto viejo.
- **Lectura sin conexión** (`GET` en la misma ruta): arma el informe desde lo guardado. Por automatización: `inaplicable`, `bloqueada`, `pendiente` o `aplicable`, con todos los motivos (DEC-46).
- **Re-registro:** reemplazar el SQL de una entidad deja su validación en `no-validado` en la misma escritura (DEC-41).

## Decisiones tomadas

DEC-39 a DEC-46 (`docs/01-decisiones.md`), todas decididas por el usuario. Se presentaron en tres rondas: exploración (DEC-39 a DEC-42), propuesta (categoría `identificador` en DEC-39, DEC-43, DEC-44) y diseño (`pedido.numero` en DEC-39, DEC-45, DEC-46). Las alternativas y los motivos de cada una están en ese archivo; no se repiten acá.

| Decisión | Qué fija |
|---|---|
| DEC-39 | Tipo semántico por campo; `identificador` acepta enteros, `uuid` y texto; incluye `pedido.numero` |
| DEC-40 | Validar es una acción explícita y el resultado se persiste |
| DEC-41 | Re-registrar el SQL invalida la validación guardada |
| DEC-42 | Validación solo estructural (`LIMIT 0`) |
| DEC-43 | Columnas fuera del contrato hacen fallar la validación |
| DEC-44 | Resultado en columnas de `VistaCanonica`, solo el último |
| DEC-45 | Tipos sin categoría (enums, arrays, `json`, `money`) fallan con pista de cast |
| DEC-46 | Inaplicable y bloqueada a la vez se informa como inaplicable, con todos los motivos |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | El contrato no tenía ningún eje de tipo | CH-08 modeló obligatoriedad y automatizaciones, no tipos | DEC-39 | no medido |
| 2 | Tres rondas de preguntas abiertas frenaron la cadena automática (exploración, propuesta, diseño) | AGENTS.md: ninguna decisión de arquitectura la toma un agente | Cada ronda se le presentó al usuario y se registró antes de seguir | no medido |
| 3 | El diseño no definía el esquema del cuerpo del `POST`; un `tenantId` en el cuerpo se habría ignorado en lugar de rechazarse | Omisión del diseño | Lo detectó la validación independiente del diseño, antes de las tareas; se agregó un esquema que rechaza cualquier propiedad | no medido |
| 4 | `npm test -- <archivo>` corre la suite entera | El script usa un glob (`src/**/*.test.ts`) que siempre se expande | Para correr un archivo: `npx tsx --test <archivo>` | no medido |
| 5 | Con el puerto por defecto (5432) las suites vivas fallan por autenticación en lugar de saltearse | En esta máquina el 5432 es la base de Saleor: el chequeo de alcance pasa y el login falla | Se corrió con `TEST_DB_PORT=5434` contra el contenedor de pruebas del proyecto (`zd-ch09-testdb`) | no medido |
| 6 | El registro de intentos de SDD quedó bloqueado después del apply | El orquestador fijó un tope de 2000 líneas; el apply cambió 2505 | El usuario autorizó el reset del objetivo para correr la verificación | no medido |
| 7 | Las unidades 3 (~884 líneas) y 4a (~763) superan el tope de 400 líneas por PR | Lógica de validación y rutas con muchos casos | La unidad 4 se partió en 4a y 4b; la 3 queda para partir o marcar `size:exception` al abrir los PRs | no medido |
| 8 | Aparecieron archivos vacíos en el repositorio (`0)`, `e.nombre)\``, `e.entidad`) | Redirecciones de shell accidentales de los agentes | Se borraron; uno había entrado al commit de planificación y se corrigió antes de seguir | no medido |
| 9 | El agente de archivo devolvió tres requisitos a sus títulos viejos para que la herramienta de composición los encontrara | La convención de OpenSpec pide un bloque `RENAMED` para renombres | Se restauraron los deltas verificados, se agregó `RENAMED` y se corrigieron los títulos en las specs principales | no medido |

## Verificación

`sdd-verify`: PASS WITH WARNINGS — 0 críticos, 2 advertencias, 3 sugerencias. 27/27 escenarios de las specs con prueba que pasa.

| Comando | Resultado |
|---|---|
| `npm test` (con `TEST_DB_PORT=5434`) | 328/328, 41 suites, 0 fallas, 0 salteadas |
| `npx tsc --noEmit` | limpio |
| `npx prisma validate` | válido |

Advertencias: el diseño no listaba los campos `tipoObservado` y `pista` del diagnóstico (corregido en 4217d8d); las unidades 3 y 4a superan el tope de 400 líneas por PR.

La prueba de cero filas usa una vista con `1/(id-id)`: si el sondeo evaluara alguna fila fallaría por división por cero, así que un veredicto `valida` prueba que no se leyó ninguna.

## Consultas ejecutadas

Ninguna consulta de dominio. El único SQL que se ejecuta contra el tenant es el sondeo `LIMIT 0` de cada vista registrada, que no lee filas.

## Notas para la tesis

- **Límite del artefacto (DEC-42):** una vista con columnas y tipos correctos pero valores `NULL` en un campo obligatorio pasa la validación. Es el caso que DEC-36 dejó abierto para `producto.activo`.
- **Límite del artefacto:** los identificadores que se referencian entre entidades no se comparan entre sí (por ejemplo, un `producto.id` entero contra un `item_pedido.productoId` `uuid`); el sondeo es por entidad.
- **DEC-45 en Medusa:** `order.status` es un enum; su vista canónica tiene que castearlo a texto para pasar la validación.

## Lo que esta entrada NO sostiene

- Ningún dato de tiempo de trabajo: las marcas de commit acotan la implementación, no el ciclo completo.
- Ninguna validación contra las vistas reales de Food Store, Medusa o Saleor: las pruebas usan vistas de fixture sobre la base de pruebas del proyecto.
