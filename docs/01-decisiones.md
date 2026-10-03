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
1. **Licencia.** La Sustainable Use License de n8n limita el uso a fines internos propios de negocio o a fines no comerciales o personales, y solo permite distribuir el software o proveerlo a terceros en forma gratuita y con fines no comerciales: *"You may use or modify the software only for your own internal business purposes or for non-commercial or personal use. You may distribute the software or provide it to others only if you do so free of charge for non-commercial purposes."* Un modelo en el que el implementador aloja las automatizaciones de varios clientes y cobra por el servicio no encuadra en el uso interno propio. *(Fuente: `LICENSE.md` del repositorio `n8n-io/n8n`, rama `master`, Sustainable Use License versión 1.0, sección "Limitations". Consultado el 2026-09-24. Para uso comercial, confirmar con el proveedor.)*
2. **Alcance.** La generalidad de n8n excede lo que el catálogo necesita: todas las automatizaciones responden al mismo patrón lineal.

**Se resigna.** Todo lo que n8n resolvía pasa a ser responsabilidad propia: planificación, reintentos, solapamientos, ejecuciones interrumpidas, historial. Es el bloque X del mapa de historias.

**Efecto sobre la tesis.** Los tres workflows dejan de ser el artefacto y pasan a ser el estudio previo que define el patrón y el catálogo inicial.

**Estado:** firme.

**Nota de corrección (2026-09-24).** Se reescribió el punto 1 del "Por qué". Decía que la licencia "excluye explícitamente alojar n8n cobrando por el acceso, y embeberlo en un producto propio", pero el texto de la licencia no contiene esa exclusión literal. Ahora cita el texto de la sección "Limitations" y aclara que la conclusión sobre el modelo multi-tenant es una interpretación de ese texto. La decisión no cambia.

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

### DEC-30 — Mapeo por tenant (CH-09): vistas canónicas registradas, no generadas

**Contexto.** El mapa de changes define CH-09 (M2) como "vistas canónicas registradas o generadas por tenant", sin elegir entre las dos. CH-16b ya escribió a mano las vistas canónicas de tres esquemas (`03_vistas_foodstore.sql`, `06_vistas_medusa.sql`, `08_vistas_woo.sql`) y encontró casos que no son una correspondencia columna a columna: atributos como filas en WooCommerce (entidad-atributo-valor), el stock de Medusa detrás de joins con `inventory_level`, y el mapeo a nivel de variante (DEC-27).

**Opciones.** (a) Registradas: la operadora escribe el SQL de las vistas canónicas de cada tenant y la herramienta lo registra. (b) Generadas: la operadora declara qué columna de origen corresponde a cada campo del contrato y la herramienta arma las vistas.

**Decisión.** (a). Vistas registradas, escritas por la operadora.

**Por qué.** Es lo que CH-16b ya probó que funciona sobre esquemas reales. Un generador por correspondencia de columnas no cubre los casos que CH-16b encontró, y ampliarlo para cubrirlos sería agregarle al producto una capacidad de traducción de esquemas que el anti-alcance no contempla. Además, escribir las vistas es justamente el costo de adaptación que la tesis quiere medir (CH-15, CH-16); generarlas lo ocultaría.

**Se resigna.** El alta de un tenant exige saber SQL y entender el modelo de datos de origen (la barrera de entrada que CH-16b registró para la clase entidad-atributo-valor). No hay asistencia para escribir las vistas.

**Queda abierto para la exploración de CH-09, sin decidir acá:** dónde viven las vistas y cómo se aplican. Crearlas como objetos en la réplica del cliente requiere permisos de DDL, que chocan con la regla 3 (usuario de base sin escritura); guardarlas en la base propia y componerlas en cada consulta no requiere esos permisos. Es una decisión de arquitectura y se registra aparte antes de especificar. *(Cerrado por DEC-31.)*

**Decidido por:** el usuario, 2026-09-23 — elección directa entre (a) y (b), no inferida por el agente.

**Estado:** firme.

---

### DEC-31 — Las vistas registradas viven en la base propia y se aplican como `WITH` en cada consulta

**Contexto.** DEC-30 dejó abierto dónde viven las vistas canónicas registradas y cómo se aplican al consultar. La exploración de CH-09 (`openspec/changes/CH-09-tenant-schema-mapping/explore.md`) comparó cuatro opciones contra las reglas no negociables y el motor ya implementado.

**Opciones.** (A) Crearlas como `VIEW` reales en la réplica con la credencial guardada. (A-sub) Que el cliente las cree en su réplica con un usuario con privilegios, y ZeroDashboard solo las verifique. (B) Guardar el SQL en la base propia y anteponerlo como `WITH v_x AS (...)` a cada consulta. (C) Tablas foráneas (`postgres_fdw`) y vistas reales dentro de la base propia.

**Decisión.** (B).

**Por qué.** Es la única opción que no requiere DDL en la réplica: (A) es inviable con el motor actual, porque `verificarPermisosRol()` bloquea cualquier rol con `CREATE` (`rol-con-create-en-esquema`, DEC-08) y además pondría una credencial con escritura en la base propia, contra DEC-16/17. (A) y (A-sub) son imposibles si la réplica es una réplica física real (hot standby no admite DDL). La consulta armada pasa por el mismo pipeline que cualquier otra (`BEGIN TRANSACTION READ ONLY`, chequeo de permisos, `LIMIT $1 OFFSET $2`), así que no hace falta maquinaria de validación nueva. Anteponer SQL escrito por la operadora no viola la regla 4, que se refiere a valores en tiempo de ejecución: es el mismo patrón que el envoltorio de paginación ya implementado. El registro es una llamada a la API, medible por CH-15, y no depende de cómo se cierre D-2. (C) exige una conexión persistente entre servidores y una credencial duplicada por tenant.

**Se resigna.** Las vistas no existen como objetos en la base del cliente, así que no se pueden inspeccionar con herramientas de catálogo del lado del cliente. El armado tiene que manejar consultas que abren su propio `WITH`, y los nombres de las vistas pasan a ser identificadores reservados dentro de la consulta armada.

**Alcance acordado para CH-09.** Solo registro: alta, listado y lectura del mapeo, más una vista previa opcional de cero filas por el pipeline existente. El armado de los `WITH` en tiempo de ejecución se construye en CH-12, donde se consume. `POST /consultas/ejecutar` no cambia: sigue ejecutando SQL ad hoc contra el esquema nativo.

**Decidido por:** el usuario, 2026-09-23, a partir de la exploración de CH-09 — no inferido por el agente.

**Estado:** firme.

---

### DEC-32 — El mapeo se registra por entidad canónica, con el nombre del contrato como clave

**Contexto.** El mapeo registrado (DEC-30/31) podía guardarse como un único bloque de SQL por origen (como los archivos de CH-16b) o como una definición por entidad canónica.

**Opciones.** (a) Una definición por entidad, con el nombre exacto de `CONTRATO_CANONICO` como clave (`producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`). (b) Un único bloque de SQL con todas las vistas.

**Decisión.** (a).

**Por qué.** CH-10 (M3/M4) necesita saber qué entidades están mapeadas para declarar qué automatizaciones son inaplicables; con (a) es un chequeo de existencia, con (b) habría que parsear el SQL. Usar los nombres del contrato como clave formaliza lo que `src/contrato.ts` ya anticipaba.

**Se resigna.** Una vista que dependa de otra (por ejemplo, una CTE auxiliar compartida) no tiene lugar propio; cada definición tiene que ser autocontenida.

**Decidido por:** el usuario, 2026-09-23 — no inferido por el agente.

**Estado:** firme.

---

### DEC-33 — El mapeo se asocia a la `Conexion`, no al `Tenant`

**Contexto.** El modelo permite varias `Conexion` por tenant. Había que decidir a qué entidad pertenece el mapeo registrado.

**Opciones.** (a) A la `Conexion`. (b) Al `Tenant`.

**Decisión.** (a).

**Por qué.** El SQL de las vistas depende del esquema de origen, que es propio de cada conexión. Asociarlo al tenant asumiría una sola plataforma por tenant, algo que no está escrito en ningún documento.

**Se resigna.** Un tenant con dos conexiones al mismo esquema tiene que registrar el mapeo dos veces. El modelo nuevo entra en `MODELOS_AISLADOS` (DEC-13) igual que `Conexion`.

**Decidido por:** el usuario, 2026-09-23 — no inferido por el agente.

**Estado:** firme.

---

### DEC-34 — Registrar de nuevo el mapeo de una entidad reemplaza la definición anterior

**Contexto.** DEC-32 admite una sola definición por conexión y entidad canónica. DEC-10 dejó fuera la actualización de consultas guardadas por solaparse con B4 (versionado, CH-25), pero ahí siempre se puede guardar una consulta nueva. En el mapeo no: si registrar de nuevo se rechaza, una definición equivocada queda trabada hasta CH-25.

**Opciones.** (a) Reemplazar: registrar de nuevo pisa la definición anterior, sin historial. (b) Rechazar con 409, coherente con DEC-10. (c) Rechazar con 409 y agregar una ruta de borrado.

**Decisión.** (a).

**Por qué.** Corregir un mapeo es parte normal del alta (en CH-16b las vistas se iteraron varias veces), y es la única forma de corregirlo sin agregar una ruta que ninguna historia pide.

**Se resigna.** Se aparta de DEC-10 para esta entidad: una definición reemplazada no deja rastro. El historial queda para B4/CH-25. No hay borrado: una entidad mapeada por error no se puede desmapear en CH-09.

**Decidido por:** el usuario, 2026-09-23, durante la propuesta de CH-09 — no inferido por el agente.

**Estado:** firme.

---

### DEC-35 — `VistaCanonica` no suma una clave foránea compuesta por tenant; el aislamiento sigue siendo DEC-13

**Contexto.** `VistaCanonica` (CH-09) tiene `tenantId` y `conexionId`. La extensión de aislamiento completa el `tenantId` de la fila nueva, pero la clave foránea a `Conexion` aceptaría el id de una conexión de otro tenant si algo llegara a escribirlo. Había que decidir si la base lo impide por estructura.

**Opciones.** (a) Buscar la conexión con el delegado aislado antes de escribir (la de otro tenant da 404), cubierto por la prueba T2. (b) Clave foránea compuesta `(conexionId, tenantId)` → `Conexion(id, tenantId)`, que exige un índice único nuevo en `Conexion`.

**Decisión.** (a).

**Por qué.** Mantiene un único mecanismo de aislamiento (DEC-13) y no toca la tabla `Conexion` existente.

**Se resigna.** La garantía de no tener filas cruzadas es de la aplicación y de la prueba T2, no de la base. Una escritura que evitara el delegado aislado podría crear una fila cruzada.

**Decidido por:** el usuario, 2026-09-23, durante el diseño de CH-09 — no inferido por el agente.

**Estado:** firme.

---

### DEC-36 — `producto.activo` pasa a obligatorio; `stock-producible` deja de figurar en `producto.stockDisponible`

**Contexto.** La consulta canónica de `stock-producible` (`openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql`) filtra `WHERE pr.activo = true`, pero `src/contrato.ts` declaraba `producto.activo` como `opcional`. Si una plataforma no puede poblarlo, la vista lo deja en `NULL`, el filtro descarta todas las filas y la automatización devuelve cero filas sin error. Además, el contrato declaraba que `stock-producible` usa `producto.stockDisponible`, pero esa consulta no lo lee: solo lee `insumo."stockDisponible"`. Por el criterio de DEC-29, `activo` debería ser obligatorio y la etiqueta de `producto.stockDisponible` no correspondía.

**Opciones.** (a) `producto.activo` pasa a `obligatorio`, y se quita `STOCK_PRODUCIBLE` de las automatizaciones de `producto.stockDisponible`. (b) Cambiar la consulta a `COALESCE(pr.activo, true)`, para que un `activo` ausente cuente como activo y el campo pueda seguir siendo opcional.

**Decisión.** (a).

**Por qué.** Aplica el criterio de DEC-29 a lo que la consulta real hace hoy: `stock-producible` no puede dar un resultado correcto sin `activo`, así que el campo es obligatorio. `producto.stockDisponible` sigue siendo obligatorio por `stock-fisico` y `reporte-diario`, pero `stock-producible` no lo lee, y declarar esa dependencia era falso. El contrato se ajusta a la consulta, no al revés.

**Se resigna.** (b), que habría evitado exigir el campo. Una plataforma que no modele productos activos/inactivos tiene que derivar `activo` en su vista canónica (por ejemplo, fijarlo en `true`), en lugar de que la consulta lo resuelva. El contrato declara la exigencia pero no la hace cumplir: una vista que deje `activo` en `NULL` sigue produciendo cero filas sin error. Esa verificación queda fuera de esta decisión.

**Decidido por:** el usuario (autor), 2026-09-24 — decisión tomada por el autor y transcripta por el agente, no inferida.

**Estado:** firme.

---

### DEC-37 — En Saleor, `v_producto."stockDisponible"` suma sobre todos los depósitos lo no asignado

