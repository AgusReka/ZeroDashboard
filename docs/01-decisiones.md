# 01 — Decisiones y compuertas

Registro de decisiones de arquitectura. **Este archivo es la fuente del capítulo de arquitectura de la tesis.** Cada entrada debe poder leerse como una subsección: qué se decidió, qué alternativas había, por qué esta, y qué se resigna.

Regla: ninguna decisión de arquitectura la toma un agente. Si durante el desarrollo aparece una decisión no registrada, se frena, se registra acá, y recién después se implementa.

Formato de cada entrada: contexto, opciones, decisión, consecuencias, estado.

---

## Decisiones tomadas

### DEC-01 — Acceso por SQL directo, no por API de la plataforma

**Contexto.** Para leer el estado del e-commerce hay dos caminos: consultar la base, o consumir endpoints del backend del cliente.

**Opciones.** (a) SQL directo sobre réplica. (b) Endpoints expuestos por el cliente.

**Decisión.** SQL directo.

**Por qué.** La opción (b) exige que el cliente desarrolle y mantenga endpoints, lo que presupone equipo técnico disponible y contradice la premisa de baja barrera. La opción (a) solo requiere acceso de lectura.

**Se resigna.** Se duplica lógica de negocio: reglas de cálculo que viven en el backend del cliente se reimplementan en las consultas. Un cambio de regla exige actualizar ambos artefactos.

**Estado:** firme. Heredada del trabajo previo con los tres workflows.

---

### DEC-02 — Motor de ejecución propio, no n8n

**Contexto.** Los tres workflows previos se implementaron en n8n. Al pasar a un modelo multi-tenant alojado por el implementador, hay que decidir si n8n sigue siendo el motor.

**Opciones.** (a) n8n manejado por su API. (b) Planificador propio acotado al patrón consulta-condición-notificación.

**Decisión.** Motor propio.

**Por qué.**
1. **Licencia.** La Sustainable Use License de n8n restringe el uso a fines internos de negocio y excluye explícitamente alojar n8n cobrando por el acceso, y embeberlo en un producto propio. El modelo multi-tenant cae de ese lado. *(Verificado en la documentación oficial de n8n. Para uso comercial, confirmar con el proveedor.)*
2. **Alcance.** La generalidad de n8n excede lo que el catálogo necesita: todas las automatizaciones responden al mismo patrón lineal.

**Se resigna.** Todo lo que n8n resolvía pasa a ser responsabilidad propia: planificación, reintentos, solapamientos, ejecuciones interrumpidas, historial. Es el bloque X del mapa de historias.

**Efecto sobre la tesis.** Los tres workflows dejan de ser el artefacto y pasan a ser el estudio previo que define el patrón y el catálogo inicial.

**Estado:** firme.

---

### DEC-03 — Arquitectura multi-tenant alojada por el implementador

**Contexto.** La consola es una herramienta del implementador y se usa para todos los clientes. Una instalación por cliente implicaría una consola por cliente.

**Opciones.** (a) Instalación completa por cliente. (b) Multi-tenant alojado por el implementador.

**Decisión.** Multi-tenant.

**Se resigna.** Concentración de credenciales de todos los clientes en un solo lugar; necesidad de aislamiento estricto entre inquilinos; y la conectividad se invierte, lo que abre D-2.

**Estado:** firme, con D-2 pendiente.

---

### DEC-04 — Dos superficies separadas

**Contexto.** El implementador escribe SQL; el administrador de la PYME no debe hacerlo.

**Decisión.** Consola (P1) y panel (P2) son superficies distintas con permisos distintos.

**Por qué.** Si el cliente escribe consultas, el producto pierde su diferencial frente a herramientas de BI existentes y hereda sus riesgos de seguridad sin ninguna de sus ventajas.

**Estado:** firme.

---

### DEC-05 — Stack tecnológico: Node.js + TypeScript, base propia en PostgreSQL

**Contexto.** D-3 quedaba abierta con el criterio "el que el autor domina", sin consumir más de una jornada. CH-01 (esqueleto de aplicación y entorno) no se puede especificar sin esto resuelto.

**Opciones.** Lenguaje/runtime: (a) Node.js + TypeScript. (b) Python. (c) .NET / C#. Motor de la base propia (distinto de D-4, que es sobre la réplica del cliente): (a) PostgreSQL. (b) MySQL. (c) SQLite.

**Decisión.** Node.js + TypeScript para la aplicación; PostgreSQL para la base propia.

**Por qué.** Confirmado por el autor como el stack que domina.

**Se resigna.** El framework web específico y la herramienta de ORM/migraciones dentro de Node.js + TypeScript quedan sin fijar acá: se resuelven a nivel de diseño de cada change (empezando por CH-01), no como una compuerta de arquitectura nueva.

**Estado:** firme. Cierra D-3.

---

### DEC-06 — Entidad `tenant` mínima desde CH-02, no diferida a CH-06

**Contexto.** `docs/02-mapa-de-changes.md` define R0 como "consola mínima, local, un cliente" y ubica el bloque T (tenants con aislamiento real: T1, T2, T4) recién en R1 (CH-06). CH-02 ("modelo de datos inicial") necesita decidir si `conexion` y `consulta_guardada` llevan `tenant_id` desde el día uno o si esa columna se agrega en CH-06.

**Opciones.** (a) Sin noción de tenant en CH-02; CH-06 agrega la columna `tenant_id` a `conexion` y `consulta_guardada` y migra los datos existentes. (b) Tabla `tenant` mínima desde CH-02 — una sola fila sembrada por migración/seed, sin aislamiento ni filtrado por tenant todavía — y `conexion`/`consulta_guardada` referencian esa fila desde el inicio.

**Decisión.** (b). Tenant mínimo desde CH-02.

**Por qué.** Evita una migración de columna más backfill de datos existentes cuando llegue CH-06. El aislamiento real (T2: prueba automatizada con dos tenants, T4: indicador de tenant activo) sigue siendo trabajo de CH-06; CH-02 solo deja la forma de la tabla lista para extenderse.

**Se resigna.** CH-02 incluye una tabla que R0 no explota (no hay alta de tenants, no hay UI de selección, todo opera contra la única fila sembrada). Es deuda de alcance aceptada a cambio de evitar la migración posterior.

**Decidido por:** el usuario, durante la exploración de CH-02 (2026-09-15), no inferido por el agente.

**Estado:** firme.

---

### DEC-07 — Consola web mínima desde CH-04, no diferida

