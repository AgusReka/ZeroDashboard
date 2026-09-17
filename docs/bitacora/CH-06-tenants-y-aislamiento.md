# Bitácora — CH-06: Tenants y aislamiento

**Fecha de inicio:** 2026-09-17
**Fecha de cierre:** 2026-09-17 — implementación completa y verificada en vivo (129 pruebas en verde y humo de punta a punta pasando); queda pendiente el `verify` y el archivado del change
**Tiempo invertido:** sesión asistida por agente (Claude Code), en cuatro tandas encadenadas correspondientes a los cuatro PR planificados (migración + alta de tenants, primitiva de contexto + extensión de Prisma + adopción en rutas, suites de T1 y T2, consola + humo + documentación). No cronometrada minuto a minuto: completar con el tiempo real percibido antes de citar este dato en la tesis.

> Se escribe durante el desarrollo, apoyada en los registros de la sesión (comandos ejecutados y sus resultados), no reconstruida de memoria al final.

---

## Qué se construyó

El aislamiento entre tenants, que hasta ahora la arquitectura afirmaba (DEC-03) y ningún código hacía cumplir. Antes de este change, `GET /consultas-guardadas`, `GET /consultas-guardadas/:id`, `POST /conexiones/:id/prueba` y la búsqueda de `Conexion` en `POST /consultas/ejecutar` resolvían por `id` sin mirar el `tenantId`, y los dos caminos de alta elegían "el primer tenant que se haya creado alguna vez". Ahora cada petición nombra su tenant activo en el encabezado `X-Tenant-Id`, dos hooks `onRequest` lo validan antes de que corra cualquier handler, y una extensión del cliente de Prisma inyecta el filtro por tenant en **toda** consulta sobre `Conexion` y `ConsultaGuardada`. Las rutas dejaron de mencionar tenants: ninguna escribe `where: { tenantId }` a mano, y las cuatro lecturas sin filtrar quedaron alcanzadas sin cambiarles una línea de lógica.

La historia T1 entró completa en `src/tenants.ts`: alta (`POST /tenants`), listado de activos con una salida explícita para ver también los dados de baja (`GET /tenants?incluirInactivos=true`), y baja lógica (`POST /tenants/:id/baja`). La baja es la de DEC-14 y no una versión suave: el tenant sale del listado por defecto, toda operación posterior que lo nombre se rechaza con `409 tenant-desactivado` antes de tocar la base, y sus filas quedan intactas para auditoría. No existe reactivación, y hay una prueba que lo afirma probando las tres formas que tendría si existiera.

La historia T2 es el archivo `src/aislamiento.test.ts`: dos tenants cargados, cada uno con su `Conexion` y su `ConsultaGuardada`, y un barrido escrito como **tabla de ruta × tenant** en vez de un caso suelto por ruta —de modo que una ruta nueva que falte ahí se vea como omisión en la revisión—. Cada fila se corre en las dos direcciones, y cada una lleva su control: la misma ruta contra el id propio tiene que seguir funcionando, porque si no la afirmación de aislamiento también pasaría con la ruta simplemente rota. La historia T4 es la barra fija de la consola, con selector e indicador permanente del tenant activo.

`503 tenant-no-inicializado` se eliminó, no se recicló. Existía porque el alta necesitaba *algún* id de tenant para una clave foránea NOT NULL; con el tenant nombrado por la petición esa condición es inalcanzable, y una tabla vacía responde `404 tenant-no-encontrado`, que es lo cierto. Dejarlo como alias habría dejado una rama muerta que se lee como una garantía viva.

## Decisiones tomadas

