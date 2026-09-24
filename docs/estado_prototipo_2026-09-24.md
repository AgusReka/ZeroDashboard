# Estado del prototipo — 2026-09-24 (fecha de congelamiento)

Relevamiento hecho para el Capítulo 5 de la tesis. Es solo lectura: para escribirlo no se modificó ningún archivo del repositorio salvo este.

**Fuentes:** `docs/02-mapa-de-changes.md`, `docs/mapa-historias.md`, `docs/00-contexto.md`, `docs/01-decisiones.md`, `openspec/changes/` (incluido `archive/`), `docs/bitacora/`, `prisma/schema.prisma`, `src/` y el historial de git.

**Estado de git a la fecha:**

- Rama única `master`, sincronizada con `origin/master` en `336cff0` (2026-09-23). Tiene 28 commits.
- No hay ramas de feature ni pull requests: todos los changes se commitearon directamente en `master`. En este documento, "mergeado" significa "commiteado en `master` y publicado en `origin`".
- El árbol de trabajo tiene cambios **sin commitear**:
  - DEC-36: `src/contrato.ts`, `src/contrato.test.ts`, `src/contrato-rutas.test.ts`, `docs/bitacora/bitacora_DEC-36.md`.
  - Corrección de la spec `openspec/specs/canonical-contract/spec.md`.
  - Corrección de DEC-02 en `docs/01-decisiones.md`.
  - El directorio `docs/saleor_kit/`, sin seguimiento en git.

---

## 1. Changes

### 1.1 Implementados y mergeados

Cada uno tiene su carpeta en `openspec/changes/archive/` con `verify-report.md` y `archive-report.md`, y su entrada en `docs/bitacora/`.

| ID | Objetivo | Release | Commits | Veredicto de verificación |
|---|---|---|---|---|
| CH-01 | Esqueleto de aplicación y entorno: Docker Compose, base propia, migraciones, configuración por variables de entorno | R0 | `1f9fbcb`, `0c9123a` (2026-09-15) | pass |
| CH-02 | Modelo de datos inicial: `Tenant`, `Conexion`, `ConsultaGuardada` | R0 | `10a3049`, `221edb7` (2026-09-15) | pass |
| CH-03 | Registro de conexiones a la réplica y prueba con resultado visible | R0 | `6425260` (2026-09-16) | pass |
| CH-04 | Ejecución de consultas de solo lectura con tabla paginada y error legible, y consola web mínima | R0 | `01f9041` (2026-09-16) | pass_with_warnings |
| CH-05 | Consultas guardadas con nombre y descripción, persistidas en la base propia | R0 | `75990ad` (2026-09-16) | pass with warnings |
| CH-06 | Tenants (alta, baja lógica, listado) y aislamiento entre tenants con prueba automatizada | R1 | `5be9714` (2026-09-17) | pass_with_warnings |
| CH-07 | Cifrado de credenciales en reposo con clave maestra fuera de la base; timeout y tope de filas | R1 | `47736b9` … `47e493f` (2026-09-17/18) | pass_with_warnings |
| CH-08 | Contrato canónico estático y ruta de lectura `GET /contrato` | R1 | `8571ce1` … `a047bbb` (2026-09-18), bitácora `8c520cc` (2026-09-23) | pass_with_warnings |

Con esto, R0 está completo. En R1 están implementados CH-06, CH-07 y CH-08.

### 1.2 En curso

| ID | Objetivo | Estado |
|---|---|---|
| CH-09 | Mapeo de esquema por tenant (M2): registrar, por conexión y por entidad canónica, el SQL de la vista canónica escrito por la operadora (DEC-30 a DEC-35) | En `openspec/changes/CH-09-tenant-schema-mapping/` (sin archivar). Tiene exploración, propuesta, spec, diseño y tareas. En `tasks.md` hay 18 tareas hechas y 8 pendientes. Hechas: fase 1 (modelo `VistaCanonica`, migración `20260923000000_vista_canonica`, registro en el aislamiento) y fase 2 (rutas, commit `336cff0`). Pendientes: fase 3 (extensión del barrido de aislamiento T2 a las rutas nuevas) y fase 4 (verificaciones y suite completa). No tiene `verify-report.md`. |