**Contexto.** CH-16c escribe `v_producto` sobre una instancia real de Saleor (`openspec/changes/CH-16c-saleor-caso-negativo/sql/10_vistas_saleor.sql`). Saleor registra la existencia en `warehouse_stock` por variante **y** por depósito, con `quantity` y `quantity_allocated` (lo ya asignado a pedidos). El contrato espera un único `stockDisponible` por producto, así que hay que decidir cómo agregar. La granularidad por variante sigue a DEC-27.

**Opciones.** (a) Sumar sobre todos los depósitos `quantity - quantity_allocated`. (b) Sumar `quantity` sin restar lo asignado. (c) Tomar un solo depósito. (d) Filtrar por canal.

**Decisión.** (a): `stockDisponible = SUM(quantity - quantity_allocated)` sobre todos los depósitos de la variante, `0` si no tiene filas de stock.

**Por qué.** Decidido por el autor. Es la lectura más directa de "disponible" en el modelo de Saleor: lo que existe en cualquier depósito y todavía no está comprometido.

**Se resigna.** La distinción por depósito y por canal: una variante con stock en un depósito que no abastece a ningún canal cuenta igual. Es la misma pregunta que quedó abierta para `insumo.stockDisponible` en Medusa; esta decisión la cierra solo para `producto` en Saleor.

**Decidido por:** el usuario (autor), 2026-09-24 — decisión tomada por el autor y transcripta por el agente, no inferida.

**Estado:** firme.

---

### DEC-38 — En Saleor, `producto.activo` = publicado en al menos un canal

**Contexto.** DEC-36 hizo obligatorio `producto.activo`. Saleor no tiene un campo "activo" ni en la variante ni en el producto: la publicación depende del canal (`product_productchannellisting.is_published`). La vista de CH-16c tiene que derivarlo, y si lo dejara en `NULL` la consulta canónica devolvería cero filas sin error.

**Opciones.** (a) Activo si el producto está publicado en al menos un canal. (b) Activo solo si está publicado en un canal determinado (por ejemplo, el canal por defecto). (c) Fijarlo en `true`.

**Decisión.** (a): `activo = EXISTS (product_productchannellisting con is_published)` para el producto de la variante. Nunca es `NULL`.

**Por qué.** Decidido por el autor. Es una decisión de granularidad, no una columna: traduce la publicación por canal a un booleano sin elegir un canal arbitrario.

**Se resigna.** La visibilidad por canal y la fecha de publicación (`published_at`). Un producto publicado en un canal que el negocio no usa cuenta como activo.

**Decidido por:** el usuario (autor), 2026-09-24 — decisión tomada por el autor y transcripta por el agente, no inferida.

**Estado:** firme.

---

### DEC-39 — Cada campo del contrato declara un tipo semántico, validado con un mapeo tolerante desde Postgres

**Contexto.** M3 (CH-10) pide que la validación del mapeo falle ante columnas o **tipos** faltantes, pero `CampoCanonico` en `src/contrato.ts` no declara ningún tipo: no hay contra qué comparar el tipo de una columna de la vista. Además, CH-16b/c/d mostraron que esquemas distintos usan tipos distintos para el mismo concepto (identificadores `int`, `uuid` o `text`).

**Opciones.** (a) Un tipo semántico por campo (`texto`, `numero`, `booleano`, `fecha`), con un mapeo documentado y tolerante de tipos Postgres (OID) a esas categorías. (b) Un nombre de tipo Postgres exacto por campo. (c) No validar tipos, solo presencia de columnas, registrando la reducción de alcance de M3.

**Decisión.** (a), con una quinta categoría `identificador` para los campos de identidad y referencia (`id`, `pedidoId`, `productoId`, `insumoId`) y para `pedido.numero`, que acepta enteros, `uuid` y texto.

**Por qué.** Cumple lo que M3 pide sin atar el contrato a los tipos físicos de una plataforma. La tolerancia del mapeo absorbe la heterogeneidad ya observada entre Food Store, Medusa y Saleor. La categoría `identificador` se agregó durante la propuesta de CH-10: los identificadores son `int`, `uuid` o `text` según la plataforma, y declararlos `texto` habría debilitado el significado de esa categoría para el resto de los campos. Durante el diseño se aclaró que `pedido.numero` (el número de pedido legible por la operadora) también es `identificador`: según la plataforma es entero o alfanumérico.

**Se resigna.** Precisión: dos columnas de la misma categoría (por ejemplo, `int4` y `numeric`) se consideran equivalentes, aunque una consulta canónica pueda comportarse distinto con cada una. Se modifica `src/contrato.ts`, que DEC-21 declara central.

**Decidido por:** el usuario (autor), 2026-09-26, durante la exploración de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-40 — La validación del mapeo es una acción explícita y su resultado se persiste

**Contexto.** M3 pide validar el mapeo antes de activar automatizaciones y M4 pide ver qué automatizaciones quedan inaplicables. Había que decidir si el resultado se calcula al leer o se guarda. G1 (CH-15) pide además una marca de tiempo de validación.

**Opciones.** (a) Calcular al leer: cada consulta abre la conexión del tenant y valida en vivo, sin guardar nada. (b) Acción explícita "validar" que persiste estado, diagnóstico por campo y fecha; las lecturas sirven el último resultado sin tocar la base del tenant. (c) Híbrido: (b) más validación en vivo forzada por entidad.

**Decisión.** (b).

**Por qué.** Hace de "falla ruidosamente" un estado durable e inspeccionable, da la marca de tiempo que pide G1 y deja el resultado listo para el panel (CH-22) sin depender de conectividad al leer.

**Se resigna.** Frescura: el resultado guardado puede quedar desactualizado si el esquema de origen cambia sin que nadie revalide. Requiere persistencia nueva y su delta en la spec `domain-data-model`.

**Decidido por:** el usuario (autor), 2026-09-26, durante la exploración de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-41 — Registrar de nuevo el SQL de una entidad invalida su validación guardada

**Contexto.** DEC-34 hace que registrar de nuevo el mapeo de una entidad reemplace la definición anterior. Con DEC-40, esa entidad puede tener un resultado de validación guardado que corresponde al SQL viejo.

**Opciones.** (a) Cualquier cambio de SQL deja la entidad en "no validado" hasta una nueva validación. (b) El resultado anterior se mantiene hasta la próxima validación explícita, documentado como límite.

**Decisión.** (a).

**Por qué.** Evita que un veredicto de un SQL viejo se aplique en silencio a uno nuevo, el mismo tipo de falla silenciosa que DEC-36 señala.

**Se resigna.** Después de cada corrección del mapeo hay que volver a validar.

**Decidido por:** el usuario (autor), 2026-09-26, durante la exploración de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-42 — La validación del mapeo es solo estructural: consulta de cero filas

**Contexto.** La validación puede limitarse a la forma de la vista (columnas y tipos, con `LIMIT 0`) o también leer una muestra de datos. Solo con una muestra se detectaría el caso que DEC-36 deja abierto: un campo obligatorio mapeado pero siempre `NULL`.

**Opciones.** (a) Solo estructural: `LIMIT 0`, sin leer datos del tenant. (b) Estructural más una muestra acotada que advierta `NULL` en campos obligatorios, con su propio presupuesto de filas y timeout sobre DEC-18/19.

**Decisión.** (a).

**Por qué.** No lee datos del tenant (minimización, regla 5) y no suma un presupuesto nuevo sobre DEC-18/19.

**Se resigna.** Una vista con las columnas y tipos correctos pero valores `NULL` en un campo obligatorio pasa la validación. Queda documentado como límite del artefacto.

**Decidido por:** el usuario (autor), 2026-09-26, durante la exploración de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-43 — Una vista con columnas que el contrato no define no pasa la validación

**Contexto.** Una vista canónica registrada puede exponer columnas que el contrato no define, entre ellas campos personales que DEC-23 excluyó del contrato. Había que decidir si la validación de CH-10 las mira.

**Opciones.** (a) La entidad queda inválida y el diagnóstico nombra las columnas sobrantes. (b) La entidad puede quedar válida, con las columnas sobrantes listadas como advertencia. (c) Se ignoran, documentado como límite.

**Decisión.** (a).

**Por qué.** Hace cumplir la minimización (regla 5) por estructura en el mapeo, no solo en la definición del contrato, en línea con DEC-23.

**Se resigna.** Una vista con columnas auxiliares inocuas (por ejemplo, para depurar) tiene que quitarlas antes de validar.

**Decidido por:** el usuario (autor), 2026-09-26, durante la propuesta de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-44 — El resultado de la validación se guarda en columnas de `VistaCanonica`

**Contexto.** DEC-40 exige persistir el resultado de la validación. Había que decidir dónde.

**Opciones.** (a) Columnas nuevas en `VistaCanonica`: estado, diagnóstico (JSON) y fecha de validación. (b) Un modelo nuevo de resultados, con una fila por validación.

**Decisión.** (a).

**Por qué.** DEC-41 se cumple en el mismo upsert que reemplaza el SQL, y no se suma un modelo aislado nuevo a `MODELOS_AISLADOS` ni a la prueba T2. Las entidades no mapeadas no tienen fila; su estado se deriva del contrato al leer.

**Se resigna.** Historial: solo se guarda la última validación de cada entidad.

**Decidido por:** el usuario (autor), 2026-09-26, durante la propuesta de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-45 — Los tipos Postgres fuera de la tabla de categorías no pasan la validación, con una pista de cast

**Contexto.** El mapeo tolerante de DEC-39 cubre los tipos básicos de Postgres. Quedan afuera arrays, `money`, `json`, enums y cualquier OID no incluido; por ejemplo, `order.status` de Medusa es un enum.

**Opciones.** (a) No se aceptan: el campo falla y el diagnóstico sugiere castear la columna en la vista (por ejemplo, `::text`). (b) Clasificarlos por `pg_type.typcategory`, con una consulta extra al catálogo en la conexión del tenant.

**Decisión.** (a).

**Por qué.** La clasificación queda determinista y sin lecturas extra sobre la base del tenant, y el cast queda explícito en el mapeo, donde se lee.

**Se resigna.** Una vista que exponga un enum tiene que castearlo aunque su contenido sea texto legible.

**Decidido por:** el usuario (autor), 2026-09-26, durante el diseño de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-46 — Una automatización inaplicable y bloqueada a la vez se informa como inaplicable, con todos los motivos

**Contexto.** El informe de aplicabilidad de CH-10 (M4) puede encontrar una automatización que es inaplicable (una entidad opcional sin mapear) y a la vez está bloqueada (una entidad o campo obligatorio que falla la validación).

**Opciones.** (a) Estado `inaplicable`, listando todos los motivos, incluidos los bloqueos. (b) Estado `bloqueada`, priorizando el error corregible, también con todos los motivos.

**Decisión.** (a).

**Por qué.** Corregir el error no volvería aplicable la automatización: la falta de datos en la plataforma manda. Los bloqueos siguen visibles entre los motivos.

**Se resigna.** Quien mire solo el estado no ve que además hay un error de mapeo; tiene que leer los motivos.

**Decidido por:** el usuario (autor), 2026-09-26, durante el diseño de CH-10 — no inferido por el agente.

**Estado:** firme.

---

### DEC-47 — Los parámetros se escriben con nombre (`:nombre`) y se reescriben a `$n` al ejecutar

**Contexto.** CH-11 (B3) introduce parámetros en las consultas. Hoy el SQL del usuario no tiene ningún concepto de parámetro; los únicos parámetros del driver son los de la paginación.

**Opciones.** (a) Marcadores con nombre `:nombre`, reescritos a posicionales `$n` con una transformación de texto plano (sin analizador de SQL, en línea con DEC-09). (b) Posicionales `$1, $2…` escritos a mano, más una lista declarada en el mismo orden. (c) Otra convención, como `{{nombre}}`.

**Decisión.** (a).

**Por qué.** La identidad del parámetro es el nombre: puede repetirse en la consulta y el orden de la declaración no importa. Con (b), un desfase entre la lista y el SQL asigna un valor equivocado sin error; (c) se parece a un motor de plantillas.

**Se resigna.** Una transformación por texto tiene casos borde que un analizador absorbería (`::tipo`, `:` dentro de cadenas, bloques `$$…$$`); se enumeran y se prueban. La sustitución sigue siendo siempre por parámetros del driver (regla 4).

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-48 — Los parámetros se declaran en la consulta guardada y en la ejecución suelta

**Contexto.** Hay dos superficies que ejecutan consultas: `ConsultaGuardada` (DEC-10) y `POST /consultas/ejecutar` con SQL suelto.

**Opciones.** (a) Solo en `ConsultaGuardada`. (b) En `ConsultaGuardada` (persistida) y en la ejecución suelta (declaración y valores en la misma petición, sin persistir). (c) Un modelo nuevo, separado de `ConsultaGuardada`.

**Decisión.** (b).

**Por qué.** B1 y B2 ya tratan ambas superficies como dos entradas a la misma operación de ejecución; B3 extiende esa operación, no solo la entidad guardada.

**Se resigna.** La misma lógica de reescritura y validación corre sobre dos fuentes de declaración. Como `ConsultaGuardada` no tiene ruta de edición (DEC-10), corregir una declaración guardada implica guardar una consulta nueva.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-49 — Los parámetros tienen un vocabulario de tipos propio: texto, numero, booleano, fecha