**Contexto.** B1 ("Como P1, quiero escribir una consulta y ver el resultado") exige "Editor, ejecución, tabla paginada, error legible". Hasta CH-03 el proyecto es exclusivamente API/JSON: no existe ninguna página HTML, activo estático ni dependencia de frontend. Había que decidir si CH-04 introduce la primera superficie visual de la consola (P1) o si esa historia se satisface con una API bien formada, dejando la UI para un change posterior.

**Opciones.** (a) Solo API: endpoint JSON con paginación por parámetros, sin página web; la UI real se construye en un change futuro dedicado. (b) Consola web mínima ahora: una página HTML servida por la propia app (textarea de SQL + tabla de resultados paginada), como primera superficie de P1.

**Decisión.** (b). Consola web mínima desde CH-04.

**Por qué.** R0 se llama explícitamente "consola mínima" y B1 describe literalmente elementos de interfaz (editor, tabla paginada), no solo una forma de respuesta. Ningún change posterior del mapa reserva la construcción de una UI para P1 (CH-22 es el panel de P2, una superficie distinta con reglas distintas — DEC-04). Diferir la UI habría dejado a R0 sin consola real pese a su nombre.

**Se resigna.** CH-04 crece en alcance: además del motor de ejecución de solo lectura, debe servir una página, sus activos y su lógica de cliente. Aumenta el riesgo de superar el presupuesto de revisión de 400 líneas (ya ocurrido en CH-03) y probablemente exige partir el change en PRs encadenados.

**Decidido por:** el usuario, durante la exploración de CH-04 (2026-09-16), no inferido por el agente.

**Estado:** firme.

---

### DEC-08 — Verificación activa de permisos de escritura del rol de base del tenant

**Contexto.** A3 exige "usuario de base sin escritura" como una de las dos capas de solo-lectura (la otra es el rechazo a nivel aplicación). El usuario de base lo configura el propio tenant al registrar la conexión (CH-03); la app no controla el servidor del tenant. Había que decidir si la app verifica esto por código, lo advierte sin bloquear, o lo trata como puramente operativo/documental.

**Opciones.** (a) Solo documentación: es responsabilidad operativa de P1 configurar un usuario sin escritura; la app no verifica nada. (b) Advertir sin bloquear: la app detecta permisos de escritura del rol conectado y muestra una advertencia, pero igual permite ejecutar (la garantía real queda en la capa de aplicación). (c) Bloquear activamente: antes de ejecutar, la app consulta los grants del rol conectado (`information_schema`/`has_table_privilege`) y rechaza la ejecución si el rol parece tener permisos de escritura.

**Decisión.** (c). Bloquear activamente si se detectan permisos de escritura.

**Por qué.** A3 pide explícitamente dos capas independientes de solo-lectura, no una capa reforzada por una advertencia ignorable. Un chequeo activo que rechaza la ejecución hace tangible la segunda capa en vez de dejarla como una nota de configuración que nadie vuelve a mirar.

**Se resigna.** El chequeo no es una garantía perfecta: un rol superusuario, permisos otorgados a nivel de esquema en vez de tabla, o cambios de grants entre el chequeo y la ejecución (TOCTOU) pueden eludirlo. Se documenta como límite conocido, no como garantía absoluta — la capa de aplicación (DEC-09) sigue siendo la que realmente impide la escritura.

**Decidido por:** el usuario, durante la exploración de CH-04 (2026-09-16), no inferido por el agente.

**Estado:** firme.

---

### DEC-09 — Enforcement de solo-lectura vía transacción `READ ONLY` + protocolo extendido, sin parser de SQL

**Contexto.** La capa de aplicación de A3 debe rechazar sentencias que no sean de lectura. Un chequeo ingenuo por palabra clave o regex es evadible (múltiples sentencias separadas por `;`, CTEs con escritura, `SELECT ... INTO`, funciones con efectos secundarios). Había que decidir si se agrega una dependencia de parseo de SQL para analizar la sentencia antes de ejecutar, o si se apoya en garantías del propio motor de Postgres.

**Opciones.** (a) Agregar una librería de parseo de SQL (ej. `node-sql-parser`) para analizar estáticamente el tipo de sentencia antes de ejecutar. (b) Sin dependencia nueva: forzar sentencia única a través del protocolo extendido de `node-postgres` (rechaza texto multi-sentencia) y ejecutar dentro de `BEGIN TRANSACTION READ ONLY`, que hace que el propio motor de Postgres rechace escrituras y DDL (SQLSTATE `25006`).

**Decisión.** (b). Transacción `READ ONLY` más protocolo extendido, sin parser de SQL.

**Por qué.** Traslada la garantía de "es de lectura" al motor de la base en vez de a un análisis estático que siempre puede quedar desactualizado frente a variantes sintácticas de Postgres. Evita sumar una dependencia nueva y su superficie de mantenimiento.

**Se resigna.** Las tablas temporales siguen permitidas dentro de una transacción de solo lectura (son de alcance de sesión) — es un hueco conocido y documentado, no una omisión. Queda como límite explícito del artefacto, revisable si en la práctica se vuelve un problema real (no antes).

**Decidido por:** el usuario, durante la exploración de CH-04 (2026-09-16), no inferido por el agente.

**Estado:** firme.

---

### DEC-10 — Superficie de consultas guardadas: crear + listar + obtener por ID

**Contexto.** B2 pide, en su redacción literal, "guardar una consulta con nombre y descripción" — leído al pie, solo exige creación. Pero el cierre de R0 describe el flujo completo como "conectarse..., escribir una consulta, guardarla y ejecutarla", lo que presupone poder recuperarla después de guardarla. Había que decidir si CH-05 construye solo el alta, un alta+lectura mínima, o CRUD completo.

**Opciones.** (a) Solo crear — lectura más literal de B2, pero deja la consulta guardada sin forma de recuperarla. (b) Crear + listar + obtener por ID — permite guardar, ver el listado y cargar una consulta guardada; actualizar y borrar quedan fuera. (c) CRUD completo (crear, listar, obtener, actualizar, borrar).

**Decisión.** (b). Crear + listar + obtener por ID.

**Por qué.** Es la superficie mínima que hace utilizable el cierre de R0 sin sobre-construir. Actualizar se solapa con B4 (versionado de consultas guardadas, CH-25, R3) y adelantarlo invita a resolver dos veces el mismo problema; borrar no lo pide ninguna historia del mapa.

**Se resigna.** Una consulta guardada con nombre equivocado o SQL desactualizado no se puede corregir in-place en CH-05: hay que esperar a B4/CH-25, o vivir con guardar una nueva.

**Decidido por:** el usuario, durante la exploración de CH-05 (2026-09-16), no inferido por el agente.

