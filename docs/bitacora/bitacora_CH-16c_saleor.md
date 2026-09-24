# Bitácora — CH-16c: Saleor como caso negativo ejecutado

**Fecha de la corrida:** 2026-09-24 (hora local UTC-3)
**Instancia:** `saleor-platform` commit `ab6315bd59c58b4815175df4c679107ff9695be4` (2026-04-16), imagen del servicio `api`: `ghcr.io/saleor/saleor:3.23` (digest `sha256:3fed0d65bb93644ff5a3b8d2014ce3d9512b46dbbbcb540133efc1d69ebe6426`, creada 2026-09-24T09:04:50Z), versión de Saleor: **3.23.36** (`saleor.__version__`)
**Base:** `saleor`, **PostgreSQL 15.19** on x86_64-pc-linux-musl (imagen `postgres:15-alpine`, digest `sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81`)
**Datos:** `populatedb` oficial, sin modificaciones

**Estado de la corrida:** completa. La primera ejecución del inventario, con un rol que no es dueño de las tablas, se detuvo en la sección 3 y quedó registrada como incidente (I-1). El autor decidió volver a correr el script completo, sin modificarlo, con el rol dueño (`saleor`). **Esa salida es la definitiva.** Después se creó `v_producto`, se otorgó SELECT al rol de solo lectura de la prueba y se verificó que ninguna fila tiene `activo` en `NULL`.

---

## Scripts: nombre original → nombre en el change

Los scripts del kit se guardaron en `openspec/changes/CH-16c-saleor-caso-negativo/sql/` con la numeración que sigue a la de CH-16b (que termina en `08_vistas_woo.sql`). Contenido idéntico al del kit (`docs/saleor_kit/`), sin modificaciones.

| Nombre original (kit) | Nombre en el change |
|---|---|
| `07_inventario_esquema_saleor.sql` | `09_inventario_esquema_saleor.sql` |
| `08_vistas_saleor.sql` | `10_vistas_saleor.sql` |

Las salidas crudas están en `openspec/changes/CH-16c-saleor-caso-negativo/salidas/`.

---

## Análisis previo de código (23/09/2026)

Repositorio `saleor/saleor`, commit `4f3190d`, versión 3.23.35. Sin modelo que vincule variante con componente y cantidad. Existencia en `warehouse_stock` (variante × depósito). Atributos de referencia a variantes sin cantidad por vínculo. *(Ver PROTOCOLO_Saleor.md.)*

La instancia de esta corrida es **3.23.36**, una versión de parche posterior a la analizada.

---

## Paso 1 — Levantar `saleor-platform`

Clonado en `..\saleor-platform`, fuera del repositorio.

| Hora | Comando | Resultado | Salida cruda |
|---|---|---|---|
| 13:01:54 | `git clone https://github.com/saleor/saleor-platform.git` | OK, commit `ab6315b` | — |
| 13:02:16 → 13:19:18 | `docker compose run --rm api python3 manage.py migrate` | exit 0; 1433 líneas `... OK`, 0 `Traceback` (incluye la descarga de imágenes) | `salidas/salida_migrate_2026-09-24.txt` |
| 13:19:30 → 13:20:16 | `docker compose run --rm api python3 manage.py populatedb --createsuperuser` | exit 0; `Superuser created successfully: admin@example.com` (credencial por defecto documentada en el README de `saleor-platform`) | `salidas/salida_populatedb_2026-09-24.txt` |
| 13:20:20 | `docker compose up -d` | exit 1: el servicio `api` no arrancó (`Bind for 0.0.0.0:8000 failed: port is already allocated`); `db`, `cache`, `jaeger`, `dashboard`, `mailpit`, `worker` arriba | `salidas/salida_compose_up_2026-09-24.txt` |

Versiones obtenidas con:

```
docker compose run --rm --no-deps -T api python3 -c "import saleor; print('saleor', saleor.__version__)"
  -> saleor 3.23.36
docker image inspect ghcr.io/saleor/saleor:3.23 --format '{{json .RepoDigests}} {{.Created}}'
  -> ["ghcr.io/saleor/saleor@sha256:3fed0d65bb93644ff5a3b8d2014ce3d9512b46dbbbcb540133efc1d69ebe6426"] 2026-09-24T09:04:50.799919268Z
docker compose exec -T db psql -U saleor -d saleor -Atc "select version();"
  -> PostgreSQL 15.19 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
```