**Contexto.** Un parámetro declarado necesita un tipo. `TipoSemantico` (DEC-39) ya existe, pero clasifica columnas leídas de una vista, no valores que alguien ingresa.

**Opciones.** (a) Reusar `TipoSemantico` completo, con `identificador`. (b) Un conjunto propio sin `identificador`. (c) Sin tipo declarado.

**Decisión.** (b).

**Por qué.** `identificador` describe la tolerancia de una columna (`int`/`uuid`/`text`), no un valor de entrada. Sin tipo declarado, B3 pierde el "declarado".

**Se resigna.** Conviven dos vocabularios parecidos pero distintos; `src/contrato.ts` no se toca.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-50 — Todo parámetro declarado es obligatorio; no hay valores por defecto

**Contexto.** Un parámetro podría ser opcional y tomar un valor por defecto.

**Opciones.** (a) Todos obligatorios, sin valores por defecto. (b) Opcionales con valor por defecto. (c) Sin control propio: el error lo da Postgres.

**Decisión.** (a).

**Por qué.** Es la lectura literal de B3 y ninguna historia de R1 pide valores por defecto. Si una plantilla los necesita, se decide en CH-12.

**Se resigna.** Quien ejecuta tiene que mandar siempre todos los valores.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-51 — El valor de un parámetro se valida en dos capas: forma en la aplicación, tipo final en Postgres

**Contexto.** Un valor enviado puede no coincidir con el tipo declarado.

**Opciones.** (a) Solo la aplicación, antes de ejecutar. (b) Solo Postgres, clasificado por `classifyExecutionError`. (c) Ambas.

**Decisión.** (c).

**Por qué.** La aplicación falla temprano y con un mensaje que nombra el parámetro (mismo criterio que DEC-08, DEC-09 y DEC-39); Postgres sigue siendo el árbitro final de la conversión.

**Se resigna.** Más código: un control de forma por tipo, además de la clasificación de errores existente.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-52 — La declaración de parámetros y la sustitución segura quedan reutilizables por la plantilla de CH-12

**Contexto.** La `Plantilla` de CH-12 (D1) incluye "consulta + parámetros".

**Opciones.** (a) CH-11 deja la forma de declaración y la función de sustitución como primitiva reutilizable, sin campos propios de CH-12. (b) CH-12 define su propio mecanismo.

**Decisión.** (a).

**Por qué.** Evita resolver el mismo problema dos veces. CH-11 no agrega condición, formato ni frescura, ni decide dónde viven los valores de una ejecución automática (X1–X3, D2).

**Se resigna.** La forma elegida condiciona a CH-12 antes de explorarlo.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-53 — Los parámetros declarados ocupan `$1…$n`; la paginación usa `$(n+1)` y `$(n+2)`

**Contexto.** La envoltura de paginación usa hoy `LIMIT $1 OFFSET $2`. CH-11 es el primer cambio que pone otra clase de parámetros del driver en la misma sentencia.

**Opciones.** (a) Declarados primero, paginación después, numerado en cada ejecución. (b) Paginación fija en `$1`/`$2`, declarados desde `$3`. (c) Paginación sin parámetros del driver.

**Decisión.** (a).

**Por qué.** Se deriva de la cantidad real de parámetros en cada ejecución, en vez de fijar una numeración que puede desincronizarse. (c) viola la regla 4.

**Se resigna.** La construcción de la sentencia final necesita conocer la cantidad de parámetros antes de armar el texto.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-54 — CH-11 no agrega parámetros a las vistas canónicas

**Contexto.** Las vistas registradas en CH-09 (`VistaCanonica`) se componen con `WITH` en CH-12 (DEC-31).

**Opciones.** (a) Las vistas siguen sin parámetros. (b) Las vistas también declaran parámetros.

**Decisión.** (a).

**Por qué.** B3 es una historia de consulta, no de mapeo; la composición con `WITH` ya está asignada a CH-12, y DEC-30 a DEC-35 cerraron el alcance del mapeo.

**Se resigna.** Si CH-12 necesita parámetros dentro de una vista compuesta, se decide ahí.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-55 — La declaración de parámetros de una consulta guardada es una columna JSON en `ConsultaGuardada`

**Contexto.** DEC-48 persiste la declaración en la consulta guardada, pero no dice cómo. En CH-10, elegir entre columnas y un modelo nuevo quedó registrado como DEC-44.

**Opciones.** (a) Columna JSON `parametros` en `ConsultaGuardada`, por defecto `[]`, validada en la aplicación. (b) Modelo hijo `ParametroConsulta` (consulta, nombre, tipo, orden) con clave foránea y nombre único por consulta.

**Decisión.** (a).

**Por qué.** La declaración se lee y se escribe entera junto con la fila, que no se edita (DEC-10), y CH-12 puede reusar la misma forma (DEC-52).

**Se resigna.** La base no garantiza la integridad del contenido; la garantiza la validación de la aplicación.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-56 — Un parámetro declarado que el SQL no usa se rechaza

**Contexto.** La declaración y el SQL pueden desalinearse.

**Opciones.** (a) Rechazo 400 que nombra el parámetro. (b) Se acepta y se ignora.

**Decisión.** (a).

**Por qué.** Suele ser una declaración vieja; falla ruidosamente en vez de exigir un valor que no se usa.

**Se resigna.** Hay que borrar la declaración al quitar el marcador del SQL.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-57 — Un marcador `:x` sin declarar en el SQL se rechaza

**Contexto.** El SQL puede usar un marcador que no figura en la declaración.

**Opciones.** (a) Rechazo 400. (b) Declararlo solo, con tipo `texto`.

**Decisión.** (a).

**Por qué.** Un parámetro sin declarar contradice B3 ("parámetros declarados") y DEC-49.

**Se resigna.** Nada relevante: la declaración se escribe explícita.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-58 — Un valor enviado para un nombre no declarado se rechaza

**Contexto.** La petición de ejecución puede traer valores de más.

**Opciones.** (a) Rechazo 400. (b) Se ignoran.

**Decisión.** (a).

**Por qué.** Un valor de más suele ser un error de tipeo en el nombre; ignorarlo lo esconde.

**Se resigna.** Quien ejecuta tiene que mandar exactamente los nombres declarados.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-59 — Un `$n` escrito a mano en el SQL del usuario se rechaza siempre

**Contexto.** Hoy un `$1` suelto en el SQL del usuario tomaría el valor del `LIMIT` de la envoltura de paginación. Con DEC-53, además chocaría con los parámetros declarados.

**Opciones.** (a) Rechazo 400 siempre que aparezca fuera de cadenas y comentarios. (b) Rechazo solo cuando la consulta declara parámetros.

**Decisión.** (a).

**Por qué.** Los parámetros del driver los numera solo la aplicación; un `$n` del usuario nunca tiene un significado correcto.

**Se resigna.** Cambia el comportamiento de consultas sin parámetros que usaran `$n` (hoy devuelven un valor sin sentido o un error).

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-60 — Formato de valor por tipo de parámetro

**Contexto.** El control de forma de DEC-51 necesita saber qué valor JSON acepta cada tipo de DEC-49.

**Opciones.** (a) `numero`: solo número JSON; `fecha`: cadena ISO 8601, fecha (`2026-09-27`) o fecha y hora (`2026-09-27T10:00:00Z`). (b) Como (a), pero `numero` acepta también cadena numérica. (c) Como (a), pero `fecha` solo sin hora. En todos los casos `texto` es cadena JSON y `booleano` es booleano JSON.

**Decisión.** (a).

**Por qué.** Un tipo JSON por tipo declarado, sin conversiones implícitas; la fecha admite hora porque los filtros por instante son comunes.

**Se resigna.** Un cliente que mande números como texto recibe un rechazo.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-11 — no inferido por el agente.

**Estado:** firme.

---

### DEC-61 — La plantilla es un catálogo global persistido

**Contexto.** D1 pide una plantilla reutilizable. `docs/00-contexto.md` §8 separa `plantilla` de `automatizacion` (instancia de plantilla en un tenant), y D2/CH-21 da de alta automatizaciones eligiendo una plantilla de un catálogo.

**Opciones.** (a) Por tenant, con `tenantId`, como `ConsultaGuardada` y `VistaCanonica`. (b) Catálogo global persistido, sin `tenantId`, sus rutas exentas de `x-tenant-id` como `/contrato` (DEC-24). (c) Global y solo en código, como `contrato.ts`.

**Decisión.** (b).

**Por qué.** Respeta la separación plantilla/automatización del modelo de dominio y deja a CH-21 elegir de un catálogo compartido. Se persiste porque P1 la escribe por API, no con un despliegue.

**Se resigna.** Es el primer modelo con datos en la base fuera de `Tenant` que no pasa por el aislamiento por tenant; la lista cerrada de `MODELOS_AISLADOS` y la de rutas exentas crecen.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-62 — CH-12 incluye composición `WITH` y un endpoint de prueba

**Contexto.** DEC-31 asigna a CH-12 el armado de los `WITH` de vistas canónicas en tiempo de ejecución. El planificador llega recién en CH-13.

**Opciones.** (a) Solo función pura de composición, sin abrir conexión. (b) Función pura más un endpoint que prueba la plantilla contra una conexión del tenant, reutilizando `ejecutarConsulta` (solo lectura). (c) Ejecución completa al estilo del planificador.

**Decisión.** (b).

**Por qué.** P1 puede verificar que la plantilla corre sobre las vistas de un tenant antes de que exista el planificador, sin duplicar CH-13.

**Se resigna.** Una superficie más de ejecución; la prueba corre con el tenant de la petición y por el mismo pipeline de solo lectura.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-63 — La plantilla declara explícitamente sus entidades canónicas

**Contexto.** La composición necesita saber qué vistas canónicas anteponer como `WITH`.

**Opciones.** (a) Lista explícita `entidades`, validada contra el contrato canónico. (b) Inferirla del texto del SQL. (c) Componer siempre las cinco entidades.

**Decisión.** (a).

**Por qué.** Auditable y sin una segunda superficie de escaneo de texto; coherente con "registrado, no generado" (DEC-30) y con la validación explícita de entidad de DEC-32.

**Se resigna.** Quien escribe la plantilla mantiene la lista a mano.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-64 — "Condición" no agrega campo en CH-12

**Contexto.** D1 menciona una condición. Ya existen el `WHERE` parametrizado de CH-11 y la regla "sin filas no se envía" de X3/CH-14.

**Opciones.** (a) Nada nuevo: la condición es el `WHERE` parametrizado más la regla de CH-14. (b) Campo estructurado `{campo, operador, valor}` que evalúa CH-14. (c) Texto libre documental.

**Decisión.** (a).

**Por qué.** No prediseña el consumidor de CH-14 antes de explorarlo; el umbral ya es un parámetro declarado.

**Se resigna.** No hay condiciones evaluadas por fuera del SQL.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-65 — "Formato" es un enum con un único valor: `correo-html`

**Contexto.** N1/N2 (CH-14) envían correo HTML; N3 (CH-21, R2) hace el formato configurable por plantilla.

**Opciones.** (a) Sin campo, se decide en CH-14. (b) Enum fijo con un único valor hoy, `correo-html`. (c) Plantillas de correo configurables ya.

**Decisión.** (b).

**Por qué.** Cumple el texto de D1 sin adelantar N3.

**Se resigna.** El campo no tiene efecto hasta CH-14.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-66 — Tolerancia de frescura: minutos, guardada y no aplicada

**Contexto.** F1/F2 (CH-24, R2) aplican la frescura.

**Opciones.** (a) Escalar `toleranciaFrescuraMinutos`, persistido y sin aplicar hasta CH-24. (b) Sin campo. (c) Duración ISO-8601.

**Decisión.** (a).

**Por qué.** Declarar ahora y aplicar después, como DEC-40; valor plano como `QUERY_TIMEOUT_MS`.

**Se resigna.** Hasta CH-24 el valor no cambia ninguna ejecución.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-67 — La plantilla se vincula a `AUTOMATIZACIONES` (cierra DEC-22)

**Contexto.** DEC-22 dejó pendiente reconciliar las etiquetas de `AUTOMATIZACIONES` en `contrato.ts` con la plantilla.

**Opciones.** (a) Campo enum cuyos valores salen de `AUTOMATIZACIONES`. (b) Sin vínculo; se reconcilia en CH-21. (c) Catálogo cerrado: exactamente una plantilla por etiqueta.

**Decisión.** (a).

**Por qué.** Cierra un pendiente documentado con un cambio chico, sin la rigidez de (c).

**Se resigna.** Una etiqueta nueva requiere tocar `contrato.ts`.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-68 — La plantilla se reemplaza en el lugar por id

**Contexto.** `ConsultaGuardada` no se edita (DEC-10); `VistaCanonica` se reemplaza en el lugar (DEC-34).

**Opciones.** (a) Sin edición. (b) Reemplazo en el lugar por id. (c) Altas, bajas y modificaciones completas, con borrado.

**Decisión.** (b).

**Por qué.** La plantilla es una definición curada por el operador que se itera durante la puesta a punto, más cerca de `VistaCanonica` que de una consulta personal.