**Estado:** firme.

---

### DEC-11 — Consulta guardada sin atar a una conexión específica

**Contexto.** El modelo `ConsultaGuardada` (creado en CH-02) no tiene columna `conexionId`; B2 no menciona explícitamente si una consulta guardada debe asociarse a una `Conexion` puntual. Había que decidir si CH-05 agrega esa relación (con su migración) o si el texto de la consulta queda desacoplado de cualquier conexión, igual que hoy funciona `/consultas/ejecutar` (recibe `conexionId` y `sql` por separado, sin persistir el vínculo).

**Opciones.** (a) Sin atar — el `sql` es texto portable; la conexión se elige aparte al momento de ejecutar. Cero migración de schema. (b) Atar a una conexión — agregar `conexionId` (FK) a `ConsultaGuardada`, exigiendo la primera migración sobre una tabla que CH-02 ya entregó.

**Decisión.** (a). Sin atar a una conexión.

**Por qué.** Coincide con el schema ya existente desde CH-02 (sin migración) y con el patrón ya vigente en `/consultas/ejecutar`, donde `conexionId` y `sql` viajan como parámetros independientes de la misma llamada, no como un vínculo persistido.

**Se resigna.** Una consulta guardada que referencia columnas de un esquema específico puede fallar o devolver resultados sin sentido si se ejecuta contra una conexión con un esquema distinto. No hay validación de compatibilidad; es responsabilidad de quien la ejecuta elegir la conexión correcta.

**Decidido por:** el usuario, durante la exploración de CH-05 (2026-09-16), no inferido por el agente.

**Estado:** firme.

---

### DEC-12 — Consola web extendida en CH-05 con guardar, listar y cargar

**Contexto.** DEC-07 construyó la consola HTML en CH-04 porque B1 nombraba elementos de interfaz explícitos (editor, tabla paginada). B2 solo nombra una propiedad de almacenamiento ("persistencia en la base propia"), no un elemento de UI, lo que dejaba abierto si CH-05 debía tocar `src/consola.ts` o quedarse en API pura.

**Opciones.** (a) Extender la consola ahora — agregar a `src/consola.ts` un botón de guardar, un listado de consultas guardadas y la carga de una de ellas al editor. (b) Solo API en CH-05 — las rutas backend nada más; la integración visual se difiere a un change posterior.

**Decisión.** (a). Extender la consola ahora.

**Por qué.** Mantiene el mismo alcance visible de punta a punta que CH-04 y evita que la consola quede con una funcionalidad de guardado invisible para P1 hasta un change futuro sin fecha en el mapa.

**Se resigna.** CH-05 crece en alcance: además de las rutas de persistencia, debe modificar el HTML/JS de la consola. Aumenta el riesgo de superar el presupuesto de revisión de 400 líneas (ya ocurrido en CH-03 y CH-04); la estrategia de PR ya está fijada en modo automático (encadenar si hace falta).

**Decidido por:** el usuario, durante la exploración de CH-05 (2026-09-16), no inferido por el agente.

**Estado:** firme.

---

### DEC-13 — Aislamiento vía extensión de Prisma + contexto de request (AsyncLocalStorage)

**Contexto.** DEC-06 fijó la forma del modelo de tenant desde CH-02 (`tenantId` en `Conexion` y `ConsultaGuardada`), pero ninguna decisión cubre cómo se hace cumplir ese aislamiento en cada consulta. Hoy ninguna ruta de lectura filtra por tenant: `GET /consultas-guardadas`, `GET /consultas-guardadas/:id`, `POST /conexiones/:id/prueba` y la búsqueda de `Conexion` en `POST /consultas/ejecutar` resuelven por `id` sin chequear `tenantId`.

**Opciones.** (a) Filtrado manual por consulta: cada ruta agrega explícitamente `where: { tenantId }`. (b) Extensión de Prisma Client que inyecta automáticamente el filtro `tenantId`, leyendo el tenant activo desde un contexto de request sostenido con `AsyncLocalStorage`. (c) Row-Level Security de Postgres: variable de sesión por transacción más políticas `USING`.

**Decisión.** (b). Extensión de Prisma + `AsyncLocalStorage`.

**Por qué.** Traslada la garantía de aislamiento a un mecanismo estructural en vez de a una convención que cada ruta nueva debe recordar aplicar — mismo criterio que DEC-08/DEC-09 (preferir garantías estructurales sobre disciplina manual). Se hereda sola en las tablas de tenant que se agreguen en CH-08 a CH-14, sin volver a resolver el problema. RLS (opción c) es más de lo que pide el problema para la base propia de la app (no es una réplica semi-confiable de un tercero) y no tiene precedente de roles/políticas en este código.

**Se resigna.** Se agrega un mecanismo de contexto de request (`AsyncLocalStorage`) que no existía antes; la extensión de Prisma se vuelve un punto único donde el aislamiento puede romperse si tiene un bug, en vez de estar distribuido (y por lo tanto más visible en revisión) en cada ruta.

**Decidido por:** el usuario, durante la exploración de CH-06 (2026-09-17), no inferido por el agente.

**Estado:** firme.

---

### DEC-14 — Baja lógica de tenant: congelado por completo

**Contexto.** T1 pide "alta, baja lógica, listado" para tenants, sin que ningún documento previo definiera qué implica exactamente desactivar un tenant.

**Opciones.** (a) Congelado por completo: oculto del listado activo y toda operación futura contra ese tenant (conexiones, consultas guardadas, ejecuciones) se rechaza; las filas existentes quedan intactas para auditoría/historial. (b) Oculto pero operable: se oculta del listado por defecto, pero conexiones/consultas guardadas existentes se pueden seguir leyendo o ejecutando si se referencian explícitamente por ID. (c) Solo bloquea alta nueva: los recursos existentes del tenant siguen funcionando con normalidad; la baja solo impide crear recursos nuevos bajo ese tenant.

**Decisión.** (a). Congelado por completo.

**Por qué.** Es la lectura más segura de "baja lógica" para un sistema que opera sobre credenciales y datos de terceros (PYMEs clientes): un tenant desactivado no debería seguir siendo alcanzable por ninguna operación nueva, aunque su historial se conserve. Evita el caso ambiguo de una operación "fantasma" contra un tenant que P1 ya dio de baja.

**Se resigna.** Si una baja fue un error operativo, no hay forma de seguir operando ese tenant "un poco" mientras se corrige — hay que reactivarlo primero. No se pide reactivación explícita en T1; queda fuera de alcance de CH-06 salvo que se necesite.