Roles presentes en la base después de levantar (`\du`): `saleor` (superusuario, dueño de las tablas) y `saleor_read_only` (creado por `replica_user.sql` de `saleor-platform`, con `SELECT` sobre todas las tablas de `public`).

---

## Paso 2 — Inventario del esquema

### Incidente I-1 — primera ejecución con `saleor_read_only` (no se usa como evidencia)

> Con un rol que no es dueño, `information_schema` oculta las claves foráneas (la sección 3 salió vacía); no se usa como evidencia.

Se conserva la salida cruda y el diagnóstico que llevó a detener la corrida. Primera ejecución, con el rol de solo lectura `saleor_read_only` (psql dentro del contenedor `db`; `psql` no está instalado en el host):

```
docker compose -f ../saleor-platform/docker-compose.yml exec -T -e PGPASSWORD=saleor db \
  psql -h localhost -U saleor_read_only -d saleor -f - \
  < openspec/changes/CH-16c-saleor-caso-negativo/sql/09_inventario_esquema_saleor.sql \
  > openspec/changes/CH-16c-saleor-caso-negativo/salidas/salida_09_2026-09-24.txt 2>&1
```

Hora: 13:21:55 (sección 0: `now()` = `2026-09-24 16:21:56.343276+00`). exit 0.

Salida cruda completa (`salidas/salida_09_2026-09-24.txt`):

```
== 0. Versión del motor y fecha de ejecución
                                         version                                          |              now              
------------------------------------------------------------------------------------------+-------------------------------
 PostgreSQL 15.19 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit | 2026-09-24 16:21:56.343276+00
(1 row)

== 1. Tablas cuyo nombre sugiere composición (insumo, receta, componente, kit, BOM, ensamble)
 table_name 
------------
(0 rows)

== 2. Columnas cuyo nombre sugiere cantidad requerida por unidad
    table_name     |         column_name         | data_type 
-------------------+-----------------------------+-----------
 site_sitesettings | limit_quantity_per_checkout | integer
(1 row)

== 3. Toda clave foránea que apunte a la tabla de variantes
 tabla_origen | columna | tabla_destino 
--------------+---------+---------------
(0 rows)

== 4. Estructura de la existencia: stock por variante y depósito
    column_name     | data_type 
--------------------+-----------
 id                 | integer
 quantity           | integer
 product_variant_id | integer
 warehouse_id       | uuid
 quantity_allocated | integer
(5 rows)

== 5. Mecanismo genérico que podría aproximar composición por convención:
==    valores de atributo que referencian variantes (sin cantidad por vínculo)
       column_name       |        data_type         
-------------------------+--------------------------
 id                      | integer
 name                    | character varying
 attribute_id            | integer
 slug                    | character varying
 sort_order              | integer
 value                   | character varying
 content_type            | character varying
 file_url                | character varying
 rich_text               | jsonb
 boolean                 | boolean
 date_time               | timestamp with time zone
 reference_page_id       | integer
 reference_product_id    | integer
 plain_text              | text
 reference_variant_id    | integer
 external_reference      | character varying
 reference_category_id   | integer
 reference_collection_id | integer
 numeric                 | double precision
(19 rows)

 valores_que_referencian_variantes 
-----------------------------------
                                 0
(1 row)

== 6. Tamaño de los datos de demostración
 productos | variantes | depositos | filas_stock 
-----------+-----------+-----------+-------------
        29 |        81 |         8 |         648
(1 row)
```

### Diagnóstico de la sección 3 (solo lectura, no reemplaza la salida anterior)

La sección 3 devolvió 0 filas, cuando la corrida de validación del 23/09 devolvió 13. Hipótesis: `information_schema.constraint_column_usage` solo muestra columnas de tablas cuyo dueño es un rol habilitado para el usuario actual, y `saleor_read_only` no es dueño de ninguna tabla. Para comprobarlo se consultó `pg_catalog.pg_constraint`, que no filtra por dueño, con el mismo rol. Hora 13:22:09. Salida cruda (`salidas/diagnostico_seccion3_2026-09-24.txt`):

