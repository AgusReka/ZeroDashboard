# Bitácora — Reporte diario (WF-03) sobre el contrato canónico

**Fecha de la corrida:** 2026-09-25, entre 15:32 y 15:40 (hora local, UTC-3).
**Rama:** `experimento/reporte-diario`, sin fusionar con `master`.
**Material:** `experimentos/reporte_diario/`
- `PREREGISTRO.md` y `sql/c*.sql`: preregistro y consultas canónicas.
- `vistas/`: vistas de pedido.
- `sql/nativas_foodstore/`: consultas nativas del Anexo C con el rango parametrizado.
- `sql/manual_saleor/`: cálculo manual en Saleor.
- `sql/with_foodstore/`: paso 7.
- `scripts/`: generación de entradas y comparaciones.
- `salidas/`: entrada exacta (`*_input.sql`), salida cruda de `psql -e` (`*_output.txt`) y resultados por consulta (`salidas/p*/`).

**Instancias:**

| Esquema | Contenedor | Motor | Base | Usuarios |
|---|---|---|---|---|
| Food Store (origen) | `foodstore-backend-fastapi-db-1` | PostgreSQL 16.15 | `food_store`, esquema `public` | `postgres` |
| Saleor (independiente) | `saleor-platform-db-1` | PostgreSQL 15.19 | `saleor`, esquema `public`; Saleor 3.23 | `saleor`, `zd_ch16c_creador`, `zd_ch16c_lectura` |

**Qué se escribió en las bases.** Nada más que esto:
- **Food Store.** Se crearon `v_pedido` y `v_item_pedido`.
- **Saleor.**
  - `GRANT SELECT ON order_order, order_orderline TO zd_ch16c_creador`, como `saleor`.
  - Se crearon `v_pedido` y `v_item_pedido`, como `zd_ch16c_creador`.
  - `GRANT SELECT ON v_pedido, v_item_pedido TO zd_ch16c_lectura`.
  - La modificación controlada del paso 5.2 terminó en `ROLLBACK`.

No se modificó ninguna vista existente, ni `src/`, ni las pruebas. No se tocó Medusa.

**Datos personales.** Las vistas de pedido no exponen columnas del cliente (DEC-23). En particular, no exponen `order_order.user_email`, `customer_note`, direcciones, `pedido.usuario_id`, `direccion_entrega_id` ni `notas_cliente`. Esta bitácora solo registra agregados, identificadores y montos.

---

## 1. Preregistro

**Commit del preregistro:** `d43ac67b64b5e4f50ad9ff5c1bc94da668a5abc2` (2026-09-25 15:32:02 -03:00).

Hasta ese commit solo se había consultado el catálogo de las bases (`\d`, `pg_views`, `pg_get_viewdef` y los valores del enum `estado_pedido_codigo`). No se había leído ninguna fila de pedidos.

**Los textos no cambiaron.** Al cierre, `git diff d43ac67 -- sql/c*.sql` está vacío y los SHA-256 coinciden con los del preregistro:

```
b635ec2dcd06b077ace2d187fcfddd33d26490907dbda0adef4c7c1230b18b46  sql/c1_ventas.sql
e8b901198a3ece44682d0daab152d1222d0ad598135acd3fe9f9b8b5b42dee5d  sql/c2_ranking.sql
52c76e9cf94038a604db636a501f98177301d16f42532d49e48039aabe08db31  sql/c2_ranking_top5.sql
dad49f4bd34a524ae187f41f356527740d6427ad3d9b1c0e551ec583b47a4f7f  sql/c3_estados.sql
```

**Cómo se ejecutaron.** Siempre con `\i /tmp/rd/<archivo>.sql`, sobre copias sin modificar de estos archivos dentro del contenedor. El rango de fechas entra por `\set desde` y `\set hasta`: no forma parte del texto.

### C1 — Ventas del día

```sql
SELECT
    COUNT(*) AS cantidad_pedidos,
    COALESCE(SUM(p.total), 0) AS facturacion_total,
    COALESCE(ROUND(AVG(p.total), 2), 0) AS ticket_promedio
FROM v_pedido p
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta';
```

### C2 — Productos más vendidos (sin `LIMIT`; `c2_ranking_top5.sql` agrega `LIMIT 5`, solo informativa)

```sql
SELECT
    i."productoId",
    pr.nombre,
    SUM(i.cantidad) AS unidades_vendidas,
    COALESCE(SUM(i.cantidad * i."precioUnitario"), 0) AS total_generado
FROM v_item_pedido i
JOIN v_pedido p ON p.id = i."pedidoId"
LEFT JOIN v_producto pr ON pr.id = i."productoId"
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta'
GROUP BY i."productoId", pr.nombre
ORDER BY unidades_vendidas DESC, i."productoId";
```

### C3 — Pedidos por estado

```sql
SELECT
    p.estado,
    COUNT(*) AS cantidad
FROM v_pedido p
WHERE p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta'
GROUP BY p.estado
ORDER BY cantidad DESC, p.estado;
```

Las decisiones de redacción (el `LEFT JOIN v_producto`, el desempate en C3, los tipos a cargo de las vistas) están en la tabla de la sección 1 de `PREREGISTRO.md`.

---

## 2. Esquema independiente

**Quedó Saleor.** Salida en `salidas/p2_saleor_conteo_output.txt`, 15:32:09.

| Conteo en `order_order` | Valor |
|---|---|
| Pedidos, total | 20 |
| Pedidos sin borradores (`status <> 'draft'`), que es el criterio preregistrado | 20 |
| Días con pedidos, en `America/Argentina/Buenos_Aires` | 1: 2026-09-24, con 20 pedidos |
| Estados | `partially fulfilled` 9, `unfulfilled` 8, `unconfirmed` 3 |

Hay un día con 2 o más pedidos, así que la regla elige Saleor en el punto 1. No se contó Medusa y no se crearon pedidos de prueba.