**Decidido por:** el usuario, durante la exploración de CH-06 (2026-09-17), no inferido por el agente.

**Estado:** firme.

---

### DEC-15 — Tenant activo de la consola: explícito por request, sin sesión de servidor

**Contexto.** T4 pide un indicador permanente e inequívoco de contra qué tenant opera P1 en la consola. Hoy no existe ninguna infraestructura de sesión o autenticación en el proyecto (P1 es el único operador de la consola, DEC-04).

**Opciones.** (a) Tenant explícito por request: cada llamada de la consola a la API lleva el id del tenant de forma explícita (parámetro de ruta o header); el estado de "tenant activo" vive del lado del cliente (un selector) y se reenvía en cada request. (b) Sesión del lado del servidor: una acción de "cambiar de tenant" fija una sesión (cookie) en el servidor, y las siguientes acciones del operador apuntan implícitamente a ese tenant hasta que se cambie.

**Decisión.** (a). Tenant explícito por request.

**Por qué.** No introduce infraestructura de sesión nueva (el proyecto no tiene ninguna todavía) y es consistente con Regla 2 del mapa de historias, que reserva la prohibición de "tenant tomado de la petición del cliente" específicamente al panel (P2) — la consola (P1) es una superficie distinta (DEC-04) donde un id de tenant explícito en la petición es una superficie de confianza aceptable, no una violación de esa regla.

**Se resigna.** El cliente de la consola (JS) es responsable de mantener y reenviar el tenant seleccionado en cada llamada; un bug en ese estado del lado del cliente podría hacer que una operación apunte al tenant equivocado sin que el servidor tenga una sesión independiente que lo contradiga. El indicador visual de T4 es, en parte, la mitigación de ese riesgo.

**Decidido por:** el usuario, durante la exploración de CH-06 (2026-09-17), no inferido por el agente.

**Estado:** firme.

---

### Resoluciones de nivel diseño bajo DEC-13, DEC-14 y DEC-15 (CH-06)

No son decisiones nuevas ni abren compuertas: son la mecánica interna de tres decisiones ya firmes, resuelta en `openspec/changes/CH-06-tenants-and-isolation/design.md` y registrada acá para que no haya que leer el change para saber cómo quedó. Mismo tipo que DEC-05 y que las resoluciones de diseño de CH-05.

**1. El tenant activo viaja en el encabezado `X-Tenant-Id` (bajo DEC-15).** Es ortogonal al ruteo, así que ninguna URL de CH-03/CH-04/CH-05 cambia de forma y una sola lista de exenciones cubre todas las rutas presentes y futuras. Se descartó el prefijo de ruta `/t/:tenantId/...` (reescribía cada path, la consola y `scripts/smoke.sh`) y el campo en el cuerpo (imposible en `GET`, y reabriría la prohibición de Regla 2 que los esquemas ya hacen cumplir: un `tenantId` **en el cuerpo** sigue siendo `400`).

Exenciones, como lista cerrada y comparada contra el *patrón* de ruta (nunca contra un prefijo de la URL cruda, para que `/consola-falsa` no pueda hacerse pasar por `/consola`): `GET /health`, `GET /consola` y todo `/tenants`. Todo lo demás queda alcanzado por defecto, incluida cualquier ruta que se agregue después y cualquier URL que no exista.

Envoltorios de falla: `400 tenant-no-indicado` si no viene el encabezado, `404 tenant-no-encontrado` si el id no nombra ningún tenant, `409 tenant-desactivado` si el tenant está dado de baja. `409` y no `404` porque borrar esa distinción sería borrar justo lo que DEC-14 existe para afirmar; y no `403` porque no hay sujeto autenticado (DEC-04) del que un veredicto de autorización pudiera hablar.

**2. La extensión de Prisma falla cerrada, por lista blanca de operaciones (bajo DEC-13).** Dos propiedades la hacen una garantía y no una defensa cosmética: la ausencia de contexto de tenant **lanza un error** en vez de dejar pasar una consulta sin filtrar, y una operación no contemplada (`upsert`, por ejemplo) **también lanza**, de modo que un aporte futuro falla en su primera corrida de tests en lugar de cruzar tenants en silencio. En las operaciones de filtro el predicado se conjuga con `AND` en vez de mezclarse dentro del `where`, así que un `tenantId` o un `OR` suministrados por quien llama no pueden desplazarlo.

Límites conocidos, declarados y no prevenidos: `$queryRaw`/`$executeRaw` no pasan por extensiones de modelo, y las escrituras anidadas por relación tampoco. Ninguna ruta usa esas formas hoy. Es la superficie residual del punto único de falla que DEC-13 aceptó a conciencia.

**3. `503 tenant-no-inicializado` se elimina, no se reutiliza (bajo DEC-15).** Existía por un solo motivo: la ruta de alta necesitaba *algún* id de tenant para una clave foránea NOT NULL y la tabla podía estar vacía. Con el tenant nombrado por la petición y validado antes de que corra el handler, esa condición es inalcanzable: una tabla vacía ahora responde `404 tenant-no-encontrado`, que es la afirmación más verdadera. Dejar el código como alias habría dejado una rama muerta que se lee como una garantía viva. `prisma/seed.ts` sigue creando un tenant por comodidad, pero ningún camino de código depende de que exista.

**Estado:** aplicadas en CH-06.

---

### DEC-16 — Cifrado de credenciales: AES-256-GCM vía `node:crypto`, IV aleatorio por fila, sobre versionado

**Contexto.** A2 exige que comprometer la base propia no alcance para descifrar las credenciales de conexión. Había que elegir un mecanismo de cifrado.

**Opciones.** (a) AES-256-GCM con el módulo `node:crypto` de Node.js, IV aleatorio por fila, sobre versionado (`v1:iv:tag:ciphertext`, base64). (b) `pgcrypto` de PostgreSQL. (c) `libsodium`. (d) AES en modo CBC sin autenticación.

**Decisión.** (a).

**Por qué.** `pgcrypto` (b) mueve la clave a la propia base de datos, exactamente el compromiso que A2 asume y quiere impedir. `libsodium` (c) suma una dependencia nueva sin necesidad, cuando `node:crypto` ya cubre AES-GCM de forma nativa. CBC sin autenticación (d) no detecta manipulación del texto cifrado; GCM es autenticado (AEAD) y descarta esa clase de fallo. El sobre versionado (`v1:...`) deja abierta una futura rotación de algoritmo o de clave sin migrar el formato de columna.

**Se resigna.** No hay rotación de clave automatizada en este change (ver DEC-17); si la clave se filtra, el remedio es manual: generar una nueva, re-cifrar y desplegar.