**Posible conflicto a resolver antes de cerrar CH-09:**

- La tarea 4.1 exige que `src/contrato.ts` quede byte por byte idéntico a su estado previo a CH-09.
- DEC-36 modificó ese archivo el 2026-09-24. El cambio todavía no está commiteado.
- Si esa tarea se aplica tal como está escrita, va a fallar. Hay que decidir si DEC-36 queda como excepción documentada o si se ajusta la tarea.

### 1.3 Experimentos ejecutados fuera de la aplicación

No son changes de código. Se listan aparte porque producen evidencia para la tesis pero no forman parte del prototipo.

| ID | Objetivo | Estado |
|---|---|---|
| CH-16 | Mapeo del segundo esquema (Medusa): experimento de genericidad | Bitácora `docs/bitacora/CH-16-mapeo-del-segundo-esquema.md`, que registra el cierre del experimento el 2026-09-19. Se escribieron cinco vistas canónicas contra una Medusa real. **El paso 4 (correr las consultas del catálogo) quedó omitido** porque esas consultas todavía no existían. No tiene carpeta en `openspec/changes/`. En el mapa de changes figura como el último de R1: se ejecutó antes que CH-09 a CH-15, de los que depende. |
| CH-16b | Vistas canónicas sobre tres esquemas (Food Store, Medusa y WooCommerce) y equivalencia de `stock-producible` | **No figura en `docs/02-mapa-de-changes.md`.** Solo existen archivos SQL (`openspec/changes/CH-16b-vistas-canonicas/sql/`) y la bitácora `bitacora_CH-16b_tres_esquemas.md`. No tiene propuesta, spec ni tareas. Commits `fc54f19` (2026-09-21) y `c6ef5a0` (2026-09-23). Food Store y Medusa corrieron contra bases reales. WooCommerce corrió **solo contra un fixture**, con datos inventados. |

### 1.4 No iniciados

| ID | Objetivo | Release |
|---|---|---|
| CH-10 | Validación de mapeo: falla ruidosa ante columnas o tipos faltantes; lista de automatizaciones inaplicables | R1 |
| CH-11 | Parámetros en consultas, por parámetros del driver | R1 |
| CH-12 | Plantillas de automatización: consulta, parámetros, condición, formato y tolerancia de frescura | R1 |
| CH-13 | Motor: planificación y registro de ejecución | R1 |
| CH-14 | Motor: condición y notificación por correo | R1 |
| CH-15 | Instrumentación de tiempos de alta | R1 |
| CH-17 | Motor: solapamientos, reintentos y ejecuciones interrumpidas | R2 |
| CH-18 | Motor: notificaciones duplicadas y aislamiento de fallos entre tenants | R2 |
| CH-19 | Conectividad definitiva según D-2 | R2 |
| CH-20 | Auditoría de ejecución de consultas | R2 |
| CH-21 | Catálogo: instanciación de plantillas y casos iniciales | R2 |
| CH-22 | Panel del cliente: autenticación y vista de automatizaciones | R2 |
| CH-23 | Panel: ajuste de umbrales y horarios | R2 |
| CH-24 | Frescura de datos por tenant y por plantilla | R2 |
| CH-25 | Versionado de consultas guardadas | R3 |
| CH-26 | Advertencia de frescura insuficiente al activar | R3 |
| CH-27 | Visualización de últimos resultados en el panel | R3 |

---

## 2. Historias de usuario cubiertas

La cobertura se asigna según la columna "Historias" del mapa de changes. Solo cuentan los changes implementados y verificados (sección 1.1).

| Historia | Descripción corta | Change |
|---|---|---|
| A1 | Registrar la conexión a la réplica y probarla | CH-03 |
| A2 | Credenciales cifradas en reposo con clave fuera de la base | CH-07 |
| A3 | Solo sentencias de lectura, en dos capas | CH-04 |
| A4 | Límites de tiempo y filas por consulta | CH-07 |
| B1 | Escribir una consulta y ver el resultado | CH-04 |
| B2 | Guardar una consulta con nombre y descripción | CH-05 |
| T1 | Alta, baja lógica y listado de tenants | CH-06 |
| T2 | Toda consulta a la base propia filtrada por tenant, con prueba automatizada de dos tenants | CH-06 |
| T4 | Indicador del tenant activo en la consola | CH-06 |
| M1 | Ver entidades y campos del contrato, con su obligatoriedad y sus automatizaciones | CH-08 |
| M5 | El contrato excluye campos personales | CH-08 |

