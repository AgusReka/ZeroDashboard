# Bitácora — Versión de Medusa y agregación de `insumo.stockDisponible` sobre `inventory_level`

**Fecha:** 2026-09-24 (consultas a las 12:51 hora -03:00).
**Instancia:** la de CH-16: contenedor `ch16-medusa-pg`, base `medusa_db`, usuario `medusa`.
**Alcance:** solo lectura. No se crearon ni se modificaron vistas ni datos. Las consultas corrieron en una transacción `REPEATABLE READ READ ONLY`, con `default_transaction_read_only=on`, y se cerraron con `ROLLBACK`.

---

## Resultado

| Dato | Valor | Fuente |
|---|---|---|
| Medusa | **2.21.0** (`@medusajs/medusa`, `@medusajs/framework` y `@medusajs/cli` fijados en `"2.21.0"`, sin rango) | `apps/backend/package.json` del proyecto de CH-16 |
| PostgreSQL | **16.15** (`PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit`) | `SELECT version()`. Coincide con la variable `PG_VERSION=16.15` de la imagen `postgres:16-alpine` |
| ¿`insumo.stockDisponible` agrega sobre varias filas de `inventory_level`? | **Sí, por construcción**: `SUM(...)` con `GROUP BY ii.id` sobre un `LEFT JOIN inventory_level` | `06_vistas_medusa.sql:16-22`, igual a la definición viva en la base |
| `inventory_item` con más de una fila en `inventory_level` | **0 de 20** (cada ítem tiene exactamente 1 fila, y hay 1 sola `stock_location`) | consulta de abajo |

En resumen: la vista está escrita para sumar sobre ubicaciones, pero con los datos de esta instancia **la suma nunca agrega más de una fila**. El caso de varias ubicaciones no está ejercitado. Esto coincide con lo que ya registraba `CH-16-mapeo-del-segundo-esquema.md`, línea 27 ("en el seed actual solo hay una ubicación por ítem, así que el caso multi-ubicación queda sin ejercitar con datos reales").

---

## 1. Versiones

### Medusa

El proyecto que creó CH-16 (`npx create-medusa-app@latest medusa-demo ...`, según la línea 47 de la bitácora de CH-16) no está en el repositorio. Se lo encontró en el scratchpad de una sesión anterior:

```
C:\Users\messi\AppData\Local\Temp\claude\C--Users-messi-OneDrive-Documentos-Proyectos-ZeroDashboard\002c7d58-fb9b-4951-9ad8-c74586275c20\scratchpad\ch16-medusa\medusa-demo
```

Comando y salida (líneas de `apps/backend/package.json` que mencionan `@medusajs`):

```
$ grep -n "medusajs\|\"name\"\|\"version\"" apps/backend/package.json
2:  "name": "@dtc/backend",
3:  "version": "0.0.1",
5:  "author": "Medusa (https://medusajs.com)",
25:    "@medusajs/admin-sdk": "2.21.0",
26:    "@medusajs/admin-shared": "2.21.0",
27:    "@medusajs/caching": "2.21.0",
28:    "@medusajs/cli": "2.21.0",
29:    "@medusajs/dashboard": "2.21.0",
30:    "@medusajs/draft-order": "2.21.0",
31:    "@medusajs/framework": "2.21.0",
32:    "@medusajs/medusa": "2.21.0",
33:    "@medusajs/ui": "4.2.4",
40:    "@medusajs/test-utils": "2.21.0",
```

Commit del proyecto plantilla: `d871b32233642be3a7afa556009d5956bb655c12` (2026-09-17 10:13:28 +0300, "chore: add pnpm allow builds config").

Salvedades:
- **No hay `node_modules` ni lockfile** (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) en esa carpeta. La versión sale de lo que **declara** `package.json`, no de lo instalado. Como la declaración es exacta (`"2.21.0"`, sin `^` ni `~`), npm no puede haber resuelto otra versión de esos paquetes. La instalación de 2.21.0 también figura en la bitácora de CH-16 (línea 47: "`@medusajs/medusa@2.21.0` instalado en `apps/backend/package.json`").
- Los metadatos del contenedor no aportan la versión de Medusa: `ch16-medusa-pg` es solo la base (`postgres:16-alpine`, sin etiquetas). La aplicación Medusa no corre en un contenedor.