**Se resigna.** Sin historial de versiones ni borrado.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-69 — CH-12 no escribe la consulta canónica de `reporte-diario`

**Contexto.** DEC-29: `reporte-diario` no tiene implementación en el repositorio.

**Opciones.** (a) Fuera de alcance; el catálogo inicial es de D3/CH-21. (b) Dentro de alcance.

**Decisión.** (a).

**Por qué.** CH-12 construye el mecanismo; `stock-fisico` y `stock-producible` alcanzan para probarlo.

**Se resigna.** El tercer caso validado sigue sin consulta canónica hasta CH-21.

**Decidido por:** el usuario (autor), 2026-09-27, durante la exploración de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-70 — Alias de cada vista compuesta: `v_<entidad>`

**Contexto.** La composición de DEC-62 antepone cada vista canónica declarada (DEC-63) como un `WITH`. El nombre fija cómo se escriben las plantillas; DEC-31 solo dice que esos nombres quedan reservados.

**Opciones.** (a) `v_<entidad>` (`v_producto`, `v_insumo`…), como el SQL del experimento CH-16d. (b) El nombre del contrato (`producto`, `insumo`…).

**Decisión.** (a).

**Por qué.** Si una plantilla usa una entidad que no declaró, la consulta falla con un error legible en vez de leer en silencio una tabla nativa del cliente con el mismo nombre.

**Se resigna.** Las plantillas se escriben con el prefijo `v_`.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-71 — El endpoint de prueba exige validación aprobada de cada vista

**Contexto.** El endpoint de prueba de DEC-62 compone las vistas canónicas de una conexión. CH-10 guarda el resultado de la validación de cada vista (DEC-40/44).

**Opciones.** (a) Exigir que cada vista compuesta tenga una validación guardada aprobada; si no, rechazo 4xx que nombra la entidad. (b) Ejecutar igual e informar el estado de validación en la respuesta.

**Decisión.** (a).

**Por qué.** La validación rechaza columnas fuera del contrato (DEC-43), así que exigirla impide que una vista sin validar filtre campos personales (regla 5).

**Se resigna.** Durante la puesta a punto hay que validar cada vista antes de probar la plantilla.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-72 — La excepción de campos personales de M5 se posterga

**Contexto.** DEC-23 dejó para CH-12 el mecanismo de M5 "salvo que una plantilla lo requiera". Ninguna de las automatizaciones validadas usa domicilio, teléfono ni correo.

**Opciones.** (a) Postergar y documentarlo como límite hasta que una plantilla real lo necesite. (b) Construirlo ahora: la plantilla declara campos personales permitidos, que se suman al contrato, y se flexibiliza DEC-43.

**Decisión.** (a).

**Por qué.** Sin un caso que lo pruebe, construirlo amplía el alcance y la exposición de datos personales; respeta el anti-alcance y la regla 5.

**Se resigna.** Una plantilla no puede usar campos personales hasta que se decida el mecanismo.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-73 — `parametros` y `entidades` de la plantilla se guardan como JSON

**Contexto.** `Plantilla` guarda la declaración de parámetros de CH-11 y la lista de entidades de DEC-63.

**Opciones.** (a) Columnas JSON validadas en la aplicación, como `ConsultaGuardada.parametros` (DEC-55). (b) `entidades` como `text[]` de Postgres y `parametros` como JSON. (c) Tablas hijas `PlantillaEntidad` y `PlantillaParametro`.

**Decisión.** (a).

**Por qué.** Reutiliza la validación de CH-11 y mantiene un solo estilo; el reemplazo en el lugar (DEC-68) sigue siendo una sola escritura.

**Se resigna.** La base no tipa el contenido; la validación vive en la aplicación.

**Decidido por:** el usuario (autor), 2026-09-27, durante la propuesta de CH-12 — no inferido por el agente.

**Estado:** firme.

---

### DEC-74 — La asociación plantilla-tenant para el motor vive en una entidad mínima nueva

**Contexto.** X1 y X2 (CH-13, R1) necesitan saber, por tenant, qué plantilla corre, con qué conexión, con qué valores de parámetros y en qué horario. La instanciación completa de plantillas (D2) está asignada a CH-21, en R2. DEC-61 deja `Plantilla` agnóstica de tenant.

**Opciones.** (a) CH-13 crea una entidad mínima por tenant (ej. `Automatizacion`) con solo lo que X1 y X2 necesitan, sin la experiencia de instanciación de CH-21. (b) Guardar horario, conexión y valores sobre `Plantilla`. (c) Reordenar el mapa: traer D2 a CH-13 o postergar CH-13 hasta CH-21.

**Decisión.** (a).

**Por qué.** Respeta DEC-61 y no adelanta el alcance de CH-21: CH-21 construye la instanciación sobre esta entidad en lugar de crearla.

**Se resigna.** La supersesión explícita de la prohibición de tablas `Ejecucion`/`Automatizacion` en la spec de modelo de datos; y hasta CH-21 la entidad se da de alta sin la experiencia completa de D2.

**Decidido por:** el usuario (autor), 2026-09-28, durante la exploración de CH-13 — no inferido por el agente.

**Estado:** firme.

---

### DEC-75 — El planificador corre dentro del proceso de la aplicación

**Contexto.** El motor necesita disparar ejecuciones por horario. La aplicación es hoy un único proceso (`src/server.ts`) en un único servicio de Compose.

**Opciones.** (a) Temporizador dentro del proceso existente. (b) Proceso o servicio de Compose aparte para el motor.

**Decisión.** (a).

**Por qué.** No agrega infraestructura y es coherente con DEC-02 (sin orquestador externo). Alcanza para el volumen de R1.

**Se resigna.** Si el proceso cae, no hay ejecuciones; las ejecuciones interrumpidas, los solapamientos y los reintentos se tratan en CH-17. Escalar horizontalmente exigiría coordinar el planificador.

**Decidido por:** el usuario (autor), 2026-09-28, durante la exploración de CH-13 — no inferido por el agente.

**Estado:** firme.

---

### DEC-76 — El horario se expresa en cron estándar con una librería de cálculo de próximo disparo

**Contexto.** Hay que representar el horario de cada automatización.

**Opciones.** (a) Cron estándar, calculado con una librería chica que solo resuelve el próximo disparo (nueva dependencia). (b) Subconjunto propio (diario HH:mm o cada N minutos) implementado a mano, sin dependencias.

**Decisión.** (a).

**Por qué.** Cron es un formato conocido y expresivo; delegar el cálculo evita reimplementar un parser con casos borde de calendario.

**Se resigna.** Una dependencia de terceros nueva y superficie ajena al proyecto; la librería debe limitarse al cálculo del próximo disparo, no a ejecutar tareas.

**Decidido por:** el usuario (autor), 2026-09-28, durante la exploración de CH-13 — no inferido por el agente.

**Estado:** firme.

---

### DEC-77 — Los horarios se interpretan en una zona horaria global configurada por variable de entorno

**Contexto.** Una expresión cron necesita una zona horaria para resolverse.

**Opciones.** (a) Solo UTC. (b) Una zona horaria global por variable de entorno, con el mismo precedente que DEC-19. (c) Zona horaria por tenant (nueva columna en `Tenant`).

**Decisión.** (b).

**Por qué.** Los tenants de R1 comparten zona; sigue el precedente de configuración por entorno y evita pedirle al operador que traduzca horarios a UTC.

**Se resigna.** Tenants en zonas distintas no se soportan hasta que se decida lo contrario.

**Decidido por:** el usuario (autor), 2026-09-28, durante la exploración de CH-13 — no inferido por el agente.

**Estado:** firme.

---

### DEC-78 — Las automatizaciones se crean por API con alcance de tenant y una consola mínima

**Contexto.** DEC-74 crea la entidad `Automatizacion` pero deja la experiencia completa de instanciación (D2) para CH-21. Hacía falta definir cómo se da de alta una automatización hasta entonces.

**Opciones.** (a) API con alcance de tenant para crear, listar y obtener. (b) Solo seed o script, sin API. (c) La API más una interfaz mínima en la consola.

**Decisión.** (c).

**Por qué.** Da un camino real desde el producto para configurar una automatización en R1, sin depender de scripts.

**Se resigna.** Es el alcance más grande de las tres opciones: cambia la consola y todas las rutas nuevas entran en el barrido de aislamiento T2. La interfaz es mínima; la experiencia de instanciación de CH-21 no se adelanta.

**Decidido por:** el usuario (autor), 2026-09-28, durante la propuesta de CH-13 — no inferido por el agente.

**Estado:** firme.

---

### DEC-79 — Una automatización se detiene con un flag de activo

**Contexto.** Sin un mecanismo propio, la única forma de detener una automatización sería desactivar el tenant entero, que no tiene vuelta atrás (DEC-14).

**Opciones.** (a) Sin mecanismo. (b) Flag de activo con una acción de desactivar. (c) Reemplazo en el lugar por id, como las plantillas (DEC-68). (d) Borrado.

**Decisión.** (b).

**Por qué.** Permite frenar una automatización sin perder su registro de ejecuciones ni afectar al resto del tenant.

**Se resigna.** No hay edición ni borrado en CH-13: para cambiar horario, conexión o valores se desactiva y se crea otra.

**Decidido por:** el usuario (autor), 2026-09-28, durante la propuesta de CH-13 — no inferido por el agente.

**Estado:** firme.

---

### DEC-80 — El registro de ejecuciones se lee por API con alcance de tenant y una vista en la consola

**Contexto.** X2 exige registrar cada ejecución; hacía falta definir cómo se consulta ese registro.

**Opciones.** (a) API con alcance de tenant que lista las ejecuciones de una automatización. (b) Solo persistido, inspeccionado en la base. (c) La API más una vista en la consola.

**Decisión.** (c).

**Por qué.** El operador ve si las automatizaciones corren sin acceder a la base.

**Se resigna.** Más superficie de rutas y de consola, que entra en el barrido de aislamiento T2.

**Decidido por:** el usuario (autor), 2026-09-28, durante la propuesta de CH-13 — no inferido por el agente.

**Estado:** firme.

---

### Resoluciones de nivel diseño bajo DEC-13, DEC-14 y DEC-71 (CH-13)

No son decisiones nuevas ni abren compuertas: son la mecánica interna de decisiones ya firmes, resuelta en `openspec/changes/CH-13-engine-scheduling-execution/design.md` y registrada acá, con el mismo criterio que las resoluciones de CH-06.

**1. El planificador es un camino de producción hacia el contexto de tenant (bajo DEC-13 y DEC-14).** `conTenantActivo`, hasta ahora usado solo en tests y seed, pasa a ser la entrada del planificador. El planificador lee las filas de `Tenant` activas de la base propia (no filtradas por tenant) y entra al contexto de cada una antes de tocar cualquier dato con alcance de tenant. El identificador de tenant sale solo de la base propia, nunca de una petición (regla 2), y la extensión de Prisma que falla cerrada sigue siendo el único filtro. Los tenants desactivados no corren (DEC-14).

**2. La compuerta de validación de DEC-71 se aplica también a las ejecuciones programadas.** DEC-71 nombra solo el endpoint de prueba, pero su motivo (una vista sin validar puede filtrar campos personales, regla 5) vale igual para una ejecución programada. Cada ejecución programada exige validación aprobada de cada vista compuesta antes de conectarse a la base del tenant; si falta, la ejecución se registra como fallida con una categoría clasificada.

**Estado:** aplicadas en CH-13.

---

### DEC-81 — El correo se envía por SMTP con nodemailer, con Mailpit para desarrollo

**Contexto.** N1 exige enviar el resultado de una automatización por correo. Hasta CH-14 no hay código, dependencia ni variable de entorno de correo. Los workflows originales usaban SMTP (Gmail, 465 SSL).

**Opciones.** (a) nodemailer sobre SMTP, con Mailpit en Docker Compose para desarrollo. (b) API HTTP de un proveedor (Resend, SendGrid, Postmark). (c) SMTP escrito a mano sobre `node:net`, sin dependencia.

**Decisión.** (a).

**Por qué.** Da continuidad con el SMTP ya usado, no ata el proyecto a un proveedor ni hace pasar las filas por la API de un tercero, y permite probar el transporte sin red. Suma una sola dependencia, con el mismo criterio que DEC-76. Las credenciales SMTP van solo por variables de entorno (regla 7).

**Se resigna.** Una dependencia nueva. El relay SMTP que se configure recibe el contenido del correo: es la primera salida de datos del tenant fuera del sistema, coherente con la inclinación de D-1 pero sin cerrarla.

**Decidido por:** el usuario (autor), 2026-09-29, durante la exploración de CH-14 — no inferido por el agente.

**Estado:** firme.

---

### DEC-82 — El destinatario es una única dirección en la automatización

**Contexto.** `Automatizacion` no tiene destinatario y `Tenant` solo tiene nombre y activo. `Usuario` está prohibido por la spec del modelo de dominio.

**Opciones.** (a) Columna `destinatario` en `Automatizacion`, una dirección validada, cargada al crear y sin edición (DEC-79). (b) Columna en `Tenant`. (c) Un destinatario global por variable de entorno. (d) Ambas, con prioridad de la automatización. (e) Entidad `Usuario`. Subopción: una dirección o una lista.