**Decidido por:** el usuario, durante la exploración de CH-07 (2026-09-17), no inferido por el agente.

**Estado:** firme.

---

### DEC-17 — Clave maestra: una por despliegue, desde variable de entorno, fail-closed al arrancar

**Contexto.** A2 exige que la clave viva fuera de la base propia. Había que decidir el alcance de la clave (una por despliegue o una por tenant) y de dónde se lee.

**Opciones (alcance).** (a) Una clave maestra por despliegue. (b) Una clave maestra por tenant. **Opciones (origen).** (a) Variable de entorno, leída al arrancar. (b) Gestor de secretos / KMS. (c) Archivo en disco. (d) La propia base de datos (descartada por A2).

**Decisión.** Una clave por despliegue, desde variable de entorno; si la clave falta, es demasiado corta o está mal formada, el proceso rechaza arrancar.

**Por qué.** Una clave por tenant reduce el radio de un compromiso, pero hoy no hay ninguna infraestructura de gestión de secretos por tenant, y D-2 (cómo llega el motor a la réplica del cliente) sigue abierta — resolver el alcance de la clave antes que D-2 fijaría una superficie de despliegue que todavía no existe. KMS/gestor de secretos queda fuera de alcance por la misma razón: no hay todavía un objetivo de despliegue concreto contra el cual integrarlo. Fail-closed al arrancar traslada el error al momento del despliegue, no al primer uso de una conexión, cuando ya sería un fallo silencioso en producción.

**Se resigna.** Un solo despliegue comprometido expone la clave de todos los tenants a la vez — el radio de impacto completo de riesgo 1 de `mapa-historias.md` §7 permanece. Es una decisión explícita del usuario, no una omisión: se revisa si en la práctica el número de tenants o el modelo de despliegue lo justifican.

**Decidido por:** el usuario, durante la exploración de CH-07 (2026-09-17), no inferido por el agente.

**Estado:** firme, con D-2 pendiente.

---

### DEC-18 — Tope de filas: veredicto propio de la aplicación, distinto de la paginación

**Contexto.** A4 pide que un corte por tope de filas o por timeout sea legible y distinto de una página más de resultados. Hoy el tope es un `maximum: 200` fijo en el esquema JSON de `src/consultas.ts`, sin ningún veredicto que lo distinga de `hayMas`.

**Opciones.** (a) La aplicación aplica el tope y devuelve un veredicto propio (p. ej. `tope-de-filas`), distinto de `hayMas`. (b) Reutilizar `hayMas` para señalar el corte por tope. (c) Dejar el corte solo del lado del motor (`LIMIT`), sin veredicto en la respuesta.

**Decisión.** (a).

**Por qué.** `hayMas` (b) invita a pedir la página siguiente, que es exactamente lo que el tope existe para impedir — reusarlo confundiría "hay más resultados disponibles" con "esto es todo lo que vas a poder ver". Un `LIMIT` silencioso (c) dejaría a P1 sin saber si vio todo el resultado o si fue cortado.

**Se resigna.** Ninguno nuevo: es una extensión del contrato de respuesta ya existente de `query-execution`, no una garantía nueva.

**Decidido por:** el usuario, durante la exploración de CH-07 (2026-09-17), no inferido por el agente.

**Estado:** firme.

---

### DEC-19 — Timeout y tope de filas: configuración global por variable de entorno, no por conexión ni por tenant

**Contexto.** A4 pide límites "configurables" sin nombrar el sujeto. Había que decidir si el timeout y el tope de filas se configuran de forma global, por conexión (`Conexion`) o por tenant.

**Opciones.** (a) Defaults globales por variable de entorno (mismo valor para toda conexión y todo tenant). (b) Por conexión — agrega columnas a `Conexion` y una migración. (c) Por tenant — agrega columnas a `Tenant` y una migración.

**Decisión.** (a).

**Por qué.** Es la porción más chica del cambio, no requiere migración de esquema, y es consistente con cómo `QUERY_TIMEOUT_MS` ya funciona hoy desde CH-04. Ni (b) ni (c) tienen todavía un caso de uso concreto que los justifique — nada en los documentos pide límites distintos por conexión o por tenant.

**Se resigna.** Si en el futuro un tenant necesita un límite distinto (por ejemplo, una réplica más lenta que tolera menos filas), esta decisión queda para revisar entonces; no se resuelve preventivamente acá. `domain-data-model` no se modifica por este change.

**Decidido por:** el usuario, durante la exploración de CH-07 (2026-09-17), no inferido por el agente.

**Estado:** firme.

---

### DEC-20 — Conexiones registradas antes de CH-07: se tratan como datos de desarrollo, se re-registran

**Contexto.** Antes de CH-07, `Conexion.credencial` se guarda en texto plano. Había que decidir qué pasa con esas filas ya existentes cuando el cifrado entra en vigencia: reescribirlas en la migración (backfill-cifrado) o darlas por datos de desarrollo a reemplazar.

**Opciones.** (a) La migración lee el valor en texto plano de cada fila existente y lo reescribe como sobre cifrado, en el momento de migrar. (b) Las filas existentes se tratan como datos de desarrollo: quedan como están o se limpian, y cualquier conexión registrada antes de CH-07 debe volver a registrarse después del cambio.

**Decisión.** (b).

**Por qué.** (a) obliga a que la clave maestra esté disponible en el momento mismo de correr la migración y a que el proceso de migración manipule texto plano de credenciales — una superficie adicional que (b) evita por completo. El proyecto no tiene todavía datos de producción reales (P1 es el único operador, DEC-04), así que el costo de re-registrar es bajo.

**Se resigna.** Cualquier conexión cargada durante el desarrollo antes de CH-07 deja de funcionar hasta que se vuelva a registrar; no hay ninguna migración de datos que la preserve. Esto también simplifica el plan de rollback de CH-07: revertir el código no deja credenciales ilegibles, porque ninguna fila vieja pasó por un cifrado en migración.

**Decidido por:** el usuario, durante la exploración de CH-07 (2026-09-17), no inferido por el agente.

**Estado:** firme.

---

### DEC-21 — Contrato canónico: definición estática en código, expuesta por una API de lectura

**Contexto.** CH-08 (M1) exige que P1 pueda "ver qué entidades y campos exige el contrato", con obligatorios/opcionales y qué automatización depende de cada uno. Había que decidir si ese contrato vive como una definición estática en código o como una entidad guardada/consultable en la base propia.