**Cubiertas parcialmente:**

- **M2** (registrar el mapeo de un tenant): CH-09 en curso. El registro y la lectura ya están commiteados; falta la prueba de aislamiento extendida y la verificación.

**Historias de práctica documental (no se cumplen con código):**

- **G2** (bitácora fechada de fricciones): hay una entrada por cada change implementado y por los experimentos CH-16 y CH-16b, en `docs/bitacora/`.
- **G3** (todo dato citado remite a una consulta y una fecha): las bitácoras de CH-16 y CH-16b transcriben las consultas y la fecha de cada corrida. No se verificó en forma sistemática para todo el material citable.

**No cubiertas:** el resto de las historias de R1 (B3, M3, M4, X1–X3, N1, N2, D1, G1) y todas las de R2 y R3.

---

## 3. ¿Se ejecuta alguna automatización del catálogo dentro del prototipo?

**No.** Ninguna de las tres automatizaciones (`stock-fisico`, `stock-producible`, `reporte-diario`) se ejecuta dentro de la aplicación.

**Qué hay en el prototipo:**

- Las tres automatizaciones existen solo como **etiquetas** en `src/contrato.ts` (constante `AUTOMATIZACIONES`). Esas etiquetas indican qué campos del contrato necesita cada una (DEC-22). No hay código que las ejecute.
- No hay motor. En `src/` no hay planificador ni envío de correo. `prisma/schema.prisma` define solo `Tenant`, `Conexion`, `ConsultaGuardada` y `VistaCanonica`: no existen `Plantilla`, `Automatizacion` ni `Ejecucion`. Eso llega con CH-12, CH-13 y CH-14, que no están iniciados.
- Las vistas canónicas registradas por CH-09 todavía no se componen con ninguna consulta. La composición con `WITH` está asignada a CH-12 (DEC-31).

**Cómo se ejecuta cada automatización hoy, fuera del prototipo:**

- **`stock-producible`** tiene una implementación SQL independiente: `openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql`. Se corrió **a mano con `psql`**, siguiendo `README_correr.md`:
  - Las vistas canónicas (`03_vistas_foodstore.sql`, `06_vistas_medusa.sql`) se crearon directamente en las bases de origen con un superusuario (`postgres`), porque el usuario de lectura del proyecto no tiene permiso `CREATE`.
  - Sobre Food Store real se probó que es equivalente a la consulta original de WF-01c: 6 filas en común, 0 en cada diferencia.
  - Sobre Medusa real devolvió 20 filas.
  - Todo esto está registrado en la bitácora de CH-16b.
- **`stock-fisico`** y **`reporte-diario`** no tienen implementación en el repositorio (DEC-29). Sus versiones previas son los workflows de n8n del estudio previo, que no forman parte de este repositorio.

La consola de CH-04 acepta cualquier consulta de lectura escrita a mano. En principio podría correr el SQL de `04_consulta_canonica.sql` contra una réplica donde esas vistas ya existan. **No hay registro de que se haya hecho**, y no es una ejecución de la automatización: no hay condición, notificación ni registro de ejecución.

---

## 4. Glosario de prefijos y etapas

### 4.1 Prefijos de las historias

Tomados de las secciones 4 y 8 de `docs/mapa-historias.md`.