Los 20 pedidos son del juego de datos de demostración de la instancia (`populatedb`). Se crearon entre las 13:20:01 y las 13:20:07 del 2026-09-24. No hay ningún pedido cancelado: el único cancelado de la prueba es el de la modificación controlada (5.2), que se revirtió.

---

## 3. Vistas

Clases según el criterio de la sección 6.4.1, en el orden de `docs/bitacora/matriz_correspondencias.md`: 1 directa, 2 granularidad, 3 entidad-atributo-valor, 4 ausencia. Los filtros de fila (`WHERE`) no cuentan para la clase (caso T-1 de la matriz).

### 3.1 Food Store (`vistas/v_pedido_foodstore.sql`)

```sql
CREATE VIEW v_pedido AS
SELECT
  p.id::text                                    AS id,
  p.created_at                                  AS "fechaCreacion",   -- timestamp without time zone
  CASE WHEN ep.codigo = 'CANCELADO' THEN 'cancelado'
       ELSE ep.codigo::text END                 AS estado,
  p.total                                       AS total,             -- persistido; incluye costo_envio
  NULL::integer                                 AS numero,            -- SIN ORIGEN: no hay numero distinto del id
  NULL::text                                    AS moneda             -- SIN ORIGEN: tienda de una sola moneda
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL;

CREATE VIEW v_item_pedido AS
SELECT
  dp.id::text                                   AS id,
  dp.pedido_id::text                            AS "pedidoId",
  dp.producto_id::text                          AS "productoId",
  dp.cantidad                                   AS cantidad,
  dp.producto_precio_unitario                   AS "precioUnitario"   -- precio congelado al comprar
FROM detalle_pedido dp
WHERE dp.deleted_at IS NULL;
```

| Entidad | Atributo | Expresión | Clase | Decisiones de significado |
|---|---|---|---|---|
| pedido | id | `p.id::text` | 1 | Texto, igual que `v_producto.id`, para que los identificadores sean comparables en todas las plataformas. |
| pedido | fechaCreacion | `p.created_at` | 1 | Tipo **`timestamp without time zone`**. Se interpreta como hora local, igual que la consulta nativa, que compara con `CURRENT_DATE` en la zona de la sesión. No se sabe en qué zona escribe la aplicación (ver DEC-44 propuesta). |
| pedido | estado | `CASE WHEN ep.codigo = 'CANCELADO' THEN 'cancelado' ELSE ep.codigo::text END`, con `JOIN estado_pedido` | 1 | La reunión es con una tabla de valores enumerados, así que cuenta como clase 1 (cláusula 1). Solo `CANCELADO` corresponde a `'cancelado'`. Los demás estados (`PENDIENTE`, `CONFIRMADO`, `EN_PREP`, `LISTO`, `ENTREGADO`) salen con su código nativo (DEC-39 propuesta). Se usa el `codigo` y no la `descripcion`, que es lo que agrupa la nativa. |
| pedido | total | `p.total` | 1 | Persistido. **Incluye el envío**: `total = subtotal + costo_envio` en 99 de 99 pedidos, y los 99 tienen envío. Food Store no modela impuestos ni descuentos. |
| pedido | numero | `NULL::integer` | 4 | No hay un número de pedido distinto del `id`. |
| pedido | moneda | `NULL::text` | 4 | No hay columna de moneda: la tienda opera en una sola. |
| item_pedido | id | `dp.id::text` | 1 | |
| item_pedido | pedidoId | `dp.pedido_id::text` | 1 | Texto, comparable con `v_pedido.id`. |
| item_pedido | productoId | `dp.producto_id::text` | 1 | Texto, comparable con `v_producto.id`. |
| item_pedido | cantidad | `dp.cantidad` | 1 | |
| item_pedido | precioUnitario | `dp.producto_precio_unitario` | 1 | Precio congelado al momento de la compra, **sin impuestos** (no se modelan). En 194 de 194 líneas, `subtotal = cantidad × producto_precio_unitario`. |

**Bajas lógicas.** `pedido.deleted_at IS NULL` y `detalle_pedido.deleted_at IS NULL`, como la nativa. Hoy no hay pedidos ni detalles borrados. `v_item_pedido` no filtra por el pedido padre: C2 lo resuelve con el `JOIN v_pedido`.

Al crearlas (`salidas/p3_foodstore_vistas_output.txt`, 15:33:02), `v_pedido` tenía 99 filas y `v_item_pedido`, 194.

### 3.2 Saleor (`vistas/v_pedido_saleor.sql`)

```sql
CREATE VIEW v_pedido AS
SELECT
  o.id::text                                    AS id,
  o.created_at                                  AS "fechaCreacion",   -- timestamp with time zone
  CASE WHEN o.status = 'canceled' THEN 'cancelado'
       ELSE o.status::text END                  AS estado,
  o.total_gross_amount                          AS total,             -- bruto: con impuestos y envio, neto de descuentos
  o.number                                      AS numero,
  o.currency::text                              AS moneda
FROM order_order o
WHERE o.status <> 'draft';                                            -- un borrador no es un pedido realizado

CREATE VIEW v_item_pedido AS
SELECT
  ol.id::text                                   AS id,
  ol.order_id::text                             AS "pedidoId",
  ol.variant_id::text                           AS "productoId",      -- NULL si la variante se borro (ON DELETE SET NULL)
  ol.quantity                                   AS cantidad,
  ol.unit_price_gross_amount                    AS "precioUnitario"   -- bruto: con impuestos, neto de descuentos
FROM order_orderline ol;
```

**Corrección al comentario de `productoId`.** En la base, la clave foránea `order_orderline_variant_id_866774cb_fk_product_p` es `NO ACTION` (`confdeltype = 'a'`). El `SET NULL` lo hace Django, no PostgreSQL. El archivo quedó tal como se ejecutó.

