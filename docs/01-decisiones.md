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

### D-4 — Motores de base admitidos

Opciones: solo PostgreSQL / PostgreSQL y MySQL.

**Qué depende.** Si cada vista canónica necesita una o dos variantes. Las consultas ya escritas usan construcciones específicas de PostgreSQL que no tienen equivalente directo en MySQL.

**Estado:** abierta.

---

### D-5 — Segundo esquema para la validación de genericidad

Candidatos a verificar: Saleor y Medusa (PostgreSQL), WooCommerce y PrestaShop (MySQL).

**Qué depende.** El release R1, que es el que sostiene el capítulo de resultados.

**Advertencia:** si el segundo esquema corre sobre otro motor, se prueban dos cosas a la vez (mapeo de esquema y portabilidad de dialecto) y un fallo no distingue cuál falló.

**Pendiente de verificar:** motor de base de cada candidato, y si modelan insumos y recetas. Su ausencia deja inaplicable la automatización de stock producible, lo cual es un resultado esperado y reportable.

**Estado:** abierta, depende de D-4.

---

### D-6 — Declaración de uso de asistentes de IA

**Qué depende.** Requisitos de la institución sobre declarar el uso de herramientas de IA en el desarrollo.

**Estado:** abierta. Consultar el reglamento antes de la entrega.