**Decisión.** (a), con una sola dirección.

**Por qué.** Mantiene el destinatario dentro del alcance de tenant, sin tocar las rutas de tenants ni introducir entidades nuevas. La columna admite nulos porque las automatizaciones creadas en CH-13 no tienen destinatario.

**Se resigna.** Para cambiar el destinatario se desactiva la automatización y se crea otra. No hay envío a varias direcciones.

**Decidido por:** el usuario (autor), 2026-09-29, durante la exploración de CH-14 — no inferido por el agente.

**Estado:** firme.

---

### DEC-83 — El resultado de la notificación se registra en una columna de `Ejecucion`; un envío fallido marca la ejecución como fallida

**Contexto.** X2 registra el resultado de la consulta; CH-14 agrega un segundo resultado, el del envío, que tiene que distinguirse: enviada, omitida por no haber filas, fallo de envío, sin destinatario, SMTP no configurado.

**Opciones.** (a) Columna nueva `notificacion` que admite nulos, con esos cinco valores. (b) Solo ampliar los valores de `estado` y `fase`. (c) Tabla hija `Notificacion`. Subopción para un envío fallido: (i) `estado='fallo'`, `fase='notificacion'` y una categoría de error cerrada; (ii) `estado` queda en `ok` y solo `notificacion` refleja el fallo.

**Decisión.** (a), con la subopción (i).

**Por qué.** El resultado del envío se lee sin ambigüedad, y un envío fallido queda visible como fallo para lo que se apoye en `estado` (P3h, CH-17). El error se guarda como categoría cerrada, nunca como texto crudo del servidor SMTP.

**Se resigna.** `estado='fallo'` deja de significar solo "falló la consulta": hay que mirar `fase` para saber qué falló.

**Decidido por:** el usuario (autor), 2026-09-29, durante la exploración de CH-14 — no inferido por el agente.

**Estado:** firme.

---

### DEC-84 — Sin filas no se envía; la degradación elegante cubre datos incompletos

**Contexto.** X3 dice que sin filas no se envía nada. N2 pide que el correo se vea bien sin datos. En el WF-03 original, el día vacío sí se enviaba.

**Opciones.** (a) X3 literal: cero filas nunca envía; N2 cubre celdas nulas, agregados en cero, celdas vacías y el aviso de corte. (b) Un campo por plantilla para enviar aunque esté vacío. (c) Enviar siempre un correo de "sin datos".

**Decisión.** (a).

**Por qué.** Respeta X3 sin agregar campos a `Plantilla` (DEC-64, DEC-65) y deja a N2 un alcance verificable: el correo nunca muestra `null`, `undefined` ni celdas rotas.

**Se resigna.** Un reporte que quiera avisar "hoy no hubo datos" no se puede expresar; queda documentado como límite del artefacto (regla 6), con N3 como lugar para revisarlo.

**Decidido por:** el usuario (autor), 2026-09-29, durante la exploración de CH-14 — no inferido por el agente.

**Estado:** firme.

---

### DEC-85 — El HTML del correo lo arma un renderizador genérico que reimplementa el diseño validado

**Contexto.** N1 pide reutilizar el HTML ya validado en los workflows. Ese HTML no está en el repositorio: vive como expresión de un nodo de n8n y está descrito en las bitácoras WF-01 y WF-03 (estilos inline, tabla, encabezado con color de acento, pie discreto, paleta ámbar `#f59e0b`, rojo `#dc2626`, azul `#2563eb`).

**Opciones.** (a) Renderizador genérico de tablas a partir de las columnas; el color de acento y el emoji del asunto salen de la etiqueta `automatizacion` de la plantilla. (b) Tres diseños fijos por etiqueta, copiados de los workflows. (c) HTML guardado por plantilla.

**Decisión.** (a).

**Por qué.** Reutiliza el sistema visual documentado sin acoplarse a la forma de las columnas de cada consulta y sin agregar campos a `Plantilla` (DEC-65). (c) es N3 y queda fuera de alcance.

**Se resigna.** No es el HTML literal de n8n sino una reimplementación a partir de las bitácoras. Un reporte con varias secciones (WF-03: tres consultas, un correo) no se reproduce: una ejecución produce una notificación, y queda como límite del artefacto.

**Decidido por:** el usuario (autor), 2026-09-29, durante la exploración de CH-14 — no inferido por el agente.

**Estado:** firme.

---

### DEC-86 — Sin SMTP configurado, la automatización corre igual y registra que no se notificó

**Contexto.** DEC-17 hace fallar el arranque sin clave maestra. Había que decidir si SMTP recibe el mismo trato.

**Opciones.** (a) Variables `SMTP_*` opcionales: sin ellas la ejecución corre y registra `notificacion='no-configurada'`. (b) Fallar cerrado al arrancar, como DEC-17.

**Decisión.** (a).

**Por qué.** La ausencia de SMTP no compromete la seguridad (a diferencia de la clave maestra) y queda visible en el registro. Mantiene los tests y entornos sin correo real funcionando.

**Se resigna.** Un despliegue sin SMTP no falla al arrancar: la ausencia se ve recién en el registro de ejecuciones.

**Addendum (2026-09-29, diseño de CH-14).** "No configurado" significa `SMTP_HOST` ausente o vacío. Si `SMTP_HOST` está presente, el resto de la configuración tiene que ser completa y válida (`SMTP_FROM` presente, puerto numérico, `SMTP_SECURE` booleano, `SMTP_USER` y `SMTP_PASSWORD` juntos o ninguno); si no lo es, la aplicación no arranca y el error nombra la variable, nunca su valor. Es el mismo criterio que `config.ts` aplica al resto de las variables opcionales: ausente usa el valor por defecto, presente e inválida frena el arranque. Evita que un error de tipeo deje de enviar correos en silencio. Decidido por el usuario (autor) ante la validación del diseño — no inferido por el agente.

**Decidido por:** el usuario (autor), 2026-09-29, durante la exploración de CH-14 — no inferido por el agente.

**Estado:** firme, con addendum.

---

### Resoluciones de nivel diseño bajo DEC-19, DEC-83 y DEC-86 (CH-14)

No son decisiones nuevas: son la mecánica interna de decisiones ya firmes, resuelta en `openspec/changes/CH-14-engine-condition-email-notification/design.md`.

**1. Un envío fallido conserva el conteo de filas (bajo DEC-83).** La consulta sí corrió: la ejecución queda con `estado='fallo'`, `fase='notificacion'`, una categoría de envío cerrada y el mismo `filas` que habría tenido si el envío salía bien.

**2. El envío tiene un tiempo máximo configurable (bajo DEC-19).** `SMTP_TIMEOUT_MS`, con valor por defecto 10000 ms, con el mismo criterio que los límites de consulta de DEC-19. Un servidor SMTP colgado no bloquea el resto del tick más allá de ese tiempo.

**3. Con el envío exitoso o sin envío, `fase` queda en `ejecucion`.** Solo un envío fallido usa `fase='notificacion'`.

**Estado:** firmes.

---

### DEC-87 — Las marcas de tiempo del alta se derivan con SQL versionado sobre columnas existentes

**Contexto.** G1 pide marcas de tiempo de conexión, mapeo, validación y primera ejecución. Las columnas ya existen (`Conexion.creadaEn`, `VistaCanonica.creadaEn/actualizadaEn/validadaEn`, `Automatizacion.creadaEn`, `Ejecucion.iniciadaEn`), salvo el resultado de la prueba de conexión.

**Opciones.** (a) Script SQL versionado con salidas fechadas y test con fixtures. (b) Vista en la base. (c) Ruta de lectura en la API. (d) Columnas write-once o tabla de eventos (`EventoAlta`).

**Decisión.** (a). Sin migración, sin ruta, sin panel de consola y sin cambios en el motor.

**Por qué.** Es lo que DEC-30, DEC-31 y DEC-40 ya presuponían. Respeta el anti-alcance del motor (regla 6), no agrega modelos (DEC-44) y cumple G3 (consulta identificable y fechada). Sirve también para tenants desactivados (DEC-14).

**Se resigna.** No hay visibilidad dentro de la aplicación. La marca de validación queda mutable (se anula al re-registrar, DEC-41, y se sobrescribe al re-validar, DEC-44): es un límite del artefacto, y se mitiga capturando la salida de la consulta en la bitácora al cerrar cada alta. Las marcas miden tiempo transcurrido, no esfuerzo (incluyen horas ociosas, SQL escrito fuera del sistema y la espera del cron). No se asume orden estricto entre marcas por mezcla de relojes (base vs aplicación). Sin *backfill* ni medición retroactiva de CH-16 (horas autorreportadas).

**Decidido por:** el usuario (autor), 2026-09-30, durante la exploración de CH-15 — no inferido por el agente. Las consecuencias de la mutabilidad, la ausencia de panel y el uso prospectivo se derivan de esta elección.

**Estado:** firme.

---

### DEC-88 — La marca de «conexión» es el registro de la conexión

**Contexto.** La prueba `POST /conexiones/:id/prueba` no persiste su resultado; no existe una marca de «conectó bien».

**Opciones.** (a) Usar `Conexion.creadaEn`. (b) Persistir la primera prueba exitosa (`probadaEn`/`probadaOk`).

**Decisión.** (a).

**Por qué.** Evita migración y una escritura en una ruta hoy de solo lectura. La compuerta D-2 puede cambiar qué significa «conectado» (agente saliente), así que la marca se mantiene genérica.

**Se resigna.** Un registro puede preceder a una conexión exitosa: la marca sobreestima el avance. Se documenta como límite del artefacto.

**Decidido por:** el usuario (autor), 2026-09-30 — no inferido por el agente.

**Estado:** firme.

---

### DEC-89 — Definición de las marcas restantes y agregación por conexión

**Decisión.** El reporte incluye: inicio del alta (`Tenant.creadoEn`); conexión (DEC-88); mapeo, con inicio (mínimo de `creadaEn`) y fin (máximo de `actualizadaEn`); última validación con su estado; primera ejecución con su `estado`/`fase` y, aparte, la primera con `estado='ok'`; y `Automatizacion.creadaEn` como quinta marca informativa que separa el esfuerzo del operador de la espera del cron. Se reporta una fila por `Conexion`, repitiendo la marca de inicio del tenant (coherente con DEC-33).

**Por qué.** Muestra los intentos fallidos sin perder el primer éxito, y no atribuye al operador la espera del cron.

**Se resigna.** No hay agregado por tenant; quien lo quiera lo calcula sobre las filas.

**Decidido por:** el usuario (autor), 2026-09-30 — no inferido por el agente.

**Estado:** firme.

---

### DEC-90 — El script de marcas del alta no lleva parámetro de tenant y se corre fuera de la aplicación

**Contexto.** El diseño de CH-15 debía decidir si `scripts/marcas-alta.sql` filtra por tenant o lista todos.

**Opciones.** (a) Sin parámetro: lista las conexiones de todos los tenants, incluidos los desactivados; lo corre el autor a mano. (b) Con filtro de tenant como parámetro del driver, más un script ejecutor.

**Decisión.** (a).

**Por qué.** Cumple la regla 4 porque ningún valor entra a la consulta. `psql` no rellena un `$1` cuando recibe el archivo directo. Es una herramienta de investigación de P4, no una superficie del panel, así que la regla 2 (aislamiento del panel) no aplica; saltea la extensión de aislamiento de Prisma a propósito, igual que las consultas de CH-16b. Un test estático verifica que ningún código de la aplicación referencia el archivo.

**Se resigna.** La salida cubre todos los tenants: quien la pega en una bitácora elige las filas que corresponden.

**Decidido por:** el usuario (autor), 2026-09-30 — no inferido por el agente.

**Estado:** firme.

---

### DEC-91 — El script vive en `scripts/marcas-alta.sql`

**Decisión.** `scripts/marcas-alta.sql`, junto a `smoke.sh`. No dentro de la carpeta del change.

**Por qué.** Archivar mueve la carpeta del change y rompería la ruta del test y los enlaces de la bitácora. Es el primer SQL de larga vida fuera de las migraciones: fija la convención para scripts de investigación.

**Decidido por:** el usuario (autor), 2026-09-30 — no inferido por el agente.

**Estado:** firme.

---

### DEC-92 — Solo lectura del script de marcas: rol de prueba y transacción de solo lectura

**Contexto.** La regla 3 pide dos capas (rechazo en la aplicación y usuario sin escritura) y está escrita para consultas del panel contra la base del cliente. Aquí el script corre sobre la base propia de la aplicación, que no tiene un login de solo lectura.

**Opciones.** (a) En el test: rol descartable con `SELECT` solo sobre las columnas necesarias, dentro de una transacción de solo lectura; en la corrida manual: transacción de solo lectura y archivo revisado. (b) Crear un login de solo lectura también para las corridas manuales.

**Decisión.** (a).

**Por qué.** (b) es alcance nuevo (migración/configuración) y sube el riesgo del límite de 400 líneas. Los permisos por columna del rol de prueba también hacen cumplir la minimización de datos (regla 5).

**Se resigna.** En la corrida manual la base aplica una sola capa de solo lectura; la otra es la revisión del archivo.