| Entidad | Atributo | Expresión | Clase | Decisiones de significado |
|---|---|---|---|---|
| pedido | id | `o.id::text` | 1 | Un `uuid` convertido a texto. |
| pedido | fechaCreacion | `o.created_at` | 1 | Tipo **`timestamp with time zone`**. El día se define en la zona de la sesión (`America/Argentina/Buenos_Aires`). |
| pedido | estado | `CASE WHEN o.status = 'canceled' THEN 'cancelado' ELSE o.status::text END` | 1 | Solo `canceled` corresponde a `'cancelado'`. Quedan con su valor nativo `unconfirmed`, `unfulfilled`, `partially fulfilled`, `fulfilled`, `partially returned`, `returned` y `expired`. Por la asimetría del original, **cuentan como venta**. `expired` y `returned` son discutibles (ver DEC-39 propuesta); ninguno aparece en los datos. |
| pedido | total | `o.total_gross_amount` | 1 | **Bruto**: con impuestos y envío, y neto de descuentos. En 20 de 20 pedidos, `total_gross = Σ(cantidad × precio unitario bruto) + envío bruto`, y 19 tienen envío. En estos datos no hay impuestos (bruto = neto en las 51 líneas) ni descuentos, así que **los datos no distinguen entre bruto y neto**. |
| pedido | numero | `o.number` | 1 | |
| pedido | moneda | `o.currency::text` | 1 | **Hay dos monedas**: USD (canal `default-channel`, 11 pedidos) y PLN (canal `channel-pln`, 9 pedidos). Ver 6 y DEC-42. |
| item_pedido | id | `ol.id::text` | 1 | |
| item_pedido | pedidoId | `ol.order_id::text` | 1 | |
| item_pedido | productoId | `ol.variant_id::text` | 1 y 2 (G-1) | Una columna de la línea, pero apunta a la **variante**, que es la fila canónica de producto en Saleor (DEC-38; nivel de variante de DEC-27). Es la misma expresión de nivel que `v_producto.id = pv.id::text`. Hoy no hay líneas sin variante (0 de 51), y todas las variantes vendidas están en `v_producto`. |
| item_pedido | cantidad | `ol.quantity` | 1 | |
| item_pedido | precioUnitario | `ol.unit_price_gross_amount` | 1 | Bruto (con impuestos) y neto de descuentos, por coherencia con `total`. Sin descuentos ni impuestos en los datos. |

**Filtros.** `v_pedido` excluye los borradores (`status <> 'draft'`). Hoy no hay ninguno. `v_item_pedido` no filtra: C2 descarta las líneas de borradores con el `JOIN v_pedido`.

Salida de la creación: `salidas/p3_saleor_vistas_output.txt`, 15:33:03.

### 3.3 Medusa (no evaluada)

Medusa no quedó como esquema independiente, así que no se ejecutó nada contra ella. Del catálogo (`pg_get_viewdef`) quedan dos observaciones estructurales:
- Su `v_pedido` no tiene `total` (DEC-28): C1 sería inaplicable, por ausencia (clase 4).
- Expone `status::text`, es decir `canceled` y no `'cancelado'`. No cumple la propuesta DEC-39.

---

## 4. Resultados de Food Store

### 4.1 Nombres históricos

Salida en `salidas/p4_1_foodstore_diagnostico_output.txt`, 15:33:20.

| Verificación | Resultado |
|---|---|
| Líneas de `detalle_pedido` con `producto_nombre` distinto de `product.name` | **0**, en 0 productos |
| Nombres históricos con más de un `producto_id` | 0 |
| `producto_id` con más de un nombre histórico | 0 |
| Productos vendidos con baja lógica, que no están en `v_producto` | 0 |
| Pedidos y detalles con baja lógica | 0 y 0 |
| `descripcion → codigo` de `estado_pedido` | Uno a uno: 6 estados, `Pedido cancelado → CANCELADO` |

**El mapeo nombre → id no es ambiguo.** Tiene 9 nombres y 9 ids (`salidas/p4_2_foodstore/mapeo_productos.txt`). No hay ninguna diferencia esperable por el nombre histórico.

### 4.2 Comparación por día y bloque

- **Días.** Los 30 días con pedidos (2026-08-18 a 2026-09-16; en todos, los pedidos son de las 13:07:31) y un día sin pedidos, 2026-09-17.
- **Ejecución.** Las nativas del Anexo C (`sql/nativas_foodstore/`) y las canónicas corrieron en **una sola** transacción `REPEATABLE READ READ ONLY` (pid 13004, 15:34:33).
  - En las nativas solo cambia el rango: `CURRENT_DATE - INTERVAL '1 day'` pasa a `:'desde'` y `CURRENT_DATE` a `:'hasta'`.
  - Al ranking nativo se le quitó el `LIMIT 5` para la comparación.
- **Comparación.** Diferencia simétrica con `comm`, en los dos sentidos, sobre filas normalizadas (`scripts/p4_comparar.sh`):
  - **Ventas:** `(cantidad, facturación, ticket)`.
  - **Ranking:** `(productoId, unidades, monto)`. La nativa pasa por nombre → id.
  - **Estados:** `(estado, cantidad)`. La nativa pasa por `descripcion → codigo`, con `CANCELADO → 'cancelado'`.
- **Montos.** Se normalizaron a dos decimales; los dos lados son `numeric`.
- **Control negativo.** Sobre una copia de las salidas se reemplazaron, para el 2026-08-22, el ranking y los estados canónicos por los del 2026-08-23, y se alteró la fila de ventas. El comparador informó `1/1`, `5/2` y `1/1` filas solo nativa / solo canónica. No es un comparador que siempre dé cero.

**Totales de los 93 pares día × bloque:** 198 filas nativas, 198 canónicas, **0 solo en la nativa, 0 solo en la canónica**.