Ninguna decisión de arquitectura nueva: DEC-13, DEC-14 y DEC-15 ya estaban firmes (decididas por el usuario el 2026-09-17) antes de empezar. Las que siguen son de nivel de diseño, precedente DEC-05, y están registradas completas en `openspec/changes/CH-06-tenants-and-isolation/design.md` y resumidas en `01-decisiones.md` bajo "Resoluciones de nivel diseño bajo DEC-13, DEC-14 y DEC-15".

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| El tenant activo viaja en el encabezado `X-Tenant-Id` | Prefijo de ruta `/t/:tenantId/...`, o un campo en el cuerpo | El encabezado es ortogonal al ruteo: ninguna URL de CH-03/04/05 cambia de forma y una sola lista de exenciones cubre todas las rutas presentes y futuras. El prefijo reescribía cada path, la consola y `scripts/smoke.sh`. El cuerpo es imposible en `GET` y reabriría la prohibición de Regla 2 que los esquemas ya hacen cumplir |
| Las exenciones se comparan contra el **patrón** de ruta, no contra un prefijo de la URL cruda | `url.startsWith('/consola')` y equivalentes | Un prefijo crudo deja que `/consola-falsa` se haga pasar por `/consola`. Hay una prueba para eso |
| La extensión falla cerrada: sin contexto lanza, y una operación no contemplada también lanza | Dejar pasar la consulta sin filtrar cuando no hay contexto | Una consulta sin filtrar es exactamente la fuga que T2 existe para impedir, y sería silenciosa. Que la lista de operaciones sea cerrada invierte el valor por defecto: el `upsert` de un aporte futuro falla en su primera corrida de pruebas en vez de cruzar tenants en producción |
| El predicado de tenant se conjuga con `AND` en las operaciones de filtro, no se mezcla dentro del `where` | `where.tenantId = tenantId` | Mezclado, un `tenantId` (o un `OR` que ensanche el filtro) suministrado por quien llama podría desplazarlo. Conjugado, se aplica al nivel más alto pase lo que pase adentro. Hay dos pruebas unitarias sobre eso |
| `503 tenant-no-inicializado` se borra | Mantenerlo como alias de alguno de los envoltorios nuevos | Sería una rama muerta escrita como si fuera una garantía viva |
| La baja es `POST /tenants/:id/baja` | `DELETE /tenants/:id` | La baja de DEC-14 es una transición de estado que conserva la fila; `DELETE` prometería una eliminación que no ocurre |
| El indicador muestra el nombre **y** un fragmento del id | Solo el nombre | Los nombres duplicados están permitidos por diseño (no hay restricción de unicidad en ninguna tabla del esquema), así que el nombre solo no cumple el "sin ambigüedad" que pide T4 |
| Las pruebas conservan un cliente crudo para fixtures y comprobaciones, y le pasan el cliente extendido a la aplicación bajo prueba | Un solo cliente extendido en todo el archivo | La aplicación tiene que ejercitar la extensión real (sin simulacros, convención vigente), pero una comprobación *entre* tenants solo significa algo desde afuera del alcance. `tenantId` además no está en ninguna proyección de respuesta, así que leerlo solo es posible por ahí |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Una extensión de Prisma reescribe los **argumentos** en tiempo de ejecución, pero no reescribe los **tipos** generados del cliente. Sacar `tenantId` del `create({data})` rompió la compilación con "Property 'tenant' is missing" | El diseño describía la inyección como si fuera transparente para quien llama. Lo es en ejecución; en tipos, no | Un helper con nombre, `conTenantInyectado()`, exportado desde el módulo que causa el hueco. Es solo a nivel de tipos y no hace nada en ejecución. Se descartó un `as` suelto en cada ruta: dejaría tres conversiones sin explicar en tres archivos, y esto lo deja en un lugar revisable | Baja. Es un hueco real del diseño, no un error de implementación, y quedó anotado como tal |
| 2 | **`POST /conexiones` aceptaba un `tenantId` en el cuerpo y devolvía `201`.** Regla 2 estaba rota en esa ruta | Es la fricción 1 de CH-05 otra vez: `additionalProperties: false` con `removeAdditional` de Fastify **borra** la clave desconocida en vez de rechazarla. CH-05 arregló el esquema de consultas guardadas con `propertyNames` y **no** tocó el de conexiones, que nadie estaba ejercitando | La encontró el barrido de Regla 2 de la tarea 3.5, que a diferencia de las pruebas previas recorre **las dos** rutas de alta. Se agregó el mismo `propertyNames` a `registroConexionSchema` | Baja en tiempo, y es el hallazgo más valioso del change: un agujero de seis días que existía porque la prueba anterior miraba una sola ruta |
| 3 | Dos afirmaciones propias fallaban de forma intermitente al correr `npm test` completo, y pasaban al correr sus archivos solos | Usaban un conteo de tabla entera antes/después. `npm test` corre los archivos de prueba en **procesos paralelos** contra una sola base, así que el total se mueve por trabajo de otra suite | Se reemplazó por conteos acotados a un marcador único, que es el recurso que `consultas-guardadas.test.ts` ya usaba para lo mismo | Baja, pero instructiva: el aislamiento entre tenants se estaba probando bien y lo que fallaba era el aislamiento entre *suites* |
| 4 | Un acento invertido dentro de un comentario del script embebido rompió el archivo TypeScript, otra vez | Es exactamente la fricción 4 de CH-05: toda la consola vive dentro de una plantilla de cadena de TypeScript | Lo atrapó `npm run build` al instante. Se quitó el acento invertido y se dejó escrito el aviso **dentro** del documento, para que la próxima persona lo lea donde importa | Baja, y la repetición es el dato: la advertencia estaba en la bitácora de CH-05 y no en el archivo |
| 5 | El humo falló dos veces seguidas por **mis propios comentarios**: una guardia busca la cadena `innerHTML` en el documento servido y otra busca `tenant-no-inicializado`, y los comentarios nuevos las nombraban literalmente para explicar por qué no había que usarlas | Las guardias son búsquedas de subcadena sobre el HTML servido, no análisis sintáctico. Un comentario que menciona lo prohibido es indistinguible de usarlo | Se reescribieron los comentarios sin nombrar las cadenas, y cada uno dice ahora *por qué* no puede nombrarlas. Se descartó relajar las guardias: son baratas y ya atraparon un problema real en CH-05 | Baja, dos ciclos de humo (cada uno reconstruye la imagen). Queda como ejemplo de una guardia burda que igual vale la pena |
| 6 | No hay navegador en el entorno de la sesión y la verificación manual de la consola (tarea 4.8) es un requisito explícito del change | Entorno, no código | Lo mismo que hizo CH-05: se sirvió `/consola` desde la ruta real, se extrajo su script embebido tal cual y se **ejecutó ese código** sobre un DOM mínimo. Se afirmaron las tres condiciones de 4.8: el indicador nunca queda en blanco, cambiar de tenant vacía la tabla y la lista, y un tenant llamado `<script>alert(1)</script>` produce un nodo de texto sin hijos de elemento. Queda anotado que **no** es una prueba de navegador: no cubre parseo de HTML real ni maquetado | Media, y con el mismo residuo declarado en CH-05 |

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | Base ya migrada por CH-02, con su fila de `Tenant` sembrada | `prisma migrate deploy` | La columna `activo` se agrega y las filas existentes quedan en `true`, sin error | `Applying migration 20260917000000_tenant_activo` … `All migrations have been successfully applied`; `psql` muestra `Food Store | t` | ✅ |
| V-2 | Aplicación con los hooks registrados | Pedir una ruta alcanzada sin encabezado, con un id inexistente y con un tenant dado de baja | `400 tenant-no-indicado`, `404 tenant-no-encontrado`, `409 tenant-desactivado`, los tres antes del handler | Los tres envoltorios, y un alta rechazada no dejó ninguna fila | ✅ |
| V-3 | Cliente extendido, fuera de todo contexto de petición | Llamar `findMany` y `create` sobre un modelo alcanzado | Rechaza con `ErrorSinTenantActivo` y no escribe nada | Rechazó las dos; el conteo por marcador quedó en 0 | ✅ |
| V-4 | Dos tenants, cada uno con su `Conexion` y su `ConsultaGuardada` | Barrido de ruta × tenant en las dos direcciones | Listado excluye, y `get-by-id`, `prueba` y `ejecutar` dan `404`; las mismas rutas contra el id propio siguen funcionando | Todo el barrido en verde, incluido el caso de efecto: un `DELETE` enviado contra la conexión del otro tenant no movió ni una fila | ✅ |
| V-5 | Un tenant activo y las suites de CH-03, CH-04 y CH-05 | `npm test` | Los escenarios previos pasan sin cambios más allá del encabezado agregado | `tests 129 / pass 129 / fail 0 / skipped 0` | ✅ |
| V-6 | Pila de Compose levantada desde cero | `npm run smoke` | Todas las secciones anteriores más la de CH-06 | `SMOKE TEST PASSED`, con el tenant B viendo listado vacío y `404` en las tres rutas, y la baja respondiendo `409` en todas | ✅ |
| V-7 | Documento `/consola` realmente servido | Ejecutar su script embebido sobre un DOM mínimo | Indicador siempre con texto, cambio de tenant vacía tabla y lista, nombre hostil como texto, encabezado en toda llamada alcanzada | Las cuatro; `GET /tenants` confirmado como exento, sin encabezado | ✅ |