### Metadatos del contenedor

```
$ docker inspect ch16-medusa-pg --format '{{.Config.Image}} | {{json .Config.Labels}} | {{json .Config.Env}} | {{json .Mounts}} | created {{.Created}}'
postgres:16-alpine | {} | ["POSTGRES_USER=medusa","POSTGRES_PASSWORD=medusa","POSTGRES_DB=medusa_db","PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin","GOSU_VERSION=1.19","LANG=en_US.utf8","PG_MAJOR=16","PG_VERSION=16.15","PG_SHA256=c1575341fa7bd40f5274ea465b34390f4dc64cdd0770af327005caaeb9f6b7ed","DOCKER_PG_LLVM_DEPS=llvm21-dev \t\tclang21","PGDATA=/var/lib/postgresql/data"] | [{"Type":"volume","Name":"333a55ae78c9e48dbf0f6d8841c7831969c720e18a70d44a6fa27ba506e1fc40","Source":"/var/lib/docker/volumes/333a55ae78c9e48dbf0f6d8841c7831969c720e18a70d44a6fa27ba506e1fc40/_data","Destination":"/var/lib/postgresql/data","Driver":"local","Mode":"","RW":true,"Propagation":""}] | created 2026-09-20T00:08:48.210078306Z
```

(Las credenciales que aparecen, `medusa`/`medusa`, son las de la instancia local de demostración creada en CH-16.)

### PostgreSQL

Sale de `SELECT version()` en la salida cruda de la sección 3.

## 2. Cómo calcula `insumo.stockDisponible` la vista `06_vistas_medusa.sql`

`openspec/changes/CH-16b-vistas-canonicas/sql/06_vistas_medusa.sql`, líneas 16–22:

```sql
CREATE OR REPLACE VIEW v_insumo AS
SELECT ii.id AS id, ii.title AS nombre,
       COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS "stockDisponible",
       ii.unit_of_measure AS "unidadMedida", ii.sku AS codigo
FROM inventory_item ii
LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku;
```

- Por cada fila de `inventory_level` del ítem calcula `stocked_quantity - reserved_quantity` (stock físico menos lo reservado para pedidos).
- **Suma** esas diferencias sobre todas las filas de `inventory_level` del ítem. `inventory_level` tiene una fila por par (ítem, `location_id`), así que la suma es **sobre ubicaciones**.
- Con `COALESCE(..., 0)`, un ítem sin filas en `inventory_level` queda en 0 y no en `NULL`.
- No filtra `inventory_level.deleted_at` ni `inventory_item.deleted_at`: las filas borradas lógicamente también entrarían en la suma. Hoy hay 0 filas borradas en `inventory_level`, así que esto no afecta el resultado. Se registra, no se corrige.
- No usa `incoming_quantity`.

La definición que está viva en `medusa_db` (`pg_get_viewdef`, sección 3) es la misma. La única diferencia es de forma: Postgres muestra el `0` como `0::numeric`.

## 3. Consultas y salida cruda

Comando:

```
docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on" ch16-medusa-pg psql -U medusa -d medusa_db -v ON_ERROR_STOP=1 < medusa_q.sql
```

Contenido de `medusa_q.sql`:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now();
SELECT version();
SELECT current_database(), current_user, current_setting('transaction_read_only') AS read_only;
\echo '--- definicion viva de v_insumo'
SELECT pg_get_viewdef('v_insumo'::regclass, true);
\echo '--- columnas de inventory_level'
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inventory_level' ORDER BY ordinal_position;
\echo '--- totales'
SELECT (SELECT count(*) FROM inventory_item) AS inventory_items,
       (SELECT count(*) FROM inventory_level) AS inventory_levels,
       (SELECT count(*) FROM inventory_level WHERE deleted_at IS NOT NULL) AS levels_borrados,
       (SELECT count(*) FROM stock_location) AS stock_locations,
       (SELECT count(DISTINCT location_id) FROM inventory_level) AS locations_usadas;