| Día | Bloque | Filas nativa | Filas canónica | Solo nativa | Solo canónica |
|---|---|---|---|---|---|
| 2026-08-18 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-18 | ranking | 1 | 1 | 0 | 0 |
| 2026-08-18 | estados | 2 | 2 | 0 | 0 |
| 2026-08-19 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-19 | ranking | 2 | 2 | 0 | 0 |
| 2026-08-19 | estados | 1 | 1 | 0 | 0 |
| 2026-08-20 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-20 | ranking | 5 | 5 | 0 | 0 |
| 2026-08-20 | estados | 1 | 1 | 0 | 0 |
| 2026-08-21 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-21 | ranking | 3 | 3 | 0 | 0 |
| 2026-08-21 | estados | 1 | 1 | 0 | 0 |
| 2026-08-22 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-22 | ranking | 5 | 5 | 0 | 0 |
| 2026-08-22 | estados | 2 | 2 | 0 | 0 |
| 2026-08-23 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-23 | ranking | 2 | 2 | 0 | 0 |
| 2026-08-23 | estados | 2 | 2 | 0 | 0 |
| 2026-08-24 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-24 | ranking | 3 | 3 | 0 | 0 |
| 2026-08-24 | estados | 1 | 1 | 0 | 0 |
| 2026-08-25 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-25 | ranking | 6 | 6 | 0 | 0 |
| 2026-08-25 | estados | 1 | 1 | 0 | 0 |
| 2026-08-26 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-26 | ranking | 5 | 5 | 0 | 0 |
| 2026-08-26 | estados | 1 | 1 | 0 | 0 |
| 2026-08-27 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-27 | ranking | 2 | 2 | 0 | 0 |
| 2026-08-27 | estados | 1 | 1 | 0 | 0 |
| 2026-08-28 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-28 | ranking | 3 | 3 | 0 | 0 |
| 2026-08-28 | estados | 2 | 2 | 0 | 0 |
| 2026-08-29 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-29 | ranking | 7 | 7 | 0 | 0 |
| 2026-08-29 | estados | 2 | 2 | 0 | 0 |
| 2026-08-30 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-30 | ranking | 6 | 6 | 0 | 0 |
| 2026-08-30 | estados | 1 | 1 | 0 | 0 |
| 2026-08-31 | ventas | 1 | 1 | 0 | 0 |
| 2026-08-31 | ranking | 5 | 5 | 0 | 0 |
| 2026-08-31 | estados | 1 | 1 | 0 | 0 |
| 2026-09-01 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-01 | ranking | 6 | 6 | 0 | 0 |
| 2026-09-01 | estados | 1 | 1 | 0 | 0 |
| 2026-09-02 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-02 | ranking | 3 | 3 | 0 | 0 |
| 2026-09-02 | estados | 1 | 1 | 0 | 0 |
| 2026-09-03 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-03 | ranking | 4 | 4 | 0 | 0 |
| 2026-09-03 | estados | 1 | 1 | 0 | 0 |
| 2026-09-04 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-04 | ranking | 4 | 4 | 0 | 0 |
| 2026-09-04 | estados | 1 | 1 | 0 | 0 |
| 2026-09-05 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-05 | ranking | 7 | 7 | 0 | 0 |
| 2026-09-05 | estados | 1 | 1 | 0 | 0 |
| 2026-09-06 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-06 | ranking | 7 | 7 | 0 | 0 |
| 2026-09-06 | estados | 1 | 1 | 0 | 0 |
| 2026-09-07 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-07 | ranking | 3 | 3 | 0 | 0 |
| 2026-09-07 | estados | 1 | 1 | 0 | 0 |
| 2026-09-08 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-08 | ranking | 6 | 6 | 0 | 0 |
| 2026-09-08 | estados | 1 | 1 | 0 | 0 |
| 2026-09-09 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-09 | ranking | 2 | 2 | 0 | 0 |
| 2026-09-09 | estados | 1 | 1 | 0 | 0 |
| 2026-09-10 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-10 | ranking | 4 | 4 | 0 | 0 |
| 2026-09-10 | estados | 1 | 1 | 0 | 0 |
| 2026-09-11 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-11 | ranking | 5 | 5 | 0 | 0 |
| 2026-09-11 | estados | 1 | 1 | 0 | 0 |
| 2026-09-12 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-12 | ranking | 6 | 6 | 0 | 0 |
| 2026-09-12 | estados | 1 | 1 | 0 | 0 |
| 2026-09-13 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-13 | ranking | 5 | 5 | 0 | 0 |
| 2026-09-13 | estados | 2 | 2 | 0 | 0 |
| 2026-09-14 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-14 | ranking | 5 | 5 | 0 | 0 |
| 2026-09-14 | estados | 2 | 2 | 0 | 0 |
| 2026-09-15 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-15 | ranking | 5 | 5 | 0 | 0 |
| 2026-09-15 | estados | 1 | 1 | 0 | 0 |
| 2026-09-16 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-16 | ranking | 2 | 2 | 0 | 0 |
| 2026-09-16 | estados | 2 | 2 | 0 | 0 |
| 2026-09-17 | ventas | 1 | 1 | 0 | 0 |
| 2026-09-17 | ranking | 0 | 0 | 0 | 0 |
| 2026-09-17 | estados | 0 | 0 | 0 | 0 |

Valores (canónica = nativa) por día: ventas `(cantidad, facturación, ticket)` y estados.