| Prefijo | Bloque | Alcance | Capítulo de la tesis que alimenta (sección 8) |
|---|---|---|---|
| T | Tenants y aislamiento | Alta de tenants, filtrado por tenant, visión acotada de P2, indicador de tenant activo | Cap. 4 |
| A | Conexiones y credenciales | Registro de conexión, cifrado, solo lectura, límites, auditoría | Cap. 4 |
| C | Conectividad | Llegar a la réplica sin que el cliente exponga su base (depende de D-2) | Cap. 4 |
| B | Consola: consultas | Escribir, guardar, parametrizar y versionar consultas | — (no figura en la sección 8) |
| M | Contrato canónico y mapeo | Contrato, mapeo por tenant, validación, automatizaciones inaplicables, minimización de datos | Cap. 4 y Cap. 7 (contribución principal) |
| X | Motor de ejecución | Planificación, registro, condición, solapamientos, reintentos, duplicados, aislamiento de fallos | Cap. 4 y Cap. 5 |
| N | Notificación y formato | Correo legible, degradación sin datos, formato en la plantilla | Cap. 4 y Cap. 5 |
| D | Catálogo de plantillas | Definir e instanciar plantillas; catálogo inicial | Cap. 5 |
| F | Frescura de datos | Ventana de desactualización por tenant, tolerancia por plantilla, advertencia | Cap. 4 y Cap. 6 |
| P (P1h–P4h) | Panel del cliente | Ver automatizaciones, ajustar umbrales, enterarse de fallos, ver el último resultado | Cap. 5 |
| G | Instrumentación (tesis) | Tiempos de alta, bitácora de fricciones, trazabilidad de datos citados | Cap. 3 y Cap. 6 |

**Personas** (sección 3 del mapa de historias y de `docs/00-contexto.md`):

| ID | Persona | Superficie |
|---|---|---|
| P1 | Implementador | Consola |
| P2 | Administrador de la PYME | Panel |
| P3 | Cliente final | Telegram |
| P4 | Investigador | Registro |

Las historias del bloque P llevan el sufijo `h` (P1h, P2h…). Según la lectura de este relevamiento, el sufijo sirve para distinguirlas de los códigos de persona P1–P4. Los documentos no explican el sufijo.

### 4.2 Etapas R0 a R3

Tomadas de la sección 5 de `docs/mapa-historias.md` y de `docs/02-mapa-de-changes.md`.

| Etapa | Nombre | Historias | Condición |
|---|---|---|---|
| R0 | Consola mínima, local, un cliente | A1, A3, B1, B2, G2, G3 | No depende de ninguna compuerta. Cierra con: conectarse a Food Store, escribir una consulta, guardarla y ejecutarla (CH-01 a CH-05). |
| R1 | Tenants, contrato, motor mínimo y segundo esquema | T1, T2, T4, A2, A4, B3, M1–M5, X1–X3, N1, N2, D1, G1 | Cierra con dos tenants aislados, un esquema ajeno mapeado y validado, y una automatización corriendo sola de punta a punta (CH-06 a CH-16). Es el release que sostiene el capítulo de resultados. |
| R2 | Endurecimiento del motor, catálogo, panel y conectividad | T3, A5, C1–C3, X4–X8, N3, D2, D3, F1, F2, P1h–P3h | Requiere D-1 y D-2 cerradas (CH-17 a CH-24). |
| R3 | Refinamiento | B4, F3, P4h | CH-25 a CH-27. P4h está sujeta a D-1. |

**Situación a la fecha:** R0 está completo. R1 está parcial: están hechos CH-06, CH-07 y CH-08; CH-09 está en curso; CH-16 y CH-16b se ejecutaron como experimentos fuera de la app. **La condición de cierre de R1 no se cumple:** no hay ninguna automatización corriendo sola de punta a punta.

---

## 5. Decisiones registradas en `docs/01-decisiones.md`

La columna "Change de origen" toma el change que nombra la propia entrada. Cuando la entrada no nombra ninguno, se indica.