**Decidido por:** el usuario (autor), 2026-09-30 — no inferido por el agente.

**Estado:** firme.

---

### DEC-93 — Los resultados de las consultas no se persisten: solo consultas y metadatos de ejecución (D-1)

**Contexto.** D-1 definía si el sistema guarda los resultados de las consultas. De eso depende si custodia datos personales de los clientes de los clientes, lo que cambia el apartado de consideraciones éticas y legales. Hasta R1 el resultado de una ejecución ya viaja al correo y no se guarda (DEC-83, DEC-84).

**Opciones.** (a) Solo consultas y metadatos de ejecución. (b) Resultados con retención acotada. (c) Resultados completos.

**Decisión.** (a). El sistema persiste consultas, plantillas, configuración y metadatos de ejecución (inicio, fin, duración, cantidad de filas, estado). No persiste el contenido de las filas devueltas.

**Consecuencias.** El sistema no custodia datos personales de los clientes de los clientes, en línea con la minimización de datos. CH-27 (visualización de últimos resultados en el panel), que estaba sujeto a D-1, queda fuera del alcance mientras esta decisión no se reabra. Una reapertura exige registrar antes la política de retención y su impacto legal.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme. Cierra D-1.

---

### DEC-94 — El motor llega a la réplica del cliente por un agente saliente (D-2)

**Contexto.** D-2 definía cómo el motor alcanza la réplica del cliente. De eso depende la barrera de entrada, que es la hipótesis central del trabajo: pedirle a una PYME que exponga su base a internet la contradice.

**Opciones.** (a) Conexión directa, con la base del cliente expuesta. (b) Agente saliente instalado junto a la réplica. (c) VPN.

**Decisión.** (b). Un agente instalado junto a la réplica inicia la conexión hacia afuera; el cliente no expone su base.

**Consecuencias.** CH-19 (conectividad definitiva) implementa ese agente y cuesta más desarrollo que una conexión directa. El agente queda sujeto a las reglas no negociables: solo lectura en dos capas, sin concatenación de SQL, aislamiento entre tenants y secretos fuera del repositorio. El protocolo concreto entre agente y motor es una decisión de CH-19 y se registra al llegar.

**Se resigna.** La conexión directa de R0 y R1 es la que se usa hasta CH-19; no es la solución definitiva. Queda sin verificar cómo resuelven esto los productos comparables, pendiente anotado en D-2.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme. Cierra D-2.

---

### DEC-95 — CH-17 no recupera disparos perdidos: el catch-up es un límite del artefacto

**Contexto.** El planificador es serial y evalúa la ventana `(anterior, ahora]`. Si estuvo caído o una corrida se alargó, los disparos perdidos o colapsados en un solo veredicto no se recuperan ni dejan marca. Comentarios del código y la bitácora de CH-13 atribuían ese tratamiento a CH-17, pero X4, X5 y X7 no lo piden.

**Opciones.** (a) Fuera de alcance, documentado como límite. (b) Registrar una marca por cada disparo colapsado. (c) Catch-up real tras una caída.

**Decisión.** (a). CH-17 no implementa catch-up ni registra disparos colapsados. Se documenta como límite del artefacto y se corrigen los comentarios del código que lo atribuyen a CH-17.

**Se resigna.** Tras una caída del servicio o una corrida muy larga, los disparos intermedios se pierden sin rastro. Ampliar el motor para cubrirlo contradice la regla 6.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-96 — X4: el solapamiento se detecta con una consulta a la base y se registra como ejecución `omitida`

**Contexto.** En el diseño actual (serial, un proceso) una corrida no puede solaparse consigo misma. X4 solo actúa ante filas `en-curso` que no se cerraron (zombis), paralelismo futuro o varias instancias. El criterio exige que la nueva ejecución no arranque y que "quede registrado".

**Opciones.** Mecanismo: (a) conjunto en memoria. (b) consulta a la base antes de crear la ejecución. (c) índice único parcial `WHERE estado = 'en-curso'`. Registro: (1) `estado = 'omitida'` con `error = 'solapamiento'`. (2) `estado = 'fallo'` con `error = 'solapamiento'`. (3) solo log. Frecuencia: una fila por tick o deduplicada.

**Decisión.** (b) + (1), con una fila `omitida` por cada tick en que la automatización siga trabada. Antes de crear una `Ejecucion`, se busca por el cliente con alcance de tenant una fila `en-curso` de la misma automatización; si existe, no se corre y se escribe una fila `omitida`. `omitida` y `solapamiento` son valores nuevos de los conjuntos cerrados de `estado` y `error`.

**Se resigna.** Hay una ventana de carrera entre la consulta y la creación; es aceptable mientras el tick sea serial. Si CH-18 introduce paralelismo, se reabre y se evalúa el índice único parcial. Una automatización trabada genera una fila por tick hasta que X7 la limpie.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-97 — X5: solo los fallos transitorios de la fase de conexión se reintentan

**Contexto.** X5 pide una política de reintentos con tope. La spec de `email-notification` (CH-14) exige un único intento de envío, sin reintento. Los conjuntos cerrados de categorías de fallo por fase son la base para clasificar.

**Opciones.** Categorías reintentables: solo conexión transitoria, o sumar `tiempo-agotado` de consulta, `error-desconocido` o `error-interno`. Fase de notificación: excluida o reintentable.

**Decisión.** Se reintentan únicamente `host-inalcanzable`, `dns-no-resuelve` y `tiempo-agotado` de la fase de conexión. Nunca se reintentan: credenciales inválidas, base inexistente, permisos, preparación, sintaxis, datos, `no-es-lectura`, `tiempo-agotado` de consulta, `error-desconocido`, `error-interno` ni ningún fallo de la fase de notificación. La spec de `email-notification` se reafirma sin cambios.

**Se resigna.** Un fallo transitorio fuera de esa lista espera al próximo disparo. Reintentar una consulta lenta castigaría la réplica del cliente.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-98 — X5: reintento dentro de la corrida, una fila por corrida con `intentos`, configuración global

**Contexto.** El reintento puede bloquear el tick serial y afectar a otros tenants (X8, CH-18). Los tests existentes usan una conexión a puerto cerrado que clasifica como `host-inalcanzable`.

**Opciones.** Mecánica: (P-A) bucle dentro de la corrida, (P-B) reintento en ticks posteriores, (P-C) sin reintento. Filas: una por corrida con `intentos`, o una por intento. Configuración: variables de entorno globales, columna por automatización o por plantilla.

**Decisión.** P-A, con una sola fila `Ejecucion` por corrida y una columna nullable `intentos`. Tope de 3 intentos totales y pausa fija de 5 segundos, ambos por variable de entorno global (precedente DEC-19). La pausa usa `Reloj.programar` envuelto en una promesa. La política se inyecta en el planificador con un valor por defecto de «sin reintento», para que los tests existentes no cambien. Agotado el tope, la corrida se marca `fallo` con la categoría del último intento.

**Se resigna.** Con una conexión caída, el peor caso bloquea el tick unos 3 × (timeout de conexión + 5 s). Es el costo de P-A y la razón del tope pequeño; el aislamiento entre tenants es CH-18.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-99 — X7: barrido al arrancar sobre todos los tenants, sin re-ejecutar y con arranque aunque falle

**Contexto.** Una corrida interrumpida deja una fila `en-curso` para siempre. El barrido no puede usar SQL crudo (spec `tenant-isolation`, DEC-13). Un tenant dado de baja está congelado (DEC-14).

**Opciones.** Alcance: tenants activos, todos o SQL crudo. Momento: solo al arrancar, o además un reaper por tick. Si el barrido falla: arrancar igual o negarse. Re-ejecución de las interrumpidas: sí o no.

**Decisión.** Antes del primer tick, y recorriendo el contexto de cada tenant, incluidos los dados de baja, se hace un `updateMany` de las filas `en-curso` a `estado = 'fallo'`, `error = 'interrumpida'`, `finalizadaEn` igual a la hora de arranque y `duracionMs`, `filas`, `fase` y `notificacion` nulos. `interrumpida` es un valor nuevo del conjunto cerrado de `error`. Solo al arrancar: no hay reaper por tick. Si el barrido falla, se registra el error y el servicio arranca igual. Las corridas interrumpidas no se re-ejecutan. Se asume una única instancia (DEC-75).

**Se resigna.** Una fila que queda `en-curso` en un proceso vivo (si falla el `update` final) no se limpia hasta el próximo arranque y bloquea la automatización por DEC-96 mientras tanto. Con varias instancias el barrido mataría corridas vivas. Una fila zombi tras un arranque con barrido fallido persiste hasta el siguiente.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-100 — Apagado ordenado con SIGTERM y SIGINT

**Contexto.** No hay manejador de señales: cada redeploy durante una corrida la corta y deja una fila huérfana.

**Opciones.** (a) Agregar un manejador que llame `app.close()`. (b) No agregarlo.

**Decisión.** (a). SIGTERM y SIGINT cierran la aplicación, lo que ya espera a `detener()` del planificador.

**Se resigna.** Reduce pero no elimina los huérfanos: una caída sin señal (por ejemplo `kill -9`) sigue dependiendo del barrido de DEC-99.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-101 — CH-17 se parte en CH-17a (X7 y X4) y CH-17b (X5)

**Contexto.** El pronóstico de CH-17 es de 650 a 850 líneas de código y tests, contra un tope de revisión de 400 por PR.

**Opciones.** (a) Partir en CH-17a y CH-17b. (b) Encadenar 3 o 4 slices. (c) Un solo PR con `size:exception`.

**Decisión.** (a). CH-17a cubre X7 y X4 (DEC-99, DEC-96, DEC-100, DEC-95). CH-17b cubre X5 (DEC-97, DEC-98). Se ejecutan en ese orden, cada uno con su propio ciclo.

**Se resigna.** Si CH-17a supera 400 líneas, se parte en slices dentro del mismo change.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-102 — CH-17a: punto de entrada `arrancar()`, barrido tolerante por tenant, fila `omitida` y salida tras el apagado

**Contexto.** El diseño de CH-17a (`openspec/changes/CH-17a-interrumpidas-y-solapamiento/design.md`) tomó elecciones que DEC-95, DEC-96, DEC-99 y DEC-100 no fijan. `iniciar()` es síncrono y los tests de temporizador de CH-13 dependen de eso; `server.ts` termina el proceso si el arranque rechaza; los tests corren en paralelo contra la misma base.

**Opciones.** Entrada: (a) `arrancar()` asíncrono que barre y luego llama `iniciar()` sin cambios, o (b) volver asíncrono `iniciar()`. Barrido: tolerar el fallo por tenant, o abortar al primer fallo. Fila `omitida`: `finalizadaEn = iniciadaEn` con `duracionMs` nulo, o `duracionMs = 0`. Apagado: salir tras cerrar e ignorar una segunda señal, o forzar la salida con la segunda.

**Decisión.** (a): `Planificador.arrancar()` ejecuta el barrido y después llama a `iniciar()`, que sigue siendo síncrono; el barrido nunca rechaza. El barrido captura y registra el fallo de cada tenant y sigue con los demás, con una única hora de arranque leída al inicio. La fila `omitida` lleva `finalizadaEn = iniciadaEn` y `duracionMs` nulo. El manejador de SIGTERM y SIGINT cierra la aplicación una sola vez, sale con código 0 (1 si el cierre falla) e ignora, registrándola, una segunda señal.

**Se resigna.** Con un fallo de base durante el barrido, algunas filas zombi quedan hasta el próximo arranque (coherente con DEC-99, fail-open). Una segunda señal no permite matar un cierre colgado; eso exige `kill -9`.

**Decidido por:** el usuario, 2026-09-30, no inferido por el agente.

**Estado:** firme.

---

### DEC-103 — CH-17b: `intentos` cuenta los intentos de conexión reales y se muestra en el listado y en la consola

**Contexto.** DEC-98 agrega la columna nullable `intentos` a `Ejecucion` sin fijar su valor para las corridas que no llegaron a conectar ni si el usuario la ve. Una fila `omitida` (DEC-96) o `interrumpida` (DEC-99) nunca intentó conectar, y las filas anteriores a la migración no tienen el dato.

**Opciones.** Valor: (a) cuenta los intentos de conexión reales, o (b) nulo salvo que haya reintentos. Visibilidad: (c) en el listado de ejecuciones de la API y en la consola, o (d) solo en la base.

**Decisión.** (a) y (c). `intentos` vale 1 si la corrida conectó, o falló, al primer intento, incluso con el reintento desactivado, y N si hizo N intentos. Es nulo cuando la corrida nunca llegó a intentar conectar (`omitida`, `interrumpida` y los rechazos previos a la conexión) y en las filas anteriores a la migración. `EjecucionListada` y la vista de ejecuciones de la consola muestran la columna.

**Se resigna.** Cambia la spec de `query-console`. Un nulo significa «no aplica o dato anterior», nunca «un solo intento».

**Decidido por:** el usuario, 2026-10-01, no inferido por el agente.

**Estado:** firme.

---

### DEC-104 — CH-17b: el apagado cancela la pausa entre reintentos y cierra la fila