| Día | Ventas (cantidad, facturación, ticket) | Estados |
|---|---|---|
| 2026-08-18 | 1, 2100.00, 2100.00 | ENTREGADO 1; cancelado 1 |
| 2026-08-19 | 2, 13600.00, 6800.00 | ENTREGADO 2 |
| 2026-08-20 | 3, 22700.00, 7566.67 | ENTREGADO 3 |
| 2026-08-21 | 2, 15400.00, 7700.00 | ENTREGADO 2 |
| 2026-08-22 | 4, 26000.00, 6500.00 | ENTREGADO 4; cancelado 1 |
| 2026-08-23 | 2, 6300.00, 3150.00 | ENTREGADO 2; cancelado 1 |
| 2026-08-24 | 3, 8700.00, 2900.00 | ENTREGADO 3 |
| 2026-08-25 | 4, 19400.00, 4850.00 | ENTREGADO 4 |
| 2026-08-26 | 3, 14400.00, 4800.00 | ENTREGADO 3 |
| 2026-08-27 | 2, 2900.00, 1450.00 | ENTREGADO 2 |
| 2026-08-28 | 2, 5100.00, 2550.00 | ENTREGADO 2; cancelado 1 |
| 2026-08-29 | 5, 37800.00, 7560.00 | ENTREGADO 5; cancelado 1 |
| 2026-08-30 | 4, 22800.00, 5700.00 | ENTREGADO 4 |
| 2026-08-31 | 4, 16900.00, 4225.00 | ENTREGADO 4 |
| 2026-09-01 | 4, 24500.00, 6125.00 | ENTREGADO 4 |
| 2026-09-02 | 4, 35000.00, 8750.00 | ENTREGADO 4 |
| 2026-09-03 | 3, 12200.00, 4066.67 | ENTREGADO 3 |
| 2026-09-04 | 2, 7800.00, 3900.00 | ENTREGADO 2 |
| 2026-09-05 | 4, 16400.00, 4100.00 | ENTREGADO 4 |
| 2026-09-06 | 5, 41100.00, 8220.00 | ENTREGADO 5 |
| 2026-09-07 | 2, 9800.00, 4900.00 | ENTREGADO 2 |
| 2026-09-08 | 4, 20600.00, 5150.00 | ENTREGADO 4 |
| 2026-09-09 | 2, 3800.00, 1900.00 | ENTREGADO 2 |
| 2026-09-10 | 2, 12100.00, 6050.00 | ENTREGADO 2 |
| 2026-09-11 | 3, 20800.00, 6933.33 | ENTREGADO 3 |
| 2026-09-12 | 5, 28300.00, 5660.00 | ENTREGADO 5 |
| 2026-09-13 | 3, 10100.00, 3366.67 | ENTREGADO 3; cancelado 2 |
| 2026-09-14 | 2, 10600.00, 5300.00 | ENTREGADO 2; cancelado 1 |
| 2026-09-15 | 3, 15700.00, 5233.33 | ENTREGADO 3 |
| 2026-09-16 | 2, 5200.00, 2600.00 | CONFIRMADO 1; LISTO 1 |
| 2026-09-17 | 0, 0, 0 |  |

### 4.3 Montos

`SUM(dp.subtotal)` de la nativa y `SUM(cantidad * precioUnitario)` de la canónica coinciden en todos los días y productos: ninguna fila de ranking difiere.

La causa es estructural. `detalle_pedido.subtotal = cantidad × producto_precio_unitario` en las 194 líneas, y no hay descuentos ni redondeos. No se ajustó ninguna consulta.

### 4.4 `LIMIT 5` (informativo)

En 6 días hay un empate de unidades entre el puesto 5 y el 6: 2026-08-30, 09-01, 09-05, 09-06, 09-08 y 09-12 (`salidas/p4_2_empates_limite5.txt`).
- **La nativa con `LIMIT 5`.** Esos días deja afuera un producto elegido por el orden físico, no por una regla. Ya se ve un empate resuelto sin regla el 2026-08-22: Aros de Cebolla aparece antes que BBQ Bacon, las dos con 3 unidades.
- **La canónica top 5.** Es determinista: desempata por `productoId`.

---

## 5. Resultados del esquema independiente (Saleor)

### 5.1 Canónica contra cálculo manual

**Consultas manuales** (`sql/manual_saleor/`). Se escribieron a mano sobre `order_order`, `order_orderline`, `product_productvariant` y `product_product`, sin vistas. Replican las mismas decisiones de significado que las vistas: sin borradores, `canceled` como cancelado, montos brutos y nombre de variante. Por eso verifican la composición vista + consulta canónica, no esas decisiones.

**Ejecución.**
- **Sesión A.** Como `saleor`, en `REPEATABLE READ READ ONLY`, pid 141, 15:37:44: manuales y canónicas en la misma instantánea.
- **Sesión B.** Como `zd_ch16c_lectura`, pid 148, 15:37:44: solo las canónicas. Ese rol tiene `SELECT` sobre las vistas y ningún permiso sobre las tablas de pedidos.
- **Días.** 2026-09-24 (el único con pedidos) y 2026-09-23, un día vacío.
- **Ranking.** Se comparó con la tupla completa `(productoId, nombre, unidades, monto)`.

| Día | Bloque | Filas manual | Filas canónica | Solo manual | Solo canónica | Canónica A = canónica B |
|---|---|---|---|---|---|---|
| 2026-09-24 | ventas | 1 | 1 | 0 | 0 | sí (0/0) |
| 2026-09-24 | ranking | 42 | 42 | 0 | 0 | sí (0/0) |
| 2026-09-24 | estados | 3 | 3 | 0 | 0 | sí (0/0) |
| 2026-09-23 | ventas | 1 | 1 | 0 | 0 | sí (0/0) |
| 2026-09-23 | ranking | 0 | 0 | 0 | 0 | sí (0/0) |
| 2026-09-23 | estados | 0 | 0 | 0 | 0 | sí (0/0) |

Valores del 2026-09-24:

| Bloque | Resultado |
|---|---|
| C1 ventas | 20 pedidos, facturación 16296.420, ticket 814.82 |
| C2 ranking | 42 variantes. Top 5 canónico: 386 (11 u.), 338 (7 u.), y 360, 364 y 390 (6 u. cada una; desempate por `productoId`) |
| C3 estados | `partially fulfilled` 9, `unfulfilled` 8, `unconfirmed` 3 |

**Advertencia de significado.** La facturación 16296.420 suma 3509.990 USD y 12786.430 PLN (`salidas/p5_0_saleor_diagnostico_output.txt`). La cifra coincide con el cálculo manual, pero **no tiene unidad**. Pasa lo mismo con los montos del ranking de variantes vendidas en los dos canales. Ver 6 y DEC-42.

### 5.2 Modificación controlada

