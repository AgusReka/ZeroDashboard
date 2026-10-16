# Auditoría del 2026-10-13 (TODO-ZD-13-10)

**Cerrada el 2026-10-16:** todas las fases están hechas; ver §9. Respuesta a `docs/TODO-ZD-13-10.md`. Es una auditoría: no se cambió código. Cada afirmación lleva una marca:

- **(H)** hecho verificado en el código, la base o los documentos.
- **(Hi)** hipótesis.
- **(D)** decisión pendiente.

Las observaciones de partida son las que el propio TODO resume en §5 y §6. El archivo no trae una lista aparte de observaciones de la interfaz.

## 1. Estado del proyecto

- **(H)** La rama es `master` en `4ba1f47`. CH-30d está mergeado (#166, #167 y #168) y archivado en `openspec/changes/archive/2026-10-13-CH-30d-mapeo-plantillas-contrato/`.
- **(H)** Quedan sin commitear los archivos de `.atl/` (registro de skills), este documento, el TODO y `docs/design/ZeroDashboard Design System.zip`.
- **(H)** El último cambio visual es CH-30d: pantallas de Mapeo y validación, Plantillas y Contrato. Le preceden CH-30a, CH-30b y CH-30c (esqueleto, Tenants y Conexiones, Agentes y Usuarios) y CH-21a (sistema visual).
- **(H)** No hay cambios funcionales posteriores a CH-30d. El último cambio de backend es CH-20 (auditoría de ejecución).
- **(H)** CH-30d se verificó con `tsc` limpio, build ok y 1297 de 1301 tests. Los 4 que fallan son los falsos positivos conocidos de `conexiones`.

## 2. Matriz de reconciliación

| # | Observación | Estado actual | Evidencia | Artefactos | Decisión propuesta |
|---|---|---|---|---|---|
| 1 | `409 credencial-ilegible` al probar una conexión | **(H)** Vigente, causa confirmada (§3.1) | `cripto-credencial.ts:135-160`, `conexion-destino.ts:62`, `conexiones.ts:264-272` | DEC-20, CH-07 | Corrección de datos, no de código (§5, F0) |
| 2 | Mismo 409 al validar el mapeo | **(H)** Misma causa que el #1 | `validacion-mapeo-rutas.ts:83-86`, que llama a `destinoDeConexion` | CH-30d (W2) | Igual que el #1 |
| 3 | Cargar una consulta y guardarla duplica | **(H)** Vigente: «Guardar consulta» siempre hace `POST` | `guardar()` en `consola.ts:1460` no mira `consultaCargada`; «Guardar como nueva versión» (`:2585`) sí hace `PUT` | spec `query-console` "Saving the Current Statement" (solo dice que crea) | CH-32a (§5, F1) |
| 4 | Elegir una conexión antes de consultar | **(H)** La conexión se escribe como UUID a mano | `#conexion` en `consola.ts:423-424`; `GET /conexiones` existe y la pantalla no la usa | DEC-11 (la consulta guardada no se ata a una conexión), guía C-08 | CH-32a: un selector sin atar la consulta a la conexión |
| 5 | Crear una consulta desde una plantilla, sin tocar la plantilla original | **(H)** No existe ese flujo | `consultas*.ts` no referencia plantillas; la pantalla Plantillas es de solo lectura | DEC-61, DEC-130 | **(D)** Ver §3.2: el SQL de una plantilla no corre suelto |
| 6 | Diferencia entre plantilla y consulta guardada | **(H)** Son dos mecanismos distintos | `Plantilla` es global, ligada al contrato y se ejecuta componiendo vistas `v_*`; `ConsultaGuardada` es SQL crudo del tenant | DEC-11, DEC-61 | Explicarla en la interfaz y en la documentación (F4) |
| 7 | Flujo de automatizaciones | **(H)** Plantilla + conexión + valores; cron; envía un correo si hay filas | `planificador.ts`, `automatizaciones.ts`, DEC-76, DEC-84 | spec de automatizaciones | Documentar (F4); ninguna acción nueva sin diseño |
| 8 | Editar automatizaciones | **(H)** La consola no edita; el panel del cliente sí ajusta umbral, horario y destinatario | DEC-78, DEC-79, DEC-82; CH-23 `PUT /api/panel/automatizaciones/:id/ajustes` | — | **(D)** Inconsistencia entre la consola y el panel |
| 9 | Crear tenants y usuarios con formularios claros | **(H)** Formularios en línea sobre la tabla; Conexiones ya usa un panel lateral | `consola.ts:309-313`, controles de Tenants; `zd-drawer` en `:251-268` | guía de diseño (crear y detallar en `.zd-drawer`) | CH-32b (F2) |
| 10 | Tenant activo explícito y protección de operaciones sensibles | **(H)** Barra fija con el tenant, cabecera `X-Tenant-Id`, aislamiento en Prisma. La confirmación es solo en el cliente, y «Reponer clave» no confirma | `consola.ts:158-168`, `:1076-1086`; `aislamiento-prisma.ts`; `contexto-tenant.ts:211-260` | DEC-15, DEC-152, DEC-168 | CH-32b: confirmar nombrando el objeto. El backend ya aísla (§3.4) |
| 11 | Un tenant recién creado no queda elegido | **(H)** La creación no lo selecciona | Pantalla Tenants | spec "Tenants Screen" | CH-32b, opción «Crear y elegir» |
| 12 | Automatizaciones con IDs y cron en crudo | **(H)** La tabla muestra `conexionId` y la expresión cron | `consola.ts:2013-2020` | — | CH-32b |
| 13 | Agentes y funciones futuras | **(H)** CH-19d1, CH-19d2 y CH-19e pendientes; el latido no hace nada | `agente-servidor.ts:84` | CH-19 (paraguas) | Siguen como trabajo futuro |
| 14 | Documentación funcional y técnica | **(H)** `README.md` desactualizado (dice R0, consola sin login); no hay guía de administración ni de diagnóstico | §7 | — | F4 |

## 3. Diagnóstico técnico

### 3.1 Conexiones y mapeo: `409 credencial-ilegible`

- **(H) Causa confirmada.** Las conexiones de Food Store (`food-store`, `food-store-lector`, `food-store-lector-v2` y `food-store-postgres-v2`, creadas el 2026-09-17) son anteriores a CH-07 y guardan la contraseña **en texto plano**. Las demás filas que fallan son fixtures `Replica` de los tests, con la credencial `x`.
- **(H)** `descifrarCredencial` rechaza todo valor que no sea `v1:iv:tag:ct`. Las dos rutas pasan por `destinoDeConexion`, así que es una sola causa para los dos síntomas.
- **(H)** Se descartaron tres hipótesis:
  - **Clave maestra distinta.** El contenedor `app` tiene `CREDENTIAL_MASTER_KEY` de 32 bytes, y con esa clave se descifran las filas `v1` (los smoke de CH-03).
  - **Versión de sobre incorrecta.** Solo existe la versión `v1`.
  - **Alta defectuosa desde la consola.** `POST /conexiones` cifra la credencial.
- **(H)** DEC-20 decidió no migrar esas filas ("datos de desarrollo, re-registrarlas"), y nunca se re-registraron.
- **(Hi)** El usuario elige una de las filas de Food Store. No se verificó qué id envía la consola en su caso.
- **Prueba necesaria:** re-registrar una conexión de Food Store desde la consola y repetir «Probar» y «Validar».

### 3.2 Consultas y plantillas

- **(H) Consulta guardada.** Es SQL del tenant, sin conexión (DEC-11). Tiene parámetros declarados, versiones (CH-25) y permite nombres repetidos. No se puede borrar.
- **(H) Plantilla.** Es global (DEC-61) y su SQL se escribe contra las vistas canónicas `v_<entidad>`. Solo se ejecuta componiendo `WITH v_<entidad> AS (...)` con las vistas de una conexión (`componerSentencia`, `plantillas.ts`). Hoy el catálogo tiene dos: `stock-fisico` y `stock-producible`.
- **(H) Duplicado.** Con una consulta cargada, «Guardar consulta» crea otra fila en la versión 1.
- **(Hi)** «Usar plantilla como consulta» no puede limitarse a copiar el SQL al editor: fallaría, porque las vistas `v_*` no existen en la réplica. Hay dos caminos:
  - **Copiar la sentencia ya compuesta.** Es SQL largo, que queda atado al mapeo del momento.
  - **Crear un tercer tipo de consulta, «consulta sobre vistas canónicas».** Es un cambio de modelo.
- **(D)** Elegir uno de esos dos caminos, o dejarlo como trabajo futuro.
- **(H)** La plantilla original nunca se modifica desde la consola, porque la pantalla es de solo lectura.

### 3.3 Automatizaciones

- **(H) Disparo.** Un tick por minuto ejecuta, una por una, las automatizaciones activas de cada tenant activo. Usa cron de 5 campos en la zona global (DEC-76, DEC-77) y no recupera disparos perdidos (DEC-95).
- **(H) Fuente.** Siempre es una plantilla, más una conexión y los valores de sus parámetros. Nunca una consulta guardada. Los dos mecanismos solo comparten la validación de parámetros.
- **(H) Condición.** La única es «cero filas, no se envía». El umbral es un parámetro dentro del SQL (DEC-84).
- **(H) Acción.** Un correo HTML a un solo destinatario, por SMTP. Los resultados posibles son `enviada`, `omitida-sin-filas`, `sin-destinatario`, `no-configurada`, `fallo-envio`, `enviando` e `incierta`. Las filas no se guardan (DEC-93).
- **(H) Frescura (CH-24).** Solo se informa; no bloquea la ejecución.
- **(D)** Otras acciones (varios destinatarios, otros formatos, condiciones explícitas) y la edición desde la consola no tienen definición funcional. Quedan como trabajo futuro hasta que se diseñen con criterios de aceptación.

### 3.4 Tenants y permisos

- **(H)** Hay dos superficies y ninguna tiene roles internos (DEC-04).
  - **Operador:** global, se da de alta por CLI (DEC-153).
  - **Usuario de panel:** un tenant, solo `/api/panel/*`.
- **(H) Aislamiento en el backend:**
  - Guarda de operador primero; sin la cookie de sesión responde 401.
  - El tenant sale de `X-Tenant-Id`. Un `tenantId` en el cuerpo se rechaza por esquema.
  - La extensión de Prisma inyecta el tenant y falla cerrada.
  - En el panel, el tenant sale solo de la sesión.
- **(H)** El operador puede actuar sobre cualquier tenant cambiando la cabecera. Es así por diseño (DEC-15): el operador es global. No es una fuga, pero la única protección contra el error humano es el indicador visual.
- **(H)** La baja de un tenant es irreversible: no hay ruta de reactivación. Hoy la confirma un segundo clic en línea con el nombre, solo en el cliente.
- **(D)** Si la baja debe pedir que se escriba el nombre del tenant.
- **No se encontró ningún riesgo de seguridad que exija una intervención inmediata.**

## 4. Conflictos y riesgos

1. **(H) Contraseñas en texto plano en la base de desarrollo.** Las filas de Food Store contradicen la regla 7 y CH-07. Durante esta auditoría, un relevamiento imprimió dos de esas contraseñas de desarrollo en la transcripción de la sesión. Hay que considerarlas expuestas y rotarlas si se usan en otro lado.
2. **(H) Re-registrar puede dejar huérfanos.** Antes de borrar las filas viejas de Food Store hay que mover o recrear sus `VistaCanonica` y `Automatizacion`.
3. **(H) Fixtures de tests en la base de desarrollo.** Hay 15 conexiones `Replica` de los tenants `CH-22b …`. Los tests comparten la base con el uso manual. Es ruido, no un error, pero confunde al probar a mano.
4. **(H) CH-22b sin archivar y con el spec desfasado.** Sus deltas no se sincronizaron; CH-22c y CH-23 ya escribieron encima de `client-panel-automations`. Sincronizar sin cuidado pisaría requisitos posteriores (ver §6).
5. **(H) Inconsistencia de edición.** El panel edita automatizaciones (CH-23) y la consola no (DEC-79). Unificarlo toca decisiones vigentes.
6. **(Hi) Regresiones visuales.** Pasar formularios a paneles laterales cambia ids que custodia el guard G3' de `consola.test.ts`. Hay que mantener los ids y registrar los nuevos en `IDS`.

## 5. Plan de implementación

Las fases van por dependencia y prioridad. Ninguna empieza sin aprobación.

**F0. Datos (operativo, sin código).** Re-registrar las conexiones de Food Store desde la consola, recrear su mapeo y sus automatizaciones, y después dar de baja o borrar las filas viejas (camino de DEC-20).
- Alternativa: un script que cifre en el lugar y conserve los ids. Requiere una decisión nueva, porque revierte DEC-20.
- *Aceptación:* «Probar» y «Validar» responden sin 409 sobre la conexión nueva.
- **Hecho el 2026-10-13, con autorización del usuario.** Respaldo previo con `pg_dump`. En una sola transacción:
  - se borraron los 22 tenants de prueba (`CH-06 smoke …`, `CH-22b …` y `Prueba`) con todo su contenido, y las 3 plantillas `CH-22b … plantilla interna`;
  - en Food Store se borraron las 5 consultas guardadas de prueba y 3 conexiones. Dos apuntaban a la base `team_hero_db`, que ya no existe. Se fueron con ellas el mapeo y la automatización que colgaban de la muerta.
- **Qué quedó:** `food-store-lector-v2` (usuario de solo lectura, base `food_store`), cifrada en el lugar con `cifrarCredencial`; descifra y conecta. El mapeo de esa conexión hay que hacerlo desde la consola.
- Los tests comparten esta base y la van a volver a poblar.

**F1. CH-32a: Consultas sin duplicados y con conexión elegida (solo front).**
- Selector de conexión desde `GET /conexiones`, sin atar la consulta a la conexión (DEC-11 se mantiene).
- Con una consulta cargada, la acción principal es «Guardar como nueva versión». «Guardar consulta» pasa a llamarse «Guardar como consulta nueva» y explica que crea otra.
- Una acción «Consulta nueva» que limpia el editor.
- Actualiza "Saving the Current Statement" en el spec `query-console`.
- *Aceptación:* tests RED/GREEN en `consola.test.ts`; cargar y guardar no genera un `POST`; la conexión se elige de una lista.

**F2. CH-32b: Altas y contexto (solo front).**
- «Nuevo tenant» y «Nuevo usuario» en un `.zd-drawer`, como «Nueva conexión».
- Opción de elegir el tenant recién creado.
- Confirmación de «Reponer clave».
- Automatizaciones con el nombre de la conexión y el horario en palabras.
- *Aceptación:* tests de las pantallas, los ids custodiados intactos y una pasada visual a 360 px y 1280 px.

**F3. Decisiones de producto, antes de cualquier código:**
- Plantilla → consulta (§3.2).
- Edición de automatizaciones en la consola (§4.5). **Decidido el 2026-10-14 (DEC-174):** la consola ajusta en el lugar valores, horario y destinatario, igual que el panel.
- Confirmación escrita de la baja de un tenant. **Decidido el 2026-10-14 (DEC-175):** el operador escribe el nombre en la consola, y la ruta también lo exige.
- Pantallas de CH-30e: Auditoría tiene ruta; Tiempos de alta no tiene ruta, solo `scripts/marcas-alta.sql`.

**F4. Documentación (§7).** Va después de F1 y F2, para documentar lo que ya existe.

## 6. Plan de cierre SDD

| Elemento | Clasificación | Acción |
|---|---|---|
| CH-30d | Completado | Archivado hoy |
| CH-22b | Completado, sin archivar | Verificar, revisar a mano (3.10) y sincronizar **solo** lo que CH-22c y CH-23 no reemplazaron. Archivar en un PR propio |
| CH-16b, CH-16c, CH-16d | Experimentos completados; no son changes SDD | Dejar como están, porque DEC-28/29/37/38 los citan. **(D)** Si se quieren mover a otra carpeta |
| CH-19 (paraguas) | Pendiente: faltan CH-19d1, CH-19d2 y CH-19e | Mantener abierto |
| CH-30 (paraguas) | Pendiente: falta CH-30e | Mantener abierto hasta decidir CH-30e |
| CH-26, CH-27 | Pendiente / fuera de alcance (DEC-93) | Sin cambios |

No se crea ningún change nuevo hasta aprobar este plan. CH-32a y CH-32b serían cortes nuevos, porque ningún change abierto cubre consultas ni altas.

## 7. Documentación propuesta

- **(H) Lo que hay:** `docs/00-contexto.md`, las DEC, el mapa de changes, 29 specs y bitácoras solo hasta CH-18.
- **Lo que falta:** un README vigente, una guía de administración y una de diagnóstico.

Propuesta en `docs/guia/`, siempre sobre funciones verificadas:

1. `01-arquitectura.md`: conceptos (tenant, conexión, agente, contrato, vista canónica, plantilla, consulta guardada, automatización, operador y usuario de panel) y el flujo de los datos.
2. `02-alta-de-tenant-y-conexion.md`: con conexión directa o por agente.
3. `03-mapeo-y-validacion.md`: un SQL por entidad, estados y sugerencias de cast.
4. `04-consultas.md`: parámetros, versiones, y la diferencia entre plantilla y consulta guardada.
5. `05-plantillas.md`: catálogo global, solo lectura en la consola.
6. `06-automatizaciones.md`: disparo, fuente, condición, correo, ejecuciones y frescura.
7. `07-usuarios-y-permisos.md`: operador por CLI, usuarios de panel y secretos que se muestran una sola vez.
8. `08-diagnostico.md`: catálogo de errores (`credencial-ilegible`, `tenant-desactivado`, `sin-cambios`, etc.) con su causa y qué hacer.

Además, actualizar `README.md` para que apunte a `docs/guia/`.

## 8. Siguiente paso recomendado

1. F0: re-registrar las conexiones de Food Store. Destraba las pruebas manuales de todo lo demás.
2. Cerrar CH-22b, que es deuda SDD con riesgo de pisar specs posteriores.
3. CH-32a, que corrige el único defecto funcional confirmado del lado de la interfaz (el duplicado al guardar).

## 9. Cierre (2026-10-16)

| Fase o punto | Resolución |
|---|---|
| F0, datos | Hecho el 2026-10-13 (§5). |
| F1 | CH-32a, archivado. |
| F2 | CH-32b, archivado. |
| F3, plantilla → consulta | DEC-177, CH-35, archivado. |
| F3, edición de automatizaciones y baja escrita | DEC-174 y DEC-175, CH-33, archivado. |
| F3, Tiempos de alta | DEC-178: `GET /tiempos-alta` y su pantalla, CH-30e2, archivado. Las filas de §2 y §5 que dicen que no tiene ruta quedaron viejas. |
| F4, documentación | `docs/guia/` (ocho guías) y `README.md` reescrito. |
| §6, CH-22b | Archivado. |
| §6, CH-16b a CH-16d | Movidos a `openspec/changes/archive/`. |
| §6, CH-19 y fila 13 de §2 | DEC-179: CH-19d1, CH-19d2 y CH-19e son trabajo a futuro; el paraguas está archivado. |
| §6, CH-30 | Cerrado con CH-30e2. |