| N.º | Título | Change de origen | Estado | Decidido por |
|---|---|---|---|---|
| DEC-01 | Acceso por SQL directo, no por API de la plataforma | Ninguno: heredada del trabajo previo con los tres workflows | firme | No registrado (heredada) |
| DEC-02 | Motor de ejecución propio, no n8n | Ninguno: anterior a los changes | firme | No registrado. El punto 1 del "Por qué" se corrigió el 2026-09-24 y el cambio está sin commitear |
| DEC-03 | Arquitectura multi-tenant alojada por el implementador | Ninguno: anterior a los changes | firme, con D-2 pendiente | No registrado |
| DEC-04 | Dos superficies separadas | Ninguno: anterior a los changes | firme | No registrado |
| DEC-05 | Stack tecnológico: Node.js + TypeScript, base propia en PostgreSQL | Previa a CH-01 (cierra D-3) | firme | El autor ("Confirmado por el autor"). No tiene campo "Decidido por" |
| DEC-06 | Entidad `tenant` mínima desde CH-02, no diferida a CH-06 | CH-02 (exploración) | firme | El usuario, 2026-09-15 |
| DEC-07 | Consola web mínima desde CH-04, no diferida | CH-04 (exploración) | firme | El usuario, 2026-09-16 |
| DEC-08 | Verificación activa de permisos de escritura del rol de base del tenant | CH-04 (exploración) | firme | El usuario, 2026-09-16 |
| DEC-09 | Solo lectura por transacción `READ ONLY` y protocolo extendido, sin parser de SQL | CH-04 (exploración) | firme | El usuario, 2026-09-16 |
| DEC-10 | Superficie de consultas guardadas: crear, listar y obtener por ID | CH-05 (exploración) | firme | El usuario, 2026-09-16 |
| DEC-11 | Consulta guardada sin atar a una conexión específica | CH-05 (exploración) | firme | El usuario, 2026-09-16 |
| DEC-12 | Consola web extendida en CH-05 con guardar, listar y cargar | CH-05 (exploración) | firme | El usuario, 2026-09-16 |
| DEC-13 | Aislamiento por extensión de Prisma y contexto de request (AsyncLocalStorage) | CH-06 (exploración) | firme | El usuario, 2026-09-17 |
| DEC-14 | Baja lógica de tenant: congelado por completo | CH-06 (exploración) | firme | El usuario, 2026-09-17 |
| DEC-15 | Tenant activo de la consola: explícito por request, sin sesión de servidor | CH-06 (exploración) | firme | El usuario, 2026-09-17 |
| — | Resoluciones de nivel diseño bajo DEC-13, DEC-14 y DEC-15 (sin número) | CH-06 (diseño) | aplicadas en CH-06 | No registrado. La entrada aclara que no son decisiones nuevas |
| DEC-16 | Cifrado de credenciales: AES-256-GCM con `node:crypto`, IV aleatorio por fila, sobre versionado | CH-07 (exploración) | firme | El usuario, 2026-09-17 |
| DEC-17 | Clave maestra: una por despliegue, desde variable de entorno, fail-closed al arrancar | CH-07 (exploración) | firme, con D-2 pendiente | El usuario, 2026-09-17 |
| DEC-18 | Tope de filas: veredicto propio de la aplicación, distinto de la paginación | CH-07 (exploración) | firme | El usuario, 2026-09-17 |
| DEC-19 | Timeout y tope de filas: configuración global por variable de entorno | CH-07 (exploración) | firme | El usuario, 2026-09-17 |
| DEC-20 | Conexiones registradas antes de CH-07: se tratan como datos de desarrollo y se re-registran | CH-07 (exploración) | firme | El usuario, 2026-09-17 |
| DEC-21 | Contrato canónico: definición estática en código, expuesta por una API de lectura | CH-08 (exploración) | firme | El usuario, 2026-09-18 |
| DEC-22 | Dependencia campo→automatización: etiqueta de texto libre, sin FK a `Plantilla` | CH-08 (exploración) | firme, con reconciliación pendiente en CH-12 | El usuario, 2026-09-18 |
| DEC-23 | Exclusión estructural de campos personales (M5) | CH-08 (exploración) | firme, con el mecanismo de override pendiente en CH-12 | El usuario, 2026-09-18 |
| DEC-24 | `GET /contrato` exenta del header `x-tenant-id` | CH-08 (propuesta) | firme | El usuario, 2026-09-18 |
| DEC-25 | Motores de base admitidos: solo PostgreSQL | Ninguno: cierre de la compuerta D-4, previo a CH-16 | firme (cierra D-4) | El usuario, 2026-09-19 |
| DEC-26 | Segundo esquema para validar genericidad: Medusa | Ninguno: cierre de la compuerta D-5, previo a CH-16 | firme (cierra D-5) | El usuario, 2026-09-19 |
| DEC-27 | `v_producto` mapea a la variante de Medusa, no al producto padre | CH-16 (experimento) | firme | Propuesta por el agente el 2026-09-19; confirmada por el usuario el 2026-09-21 |
| DEC-28 | Las vistas canónicas exponen el stock declarado crudo, no el producible calculado | CH-16b | firme | Propuesta por el agente; confirmada por el usuario el 2026-09-21 |
| DEC-29 | Criterio de obligatoriedad de campos del contrato; `insumo."unidadMedida"` pasa a opcional | CH-16b (verificación del PASO 6) | firme | El usuario, 2026-09-21, por instrucción directa |
| DEC-30 | Mapeo por tenant: vistas canónicas registradas, no generadas | CH-09 (registrada antes de su exploración) | firme | El usuario, 2026-09-23 |
| DEC-31 | Las vistas registradas viven en la base propia y se aplican como `WITH` en cada consulta | CH-09 (exploración) | firme | El usuario, 2026-09-23 |
| DEC-32 | El mapeo se registra por entidad canónica, con el nombre del contrato como clave | CH-09 (exploración) | firme | El usuario, 2026-09-23 |
| DEC-33 | El mapeo se asocia a la `Conexion`, no al `Tenant` | CH-09 (exploración) | firme | El usuario, 2026-09-23 |
| DEC-34 | Registrar de nuevo el mapeo de una entidad reemplaza la definición anterior | CH-09 (propuesta) | firme | El usuario, 2026-09-23 |
| DEC-35 | `VistaCanonica` no suma una clave foránea compuesta por tenant; el aislamiento sigue siendo DEC-13 | CH-09 (diseño) | firme | El usuario, 2026-09-23 |
| DEC-36 | `producto.activo` pasa a obligatorio; `stock-producible` deja de figurar en `producto.stockDisponible` | Ninguno: revisión del contrato de CH-08 contra la consulta de CH-16b (bitácora `bitacora_DEC-36.md`) | firme (sin commitear) | El usuario (autor), 2026-09-24 |