```
== D1. Rol actual
   current_user   
------------------
 saleor_read_only
(1 row)

== D2. Claves foráneas hacia product_productvariant según pg_catalog (no filtra por dueño)
              tabla_origen               |       columna        |     tabla_destino      
-----------------------------------------+----------------------+------------------------
 product_product                         | default_variant_id   | product_productvariant
 warehouse_stock                         | product_variant_id   | product_productvariant
 product_productvarianttranslation       | product_variant_id   | product_productvariant
 discount_promotionrule_gifts            | productvariant_id    | product_productvariant
 discount_promotionrule_variants         | productvariant_id    | product_productvariant
 discount_voucher_variants               | productvariant_id    | product_productvariant
 attribute_attributevalue                | reference_variant_id | product_productvariant
 attribute_assignedvariantattributevalue | variant_id           | product_productvariant
 order_orderline                         | variant_id           | product_productvariant
 attribute_assignedvariantattribute      | variant_id           | product_productvariant
 checkout_checkoutline                   | variant_id           | product_productvariant
 product_productvariantchannellisting    | variant_id           | product_productvariant
 product_variantmedia                    | variant_id           | product_productvariant
(13 rows)

== D3. Dueño de product_productvariant
 tableowner 
------------
 saleor
(1 row)
```

La consulta del diagnóstico está transcripta en la salida (secciones D1–D3). La hipótesis queda consistente: con `pg_catalog` aparecen 13 claves foráneas, la misma cantidad que en la corrida de validación, y el dueño de las tablas es `saleor`, no el rol que ejecutó el script. La corrida se detuvo acá hasta que decidiera el autor.

**Decisión del autor (2026-09-24):** volver a correr `09_inventario_esquema_saleor.sql` completo, sin modificarlo, con el rol `saleor` (dueño de las tablas), y tomar esa salida como definitiva. Control cruzado de la sección 3 contra `pg_catalog`. El script no se modificó; `cmp` confirma que es idéntico al del kit.

### Ejecución definitiva — rol `saleor` (dueño de las tablas)

```
docker compose -f ../saleor-platform/docker-compose.yml exec -T -e PGPASSWORD=saleor db \
  psql -h localhost -d saleor -U saleor -f - \
  < openspec/changes/CH-16c-saleor-caso-negativo/sql/09_inventario_esquema_saleor.sql \
  > openspec/changes/CH-16c-saleor-caso-negativo/salidas/salida_09_definitiva_saleor_2026-09-24.txt 2>&1
```

Hora: 13:28:51 (sección 0: `now()` = `2026-09-24 16:28:51.710298+00`). exit 0.

Salida cruda completa (`salidas/salida_09_definitiva_saleor_2026-09-24.txt`):