**Opciones.** (a) Solo código: módulo TS con la estructura fija, sin exponerla todavía por API. (b) Entidad en base de datos: tablas nuevas (`ContratoEntidad`/`ContratoCampo`) migradas y consultadas por Prisma como cualquier otro modelo. (c) Híbrido: definición estática en código como fuente de verdad, expuesta por un endpoint/consola de solo lectura para satisfacer el "ver" de M1.

**Decisión.** (c). Híbrido: código como fuente de verdad, expuesto por una API de lectura.

**Por qué.** El contrato canónico es igual para todos los tenants — no es dato de un tenant particular — así que persistirlo como tabla mutable en la base propia lo trataría como algo que no es. Una definición estática en código lo deja como lo que es: un artefacto de diseño versionado (la contribución central de la tesis, `docs/00-contexto.md` §1), revisable en un diff como cualquier otra decisión. Exponerlo por una API de lectura cierra el criterio de aceptación de M1 sin necesitar una migración.

**Se resigna.** Cuando CH-12 (`Plantilla`) exista, va a haber que reconciliar a mano las referencias a automatizaciones que hoy son solo texto libre (ver DEC-22); no hay mecanismo automático de sincronización entre el código estático y las plantillas reales.

**Decidido por:** el usuario, durante la exploración de CH-08 (2026-09-18), no inferido por el agente.

**Estado:** firme.

---

### DEC-22 — Dependencia campo→automatización: etiqueta de texto libre, sin FK a `Plantilla`

**Contexto.** M1 exige mostrar qué automatización depende de cada campo del contrato, pero `Plantilla` (la entidad real de automatización, CH-12) llega recién cuatro changes después de CH-08 (CH-09, CH-10 y CH-11 van antes). Había que decidir cómo representar esa dependencia sin una entidad real a la cual referenciar.

**Opciones.** (a) Etiqueta de texto libre por campo (ej. un string constante `"stock-fisico"`), sin FK, a reconciliar cuando `Plantilla` exista. (b) Referencia futura documentada explícitamente como placeholder de CH-12. (c) Booleano abstracto ("requerido por al menos una automatización"), sin nombrar cuál.

**Decisión.** (a). Etiqueta de texto libre por campo.

**Por qué.** Es la opción más simple que no presupone la forma final de `Plantilla` y no le pide a CH-08 resolver un problema de CH-12. A diferencia del booleano abstracto (c), conserva el detalle que M1 pide explícitamente ("qué automatización depende de cada uno"), no solo que alguna depende.

**Se resigna.** Ninguna garantía estructural ata hoy esas etiquetas a nombres reales de automatización; un typo o un nombre que después no coincide con el `Plantilla` real de CH-12 no se detecta hasta que ese change llegue y reconcilie a mano.

**Decidido por:** el usuario, durante la exploración de CH-08 (2026-09-18), no inferido por el agente.

**Estado:** firme, con reconciliación pendiente en CH-12.

---

### DEC-23 — Exclusión de campos personales (M5): estructural, nunca modelados en CH-08

**Contexto.** M5 exige que el contrato excluya domicilio, teléfono y correo, "salvo que una plantilla lo requiera". Como `Plantilla` (CH-12) no existe todavía, CH-08 no puede cerrar el mecanismo completo de excepción. Había que decidir qué exclusión de base sí puede cerrar CH-08: si los campos personales quedan afuera del catálogo por completo, o si se modelan pero se marcan excluidos por defecto.

**Opciones.** (a) Estructural: los campos personales no se incluyen en el catálogo canónico de CH-08; no hay nada que filtrar porque no existen en la definición. (b) Convencional: los campos personales sí están en el catálogo pero marcados "excluido por defecto", dejando el mecanismo de override más preparado para cuando CH-12 lo necesite.

**Decisión.** (a). Estructural: nunca modelados.

**Por qué.** Coincide con el patrón ya establecido del proyecto de preferir garantías estructurales sobre disciplina manual o convención (mismo criterio que DEC-08, DEC-09, DEC-13, DEC-16, DEC-17). Introducir campos personales en el contrato antes de que exista ninguna plantilla que los necesite adelanta una decisión de CH-12 sin necesidad.

**Se resigna.** El override que M5 menciona ("salvo que una plantilla lo requiera") queda completamente sin mecanismo hasta CH-12; CH-08 solo cierra la exclusión de base, no la excepción completa de la historia.

**Decidido por:** el usuario, durante la exploración de CH-08 (2026-09-18), no inferido por el agente.

**Estado:** firme, con el mecanismo de override pendiente en CH-12.

---

### DEC-24 — `GET /contrato` exenta del header `x-tenant-id`

**Contexto.** `src/contexto-tenant.ts` mantiene una lista blanca cerrada de rutas exentas (`esExenta`) que hoy incluye `GET /health`, `GET /consola` y todo `/tenants`; cualquier ruta no listada exige el header `x-tenant-id` (DEC-15, fail-closed). El nuevo `GET /contrato` (CH-08) proyecta el catálogo canónico estático (DEC-21), que es idéntico para todos los tenants y no lee ningún modelo con aislamiento. Había que decidir si se agrega a la lista de exenciones o si exige el header igual que el resto de las rutas.

**Opciones.** (a) Eximir `GET /contrato`, sumándolo a la lista blanca junto a `GET /health` y `GET /consola`. (b) Exigir `x-tenant-id` igual que cualquier otra ruta no exenta, aunque el handler no lo use.

**Decisión.** (a). Eximir `GET /contrato`.

**Por qué.** El contrato canónico es un artefacto de diseño igual para todos los tenants, no un dato de tenant — es la misma razón por la que DEC-21 descartó guardarlo como tabla. Exigir el header trataría un artefacto tenant-agnóstico como si fuera dato de un tenant particular, la inconsistencia exacta que DEC-21 evitó. El handler no lee la base ni ningún modelo alcanzado por `MODELOS_AISLADOS`, así que la exención no filtra nada; es de solo lectura (`GET`), mismo criterio que las exenciones ya existentes.

**Se resigna.** La lista blanca de exenciones crece en una entrada más; cualquier ruta futura que necesite el mismo criterio (tenant-agnóstica, de solo lectura) va a requerir la misma evaluación caso por caso, no hay una regla general que las cubra a todas de antemano.

**Decidido por:** el usuario, durante la propuesta de CH-08 (2026-09-18), no inferido por el agente.

**Estado:** firme.

---

### DEC-25 — Motores de base admitidos: solo PostgreSQL (D-4)

**Contexto.** D-4 definía si la aplicación admite solo PostgreSQL para la réplica del cliente o también MySQL. De eso depende si cada vista canónica necesita una o dos variantes de SQL, ya que las consultas ya escritas usan construcciones específicas de PostgreSQL sin equivalente directo en MySQL.