### Compuertas

| ID | Tema | Estado |
|---|---|---|
| D-1 | ¿Se persisten los resultados de las consultas? | abierta |
| D-2 | ¿Cómo llega el motor a la réplica del cliente? | abierta |
| D-3 | Stack tecnológico | cerrada por DEC-05 |
| D-4 | Motores de base admitidos | cerrada por DEC-25 |
| D-5 | Segundo esquema | cerrada por DEC-26 |
| D-6 | Declaración de uso de asistentes de IA | abierta (consultar el reglamento) |

---

## 6. Inconsistencias entre documentos detectadas durante el relevamiento

Se reportan sin corregirlas.

1. **Compuertas abiertas en `AGENTS.md`.** Dice que las compuertas abiertas son D-1, D-2, D-4 y D-5. En `docs/01-decisiones.md`, D-4 y D-5 están cerradas (DEC-25 y DEC-26) y D-6 está abierta. Las abiertas son D-1, D-2 y D-6.
2. **D-3 en `docs/mapa-historias.md`.** Su encabezado ("Cambios respecto de v3", punto 1) dice que "se cierra D-3" con el motor propio. En `docs/01-decisiones.md`, D-3 es el stack tecnológico (DEC-05), y el motor propio es DEC-02. La sección "Pendientes fuera del código" de `docs/02-mapa-de-changes.md` todavía tiene sin marcar "Cerrar D-3 (stack)" y "Escribir el modelo de datos antes de CH-02", aunque ambos ya están resueltos.
3. **Formulación de la licencia de n8n en `docs/mapa-historias.md`.** La sección 1 conserva la afirmación de que la licencia "excluye alojar n8n cobrando por el acceso o embeberlo en un producto propio". Es la misma formulación que se corrigió en DEC-02 el 2026-09-24.
4. **CH-16b no figura en el mapa de changes.** Tampoco tiene artefactos de especificación. CH-16 se ejecutó antes que CH-09 a CH-15, de los que depende según el mapa.
5. **Tarea 4.1 de CH-09.** Exige que `src/contrato.ts` no cambie, pero DEC-36 lo modificó (ver sección 1.2).