```
== 0. Versión del motor y fecha de ejecución
                                         version                                          |              now              
------------------------------------------------------------------------------------------+-------------------------------
 PostgreSQL 15.19 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit | 2026-09-24 16:28:51.710298+00
(1 row)

== 1. Tablas cuyo nombre sugiere composición (insumo, receta, componente, kit, BOM, ensamble)
 table_name 
------------
(0 rows)

== 2. Columnas cuyo nombre sugiere cantidad requerida por unidad
    table_name     |         column_name         | data_type 
-------------------+-----------------------------+-----------
 site_sitesettings | limit_quantity_per_checkout | integer
(1 row)

== 3. Toda clave foránea que apunte a la tabla de variantes
              tabla_origen               |       columna        |     tabla_destino      
-----------------------------------------+----------------------+------------------------
 attribute_assignedvariantattribute      | variant_id           | product_productvariant
 attribute_assignedvariantattributevalue | variant_id           | product_productvariant
 attribute_attributevalue                | reference_variant_id | product_productvariant
 checkout_checkoutline                   | variant_id           | product_productvariant
 discount_promotionrule_gifts            | productvariant_id    | product_productvariant
 discount_promotionrule_variants         | productvariant_id    | product_productvariant
 discount_voucher_variants               | productvariant_id    | product_productvariant
 order_orderline                         | variant_id           | product_productvariant
 product_product                         | default_variant_id   | product_productvariant
 product_productvariantchannellisting    | variant_id           | product_productvariant
 product_productvarianttranslation       | product_variant_id   | product_productvariant
 product_variantmedia                    | variant_id           | product_productvariant
 warehouse_stock                         | product_variant_id   | product_productvariant
(13 rows)

== 4. Estructura de la existencia: stock por variante y depósito
    column_name     | data_type 
--------------------+-----------
 id                 | integer
 quantity           | integer
 product_variant_id | integer
 warehouse_id       | uuid
 quantity_allocated | integer
(5 rows)

== 5. Mecanismo genérico que podría aproximar composición por convención:
==    valores de atributo que referencian variantes (sin cantidad por vínculo)
       column_name       |        data_type         
-------------------------+--------------------------
 id                      | integer
 name                    | character varying
 attribute_id            | integer
 slug                    | character varying
 sort_order              | integer
 value                   | character varying
 content_type            | character varying
 file_url                | character varying
 rich_text               | jsonb
 boolean                 | boolean
 date_time               | timestamp with time zone
 reference_page_id       | integer
 reference_product_id    | integer
 plain_text              | text
 reference_variant_id    | integer
 external_reference      | character varying
 reference_category_id   | integer
 reference_collection_id | integer
 numeric                 | double precision
(19 rows)

 valores_que_referencian_variantes 
-----------------------------------
                                 0
(1 row)

== 6. Tamaño de los datos de demostración
 productos | variantes | depositos | filas_stock 
-----------+-----------+-----------+-------------
        29 |        81 |         8 |         648
(1 row)
```

### Control cruzado de la sección 3 contra `pg_catalog` (rol `saleor`)

Hora 13:29:05. Se ejecutó la consulta sobre `pg_catalog` y la diferencia simétrica contra la consulta de la sección 3 (misma consulta `information_schema` del script). Salida cruda (`salidas/control_cruzado_pg_catalog_2026-09-24.txt`):

```
== C1. Rol actual
 current_user 
--------------
 saleor
(1 row)

== C2. Claves foráneas hacia product_productvariant según pg_catalog
              tabla_origen               |       columna        |     tabla_destino      
-----------------------------------------+----------------------+------------------------
 attribute_assignedvariantattribute      | variant_id           | product_productvariant
 attribute_assignedvariantattributevalue | variant_id           | product_productvariant
 attribute_attributevalue                | reference_variant_id | product_productvariant
 checkout_checkoutline                   | variant_id           | product_productvariant
 discount_promotionrule_gifts            | productvariant_id    | product_productvariant
 discount_promotionrule_variants         | productvariant_id    | product_productvariant
 discount_voucher_variants               | productvariant_id    | product_productvariant
 order_orderline                         | variant_id           | product_productvariant
 product_product                         | default_variant_id   | product_productvariant
 product_productvariantchannellisting    | variant_id           | product_productvariant
 product_productvarianttranslation       | product_variant_id   | product_productvariant
 product_variantmedia                    | variant_id           | product_productvariant
 warehouse_stock                         | product_variant_id   | product_productvariant
(13 rows)

== C3. Diferencia simétrica entre pg_catalog y la sección 3 (information_schema); 0 filas = coinciden
 origen | tabla_origen | columna | tabla_destino 
--------+--------------+---------+---------------
(0 rows)

== C4. Conteos
 fk_pg_catalog 
---------------
            13
(1 row)
```

**Resultado del control cruzado:** coincide. La sección 3 del rol `saleor` y `pg_catalog` devuelven las mismas 13 claves foráneas, y la diferencia simétrica tiene 0 filas.

---

## Paso 3 — Crear `v_producto`, otorgar SELECT y verificar `activo`

Mismo requisito de dos actores que en la sección 6.7.1. El administrador (`saleor`) crea dos roles para la prueba, sin superusuario ni atributos especiales:
- `zd_ch16c_creador`: `CREATE` sobre `public` y `SELECT` solo sobre las cuatro tablas que lee la vista.
- `zd_ch16c_lectura`: sin permisos sobre tablas.

La vista la crea `zd_ch16c_creador`. El script `10_vistas_saleor.sql` no se modificó (`cmp` idéntico al kit). El `GRANT` que el script deja comentado se ejecutó aparte.

