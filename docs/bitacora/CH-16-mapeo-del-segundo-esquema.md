# Bitácora — CH-16: Mapeo del segundo esquema

**Fecha de inicio:** 2026-09-19
**Fecha de cierre:** 2026-09-19 — experimento completo: Medusa levantada con datos de demo, esquema inspeccionado, cinco vistas canónicas propuestas y ejecutadas contra datos reales; el paso 4 original (correr consultas de catálogo existentes) queda explícitamente omitido porque esas consultas todavía no existen en el repo (CH-11/12/13 pendientes)
**Tiempo invertido:** sesión asistida por agente (Claude Code), corrida continua desde levantar Docker hasta escribir esta entrada. No cronometrado minuto a minuto; completar con el tiempo real percibido antes de citar este dato en la tesis.

> CH-16 no es desarrollo: es el experimento que responde la pregunta de genericidad del proyecto. Esta entrada se escribe inmediatamente después de ejecutar cada paso (comandos y consultas transcriptos tal como corrieron), no reconstruida de memoria al final.

---

## Qué se construyó

Nada de código de aplicación — por diseño del experimento (D-4/D-5 ya cerradas como DEC-25/DEC-26). Lo que se construyó fue evidencia empírica: una instancia real de Medusa 2.21.0, con su base PostgreSQL propia corriendo en Docker y el seed de demostración oficial cargado, y cinco vistas SQL (`CREATE VIEW`) que traducen el esquema real de Medusa a la forma exacta del contrato canónico (`src/contrato.ts`).

El resultado central: **ningún campo canónico carece de una columna o tabla de origen en el esquema de Medusa**, pero esa ausencia de "campos huérfanos" no significa que el mapeo sea trivial. Aparecieron tres fricciones estructurales distintas, cada una independiente de las otras: (1) una asimetría de granularidad — el contrato modela "producto" como una fila plana, Medusa lo separa en `product`/`product_variant`/`inventory_item`, tres tablas encadenadas —, (2) columnas que el esquema de Medusa deja nullable pese a que el contrato las declara obligatorias, confirmado empíricamente contra el propio seed de demostración (`inventory_item.unit_of_measure` es `NULL` en el 100% de las 20 filas sembradas), y (3) un campo (`pedido.total`) cuyo origen existe pero no es una columna escalar sino un `jsonb` interno sin filas de muestra para verificar su forma. El detalle completo de cada uno está en "Consultas ejecutadas" y "Notas para la tesis".

También se confirmó algo que D-5 dejaba como pendiente de revisar: el "Inventory Kit" de Medusa (`product_variant_inventory_item`, con `required_quantity`) es estructuralmente idéntico a `receta_componente` — variante que consume N unidades de un ítem de inventario —, pero el seed de demostración no ejercita ningún caso real de receta con múltiples insumos ni cantidades distintas de 1: los 20 vínculos sembrados tienen `required_quantity = 1` y ningún `inventory_item` se comparte entre variantes. La capacidad estructural existe y se pudo mapear (`v_receta_componente`); su comportamiento con una receta real de varios insumos no se pudo observar con datos, porque los datos no existen y la tarea prohíbe fabricarlos.

## Decisiones tomadas