\echo '--- inventory_item con mas de una fila en inventory_level (todas las filas)'
SELECT count(*) AS items_con_mas_de_una_fila
FROM (SELECT inventory_item_id FROM inventory_level GROUP BY inventory_item_id HAVING count(*) > 1) t;
\echo '--- idem, solo filas no borradas'
SELECT count(*) AS items_con_mas_de_una_fila_vigente
FROM (SELECT inventory_item_id FROM inventory_level WHERE deleted_at IS NULL GROUP BY inventory_item_id HAVING count(*) > 1) t;
\echo '--- distribucion: filas de inventory_level por inventory_item (incluye items sin filas)'
SELECT filas, count(*) AS items
FROM (SELECT ii.id, count(il.id) AS filas FROM inventory_item ii LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id GROUP BY ii.id) t
GROUP BY filas ORDER BY filas;
ROLLBACK;
```

Salida cruda completa (segunda corrida, `now()` = 15:51:40 UTC; la primera, a las 15:51:33 UTC, dio los mismos valores):

```
BEGIN
              now              
-------------------------------
 2026-09-24 15:51:40.149157+00
(1 row)

                                         version                                          
------------------------------------------------------------------------------------------
 PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
(1 row)

 current_database | current_user | read_only 
------------------+--------------+-----------
 medusa_db        | medusa       | on
(1 row)

--- definicion viva de v_insumo
                                         pg_get_viewdef                                          
-------------------------------------------------------------------------------------------------
  SELECT ii.id,                                                                                 +
     ii.title AS nombre,                                                                        +
     COALESCE(sum(il.stocked_quantity - il.reserved_quantity), 0::numeric) AS "stockDisponible",+
     ii.unit_of_measure AS "unidadMedida",                                                      +
     ii.sku AS codigo                                                                           +
    FROM inventory_item ii                                                                      +
      LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id                              +
   GROUP BY ii.id, ii.title, ii.unit_of_measure, ii.sku;
(1 row)

--- columnas de inventory_level
      column_name      |        data_type         
-----------------------+--------------------------
 id                    | text
 created_at            | timestamp with time zone
 updated_at            | timestamp with time zone
 deleted_at            | timestamp with time zone
 inventory_item_id     | text
 location_id           | text
 stocked_quantity      | numeric
 reserved_quantity     | numeric
 incoming_quantity     | numeric
 metadata              | jsonb
 raw_stocked_quantity  | jsonb
 raw_reserved_quantity | jsonb
 raw_incoming_quantity | jsonb
(13 rows)

--- totales
 inventory_items | inventory_levels | levels_borrados | stock_locations | locations_usadas 
-----------------+------------------+-----------------+-----------------+------------------
              20 |               20 |               0 |               1 |                1
(1 row)

--- inventory_item con mas de una fila en inventory_level (todas las filas)
 items_con_mas_de_una_fila 
---------------------------
                         0
(1 row)

--- idem, solo filas no borradas
 items_con_mas_de_una_fila_vigente 
-----------------------------------
                                 0
(1 row)

--- distribucion: filas de inventory_level por inventory_item (incluye items sin filas)
 filas | items 
-------+-------
     1 |    20
(1 row)

ROLLBACK
```

## Notas de entorno

- `ch16-medusa-pg` estaba detenido (`Exited (255)`). Se lo arrancó con `docker start ch16-medusa-pg` a las 12:51:20 (-03:00) y se lo volvió a detener al terminar, para dejarlo como estaba.
- En la carpeta del proyecto Medusa, `git status` muestra borrados preparados en el índice (`D .gitignore`, `D AGENTS.md`, …). No se investigó ni se tocó: no afecta a `package.json`, que está en disco.