**Entrada:** `salidas/p5_2_modificacion_input.sql`: una transacción de lectura y escritura, `REPEATABLE READ`, como `saleor`, pid 183, 15:38:45.

**Regla de elección del pedido, fijada en el script antes de correrlo:** entre los pedidos del 2026-09-24 que no son borradores ni están cancelados, el de menor `number`.
- Quedó el **pedido número 1**: `partially fulfilled`, total 326.580 USD.
- Tiene 3 líneas: variante 333 (2 u. × 75.000), 378 (1 u. × 8.990) y 397 (4 u. × 27.000).

**Secuencia:**
1. Canónicas, "antes".
2. `UPDATE order_order SET status = 'canceled' WHERE id = … AND status = 'partially fulfilled'`, que devolvió `UPDATE 1`.
3. Guarda no constante (lección I-2 de CH-16d): `ok`.
4. Canónicas, "después".
5. `ROLLBACK`.

`order_order` no tiene triggers de usuario.

**Efectos**, comparando el esperado (calculado desde "antes", el pedido y sus líneas; `scripts/p5_2_esperado.sh`) con el observado:

| Bloque | Esperado | Observado "después" | Solo esperado / solo observado |
|---|---|---|---|
| Ventas | 20 − 1 = 19 pedidos; 16296.420 − 326.580 = 15969.840; ticket 840.52 | `19 / 15969.840 / 840.52` | 0 / 0 |
| Ranking | 333 (−2 u., −150.000) y 378 (−1 u., −8.990) salen; 397 pasa de 5 u./225.000 a 1 u./117.000; 42 → 40 filas | 40 filas, idénticas | 0 / 0 |
| Estados | `partially fulfilled` 9 → 8; `cancelado` 0 → 1; el resto igual | `partially fulfilled` 8, `unfulfilled` 8, `unconfirmed` 3, `cancelado` 1 | 0 / 0 |

**Después del `ROLLBACK`.** La verificación corrió en una sesión nueva (`salidas/p5_2_verificacion_input.sql`, `READ ONLY`, pid 190, 15:38:46):
- El pedido 1 sigue en `partially fulfilled` y no hay ningún pedido `canceled`.
- Las tres canónicas son **idénticas byte a byte** a las de "antes" y a las de la corrida 5.1.

---

## 6. Obligatoriedad

Atributos que cada consulta **lee efectivamente**, en `SELECT`, `WHERE`, `JOIN`, `GROUP BY` u `ORDER BY`, contra la declaración de `src/contrato.ts`. Se usa `contrato.ts` porque la Tabla 5.1 de la tesis no está en el repositorio; se asume que la refleja.

| Entidad.atributo | Obligatoriedad declarada | Declarado para `reporte-diario` | C1 | C2 | C3 | Observación |
|---|---|---|---|---|---|---|
| pedido.id | obligatorio | sí | — | JOIN | — | Leído |
| pedido.fechaCreacion | obligatorio | sí | WHERE | WHERE | WHERE | Leído |
| pedido.estado | obligatorio | sí | WHERE | WHERE | SELECT, GROUP BY, ORDER BY | Leído |
| pedido.total | obligatorio | sí | SELECT | — | — | Leído |
| pedido.numero | opcional | sí | — | — | — | **Declarado, no leído** |
| pedido.moneda | opcional | sí | — | — | — | **Declarado, no leído**. En Saleor su ausencia en la consulta produce sumas entre monedas |
| item_pedido.id | **obligatorio** | sí | — | — | — | **Declarado obligatorio, no leído** |
| item_pedido.pedidoId | obligatorio | sí | — | JOIN | — | Leído |
| item_pedido.productoId | obligatorio | sí | — | SELECT, JOIN, GROUP BY, ORDER BY | — | Leído |
| item_pedido.cantidad | obligatorio | sí | — | SELECT | — | Leído |
| item_pedido.precioUnitario | **opcional** | sí | — | SELECT | — | **Leído pero opcional** |
| producto.id | obligatorio | sí | — | JOIN | — | Leído |
| producto.nombre | obligatorio | sí | — | SELECT, GROUP BY | — | Leído |
| producto.stockDisponible | obligatorio (por `stock-fisico`) | sí | — | — | — | **Declarado para `reporte-diario`, no leído** |
| producto.sku | opcional | sí | — | — | — | **Declarado para `reporte-diario`, no leído** |

**Leídos pero opcionales.** `item_pedido.precioUnitario`.
- **Sin la columna**, C2 no ejecuta: la referencia falla.
- **Con la columna en `NULL`**, C2 ejecuta y devuelve `total_generado = 0` por el `COALESCE`, sin error. Es el mismo modo de falla silenciosa que llevó a DEC-36 con `producto.activo`.
- Por el criterio de DEC-29 debería ser obligatorio. Ver DEC-40.

**Declarados pero no leídos.**
- **`item_pedido.id`.** Es obligatorio y ninguna consulta lo lee: por DEC-29 no pasa el criterio.
- **`producto.stockDisponible` y `producto.sku`.** Llevan la etiqueta `reporte-diario` y el reporte no los lee. El Anexo C no tiene bloque de stock: la bitácora de WF-03 lo menciona solo como "extensión futura".
- **`pedido.numero` y `pedido.moneda`.** Son opcionales, llevan la etiqueta `reporte-diario` y no se leen.
- **El caso de `moneda`.** Es un "no leído" con consecuencias. Saleor lo demuestra: C1 y C2 ejecutan y coinciden con el cálculo manual, pero suman USD con PLN.

No se modificó `src/contrato.ts`.

---

## 7. Propuestas de decisión (sin aplicar)

Numeradas desde DEC-39. Se registran acá como **propuestas**. No se escribieron en `docs/01-decisiones.md` ni en el código: las decide el autor.

### DEC-39 (propuesta) — Dominio canónico mínimo de `pedido.estado`