Una decisión de arquitectura no prevista surgió al definir `v_producto`, y se registró como **DEC-27** en `docs/01-decisiones.md`, dejada inicialmente como *propuesta* (no firme) porque la regla general del proyecto es que ninguna decisión de arquitectura la toma un agente. El usuario revisó las dos opciones el 2026-09-21 y confirmó (b); DEC-27 quedó firme.

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| `v_producto` mapea a `product_variant` de Medusa (una fila por variante), no a `product` (DEC-27) | Mapear a `product`, agregando el stock de todas sus variantes en una sola fila y resolviendo de algún modo un `sku` que dejaría de ser único | Es al nivel de variante donde Medusa liga precio, SKU, stock y la referencia real de una línea de pedido (`order_line_item.variant_id`); agregar al nivel de `product` perdería exactamente la precisión que el contrato exige como obligatoria en `stockDisponible` y `sku` |
| `pedido.total` se deja fuera de `v_pedido` en vez de forzar una expresión sobre `order_summary.totals` | Extraer un valor de `order_summary.totals` (jsonb) con una clave supuesta (p. ej. `totals->>'total'`) y presentarlo como el mapeo de `total` | La tabla `order_summary` no tiene ninguna fila en este seed (Medusa no siembra pedidos de demostración) y su forma interna no está documentada públicamente de forma verificable en esta investigación; inventar una clave de JSON no observada sería exactamente el tipo de mapeo forzado que la tarea prohíbe |
| `v_insumo`/`v_producto` agregan stock con `COALESCE(SUM(...), 0)` sobre `inventory_level`, no con un valor fijo | Tomar una sola fila de `inventory_level` arbitrariamente cuando hay más de una ubicación (`stock_location`) | Es la única agregación que no descarta datos reales cuando existe más de una ubicación de stock; en el seed actual solo hay una ubicación por ítem, así que el caso multi-ubicación queda sin ejercitar con datos reales, pero la vista no se rompe si aparece |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Docker Desktop estaba instalado pero el daemon no corría (`docker ps` fallaba con `failed to connect to the docker API at npipe:...`) | El servicio de Docker Desktop en Windows no arranca junto con la sesión; hay que iniciar la aplicación manualmente y esperar a que el daemon exponga el pipe | Se lanzó `Docker Desktop.exe` y se sondeó `docker info` en un loop hasta que respondió (recuperado en el primer sondeo del loop, sin necesitar los 150s de margen previstos) | Baja — un paso manual más de arranque, pero sin reintentos fallidos |
| 2 | `npx create-medusa-app@latest` pregunta interactivamente "¿Instalar el storefront?" incluso pasando `--no-browser`/`--skip-db` — no hay una flag para responderla de antemano. En un shell no interactivo (stdin cerrado) esto no queda en espera: el proceso de Node crashea con `Error [ERR_USE_AFTER_CLOSE]: readline was closed` al intentar leer la respuesta | El CLI de Medusa asume una terminal interactiva real; no hay un flag documentado tipo `--no-storefront` para saltear esa pregunta puntual | Se le pasó la respuesta por stdin con `printf 'n\n' \| npx create-medusa-app@latest ...`, lo cual sí la satisface sin necesitar una terminal interactiva | Baja-media — un intento perdido completo (unos minutos) hasta identificar que el crash era por el prompt, no por un error real de Medusa |
| 3 | Con la pregunta del storefront ya resuelta, el CLI igual clona un repositorio plantilla completo (`medusajs/dtc-starter`, que incluye backend y storefront juntos) y el `git checkout` posterior falla en Windows: `fatal: cannot create directory at 'apps/storefront/src/.../@dashboard/orders/details': Filename too long` | El repositorio plantilla tiene rutas anidadas muy largas (convención de Next.js App Router con rutas dinámicas `[countryCode]` y grupos `(main)`/`@dashboard`); combinado con un `cwd` ya profundo (el directorio de scratchpad de la sesión), la ruta total supera el límite clásico de 260 caracteres de Windows, y Git para Windows no tiene `core.longpaths` habilitado por defecto | Dos cambios: (a) se movió el proyecto a una ruta corta cerca de la raíz del disco (`C:\zd-medusa-ch16\`) en vez de usar el directorio de scratchpad (deliberadamente, solo para este clon; no se modificó ningún archivo del proyecto ZeroDashboard), y (b) se inyectó `core.longpaths=true` únicamente para el proceso de esa invocación vía las variables de entorno `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` (mecanismo de Git que no escribe en ningún archivo de configuración), sin tocar la configuración global de git de la máquina | Media — dos intentos fallidos completos (incluyendo la reinstalación de dependencias de cada intento) hasta aislar que la causa era el largo de ruta de Windows, no una falla real de Medusa ni de la base |
| 4 | El seed de demostración oficial de `--seed` no crea ningún pedido: `order`, `order_line_item`, `order_item` y `order_summary` quedan en 0 filas después del seed, aun con `product`/`product_variant`/`inventory_item` completamente poblados (4 productos, 20 variantes, 20 ítems de inventario) | El seed de demostración de Medusa (pensado para mostrar el catálogo de una tienda nueva) solo carga catálogo, precios, inventario y canales de venta — no simula ninguna venta histórica | Se documenta como resultado, no se fabrica ningún pedido de prueba: `v_pedido` y `v_item_pedido` se definieron y se ejecutaron contra el esquema real (la `CREATE VIEW` corrió sin error), pero no se pudieron verificar contra filas reales, solo contra el DDL | Ninguno perdido — es un hallazgo, no un bloqueo: se transcribe en "Notas para la tesis" |
| 5 | El "Inventory Kit" de Medusa (relación variante↔insumo con `required_quantity`, el candidato a `receta_componente`) existe en el esquema pero el seed no sembró ningún caso real de receta de más de un insumo | Mismo motivo que la fricción 4: el seed de demostración de Medusa es una tienda de ropa (remeras, shorts, buzos), no un fabricante con lista de materiales real | Se verificó la forma de la relación por inspección de esquema y por los 20 vínculos 1:1 sembrados (`required_quantity = 1` en el 100% de los casos, ningún `inventory_item` compartido entre variantes), y se documenta la limitación explícitamente en vez de inventar una receta de varios insumos que no está en los datos reales | Ninguno perdido — es un hallazgo, no un bloqueo |

> Fricción 3 en particular es material directo de tesis sobre barrera de entrada técnica: un desarrollador con experiencia en Git y Windows la resuelve en minutos una vez que identifica el mensaje de error real (`Filename too long` no es autoexplicativo sobre su causa real, que es la combinación de ruta larga + `core.longpaths` deshabilitado); alguien sin ese conocimiento previo podría interpretar el fallo como "Medusa no funciona en Windows" y abandonar el intento ahí, cuando el problema es enteramente de la herramienta de scaffolding, no de Medusa como plataforma ni de PostgreSQL.

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | Docker instalado, daemon no verificado | `docker info` tras iniciar Docker Desktop | El daemon responde sin error | Respondió en el primer sondeo del loop de espera | ✅ |
| V-2 | Sin base de datos propia para Medusa | `docker run postgres:16-alpine` con puerto propio (`55432`) publicado | Contenedor `Up`, alcanzable por `psql`/`docker exec` | `ch16-medusa-pg` en estado `Up`, confirmado con `docker ps` | ✅ |
| V-3 | Sin proyecto Medusa | `npx create-medusa-app@latest medusa-demo --db-url ... --seed --no-browser --use-npm` | Proyecto creado, migraciones corridas, base poblada | CLI reportó "✔ Ran Migrations" y "✔ Project Prepared"; `@medusajs/medusa@2.21.0` instalado en `apps/backend/package.json` | ✅ |
| V-4 | Base de Medusa recién migrada y sembrada | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` | Un esquema con más de una decena de tablas (evidencia de migraciones reales, no una base vacía) | 147 tablas | ✅ |
| V-5 | Base sembrada | `SELECT count(*) FROM product`, `product_variant`, `inventory_item` | Catálogo de demostración presente | 4 productos, 20 variantes, 20 ítems de inventario | ✅ |
| V-6 | Base sembrada | `SELECT count(*) FROM "order"`, `order_line_item`, `order_summary` | — (sin expectativa previa; resultado a documentar) | 0 filas en las tres tablas | ✅ (confirma fricción 4, no es un fallo) |
| V-7 | Cinco `CREATE VIEW` propuestas | Ejecutarlas contra `medusa_db` | Las cinco corren sin error de sintaxis ni de referencia a columnas/tablas inexistentes | `CREATE VIEW` × 5, sin errores | ✅ |
| V-8 | Vistas creadas | `SELECT * FROM v_producto/v_insumo/v_receta_componente` | Filas legibles, consistentes con el catálogo sembrado | 20 filas en cada una, con `nombre`, `stockDisponible`, `sku`/`codigo` poblados como se esperaba de la definición | ✅ |
| V-9 | Vistas creadas | `SELECT * FROM v_pedido/v_item_pedido` | 0 filas, porque no hay pedidos sembrados (fricción 4) | 0 filas en ambas | ✅ (esperado, no es un fallo de la vista) |
| V-10 | Hipótesis: `insumo.unidadMedida` es obligatorio en el contrato pero nullable en Medusa | `SELECT count(*), count(unit_of_measure) FROM inventory_item` | Al menos alguna fila sin `unidadMedida`, si la hipótesis es cierta | 20 de 20 filas con `unit_of_measure IS NULL` (0 de 20 con valor) | ✅ confirma la hipótesis con evidencia empírica, no solo por DDL |

## Consultas ejecutadas

```sql
-- ejecutada 2026-09-19 sobre medusa_db (contenedor Docker ch16-medusa-pg, Postgres 16-alpine)
-- universo: esquema completo recién migrado por create-medusa-app@2.21.0 / @medusajs/medusa@2.21.0

-- inventario de tablas del esquema public
SELECT count(*) AS n_tables FROM information_schema.tables WHERE table_schema='public';
-- resultado: 147

-- catálogo de demostración sembrado
SELECT count(*) FROM product;                          -- 4
SELECT count(*) FROM product_variant;                   -- 20
SELECT count(*) FROM inventory_item;                    -- 20
SELECT count(*) FROM "order";                           -- 0
SELECT count(*) FROM order_line_item;                   -- 0
SELECT count(*) FROM order_summary;                     -- 0

-- columnas de las tablas relevantes para el contrato canónico
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('product','product_variant','order','order_line_item',
                      'order_item','order_summary','inventory_item',
                      'inventory_level','product_variant_inventory_item')
ORDER BY table_name, ordinal_position;

-- valores del enum de estado de pedido
SELECT t.typname, e.enumlabel
FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname ILIKE '%order%status%';
-- resultado: order_status_enum = {pending, completed, draft, archived, canceled, requires_action}

-- distribución de cantidades del Inventory Kit (candidato a receta_componente)
SELECT required_quantity, count(*) FROM product_variant_inventory_item GROUP BY required_quantity;
-- resultado: 20 filas, todas con required_quantity = 1

-- ítems de inventario compartidos por más de una variante (señal de kit/BOM real)
SELECT inventory_item_id, count(*) AS n_variants
FROM product_variant_inventory_item GROUP BY inventory_item_id HAVING count(*) > 1;
-- resultado: 0 filas — ningún ítem de inventario se comparte entre variantes en este seed

-- verificación empírica de la nulabilidad de unidadMedida
SELECT count(*) AS total, count(unit_of_measure) AS con_unidad,
       count(*) FILTER (WHERE unit_of_measure IS NULL) AS sin_unidad
FROM inventory_item;
-- resultado: total=20, con_unidad=0, sin_unidad=20
```

### Vistas canónicas propuestas

Para cada campo se indica de qué tabla/columna de Medusa sale. Los campos sin una columna escalar directa (transformación, agregación o `NULL` intencional) están señalados explícitamente en comentarios SQL, no rellenados en silencio.

```sql
-- ejecutada 2026-09-19 sobre medusa_db — las cinco corrieron sin error (CREATE VIEW)

-- v_producto: una fila por product_variant de Medusa (DEC-27), no por product.
--   id               <- product_variant.id
--   nombre           <- product.title || ' - ' || product_variant.title   (transformación: concatenación)
--   stockDisponible  <- SUM(inventory_level.stocked_quantity - reserved_quantity)
--                       sobre los inventory_item vinculados a la variante (agregación)
--   sku              <- product_variant.sku                               (directo, opcional en Medusa también)
--   activo           <- product.status = 'published'                     (transformación: reinterpretación de un enum
--                       de visibilidad de storefront como "no discontinuado"; el seed solo tiene status='published'
--                       en las 4 filas de producto, así que esta transformación no se ejercitó con un caso status<>'published')
CREATE VIEW v_producto AS
SELECT
  pv.id                                                          AS id,
  p.title || ' - ' || pv.title                                   AS nombre,
  COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)   AS "stockDisponible",
  pv.sku                                                         AS sku,
  (p.status = 'published')                                       AS activo
FROM product_variant pv
JOIN product p ON p.id = pv.product_id
LEFT JOIN product_variant_inventory_item pvi ON pvi.variant_id = pv.id
LEFT JOIN inventory_item ii ON ii.id = pvi.inventory_item_id
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY pv.id, p.title, pv.title, pv.sku, p.status;

-- v_pedido: "total" queda deliberadamente FUERA de esta vista.
--   id             <- "order".id
--   fechaCreacion  <- "order".created_at
--   estado         <- "order".status (enum order_status_enum, convertido a texto)
--   numero         <- "order".display_id
--   moneda         <- "order".currency_code
--   total          <- SIN MAPEO VERIFICADO. Medusa no lo guarda como columna escalar de "order": vive en
--                     order_summary.totals (jsonb), una tabla que en este seed tiene 0 filas (Medusa no
--                     siembra pedidos de demo) y cuya forma interna de claves no se pudo verificar contra
--                     datos reales. No se incluye una expresión sobre una clave de JSON no observada.
CREATE VIEW v_pedido AS
SELECT
  o.id             AS id,
  o.created_at     AS "fechaCreacion",
  o.status::text   AS estado,
  o.display_id     AS numero,
  o.currency_code  AS moneda
FROM "order" o;

-- v_item_pedido: requiere JOIN porque Medusa separa "los hechos de la línea" (order_line_item: precio,
-- producto, variante) de "el vínculo con el pedido y la cantidad" (order_item: order_id, item_id, quantity)
-- en dos tablas distintas — no hay una sola tabla "línea de pedido" con todos los campos juntos.
--   id              <- order_item.id
--   pedidoId        <- order_item.order_id
--   productoId      <- order_line_item.variant_id (vía order_item.item_id = order_line_item.id;
--                       nullable en Medusa — una línea histórica puede sobrevivir a la variante que la originó)
--   cantidad        <- order_item.quantity
--   precioUnitario  <- order_line_item.unit_price
CREATE VIEW v_item_pedido AS
SELECT
  oi.id           AS id,
  oi.order_id     AS "pedidoId",
  oli.variant_id  AS "productoId",
  oi.quantity     AS cantidad,
  oli.unit_price  AS "precioUnitario"
FROM order_item oi
JOIN order_line_item oli ON oli.id = oi.item_id;

-- v_insumo: un inventory_item de Medusa por fila.
--   id             <- inventory_item.id
--   nombre         <- inventory_item.title           (nullable en Medusa; en el seed viene poblado pero
--                      con el mismo texto que el título de variante, p. ej. "S / White" — no es un nombre
--                      de insumo descriptivo por sí mismo, es lo que Medusa auto-generó al crear el ítem)
--   stockDisponible <- SUM(inventory_level.stocked_quantity - reserved_quantity) agregado por ubicación
--   unidadMedida   <- inventory_item.unit_of_measure  (nullable en Medusa; el contrato lo exige obligatorio.
--                      Verificado empíricamente: 0 de 20 filas del seed tienen este campo poblado — ver V-10)
--   codigo         <- inventory_item.sku
CREATE VIEW v_insumo AS
SELECT
  ii.id                                                          AS id,
  ii.title                                                       AS nombre,
  COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0)   AS "stockDisponible",
  ii.unit_of_measure                                             AS "unidadMedida",
  ii.sku                                                         AS codigo
FROM inventory_item ii
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku;

-- v_receta_componente: el "Inventory Kit" de Medusa (product_variant_inventory_item) es
-- estructuralmente idéntico a este concepto — variante que consume N unidades de un insumo.
--   productoId         <- product_variant_inventory_item.variant_id
--   insumoId           <- product_variant_inventory_item.inventory_item_id
--   cantidadPorUnidad  <- product_variant_inventory_item.required_quantity
CREATE VIEW v_receta_componente AS
SELECT
  pvi.variant_id          AS "productoId",
  pvi.inventory_item_id   AS "insumoId",
  pvi.required_quantity   AS "cantidadPorUnidad"
FROM product_variant_inventory_item pvi;
```

### Paso 4 del pedido original — omitido, con motivo documentado

El usuario había pedido inicialmente correr "las consultas del catálogo actual" contra estas vistas. Antes de ejecutar este experimento se verificó que **no existen consultas SQL de catálogo en el repositorio todavía**: CH-11 (parámetros), CH-12 (plantillas) y CH-13 (motor de automatizaciones) —los changes que producirían esas consultas— no se hicieron. El usuario confirmó explícitamente omitir ese paso en vez de inventar una consulta de catálogo que no existe o correr algo fuera del alcance real del repo en su estado actual. Este paso queda pendiente de retomar cuando CH-11/12/13 estén cerrados; en ese momento, las vistas de esta bitácora son el objeto natural contra el que esas consultas deberían poder correr sin reescritura, si el mapeo demuestra ser realmente genérico.

## Notas para la tesis

Esta entrada alimenta directamente el **capítulo de resultados**, en la sección que responde la pregunta de genericidad del sistema (la razón por la que el mapa de changes marca a CH-16 como "el más importante del proyecto").

**Lo que mapeó por traducción directa.** Tres de los cinco campos de `receta_componente` (`productoId`, `insumoId`, `cantidadPorUnidad`) y varios campos de `producto`/`insumo`/`item_pedido` (`sku`, `codigo`, `precioUnitario`, `cantidad`) tienen una columna de Medusa con el mismo significado, sin transformación ni agregación. Ningún campo del contrato canónico resultó completamente ausente del esquema de Medusa — un resultado en sí mismo, dado que Medusa fue elegida (DEC-26) precisamente por ser el candidato con modelo de insumos/BOM más completo de los cuatro investigados.

**Lo que exigió una decisión de traducción, no una columna directa.** `producto` es el caso central: el contrato lo modela plano, Medusa lo separa en tres tablas (`product`/`product_variant`/`inventory_item`) con una relación uno-a-muchos entre producto y variante. Resolver esto exigió una decisión de arquitectura no prevista (DEC-27, dejada como propuesta a confirmar): cada variante de Medusa es la fila canónica "producto". Es el hallazgo más directamente citable sobre el costo real de la genericidad — no es que a Medusa "le falten campos", es que su modelo tiene un nivel de indirección adicional que el contrato canónico no previó, y que un tercer esquema con más niveles todavía (por ejemplo, variantes con múltiples unidades de empaque) volvería a exigir la misma clase de decisión.

**Lo que quedó inaplicable por ausencia de datos, no por ausencia de esquema.** `pedido`/`item_pedido` tienen columnas y tablas de origen completas y las vistas corrieron sin error, pero no se pudieron verificar contra filas reales porque el seed de demostración oficial de Medusa no crea pedidos (0 filas en `order`, `order_line_item`, `order_summary`). De la misma forma, el "Inventory Kit" (candidato a receta con múltiples insumos) existe en el esquema y se mapeó, pero el seed solo ejercita el caso trivial (`required_quantity = 1`, sin ítems compartidos entre variantes) — no hay, en los datos oficiales, ningún caso real de una "receta" con más de un insumo para validar la aritmética de `stock-producible` contra Medusa. Esto es distinto de "campo sin origen": es "esquema genérico, datos de demostración no representativos del caso que el proyecto necesita probar", una distinción que vale la pena mantener separada en el capítulo de resultados.

**El único campo sin mapeo verificado con confianza.** `pedido.total`: existe en Medusa, pero no como columna escalar — vive en `order_summary.totals` (jsonb), una tabla vacía en este seed cuya forma interna de claves esta investigación no pudo confirmar contra datos reales. Se documenta como resultado abierto en vez de forzar una clave de JSON no observada.

**Costo de tiempo y fricción de plataforma.** Levantar Medusa con datos reales tomó más intentos que levantar Postgres solo: dos fallos completos de scaffolding (fricciones 2 y 3) antes de tener el proyecto corriendo, ninguno debido a Medusa ni a PostgreSQL en sí, sino a la interacción entre el CLI de scaffolding de Medusa y el entorno de shell/Windows. Es evidencia de que "levantar un segundo esquema real para validar genericidad" tiene un costo de fricción de plataforma no trivial incluso para un perfil técnico, separado por completo de la pregunta de genericidad del mapeo en sí.