**3.a — Roles** (13:29:20, como `saleor`, `psql -v ON_ERROR_STOP=1 -e`). exit 0. Salida cruda (`salidas/salida_roles_2026-09-24.txt`):

```
== R1. Rol que crea la vista (CREATE sobre public + SELECT sobre las tablas que lee la vista)
CREATE ROLE zd_ch16c_creador LOGIN PASSWORD 'ch16c';
CREATE ROLE
GRANT CONNECT ON DATABASE saleor TO zd_ch16c_creador;
GRANT
GRANT USAGE, CREATE ON SCHEMA public TO zd_ch16c_creador;
GRANT
GRANT SELECT ON product_productvariant, product_product, warehouse_stock, product_productchannellisting TO zd_ch16c_creador;
GRANT
== R2. Rol de solo lectura de la prueba (sin permisos sobre tablas; recibirá SELECT sobre v_producto)
CREATE ROLE zd_ch16c_lectura LOGIN PASSWORD 'ch16c';
CREATE ROLE
GRANT CONNECT ON DATABASE saleor TO zd_ch16c_lectura;
GRANT
GRANT USAGE ON SCHEMA public TO zd_ch16c_lectura;
GRANT
== R3. Atributos de los roles
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname LIKE 'zd_ch16c_%' ORDER BY 1;
     rolname      | rolsuper | rolcreaterole | rolcreatedb | rolbypassrls 
------------------+----------+---------------+-------------+--------------
 zd_ch16c_creador | f        | f             | f           | f
 zd_ch16c_lectura | f        | f             | f           | f
(2 rows)
```

(Contraseña `ch16c`: solo de la instancia local descartable de la prueba.)

**3.b — Crear la vista** (13:29:27, como `zd_ch16c_creador`):

```
docker compose -f ../saleor-platform/docker-compose.yml exec -T -e PGPASSWORD=ch16c db \
  psql -h localhost -U zd_ch16c_creador -d saleor -v ON_ERROR_STOP=1 -f - \
  < openspec/changes/CH-16c-saleor-caso-negativo/sql/10_vistas_saleor.sql \
  > openspec/changes/CH-16c-saleor-caso-negativo/salidas/salida_10_2026-09-24.txt 2>&1
```

exit 0. Salida cruda (`salidas/salida_10_2026-09-24.txt`):

```
CREATE VIEW
 filas_v_producto | activas | con_sku 
------------------+---------+---------
               81 |      81 |      67
(1 row)

 id  |                   nombre                   | stockDisponible |    sku     | activo 
-----+--------------------------------------------+-----------------+------------+--------
 384 | Apple Juice - UHJvZHVjdFZhcmlhbnQ6Mzg0     |            3592 |            | t
 386 | Banana Juice - UHJvZHVjdFZhcmlhbnQ6Mzg2    |            2696 |            | t
 372 | Battle-tested at brands like Lush - DVD    |            3224 | 9018223582 | t
 374 | Battle-tested at brands like Lush - MP3    |            3771 | 9018223584 | t
 373 | Battle-tested at brands like Lush - iTunes |            2064 | 9018223583 | t
 385 | Bean Juice - UHJvZHVjdFZhcmlhbnQ6Mzg1      |            2088 |            | t
 362 | Blue Polygon Shirt - L                     |            2584 | 218223581  | t
 361 | Blue Polygon Shirt - M                     |            1136 | 218223580  | t
 363 | Blue Polygon Shirt - XL                    |            2464 | 218223582  | t
 387 | Carrot Juice - UHJvZHVjdFZhcmlhbnQ6Mzg3    |            2992 |            | t
(10 rows)
```

Los conteos (81 filas, 81 activas, 67 con SKU) son iguales a los de la corrida de validación del 23/09. Los nombres con sufijo base64 (`UHJvZHVjdFZhcmlhbnQ6…`) vienen de los datos de demostración, como ya anotaba el protocolo.

**3.c — GRANT y verificación** (13:29:39). El `GRANT` lo ejecuta `zd_ch16c_creador`, que es el dueño de la vista, y la verificación la ejecuta `zd_ch16c_lectura`. Salida cruda (`salidas/salida_grant_verificacion_2026-09-24.txt`):