- **Contexto.** C1 y C2 excluyen los cancelados con un literal. Sin un dominio fijado, cada plataforma expone su propio valor (`CANCELADO`, `canceled`), y el texto de la consulta tendría que cambiar por plataforma, que es lo que prueba R1.
- **Propuesta.** La vista de cada plataforma traduce su estado de cancelación al literal `'cancelado'`, en minúscula. Los demás estados se exponen con su valor nativo.
- **Consecuencias.**
  - **Food Store y Saleor.** Las vistas de este experimento la cumplen.
  - **Medusa.** Su `v_pedido` actual expone `canceled` y no la cumple: habría que redefinirla.
  - **Queda abierto** qué estados nativos corresponden a "cancelado" cuando hay más de uno parecido. En Saleor, `expired` (un pedido no confirmado que venció) y `returned` hoy cuentan como venta. No aparecen en los datos. La decisión es de significado y le corresponde al autor, por plataforma.
  - **Qué no garantiza.** Fija solo la frontera cancelado / no cancelado. C3 muestra los estados nativos, así que no se puede comparar C3 entre plataformas.

### DEC-40 (propuesta) — `item_pedido.precioUnitario` pasa a obligatorio

- **Contexto.** C2 lo lee para el monto del ranking. Con la columna en `NULL`, el ranking informa 0 sin error (sección 6).
- **Propuesta.** Obligatorio por el criterio de DEC-29.
- **Alternativa.** Quitar el monto del ranking y dejarlo en opcional.
- **Consecuencia.** El comentario actual de `contrato.ts` ("`pedido.total` already carries the amount the report needs") deja de ser cierto para el bloque de ranking.

### DEC-41 (propuesta) — Etiquetas `reporte-diario` que la consulta no respalda

- **Contexto.** Con las consultas de este experimento, varios atributos llevan la etiqueta `reporte-diario` y ninguna consulta los lee (sección 6).
- **Propuesta.**
  - `item_pedido.id` pasa a opcional.
  - Se quita `reporte-diario` de `producto.stockDisponible` y `producto.sku`. Siguen atados a `stock-fisico`.
  - Para `pedido.numero` hay dos opciones: quitar la etiqueta, y con eso el campo del catálogo, porque no tendría ninguna automatización, o conservarla solo si una versión futura del reporte lo muestra.

### DEC-42 (propuesta) — `pedido.moneda` en el reporte

- **Contexto.** En Saleor, un mismo día tiene pedidos en USD y en PLN. C1 y C2 no leen `moneda` y suman montos de monedas distintas. El resultado coincide con el cálculo manual (R3 no se cumple), pero la cifra no tiene unidad.
- **Opciones.**
  - (a) Una versión futura de C1 y C2 agrupa por `moneda`, y `moneda` pasa a obligatorio.
  - (b) Se documenta como límite del artefacto: el reporte supone una sola moneda por tenant, y una plataforma con varias queda fuera del patrón. Esta es la opción coherente con la regla 6 de `AGENTS.md`.
  - (c) La vista filtra una moneda o un canal. Esta opción oculta datos.
- **La portabilidad del texto no alcanza.** Este caso muestra que puede haber portabilidad sin equivalencia de significado.

### DEC-43 (propuesta) — Semántica de los montos

- **Contexto.** El contrato no fija qué incluyen `total` y `precioUnitario`.
  - **Food Store.** `total` incluye el envío y no hay impuestos.
  - **Saleor.** Se eligió el bruto: con impuestos y envío, neto de descuentos.
  - **El monto del ranking** (`cantidad × precioUnitario`) nunca incluye el envío. Por eso la suma del ranking no cuadra con la facturación en ninguna de las dos plataformas: la diferencia es el envío.
- **Propuesta.** El contrato fija que `pedido.total` es el importe cobrado al cliente (con envío e impuestos, neto de descuentos) y que `precioUnitario` es el precio por unidad efectivamente cobrado (con impuestos, neto de descuentos).
- **Límite de la evidencia.** Los datos de Saleor no tienen impuestos ni descuentos: esta prueba no discrimina entre bruto y neto.

### DEC-44 (propuesta) — Tipo y zona de `pedido.fechaCreacion`

- **Contexto.** El tipo cambia entre plataformas.
  - **Food Store.** `timestamp without time zone`: el día depende de en qué zona escribió la aplicación, que no se conoce.
  - **Saleor.** `timestamptz`: el día se define sin ambigüedad en la zona de la sesión.
  - **La consulta canónica** funciona con los dos gracias al literal sin tipo, pero el significado de "día" solo es el mismo si la hora sin zona de Food Store es hora local.
- **Propuesta.** El contrato fija `fechaCreacion` como `timestamptz`. La vista de una plataforma con hora sin zona la convierte con la zona que la plataforma usa realmente (`created_at AT TIME ZONE '<zona>'`), y esa zona queda registrada como decisión de significado.

---

## 8. Veredicto por criterio

"Se cumple" significa que ocurre la condición de refutación.

| Criterio | Veredicto | Evidencia |
|---|---|---|
| **R1** — alguna consulta canónica necesita editar su texto | **No se cumple** | Los cuatro archivos corrieron con `\i` sin cambios sobre Food Store (4.2, 7) y Saleor (5.1, 5.2), incluso con el rol de solo lectura `zd_ch16c_lectura`. Los SHA-256 coinciden con el preregistro y `git diff d43ac67 -- sql/c*.sql` está vacío. |
| **R2** — diferencia simétrica no vacía en Food Store | **No se cumple** | 31 días × 3 bloques = 93 pares, con 198 filas de cada lado: 0 solo nativa y 0 solo canónica. No se necesitó la excepción por nombre histórico: hay 0 casos (4.1). El control negativo muestra que el comparador sí detecta diferencias. |
| **R3** — Saleor difiere del cálculo manual, o la modificación no da exactamente lo esperado | **No se cumple** | 2 días × 3 bloques: 0/0 contra el manual (5.1). La modificación produjo exactamente −1 pedido y −326.580, las 3 variantes descontadas (42 → 40 filas) y `partially fulfilled` −1 / `cancelado` +1. Después del `ROLLBACK`, todo es idéntico byte a byte (5.2). |