**Opciones.** (a) Solo PostgreSQL. (b) PostgreSQL y MySQL.

**Decisión.** (a). Solo PostgreSQL.

**Por qué.** D-5 (segundo esquema para la validación de genericidad) se cerró eligiendo Medusa, que corre exclusivamente sobre PostgreSQL. El primer tenant del proyecto (Food Store) también corre sobre PostgreSQL. Con los dos tenants de R1 en el mismo motor, dar soporte a MySQL no tiene ningún caso de prueba real en el alcance actual, y además evita conflar dos variables distintas en el experimento de CH-16 (genericidad de mapeo vs. portabilidad de dialecto), el riesgo que la propia D-5 señalaba.

**Se resigna.** Si en el futuro aparece un tenant real sobre MySQL, esta decisión se reabre y hay que construir la segunda variante de vistas canónicas que D-4 dejaba prevista.

**Decidido por:** el usuario, 2026-09-19, no inferido por el agente.

**Estado:** firme. Cierra D-4.

---

### DEC-26 — Segundo esquema para validar genericidad: Medusa (D-5)

**Contexto.** D-5 exigía elegir un segundo esquema real (distinto de Food Store) para el experimento de CH-16, que es el que responde la pregunta central de genericidad del sistema. Candidatos investigados con fuentes oficiales: Saleor y Medusa (PostgreSQL), WooCommerce y PrestaShop (MySQL/MariaDB).

**Opciones.** (a) Saleor. (b) Medusa. (c) WooCommerce. (d) PrestaShop.

**Decisión.** (b). Medusa.

**Por qué.** Es el único candidato con modelo de insumos/bill-of-materials nativo (Inventory Kit: un `InventoryItem` se vincula a una variante con `required_quantity`), relevante porque el contexto del proyecto modela insumos y recetas y CH-16 necesita ejercitar ese caso, no solo stock por producto/variante. Corre sobre PostgreSQL, igual que Food Store, lo cual permite cerrar D-4 como "solo PostgreSQL" sin dejar nada sin probar en el alcance actual.

**Se resigna.** Medusa no tiene imagen Docker oficial con datos de demo (el repo `medusajs/docker-medusa` es comunitario y pide seed manual), a diferencia de PrestaShop que sí la tiene. Levantar el entorno de prueba para CH-16 va a requerir seed manual documentado, no un `docker compose up` con datos ya cargados. También queda pendiente verificar si Medusa modela recetas con pasos (no solo lista de materiales) — no confirmado en la investigación inicial, revisar al llegar a CH-16.

**Decidido por:** el usuario, 2026-09-19, no inferido por el agente.

**Estado:** firme. Cierra D-5.

---

### DEC-27 — Vista `v_producto` mapea al nivel de variante de Medusa, no al de producto padre

**Contexto.** Al definir las vistas canónicas de CH-16 contra el esquema real de Medusa, apareció una asimetría que ninguna decisión previa contemplaba. El contrato canónico modela `producto` como una entidad plana: una fila por `id`, con un único `stockDisponible` y un único `sku`. Medusa, en cambio, separa esa información en tres tablas encadenadas — `product` (metadata de catálogo: título, estado, sin stock ni SKU propios), `product_variant` (el SKU vendible real, con su propio `sku`) e `inventory_item`/`inventory_level` (el stock físico, enlazado a la variante vía `product_variant_inventory_item`) — y un solo `product` puede tener N variantes, cada una con su propio SKU y su propio stock independientes (confirmado en el seed de demostración: "Medusa T-Shirt" tiene 8 variantes por talle/color, cada una con su propio `product_variant.sku` y su propia fila de inventario). Además, `order_line_item.variant_id` es la referencia real que Medusa usa para vincular una línea de pedido a lo vendido, no `product_id` a secas. Había que decidir a qué nivel de la jerarquía de Medusa corresponde la fila canónica "producto".

**Opciones.** (a) Mapear `v_producto` a `product`, agregando (sumando) el stock de todas sus variantes en una sola fila y resolviendo de algún modo el `sku`, que dejaría de ser único. (b) Mapear `v_producto` a `product_variant`: cada variante de Medusa es una fila canónica "producto" independiente, con su propio `sku` y su propio stock agregado solo sobre sus propios ítems de inventario.

**Decisión.** (b). Cada `product_variant` de Medusa es una fila de `v_producto`.

**Por qué.** Es al nivel de variante donde Medusa liga precio, SKU, stock y la referencia real de una línea de pedido (`order_line_item.variant_id`) — exactamente lo que las tres automatizaciones (stock-físico, stock-producible, reporte-diario) necesitan que `producto.id` identifique sin ambigüedad. La opción (a) obligaría a agregar SKUs y stocks heterogéneos de variantes distintas (p. ej. los talles S/M/L/XL de una misma remera) en una sola fila, perdiendo exactamente la precisión que el contrato exige como obligatoria en `stockDisponible` y `sku`.

**Se resigna.** `producto.nombre` deja de ser el nombre comercial del producto padre (`Medusa T-Shirt`) y pasa a ser una concatenación con el título de la variante (`Medusa T-Shirt - S / Black`), porque `product_variant.title` solo ("S / Black") no identifica el producto sin ambigüedad. Un tercer esquema sin modelo de variantes no va a necesitar esta resolución, pero cualquier otro que sí las tenga la va a necesitar de nuevo, y esta decisión queda como precedente de cómo tratarla.

**Decidido por:** propuesta por el agente durante la ejecución del experimento CH-16 (2026-09-19) — a diferencia de DEC-01 a DEC-26, no surge de una elección de producto hecha por el usuario durante exploración, sino de un hallazgo estructural dentro de un experimento ya autorizado por el usuario. Confirmada por el usuario, con las dos opciones presentadas explícitamente, el 2026-09-21.

**Estado:** firme. El usuario revisó las opciones (a) y (b) y confirmó (b).

---

### DEC-28 — Las vistas canónicas exponen el stock declarado crudo, no el producible calculado

**Contexto.** Al escribir `v_producto` sobre el esquema real de Food Store para CH-16b, apareció una decisión de diseño que ninguna decisión previa contemplaba: qué valor expone `v_producto."stockDisponible"` para un producto con receta. Food Store persiste `product.stock_quantity` (un valor declarado que el propio backend ignora para productos con receta) y no persiste ningún stock producible ya calculado. Medusa, en el mismo campo, expone el stock físico de `inventory_level` (también un hecho crudo, no un cálculo), sin que CH-16 hubiera nombrado esto como una decisión.