```
--- como zd_ch16c_creador
== G1. Dueño de la vista y GRANT al rol de solo lectura de la prueba
SELECT current_user;
   current_user   
------------------
 zd_ch16c_creador
(1 row)

SELECT viewowner FROM pg_views WHERE schemaname='public' AND viewname='v_producto';
    viewowner     
------------------
 zd_ch16c_creador
(1 row)

GRANT SELECT ON v_producto TO zd_ch16c_lectura;
GRANT
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='v_producto' ORDER BY 1,2;
     grantee      | privilege_type 
------------------+----------------
 zd_ch16c_creador | DELETE
 zd_ch16c_creador | INSERT
 zd_ch16c_creador | REFERENCES
 zd_ch16c_creador | SELECT
 zd_ch16c_creador | TRIGGER
 zd_ch16c_creador | TRUNCATE
 zd_ch16c_creador | UPDATE
 zd_ch16c_lectura | SELECT
(8 rows)

exit_grant=0
--- como zd_ch16c_lectura
== V1. Rol actual
SELECT current_user;
   current_user   
------------------
 zd_ch16c_lectura
(1 row)

== V2. Filas de v_producto con activo NULL (esperado 0)
SELECT count(*) AS filas, count(*) FILTER (WHERE activo IS NULL) AS activo_null, count(*) FILTER (WHERE activo) AS activas, count(*) FILTER (WHERE NOT activo) AS inactivas FROM v_producto;
 filas | activo_null | activas | inactivas 
-------+-------------+---------+-----------
    81 |           0 |      81 |         0
(1 row)

== V3. Control: el rol de solo lectura no lee la tabla base
SELECT count(*) FROM product_product;
psql:<stdin>:6: ERROR:  permission denied for table product_product
== V4. Control: el rol de solo lectura no escribe
CREATE TABLE zd_ch16c_prueba (x int);
psql:<stdin>:8: ERROR:  permission denied for schema public
LINE 1: CREATE TABLE zd_ch16c_prueba (x int);
                     ^
exit_verif=0
```

**Verificación de `activo`:** 0 filas con `activo` en `NULL` sobre 81. Las 81 están activas y ninguna inactiva. Los errores de V3 y V4 son controles esperados: el rol de lectura solo ve la vista, y no puede leer las tablas base ni crear objetos. Los privilegios del dueño sobre la vista (DELETE, INSERT, etc.) son los que PostgreSQL otorga por omisión al dueño de un objeto.

Observación: en los datos de demostración todas las variantes pertenecen a productos publicados en al menos un canal, así que esta corrida no ejercita el caso `activo = false` de DEC-38.

---

## Resultados sobre la instancia

| ID | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| S-1 | `09_inventario_esquema_saleor.sql` (ex 07), sección 1 | 0 tablas | 0 filas | Coincide |
| S-2 | Sección 2 | 0 columnas; `limit_quantity_per_checkout` aceptada como coincidencia esperada por el autor | 1 fila: `site_sitesettings.limit_quantity_per_checkout integer` (límite de compra, no composición). Ninguna otra columna | Coincide con la excepción aceptada |
| S-3 | Sección 3: claves foráneas hacia variantes | Solo claves desde stock, pedidos, carrito, descuentos, canales y medios; ninguna desde otra variante ni desde un insumo | **Definitiva (rol `saleor`):** 13 claves foráneas, desde atributos (3), carrito, descuentos y promociones (3), pedidos, producto (variante por defecto), canales, traducciones, medios y stock. Ninguna desde una tabla de composición. Control cruzado con `pg_catalog`: coincide (diferencia simétrica 0). *Incidente I-1:* con `saleor_read_only` salió vacía; no se usa como evidencia | Coincide |
| S-4 | Sección 5: valores de atributo que referencian variantes | [sin expectativa] | `attribute_attributevalue` tiene `reference_variant_id` y `numeric` (19 columnas); 0 valores referencian variantes | Registrado |
| S-5 | `10_vistas_saleor.sql` (ex 08): crear `v_producto` | Se crea sin error | `CREATE VIEW` sin error, con `zd_ch16c_creador`. 81 filas, 81 activas, 67 con SKU. SELECT otorgado a `zd_ch16c_lectura`. 0 filas con `activo` en `NULL` | Coincide |
| S-6 | Intentar derivar `v_insumo` y `v_receta_componente` | No hay origen | No hay origen (ver abajo). No se crearon | Coincide |