**La portabilidad del reporte diario no queda refutada.** Tiene cuatro límites:
- **Moneda.** En Saleor, la facturación y los montos del ranking suman dos monedas. Es un defecto de significado que ningún criterio preregistrado captura (DEC-42).
- **Un solo día con pedidos en Saleor.** Esos pedidos son de demostración y no tienen impuestos, descuentos ni cancelados propios: el único cancelado fue el de la modificación controlada.
- **Medusa sin evaluar.** C1 sería inaplicable ahí por la ausencia de `total` (clase 4), y su `v_pedido` no cumple DEC-39.
- **Las decisiones de significado de las vistas no se ponen a prueba.** Las consultas manuales de Saleor comparten esas decisiones. Lo que se verifica es la composición vista + consulta.

**Paso 7 (optativo), composición con `WITH` en Food Store.**
- **Armado.** `scripts/p7_generar_with.sh` antepuso las definiciones de `v_pedido`, `v_item_pedido` (de `vistas/`) y `v_producto` (de `03_vistas_foodstore.sql`) como `WITH`. La cola de cada archivo es idéntica byte a byte a la consulta canónica (`cmp`).
- **Resultado.** En una transacción `READ ONLY` (pid 13470, 15:39:55), los 93 pares día × consulta dieron salidas **idénticas byte a byte** entre la versión con vistas y la versión con `WITH`, y también contra la corrida del paso 4.

---

## 9. Desvíos del preregistro

- **Textos canónicos:** ninguno.
- **Agregados, no desvíos:**
  - En Saleor se agregó un día vacío (2026-09-23).
  - Se agregó la sesión B con el rol de solo lectura.
  - El ranking de Saleor se comparó con la tupla completa, con `nombre` incluido, que es más estricta que la de Food Store.
- **Regla de elección:** se aplicó tal como se preregistró. Como quedó Saleor, no se aplicó el punto 3 (pedidos construidos en Medusa).
- **Incidente sin efecto sobre datos (I-1).** El primer intento del paso 4.2 (`salidas/p4_2_foodstore_intento1_output.txt`, 15:34:17) cortó con `psql` en código 3.
  - **Causa.** Git Bash convirtió `/tmp/rd/out` a una ruta de Windows en el `docker exec … mkdir`, así que el directorio de salida no existía.
  - **Estado de la base.** Solo se había ejecutado `SELECT now()` dentro de una transacción `READ ONLY`. No se leyó ninguna fila de pedidos.
  - **Corrección.** Se exportó `MSYS_NO_PATHCONV=1` y se repitió la corrida completa (15:34:33).

---

## 10. Fechas y horas de las ejecuciones

Todas el 2026-09-25, hora local (-03:00). La hora es la de `date -Iseconds` antes de cada `psql`. El texto exacto de cada consulta está en el `*_input.sql` y, repetido por `psql -e`, en el `*_output.txt`.

| Hora | Paso | Base / rol | Entrada | Resultado |
|---|---|---|---|---|
| 15:32:02 | Commit del preregistro `d43ac67` | — | — | — |
| 15:32:09 | 2 — conteo de Saleor | saleor / `saleor` | `salidas/p2_saleor_conteo_input.sql` | exit 0 |
| 15:33:02 | 3 — creación de vistas en Food Store | food_store / `postgres` | `salidas/p3_foodstore_vistas_input.sql` | exit 0, `COMMIT` |
| 15:33:03 | 3 — `GRANT` y creación de vistas en Saleor | saleor / `saleor`, `zd_ch16c_creador` | `salidas/p3_saleor_grants_input.sql`, `salidas/p3_saleor_vistas_input.sql` | exit 0, exit 0, `COMMIT` |
| 15:33:20 | 4.1 — diagnóstico de Food Store | food_store / `postgres` | `salidas/p4_1_foodstore_diagnostico_input.sql` | exit 0 |
| 15:34:17 | 4.2 — intento 1 (I-1) | food_store / `postgres` | `salidas/p4_2_foodstore_input.sql` (primera versión) | exit 3 |
| 15:34:33 | 4.2 — nativas contra canónicas, 31 días | food_store / `postgres` | `salidas/p4_2_foodstore_input.sql` | exit 0 |
| 15:37:10 | 5.0 — diagnóstico de Saleor | saleor / `saleor` | `salidas/p5_0_saleor_diagnostico_input.sql` | exit 0 |
| 15:37:44 | 5.1 — sesión A: manual y canónica | saleor / `saleor` | `salidas/p5_1_saleor_A_input.sql` | exit 0 |
| 15:37:44 | 5.1 — sesión B: canónica | saleor / `zd_ch16c_lectura` | `salidas/p5_1_saleor_B_input.sql` | exit 0 |
| 15:38:45 | 5.2 — modificación controlada | saleor / `saleor` | `salidas/p5_2_modificacion_input.sql` | exit 0, `ROLLBACK` |
| 15:38:45 | 5.2 — verificación en sesión nueva | saleor / `saleor` | `salidas/p5_2_verificacion_input.sql` | exit 0 |
| 15:39:55 | 7 — vistas contra `WITH`, 31 días | food_store / `postgres` | `salidas/p7_foodstore_input.sql` | exit 0 |

Fuera de las ejecuciones con registro, el catálogo de las bases se consultó a mano antes del preregistro: `\d` de las tablas de pedidos de Food Store y Saleor, `pg_views`, `pg_get_viewdef` de las vistas de Medusa y los valores del enum `estado_pedido_codigo`. Después se consultaron `pg_trigger` y `pg_constraint` de `order_order` y `order_orderline`, y las versiones de PostgreSQL. Nada de eso leyó filas de pedidos.

**Hash final de la rama:** se informa en el mensaje de cierre. No puede figurar en el propio commit que lo produce.