**Contexto.** DEC-100 cierra la aplicación con SIGTERM y SIGINT y espera a `detener()`. Una corrida en pausa entre reintentos puede demorar el cierre hasta unos 10 s más los intentos restantes, y el tiempo de parada de un contenedor podría matar el proceso y dejar la fila `en-curso` para el barrido de DEC-99.

**Opciones.** (a) `detener()` cancela la pausa y cierra la fila. (b) Dejar terminar el bucle.

**Decisión.** (a). Al detener el planificador, la pausa pendiente se cancela, no se hacen más intentos y la corrida se cierra como `fallo` con la categoría del último intento y el `intentos` alcanzado.

**Se resigna.** Una corrida que podía recuperarse en un reintento posterior se cierra como fallida; el próximo disparo es el reintento.

**Decidido por:** el usuario, 2026-10-01, no inferido por el agente.

**Estado:** firme.

---

### DEC-105 — CH-17b: máximo de 5 intentos, validado al arrancar

**Contexto.** DEC-98 fija 3 intentos por defecto, pero el analizador de variables de DEC-19 acepta cualquier entero positivo. Un valor alto bloquea el tick serial con una conexión caída.

**Opciones.** (a) Máximo 5 con fallo al arrancar si se excede. (b) Sin máximo.

**Decisión.** (a). La variable de intentos admite de 1 a 5; un valor mayor hace fallar la configuración al arrancar con un mensaje claro, como las otras variables inválidas.

**Se resigna.** Cambiar el máximo exige tocar el código.

**Decidido por:** el usuario, 2026-10-01, no inferido por el agente.

**Estado:** firme.

---

### DEC-106 — CH-17b: política inyectada, nombres de variables y alcance del apagado

**Contexto.** El diseño de CH-17b (`openspec/changes/CH-17b-reintentos-de-conexion/design.md`) tomó elecciones que DEC-97, DEC-98 y DEC-103 a DEC-105 no fijan: cómo se inyecta la política, cómo se llaman las variables, dónde va la columna en la consola, qué hace el apagado con el resto del tick y cómo se prueba una secuencia de fallos.

**Opciones.** Pruebas de la secuencia de fallos: relajar los ejemplos de la spec, o inyectar un punto de dial (`ejecutar?`) en el planificador. Apagado: cancelar solo la pausa, o además cortar el resto del tick.

**Decisión.** La política se inyecta como `PoliticaReintentos { intentos, pausaMs }` en `DependenciasPlanificador`, con el valor por defecto `SIN_REINTENTOS` (1 intento, sin pausa). Las variables son `CONNECTION_RETRY_ATTEMPTS` (1 a 5, por defecto 3) y `CONNECTION_RETRY_PAUSE_MS` (entero positivo, por defecto 5000). `intentos` es la última columna de la vista de ejecuciones de la consola. Los ejemplos de la spec con fallo DNS se relajan y las pruebas usan `host-inalcanzable` seguido de `tiempo-agotado`; no se agrega un punto de inyección del dial. Al apagar, `detener()` cancela solo la pausa pendiente; el resto del tick en curso termina con un intento por cada automatización vencida restante, sin reintentos.

**Se resigna.** No se puede probar un fallo DNS en una secuencia con destino fijo y sockets reales. El apagado puede demorar lo que tarden esas corridas restantes.

**Decidido por:** el usuario, 2026-10-01, no inferido por el agente.

**Estado:** firme.

---

### DEC-107 — CH-18 (X6): «mismo evento» es una ejecución; el envío es como máximo una vez

**Contexto.** X6 pide que una ejecución produzca como máximo una notificación. El código ya envía una vez por corrida (DEC-85, DEC-97) y no re-ejecuta las interrumpidas (DEC-99).

**Opciones.** (a) Evento = una corrida. (b) Evento = mismo contenido que la corrida anterior. (c) Enfriamiento por tiempo por automatización.

**Decisión.** (a). Una ejecución envía como máximo un correo, sin reintento del envío. La supresión por contenido o por tiempo queda como límite del artefacto: exige estado persistido (DEC-93, regla 5) o configuración nueva por plantilla (DEC-64, DEC-65) y ampliaría el motor (regla 6).

**Se resigna.** Dos corridas seguidas con las mismas filas envían dos correos.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-108 — CH-18 (X6): marca previa al envío y resultado `incierta`

**Contexto.** Un corte entre el envío y el cierre de la fila, o un envío que vence por tiempo pero igual se entrega, dejan el registro sin saber si el correo salió (límites de CH-14).

**Opciones.** (a) Solo documentar y corregir el texto de la consola. (b) `notificacion = 'enviando'` antes de enviar; el barrido de arranque la cierra como `fallo` / `interrumpida` con `notificacion = 'incierta'`; el envío vencido por tiempo se muestra como «puede haberse entregado». (c) Tabla de notificaciones con clave de idempotencia.

**Decisión.** (b). `notificacion` es texto, sin migración. No se reintenta el envío (DEC-97) ni se re-ejecutan las corridas interrumpidas (DEC-99). El «reporte de fallas de notificación» pendiente de CH-17b queda cubierto por `fallo-envio`, `incierta` y el listado de ejecuciones.

**Se resigna.** Un `UPDATE` extra por corrida que notifica; dos valores nuevos en el conjunto cerrado de `notificacion`; la spec de `execution-log` deja de exigir `notificacion` nula en las filas barridas.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-109 — CH-18 (X8): aislamiento de errores por tenant dentro del tick

**Contexto.** Una excepción fuera de `correr()` en un tenant aborta el tick, y los tenants siguientes pierden su ventana: `anterior` ya avanzó y no hay recuperación (DEC-95).

**Opciones.** (a) Captura por tenant con log de campos cerrados; el tick sigue con los demás. (b) Además registrar una fila de ejecución, imposible porque la fila exige `automatizacionId`.

**Decisión.** (a), con el mismo patrón que el barrido de arranque (DEC-102). Un fallo a nivel de tenant queda solo en el log.

**Se resigna.** Esa ventana del tenant fallido no se recupera (DEC-95).

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-110 — CH-18 (X8): el tick sigue serial

**Contexto.** DEC-98 dejó para CH-18 el costo de bloqueo por una conexión caída.

**Opciones.** (a) Serial con aislamiento de errores. (b) Carriles seriales por tenant con tope de concurrencia y barrera de tick. (c) Lazos independientes por tenant. (d) Cortacircuitos por conexión.

**Decisión.** (a). El criterio de X8 es aislar errores, no latencia. (b), (c) y (d) agregan capacidad al motor que ninguna historia pide (regla 6) y quedan como límite del artefacto.

**Se resigna.** Una conexión caída sigue demorando a los demás tenants hasta la cota de DEC-98.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-111 — CH-18 (X8): la ventana de carrera de DEC-96 sigue cerrada y se endurece la conexión del agente

**Contexto.** DEC-96 se reabría si CH-18 introducía paralelismo. Además, `pg.Client` en `src/db-probe.ts` no tiene listener de `'error'`; una conexión que muere tras el login podría terminar el proceso. Ese archivo lo comparten los caminos de CH-03 y CH-04.

**Opciones.** Carrera: (a) cerrada, sin índice único parcial; (b) índice único parcial con `partialIndexes` de Prisma. Listener: incluirlo o solo documentar.

**Decisión.** Carrera (a): sin paralelismo (DEC-110) y con instancia única (DEC-75, DEC-99) la ventana no se reabre. Listener: se incluye solo si una prueba confirma que el cierre del proceso ocurre; si la prueba lo refuta, no se agrega nada.

**Se resigna.** Sin defensa en base contra una segunda instancia.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-112 — CH-19: el agente es un relay de bytes; el motor sigue ejecutando la consulta

**Contexto.** DEC-94 eligió el agente saliente y dejó el protocolo concreto como decisión de CH-19. Todo el tráfico hacia la base del tenant pasa por un solo punto de conexión (`iniciarConexion`, `src/db-probe.ts`), y `pg` acepta un `stream` inyectado.

**Opciones.** (a) Relay de bytes: el agente es un túnel TLS hacia un destino permitido y el motor mantiene `pg.Client`. (b) RPC de sentencias: el agente ejecuta la sesión de solo lectura. (c) Túnel estándar (SSH -R, chisel).

**Decisión.** (a).

**Por qué.** Las dos capas de solo lectura, el chequeo de permisos de DEC-08 y la regla de una sola sentencia (DEC-09) quedan en un único lugar. El agente no suma capacidad de ejecución (regla 6). (b) duplica la lógica de solo lectura en la máquina del cliente y reabre DEC-16/17/20. (c) exige un servidor de túneles entrante y no da latido a nivel de aplicación, que C2 necesita.

**Se resigna.** La contraseña de la base sigue en el motor (DEC-17 sin cambios). El agente no hace cumplir nada semántico: solo reenvía bytes y aplica su lista de destinos (DEC-115).

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-113 — CH-19: transporte WebSocket sobre TLS

**Contexto.** Hace falta un canal que inicie el agente y que lleve control y datos.

**Opciones.** (a) WebSocket sobre TLS en el puerto de la aplicación: un canal de control y un canal de datos por sesión de base. (b) TCP con mTLS y encuadre propio. (c) Long-poll HTTP. (d) gRPC.

**Decisión.** (a). El TLS termina en un proxy inverso. El agente verifica el certificado del servidor y rechaza `ws://` salvo en loopback.

**Por qué.** Sale por 443, no exige puertos entrantes al cliente (C1) y es liviano. (c) solo encaja con RPC y (d) es desproporcionado.

**Se resigna.** Nueva dependencia (`ws`) del lado del motor. El túnel es TLS obligatorio porque por él viajan datos de consulta; `iniciarConexion` hoy no usa `ssl` hacia la base y eso no cambia.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-114 — CH-19: el agente se autentica con un token propio, guardado como hash

**Contexto.** El motor debe saber a qué tenant pertenece cada agente sin confiar en lo que el agente declare (regla 2).

**Opciones.** (a) Token opaco de 256 bits por agente, guardado como SHA-256, mostrado una sola vez y revocable. (b) Código de alta de un solo uso canjeado por token. (c) mTLS con CA propia.

**Decisión.** (a). El tenant se deduce solo de la fila del token, nunca del contenido del mensaje. Los identificadores de sesión no son adivinables y el canal de datos se reautentica con el token dueño de la sesión.

**Por qué.** (b) agrega pasos al alta y encarece C3. (c) exige una PKI desproporcionada para el prototipo.

**Se resigna.** Un token filtrado sirve hasta que se revoque. El token es un secreto (regla 7): no entra en el repositorio, en bitácoras ni en capturas.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-115 — CH-19: un agente por tenant; la lista de destinos vive solo en el agente

**Contexto.** Si el motor decidiera a qué destinos puede llegar el agente, un motor comprometido podría usar cada agente para explorar la red interna de su cliente.

**Opciones.** Cardinalidad: un agente por tenant o varios. Lista de destinos: en el motor, en el agente o en ambos. Modo directo: convive o se reemplaza.

**Decisión.** Un agente por tenant (`Conexion.agenteId` nulo para conexión directa). La lista de destinos permitidos vive solo en el agente (`AGENT_ALLOWED_TARGETS`). El modo directo convive, porque lo necesitan las pruebas y R0/R1 (DEC-94). `Conexion.host` y `Conexion.puerto` pasan a significar «tal como los ve el agente».

**Por qué.** Mantiene el control del destino del lado del cliente, que es quien asume el riesgo de su red.

**Se resigna.** Un solo agente por tenant es un punto único de falla.

**Modo directo en producción.** Queda habilitado, sin bandera de configuración nueva. Los tests y el tenant de R0/R1 usan conexión directa, y una bandera es alcance nuevo sin un problema actual que resolver. C1 se cumple por tenant: el cliente no abre puertos entrantes cuando su tenant se da de alta con agente; un tenant directo es una excepción visible, límite del artefacto. Se reevalúa al cerrar CH-19e: si la tesis necesita afirmar que ningún tenant productivo usa conexión directa, la bandera se agrega entonces.

**Decidido por:** el usuario, 2026-10-02 (cardinalidad y lista de destinos, eligiendo la opción recomendada) y 2026-10-03 (modo directo, aceptando la recomendación). No inferido por el agente.

**Estado:** firme.

---

### DEC-116 — CH-19: rutas `/agente/*` como excepción cerrada a `X-Tenant-Id`

**Contexto.** La autenticación por token ocurre antes de que exista contexto de tenant, y `X-Tenant-Id` nunca se toma de la petición del cliente (regla 2). Un modelo que no figure en `MODELOS_AISLADOS` pasa sin filtrar.

**Opciones.** Excepción cerrada y registrada, como DEC-24 y DEC-61, o rutas sin excepción con el tenant en el encabezado.

**Decisión.** Excepción cerrada para `/agente/*`. El manejador entra a `conTenantActivo` desde la fila del token, igual que el planificador. Todo modelo nuevo de agente se agrega a `MODELOS_AISLADOS` o se justifica por escrito. El registro de sesiones es en memoria, coherente con la instancia única de DEC-75. *(Enmendado por DEC-122: el camino del upgrade no entra a `conTenantActivo`.)*

**Por qué.** Evita aceptar el tenant desde el cliente y reutiliza el patrón ya probado.