Los valores de S-1, S-2 y S-4 son iguales en la ejecución definitiva (rol `saleor`) y en la del incidente I-1. Sección 4: `warehouse_stock` tiene `id`, `quantity`, `product_variant_id`, `warehouse_id`, `quantity_allocated`, es decir, la existencia por variante y depósito. Sección 6: 29 productos, 81 variantes, 8 depósitos, 648 filas de stock, los mismos conteos que la corrida de validación del 23/09.

### S-6 — Qué se buscó para `v_insumo` y `v_receta_componente`, y qué no se encontró

- **Tablas de composición** (sección 1). Se buscaron nombres que contengan `component`, `bundle`, `bom`, `bill`, `recipe`, `ingredient`, `kit`, `assembl`, `material`, `supply`, `insumo` o `receta`. No se encontró ninguna tabla.
- **Columnas de cantidad por unidad** (sección 2). Se buscaron `required_quantity`, `quantity_per`, `per_unit` y `component`. Solo apareció `site_sitesettings.limit_quantity_per_checkout`, que es un límite de compra por checkout y no una cantidad por componente.
- **Relación variante → variante o variante → insumo** (sección 3 definitiva, confirmada por el control cruzado con `pg_catalog`). Aparecen 13 claves foráneas hacia variantes, desde:
  - producto (variante por defecto)
  - stock
  - traducciones
  - descuentos y promociones
  - atributos
  - pedidos y carrito
  - canales
  - medios

  Ninguna viene de una tabla que relacione una variante con un componente y una cantidad.
- **Mecanismo genérico** (sección 5). `attribute_attributevalue.reference_variant_id` puede vincular valores de atributo con variantes, y la misma fila tiene una columna `numeric`. Pero el modelo de atributos no prevé una cantidad por vínculo, y en los datos de demostración hay 0 valores que referencien variantes.

Conclusión: en el esquema de esta instancia no hay una estructura **prevista** de la que derivar `v_insumo` (insumos con stock propio) ni `v_receta_componente` (componente y cantidad por unidad).

---

## Decisiones tomadas en esta corrida

Registradas en `docs/01-decisiones.md` antes de crear la vista.

- **DEC-37**: en `v_producto` de Saleor, `stockDisponible` = suma sobre todos los depósitos de `(quantity - quantity_allocated)`. Decidido por el autor el 2026-09-24.
- **DEC-38**: en Saleor, `producto.activo` = publicado en al menos un canal (`product_productchannellisting.is_published`). Decidido por el autor el 2026-09-24.

La granularidad por variante sigue a DEC-27.

---

## Fricciones

| # | Fricción | Causa | Resolución |
|---|---|---|---|
| 1 | `docker compose up` no levanta `api` | El puerto 8000 del host ya lo usa el contenedor `foodstore-backend-fastapi-api-1` | No se resolvió: el protocolo solo necesita la base, que quedó arriba en el puerto 5432. No se detuvo Food Store |
| 2 | `psql` no está instalado en el host | Entorno Windows sin cliente de PostgreSQL | Se ejecutó `psql` dentro del contenedor `db` con `docker compose exec -T` |
| 3 | La sección 3 devuelve 0 filas con un rol de solo lectura (incidente I-1) | `information_schema.constraint_column_usage` filtra por dueño de la tabla. El script no indica con qué rol correrlo, y la corrida de validación del 23/09 no registró el rol | Decisión del autor (2026-09-24): volver a correr el script completo, sin modificarlo, con el rol dueño `saleor`; esa salida es la definitiva. Control cruzado con `pg_catalog`: coincide. El script sigue sin indicar el rol requerido |
| 4 | La versión de la instancia (3.23.36) no es la del análisis de código (3.23.35) | `saleor-platform` usa la etiqueta flotante `3.23` | Registrado. No se fijó la versión |

---

## Lo que esta entrada NO sostiene

- Nada sobre las automatizaciones de stock físico y reporte diario sobre Saleor.
- La ausencia se observa en el esquema de una versión; otra versión o una extensión podrían agregar composición.