**Opciones.** (a) La vista expone el hecho crudo que la plataforma persiste (`stock_quantity` en Food Store, `inventory_level` en Medusa), sin calcular nada. (b) La vista precalcula el stock producible para productos con receta (usando `v_receta_componente`) y expone ese valor en lugar del declarado.

**Decisión.** (a). Las vistas exponen hechos, no cálculos.

**Por qué.** Si la vista precalculara el producible, la divergencia entre stock declarado y stock producible — que la sección 6.2.2 usa como hallazgo central del trabajo — dejaría de ser observable desde la capa canónica: quien consulte `v_producto` ya no podría ver que la plataforma ignora el producible para productos con receta, porque la vista se lo habría resuelto por debajo. El cálculo es responsabilidad de la automatización (`stock-producible`, que ya lo hace cruzando `v_producto`, `v_insumo` y `v_receta_componente`), no de la capa de correspondencia.

**Consecuencia.** Para un producto con receta, `v_producto."stockDisponible"` contiene un valor que la propia plataforma no usa para decidir si puede producirse más. La capa canónica lo expone tal cual porque es lo que la plataforma efectivamente persiste; interpretarlo correctamente queda a cargo de quien consulta la vista (o de la automatización que sí cruza con la receta).

**Decidido por:** propuesta por el agente durante CH-16b (2026-09-21), a partir de la bitácora `docs/bitacora/bitacora_CH-16b_tres_esquemas.md`. Confirmada por el usuario el 2026-09-21.

**Estado:** firme.

---

### DEC-29 — Criterio de obligatoriedad de campos del contrato; `insumo."unidadMedida"` pasa a opcional

**Contexto.** La verificación de PASO 6 de CH-16b encontró que `insumo."unidadMedida"` está declarado `obligatorio` en `src/contrato.ts`, pero Food Store no tiene ninguna columna de la que derivarlo y la consulta canónica (`04_consulta_canonica.sql`, la implementación real de `stock-producible`) nunca lo lee: divide `insumo.stockDisponible` por `receta_componente.cantidadPorUnidad` directamente, sin verificar compatibilidad de unidades. El contrato declaraba una exigencia que ninguna automatización actual hace cumplir.

**Opciones.** (a) Mantener `unidadMedida` obligatorio y tratar a Food Store como un caso que no satisface el contrato. (b) Bajar `unidadMedida` a opcional, y fijar un criterio general para decidir la obligatoriedad de cualquier campo del catálogo: un campo es obligatorio si y solo si al menos una automatización del catálogo no puede ejecutarse sin él.

**Decisión.** (b). `insumo."unidadMedida"` pasa a `opcional` en `src/contrato.ts`. Criterio general adoptado para toda entrada futura al catálogo: **un campo es obligatorio si y solo si al menos una automatización no puede ejecutarse sin él.**

**Por qué.** Ninguna automatización actual (la única implementada es `stock-producible`, vía `04_consulta_canonica.sql`) lee ni valida `unidadMedida`. Declararlo obligatorio imponía una exigencia sobre el esquema de origen que ninguna automatización necesita, y ya produjo un falso conflicto contra Food Store (fricción 1 de la bitácora de CH-16b).

**Revisión del resto de campos obligatorios contra este criterio (2026-09-21).** Se verificó, campo por campo, contra la única automatización con implementación real (`stock-producible` / `04_consulta_canonica.sql`): `producto.id`, `producto.nombre`, `insumo.id`, `insumo.nombre`, `insumo.stockDisponible`, `receta_componente.productoId`, `receta_componente.insumoId` y `receta_componente.cantidadPorUnidad` están todos efectivamente leídos por esa consulta — ninguno falla el criterio. `producto.stockDisponible` no lo lee `stock-producible`, pero sigue pasando el criterio porque el propio comentario del contrato lo ata a `stock-fisico` como el valor que esa automatización reporta directamente.

Los campos obligatorios de `pedido` e `item_pedido` (atados a `reporte-diario`) **no se pudieron verificar contra código real**: `reporte-diario` no tiene implementación en este repositorio (igual que `stock-fisico`), así que no hay ninguna consulta ni función contra la cual confirmar o refutar que cada campo es indispensable para ejecutar la automatización. Aplicar el criterio ahí sería adivinar. Quedan sin cambiar, con esta limitación registrada, para revisar cuando esas automatizaciones existan.

**Decidido por:** el usuario, 2026-09-21 — instrucción directa, no inferida por el agente. La revisión del resto del catálogo la hizo el agente, reportando sin decidir.

**Estado:** firme.

---

## Compuertas abiertas

No bloquean el R0. Bloquean el R2. Cerrarlas antes de modelar la persistencia definitiva.

### D-1 — ¿Se persisten los resultados de las consultas?

Opciones: solo consultas y metadatos / resultados con retención acotada / resultados completos.

**Qué depende.** Si el sistema custodia datos personales de los clientes del cliente. Cambia por completo el apartado de consideraciones éticas y legales.

**Inclinación actual:** solo consultas y metadatos de ejecución; el resultado viaja al correo y no se guarda.

**Estado:** abierta.

---

### D-2 — ¿Cómo llega el motor a la réplica del cliente?

Opciones: conexión directa (el cliente expone su base) / agente saliente instalado junto a la réplica / VPN.

**Qué depende.** La barrera de entrada, que es la hipótesis central del trabajo. Pedirle a una PYME que exponga su base a internet contradice esa hipótesis.

**Inclinación actual:** agente saliente. Cuesta más desarrollo y preserva el argumento.

**Pendiente de verificar:** cómo lo resuelven productos comparables.

**Estado:** abierta.

---

### D-3 — Stack tecnológico (cerrada)

Resuelta como DEC-05: Node.js + TypeScript, base propia en PostgreSQL.

**Estado:** cerrada. Ver DEC-05 en "Decisiones tomadas".

---

### D-4 — Motores de base admitidos (cerrada)

Resuelta como DEC-25: solo PostgreSQL.

**Estado:** cerrada. Ver DEC-25 en "Decisiones tomadas".

---

### D-5 — Segundo esquema para la validación de genericidad (cerrada)

Resuelta como DEC-26: Medusa.

**Estado:** cerrada. Ver DEC-26 en "Decisiones tomadas".

---

### D-6 — Declaración de uso de asistentes de IA

**Qué depende.** Requisitos de la institución sobre declarar el uso de herramientas de IA en el desarrollo.

**Estado:** abierta. Consultar el reglamento antes de la entrega.