**Se resigna.** El registro de sesiones no sobrevive a un reinicio.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-117 — CH-19: con el agente desconectado la ejecución se intenta y falla con categoría propia

**Contexto.** Hay que definir qué hace el planificador cuando el agente de un tenant no está conectado.

**Opciones.** (a) Intentar y fallar visible con la categoría nueva `agente-desconectado`. (b) Omitir la ejecución como `omitida`.

**Decisión.** (a). La categoría es distinta de `host-inalcanzable`. El agente informa los errores del lado de la réplica como código cerrado, porque el motor ya no ve `ECONNREFUSED`. Si `agente-desconectado` es reintentable se resuelve en la especificación de CH-19d como enmienda a DEC-97.

**Por qué.** Omitir es el circuit breaker que DEC-110 rechazó y amplía el motor (regla 6). Un fallo visible deja rastro en el registro de ejecución.

**Se resigna.** Cada ejecución de un tenant con agente caído consume su intento de conexión.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-118 — CH-19 (C2): alcanzabilidad por latido y sondeo TCP

**Contexto.** C2 pide detectar un tenant inalcanzable con aviso antes de que falle una ejecución programada. Hoy no hay estado de alcanzabilidad persistido.

**Opciones.** (a) Latido del agente más sondeo TCP de los destinos permitidos, sin credenciales ni SQL. (b) Derivar el estado del historial de `Ejecucion`. (c) Tabla de eventos.

**Decisión.** (a). Columnas de último estado en el registro del agente; se persisten solo las transiciones, no cada latido. Estado visible en consola y API, más una vista de automatizaciones en riesgo en la próxima ventana. No hay correo de alerta. El sondeo vive en el servidor del canal, no en el planificador.

**Por qué.** (b) es reactivo y no cumple «aviso antes». (c) ya fue rechazada en DEC-87. Un correo de alerta sería una superficie de notificación nueva (regla 6, DEC-82).

**Se resigna.** Sin alerta activa al operador: queda como límite del artefacto.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-119 — CH-19 (C3): costo de conectividad por script y plantilla, sin tabla de eventos

**Contexto.** C3 pide registrar cuánto costó resolver la conectividad en cada alta. DEC-87/90/91 resolvieron G1 con un script versionado y bitácora manual.

**Opciones.** (a) Solo convención de bitácora. (b) Script al estilo `marcas-alta.sql` más plantilla, con marcas de primer latido y primera sesión exitosa. (c) Tabla de eventos persistida.

**Decisión.** (b). Se enmienda DEC-88: la marca de conexión del alta pasa a tener un equivalente para tenants con agente.

**Por qué.** Reutiliza el patrón existente y no agrega tablas de eventos (DEC-87).

**Se resigna.** Las marcas miden tiempo transcurrido, no esfuerzo, y los intentos fallidos de prueba no se persisten; la fricción queda en la bitácora escrita a mano.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-120 — CH-19: el agente se empaqueta como imagen Docker

**Contexto.** El agente corre en la infraestructura del cliente.

**Opciones.** (a) Imagen Docker con entrypoint propio. (b) Binario único de Node. (c) Paquete npm. (d) Binario Go.

**Decisión.** (a). El agente lee su propia configuración (no usa `loadConfig`, para no exigir secretos del motor en la máquina del cliente) y comparte con el motor solo los tipos del protocolo. Incluye un fragmento de Compose y un `.env.example` sin valores reales (regla 7).

**Por qué.** La sección 7 de `docs/00-contexto.md` fija Docker Compose. Un binario Go rompería DEC-05.

**Se resigna.** El cliente necesita Docker en el host del agente.

**Decidido por:** el usuario, 2026-10-02, eligiendo la opción recomendada.

**Estado:** firme.

---

### DEC-121 — CH-19b: un agente por tenant en una sola fila, token buscado por un lookup tipado dentro del módulo de aislamiento

**Contexto.** CH-19b crea el modelo `Agente` y la emisión, listado y revocación de su token (DEC-114, DEC-115, DEC-116). El token se resuelve antes de que exista contexto de tenant, y un modelo que no figure en `MODELOS_AISLADOS` pasa sin filtrar.

**Opciones.**
- Búsqueda del token: (a) `Agente` fuera de `MODELOS_AISLADOS`; (b) segundo modelo sin filtro; (c) SQL crudo parametrizado; (d) `Agente` aislado más un lookup tipado agregado en `extenderConAislamiento`, que ya tiene el cliente crudo.
- Modelo: (a) una fila `Agente` por tenant, baja lógica; (b) `Agente` más tabla de tokens.
- `Conexion.agenteId`: (a) validado con búsqueda acotada al tenant en `POST /conexiones`; (b) clave foránea compuesta; (c) diferir a CH-19c1.

**Decisión.**
- Búsqueda: (d). `Agente` entra en `MODELOS_AISLADOS`. La búsqueda es por `tokenHash`, filtra `revocadoEn` nulo y devuelve solo `id`, `tenantId` y el estado del tenant. `tokenHash` aparece solo en ese lookup y en las escrituras de alta y reemisión. Si la extensión no funciona sobre el cliente encadenado, se cae a (c); eso no reabre esta decisión.
- Modelo: (a). Una fila por tenant (`tenantId` único, índice completo, no parcial, por DEC-111), `tokenHash` único, `creadoEn`, `tokenEmitidoEn`, `revocadoEn`. Revocar marca la fecha y conserva la fila. `POST /agentes` crea si el tenant no tiene agente, reemite en el lugar (mismo id, hash nuevo) si está revocado, y responde 409 `agente-existente` si hay uno activo. Rotar es revocar y reemitir, con un corte breve aceptado (DEC-115). Sin historial de tokens ni rotación con solapamiento.
- `Conexion.agenteId`: (a). Opcional en `POST /conexiones`; un id ajeno o inexistente responde 404 `agente-no-encontrado`. El chequeo no mira `revocadoEn`: la revocación es un estado de la credencial, no de la pertenencia. La clave foránea es `RESTRICT` explícita. Sin ruta para editar una conexión: pasar una directa a agente exige registrarla de nuevo.

**Por qué.** (d) mantiene `Agente` fail-closed con un único escape auditable en el módulo que ya posee el cliente crudo, sin SQL crudo. Una fila alcanza porque DEC-115 fija un agente por tenant y mantiene estable `Conexion.agenteId` ante la reemisión; la tabla de tokens se parece a la tabla de eventos que DEC-87 rechazó. Validar `agenteId` ahora deja el chequeo de regla 2 fuera de CH-19c1, el corte más riesgoso.

**Se resigna.** Sin historial de tokens ni rotación sin corte. No hay autenticación de operador: quien tenga un id de tenant válido puede emitir el token de ese tenant, igual que en el resto de las rutas de administración. Un lookup nuevo, visible en el tipo del cliente extendido, que debe devolver solo lo mínimo.

**Fuera de esta decisión (diseño de CH-19b).** Formato del token (`zda_` más 32 bytes aleatorios en base64url, hash SHA-256 en hexadecimal), proyección pública sin `tokenHash`, `tenantId` ni token, y rutas `/agentes` acotadas por `X-Tenant-Id` sin excepción (el prefijo `/agente/*` queda reservado para las rutas del agente, DEC-116).

**Decidido por:** el usuario, 2026-10-03, eligiendo las opciones recomendadas. No inferido por el agente.

**Estado:** firme.

---

### DEC-122 — CH-19c1: `ws` crudo con upgrade propio, autenticación solo por cabecera, fallos de réplica por el canal de control

**Contexto.** CH-19c1 implementa el lado motor del canal (DEC-112, DEC-113): rutas WebSocket de control y de datos, registro de sesiones en memoria y `destinoDeConexion` devolviendo un canal. DEC-113 nombra `ws` pero no cómo integrarlo, y DEC-114, DEC-116 y DEC-117 dejan sin fijar la autenticación del upgrade, el contexto de tenant en ese camino, cómo informa el agente un fallo de réplica y qué pasa sin canal de control.

**Opciones y decisión.**
- **Integración (Q1).** (a) `ws` con `noServer` y un listener propio del evento `'upgrade'`; (b) `@fastify/websocket`. **Decisión: (a).** El token se valida antes del 101, Fastify nunca ve la petición y la lista cerrada de excepciones de `X-Tenant-Id` no cambia. Un `GET /agente/...` que no sea upgrade cae a Fastify y falla cerrado (400 `tenant-no-indicado`).
- **Contexto de tenant (Q2).** (a) no entrar a `conTenantActivo` en el upgrade; (b) entrar leyendo `Tenant` por id; (c) ampliar el lookup con el nombre. **Decisión: (a), enmienda DEC-116.** El camino no toca ningún modelo con filtro (el lookup es sin filtro por diseño y `Tenant` no está aislado), así que sigue fallando cerrado ante cualquier consulta con filtro sin contexto. (c) queda descartada: rompe la spec y el test L2.
- **Autenticación (Q3).** **Decisión:** solo `Authorization: Bearer zda_…`; nunca query ni subprotocolo. Hash, lookup y rechazo antes del 101: 401 igual para token ausente, desconocido o revocado; 403 con tenant desactivado. El canal de datos reautentica con el mismo token y la sesión debe pertenecer al agente; una sesión ajena o inexistente da el mismo 404. Un socket con error durante el lookup asíncrono lleva un listener de `'error'` (lección de DEC-111).
- **Fallo de réplica (Q4).** (a) el agente cierra el socket de datos con un código de cierre; (b) mensaje de control nuevo `sesion-fallida` con uno de los siete códigos cerrados de DEC-117. **Decisión: (b).** El motor destruye el duplex pendiente antes de emitir `'connect'` (contrato C4 de CH-19a). Un código desconocido se clasifica como `error-desconocido`. Es una ampliación de tipos del catálogo, con delta MODIFIED sobre su requisito.
- **Sin canal de control (Q5).** (a) `ECONNREFUSED`; (b) código interno propio; (c) la categoría `agente-desconectado` ya. **Decisión: (b), provisorio.** El duplex se destruye de forma asíncrona con un código interno del motor (nombre fijado en el diseño); se clasifica `error-desconocido`, no se reintenta y deja un código visible distinto. Cubre: sin socket de control, envío fallido, tope de sesiones por agente y vencimiento de la sesión pendiente. Nunca cae a conexión directa (`host` y `puerto` son «como los ve el agente», DEC-115), ni espera, ni encola (DEC-95, DEC-110). CH-19d2 solo agrega el mapeo a `agente-desconectado`.
- **Revocación (Q6).** **Decisión:** además de recomprobar en cada upgrade, `POST /agentes/:id/revocar` y `/tenants/:id/baja` cierran los sockets del agente (código 4002) mediante el registro. Válido por instancia única (DEC-75).
- **Proxy con TLS (Q7).** **Decisión:** el motor no configura ni documenta un proxy en 19c1 y no confía en `X-Forwarded-Proto`, que es falsificable si el puerto de la app es alcanzable. La exigencia de TLS queda en el agente (DEC-113). La nota de despliegue (el puerto de la app no se expone a redes no confiables; el timeout de inactividad del proxy debe superar el ping de 20 s) va en el fragmento de Compose de CH-19c2 y el runbook de CH-19e.

**Por qué.** Cada decisión mantiene el motor sin capacidad nueva (regla 6), deja el tenant solo en la fila del token (regla 2), no registra ni guarda contenido de tramas (regla 5) y no mueve el planificador.

**Se resigna.** DEC-116 se cumple por su intención, no por su letra. El fallo sin canal queda con una categoría provisoria hasta CH-19d2. Una inundación de upgrades sin autenticar cuesta un hash y una consulta cada uno: límite residual documentado, no resuelto acá. El motor no verifica TLS por sí mismo.

**Fuera de esta decisión (diseño de CH-19c1).** Ids de sesión con `randomBytes(16)` en base64url y ligados al agente; registro en memoria con reemplazo del socket de control (el viejo se cierra con 4001); límites como constantes (tramas de datos 1 MiB, control 4 KiB, 8 sesiones por agente, vencimiento de sesión pendiente 30 s, `perMessageDeflate` apagado); ping cada 20 s sin tiempo de inactividad en datos; sin variables de entorno nuevas; el registro llega a `destinoDeConexion` como parámetro opcional con valor por defecto «sin agentes» que falla cerrado; verificación en el uso de que el `tenantId` del registro coincide con el tenant activo; cierre ordenado de los sockets en `onClose`.

**Decidido por:** el usuario, 2026-10-03, eligiendo las opciones recomendadas. No inferido por el agente.

**Estado:** firme.

---

## Compuertas abiertas

No bloquean el R0. Bloquean el R2. Cerrarlas antes de modelar la persistencia definitiva.

### D-1 — ¿Se persisten los resultados de las consultas? (cerrada)

Resuelta como DEC-93: solo consultas y metadatos de ejecución.

**Estado:** cerrada. Ver DEC-93 en "Decisiones tomadas".

---

### D-2 — ¿Cómo llega el motor a la réplica del cliente? (cerrada)

Resuelta como DEC-94: agente saliente.

**Estado:** cerrada. Ver DEC-94 en "Decisiones tomadas".

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