## Consultas ejecutadas

Ninguna consulta de dominio produjo datos citables en este change: todo lo ejecutado fue de verificación sobre la base propia o sobre el esquema de prueba `ch04_smoke`, no sobre datos de Food Store.

```sql
-- ejecutada 2026-09-17 sobre la base propia de la aplicación (zerodashboard)
-- universo: todas las filas de Tenant, para comprobar el relleno de la migración
SELECT id, nombre, activo FROM "Tenant";
```

## Notas para la tesis

Alimenta el capítulo de resultados, en dos afirmaciones distintas.

La primera es sobre **garantías estructurales frente a disciplina manual**, que es el criterio que el proyecto ya había aplicado en DEC-08 y DEC-09 y acá se aplica al aislamiento (DEC-13). El dato citable no es que el aislamiento funcione, sino *dónde* vive: ninguna de las cuatro rutas alcanzadas menciona el tenant, y las cuatro quedaron aisladas sin cambiarles lógica. El contraste está a mano: la fricción 2 es un agujero de Regla 2 que sobrevivió seis días en una sola ruta justamente porque ese control **sí** era una convención que había que acordarse de repetir, y lo que lo encontró fue una prueba que recorre las dos rutas en vez de una.

La segunda es sobre el **costo real de verificar sin las herramientas de un perfil técnico**. Tres de las seis fricciones (4, 5 y 6) no son sobre el problema del dominio: son sobre el entorno y sobre herramientas que no dicen lo que parecen decir —una plantilla de cadena que termina en un acento invertido dentro de un comentario, dos guardias de texto que no distinguen mencionar de usar, y la ausencia de un navegador para verificar una pantalla—. Ninguna es difícil una vez vista; todas cuestan un ciclo completo de reconstrucción de imagen. Es evidencia directa de la barrera de entrada técnica, y la fricción 4 tiene un valor extra: ya estaba registrada en la bitácora de CH-05 y volvió a ocurrir, lo que dice algo sobre dónde hay que dejar escrita una advertencia para que sirva.
