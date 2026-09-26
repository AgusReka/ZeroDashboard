# Bitácora — P13: replicación sobre Odoo Community (stock producible y reporte diario)

**Fecha:** 2026-09-26. **Rama:** `experimento/odoo` (no se fusiona). **Material:** `experimentos/odoo/`.

Evaluación complementaria de una tesis ya redactada. No se tocó el prototipo congelado: ni `src/`, ni `src/contrato.ts`, ni las pruebas, ni ninguna vista de Food Store, Medusa o Saleor. Las consultas canónicas se ejecutaron desde su ruta original, con el hash verificado antes de cada corrida.

**Resumen.**

- **R1 no se cumple.** Las cinco consultas canónicas corrieron sobre Odoo sin editar una línea.
- **R3 no se cumple.** En el reporte diario, la diferencia simétrica con el cálculo manual es 0/0 en los 14 días y los 3 bloques. La cancelación controlada produjo exactamente los efectos esperados.
- **R2 se cumple en su lectura literal**, y solo por el insumo limitante:
  - el **stock producible coincide** con el cálculo manual en 7 de 7 productos, antes y después de la modificación controlada;
  - el **insumo limitante no está determinado** por el texto de la consulta canónica cuando dos componentes empatan en el mínimo. En 3 de 7 productos hay empate. La canónica elige uno de los empatados, y esa elección cambió entre corridas en un producto cuyos datos no se tocaron (sección 4.5).

---

## 1. Preregistro

**Commit del preregistro:** `385b170469328118ef8743f7393551d701f66650` (2026-09-26 13:21:00 -03:00), `experimentos/odoo/PREREGISTRO.md`. Se hizo antes de levantar la instancia, por lo que antes de este commit no se leyó ninguna fila de Odoo.

SHA-256 de las consultas canónicas. Coinciden en el preregistro y en todas las corridas: ver `salidas/p3_hash.txt`, `p3_4_hash.txt`, `p4_hash.txt` y `p4_3_hash.txt`, cada uno con el hash del archivo del repositorio y el de la copia dentro del contenedor.

```
979131ebbf5055a6a267221db8c2de80ae7ccbaa3d56c091e24d900d66359c90  openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql
b635ec2dcd06b077ace2d187fcfddd33d26490907dbda0adef4c7c1230b18b46  experimentos/reporte_diario/sql/c1_ventas.sql
e8b901198a3ece44682d0daab152d1222d0ad598135acd3fe9f9b8b5b42dee5d  experimentos/reporte_diario/sql/c2_ranking.sql
52c76e9cf94038a604db636a501f98177301d16f42532d49e48039aabe08db31  experimentos/reporte_diario/sql/c2_ranking_top5.sql
dad49f4bd34a524ae187f41f356527740d6427ad3d9b1c0e551ec583b47a4f7f  experimentos/reporte_diario/sql/c3_estados.sql
```

**Valores de la modificación controlada de stock.** Se fijaron por la regla 4.1 y se commitearon **antes de ejecutarla**: `experimentos/odoo/ESPERADO_P3_4.md`, commit `b163bc8462b40c08ebc95bd845f857920fdbe856` (13:30:04). La modificación corrió a las 13:30:27.

---

## 2. Instancia

| Elemento | Valor |
|---|---|
| Imagen de Odoo | `odoo:latest` oficial de Docker Hub, `odoo@sha256:144175ec0039d52daff1d79f7e51c9281ca3c98b96c830feb49d09764a9f5d7c` (creada 2026-09-16) |
| Versión de Odoo | `Odoo Server 19.0-20260908` (`ODOO_VERSION=19.0`) |
| PostgreSQL | imagen `postgres:17`: `PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) on x86_64-pc-linux-gnu` |
| Base | `odoo`, esquema `public`, creada por Odoo |
| Instalación | `odoo -d odoo -i sale_management,stock,mrp,website_sale --with-demo --stop-after-init`, de 13:23:26 a 13:26:02, `exit=0`, sin líneas `ERROR` (`salidas/p0_instalacion.log`) |
| Código de Odoo | sin modificar. Se leyó (`mrp_bom.py`, `uom_uom.py`) para fundamentar las decisiones de la sección 3 |
| Composición | `experimentos/odoo/docker-compose.yml`. Contraseñas en `.env` (fuera del repositorio); `.env.example` sin valores |

**Módulos instalados:** 88 en total, contando las dependencias. Los pedidos fueron `sale_management`, `stock`, `mrp` y `website_sale`; con ellos quedaron instalados, entre otros, `sale`, `sale_stock`, `sale_mrp`, `mrp_account`, `stock_account`, `website`, `website_sale_mrp`, `website_sale_stock`, `product`, `uom`, `account` y `l10n_us`. La lista completa está en `salidas/p1_aplicabilidad_output.txt`, sección A.

### Conteos del paso 1

Solo catálogo y conteos, sin valores de filas. Corrida a las 13:26:07 (`salidas/p1_aplicabilidad_output.txt`).

| Tabla | Conteo |
|---|---|
| `mrp_bom` | 8 filas: **7 `normal` (fabricar) y 1 `phantom` (kit)**, todas activas |
| `mrp_bom_line` | 17 filas |
| `stock_quant` | 32 en ubicaciones `internal`; además, 32 en `inventory` y 3 en `production` |
| `sale_order` por estado | `draft` 9, `sent` 2, `sale` 29. Ninguno `cancel` |

`sale_order` por día (`date_order` llevado de UTC a `America/Argentina/Buenos_Aires`):

| Día | draft | sent | sale |
|---|---|---|---|
| 2026-07-26 | 1 | | |
| 2026-08-22 | | | 1 |
| 2026-08-24 | 1 | | |
| 2026-08-26 | 3 | 1 | 2 |
| 2026-08-29 | | | 1 |
| 2026-09-05, 09-12, 09-20, 09-21, 09-22, 09-23, 09-24, 09-25 | | | 1 cada uno |
| 2026-09-19 | | | 2 |
| 2026-09-26 | 4 | 1 | 15 |

Hay listas de materiales, así que la replicación de stock producible es aplicable.

---

## 3. Vistas

Archivo completo: `experimentos/odoo/vistas/vistas_odoo.sql`. Las creó `zd_odoo_creador`, que es su dueño, a las 13:28:04 (`salidas/p2_vistas_output.txt`).

**Roles** (`salidas/p2_roles_output.txt`, `p2_grant_output.txt`, `p2_controles_2_output.txt`), igual que en CH-16c:

- `zd_odoo_creador` tiene `USAGE, CREATE` sobre `public` y `SELECT` solo sobre las 15 tablas que leen las vistas;
- `zd_odoo_lectura` tiene `USAGE` sobre `public` y `SELECT` solo sobre las cinco vistas del contrato;
- ninguno de los dos es superusuario.

Controles con `zd_odoo_lectura`:

- lee las cinco vistas: `v_producto` 66 filas, `v_insumo` 13, `v_receta_componente` 15, `v_pedido` 29, `v_item_pedido` 67;
- no lee las tablas base: `permission denied for table sale_order`;
- no lee las vistas auxiliares: `permission denied for view zd_nombre_variante`;
- no crea objetos: `permission denied for schema public`, después de corregir el incidente I-2;
- no escribe: `permission denied for table sale_order`;
- `activo` en `NULL`: 0 de 66 filas (65 activas).

Dos vistas **auxiliares** (`zd_nombre_variante` y `zd_disponible_variante`) evitan repetir el nombre visible y el disponible en `v_producto` y `v_insumo`. No son parte del contrato y el rol de solo lectura no las lee.

### 3.1 SQL

```sql
CREATE VIEW zd_nombre_variante AS
SELECT pp.id AS product_id,
       (pt.name->>'en_US')
       || COALESCE(' (' || (SELECT string_agg(pav.name->>'en_US', ', ' ORDER BY ptav.id)
                            FROM product_variant_combination pvc
                            JOIN product_template_attribute_value ptav ON ptav.id = pvc.product_template_attribute_value_id
                            JOIN product_attribute_value pav ON pav.id = ptav.product_attribute_value_id
                            WHERE pvc.product_product_id = pp.id) || ')', '') AS nombre
FROM product_product pp
JOIN product_template pt ON pt.id = pp.product_tmpl_id;

CREATE VIEW zd_disponible_variante AS
SELECT q.product_id, SUM(q.quantity - q.reserved_quantity) AS disponible
FROM stock_quant q
JOIN stock_location l ON l.id = q.location_id
WHERE l.usage = 'internal'
GROUP BY q.product_id;

CREATE VIEW v_producto AS
SELECT pp.id::text                        AS id,
       n.nombre                           AS nombre,
       COALESCE(d.disponible, 0)          AS "stockDisponible",
       pp.default_code                    AS sku,
       (pp.active AND pt.active)          AS activo
FROM product_product pp
JOIN product_template pt ON pt.id = pp.product_tmpl_id
JOIN zd_nombre_variante n ON n.product_id = pp.id
LEFT JOIN zd_disponible_variante d ON d.product_id = pp.id;

CREATE VIEW v_insumo AS
SELECT pp.id::text                        AS id,
       n.nombre                           AS nombre,
       COALESCE(d.disponible, 0)          AS "stockDisponible",
       u.name->>'en_US'                   AS "unidadMedida",
       pp.default_code                    AS codigo
FROM product_product pp
JOIN product_template pt ON pt.id = pp.product_tmpl_id
JOIN uom_uom u ON u.id = pt.uom_id
JOIN zd_nombre_variante n ON n.product_id = pp.id
LEFT JOIN zd_disponible_variante d ON d.product_id = pp.id
WHERE EXISTS (SELECT 1 FROM mrp_bom_line l JOIN mrp_bom b ON b.id = l.bom_id
              WHERE l.product_id = pp.id AND b.active AND b.type IN ('normal', 'phantom'));

CREATE VIEW v_receta_componente AS
WITH elegida AS (
  SELECT pp.id AS product_id, pt.uom_id AS uom_producto,
         (SELECT b.id FROM mrp_bom b
          WHERE b.active AND b.type IN ('normal', 'phantom')
            AND (b.product_id = pp.id OR (b.product_id IS NULL AND b.product_tmpl_id = pp.product_tmpl_id))
          ORDER BY b.sequence, (b.product_id IS NULL), b.id
          LIMIT 1) AS bom_id
  FROM product_product pp
  JOIN product_template pt ON pt.id = pp.product_tmpl_id
  WHERE pt.type <> 'service'
)
SELECT e.product_id::text                AS "productoId",
       l.product_id::text                AS "insumoId",
       SUM( (l.product_qty * ul.factor / uc.factor)
          / (b.product_qty * ub.factor / up.factor) ) AS "cantidadPorUnidad"
FROM elegida e
JOIN mrp_bom b          ON b.id = e.bom_id
JOIN mrp_bom_line l     ON l.bom_id = b.id
JOIN product_product c  ON c.id = l.product_id
JOIN product_template ct ON ct.id = c.product_tmpl_id
JOIN uom_uom ul ON ul.id = l.product_uom_id
JOIN uom_uom uc ON uc.id = ct.uom_id
JOIN uom_uom ub ON ub.id = b.product_uom_id
JOIN uom_uom up ON up.id = e.uom_producto
WHERE NOT EXISTS (
        SELECT 1
        FROM mrp_bom_line_product_template_attribute_value_rel r
        JOIN product_template_attribute_value lv ON lv.id = r.product_template_attribute_value_id
        JOIN product_attribute a ON a.id = lv.attribute_id
        WHERE r.mrp_bom_line_id = l.id
          AND (a.create_variant = 'no_variant'
               OR NOT EXISTS (SELECT 1
                              FROM mrp_bom_line_product_template_attribute_value_rel r2
                              JOIN product_template_attribute_value lv2 ON lv2.id = r2.product_template_attribute_value_id
                              JOIN product_variant_combination pvc ON pvc.product_template_attribute_value_id = lv2.id
                              WHERE r2.mrp_bom_line_id = l.id
                                AND lv2.attribute_id = lv.attribute_id
                                AND pvc.product_product_id = e.product_id)))
GROUP BY e.product_id, l.product_id;

CREATE VIEW v_pedido AS
SELECT so.id::text                               AS id,
       (so.date_order AT TIME ZONE 'UTC')        AS "fechaCreacion",
       CASE WHEN so.state = 'cancel' THEN 'cancelado'
            ELSE so.state::text END              AS estado,
       so.amount_total                           AS total,
       so.name                                   AS numero,
       c.name                                    AS moneda
FROM sale_order so
JOIN res_currency c ON c.id = so.currency_id
WHERE so.state NOT IN ('draft', 'sent');

CREATE VIEW v_item_pedido AS
SELECT sol.id::text                   AS id,
       sol.order_id::text             AS "pedidoId",
       sol.product_id::text           AS "productoId",
       sol.product_uom_qty            AS cantidad,
       sol.price_reduce_taxinc        AS "precioUnitario"
FROM sale_order_line sol
WHERE sol.display_type IS NULL;
```

### 3.2 Clase de cada atributo

Criterio de la sección 6.4.1: 1 directa, 2 granularidad, 3 entidad-atributo-valor, 4 ausencia. Los filtros de fila (`WHERE`) no cuentan para la clase (caso T-1 de la matriz). La reunión con una tabla de valores enumerados o de catálogo cuenta como clase 1.

| Entidad | Atributo | Expresión | Clase | Decisión de significado |
|---|---|---|---|---|
| producto | id | `product_product.id` | 2 | Nivel de variante (O-1) |
| producto | nombre | `product_template.name->>'en_US'` + valores de atributo de la variante | 2, 3 | El nombre vive en la plantilla (2). Lo que distingue a la variante son filas de `product_variant_combination` → `product_attribute_value`, es decir, pares atributo-valor (3). `name` es `jsonb` por idioma: se toma `en_US`, el único idioma activo (O-2) |
| producto | stockDisponible | `SUM(quantity - reserved_quantity)` de `stock_quant` en ubicaciones `internal` | 2 | El stock se registra por variante, ubicación, lote y paquete. Se suma lo no reservado de todas las ubicaciones internas de todas las compañías (O-6). Hecho crudo (DEC-28): en un producto con lista es el stock físico, no el producible |
| producto | sku | `product_product.default_code` | 1 | — |
| producto | activo | `product_product.active AND product_template.active` | 2 | Hay archivado en dos niveles; no se usa `sale_ok` ni `is_published` (O-7) |
| insumo | id | `product_product.id` de los componentes | 2 | Los componentes son productos. Regla de pertenencia (O-3) |
| insumo | nombre | igual que `producto.nombre` | 2, 3 | — |
| insumo | stockDisponible | igual que `producto.stockDisponible` | 2 | En la unidad del producto (`product_template.uom_id`) |
| insumo | unidadMedida | `uom_uom.name->>'en_US'` por `product_template.uom_id` | 1 | Catálogo de unidades |
| insumo | codigo | `product_product.default_code` | 1 | Es el mismo campo que `sku`: Odoo no distingue un código interno de insumo |
| receta_componente | productoId | variante + lista elegida por `_bom_find` | 2 | La lista está a nivel de plantilla y se expande a cada variante. Si hay varias listas, se elige una (O-4) |
| receta_componente | insumoId | `mrp_bom_line.product_id` | 1 | La línea apunta a la variante del componente |
| receta_componente | cantidadPorUnidad | `(línea en unidad del componente) / (cabecera en unidad del producto)` | 2 | División por la cantidad de la cabecera y conversión de unidades; kit y fabricar incluidos; varias líneas del mismo componente se suman (O-4, O-5) |
| pedido | id | `sale_order.id` | 1 | — |
| pedido | fechaCreacion | `date_order AT TIME ZONE 'UTC'` | 1 | `date_order`, no `create_date`. Odoo la guarda en UTC como `timestamp without time zone`: la vista la expone como `timestamptz` (O-9) |
| pedido | estado | `CASE state WHEN 'cancel' THEN 'cancelado' ELSE state END` | 1 | DEC-39 propuesta. Se excluyen los presupuestos (O-8) |
| pedido | total | `sale_order.amount_total` | 1 | Con impuestos (O-10) |
| pedido | numero | `sale_order.name` (`S00004`) | 1 | — |
| pedido | moneda | `res_currency.name` por `currency_id` | 1 | Catálogo de monedas |
| item_pedido | id | `sale_order_line.id` | 1 | Se excluyen secciones y notas (`display_type` no nulo) |
| item_pedido | pedidoId | `sale_order_line.order_id` | 1 | — |
| item_pedido | productoId | `sale_order_line.product_id` | 1 | Variante, el mismo nivel que `v_producto.id` |
| item_pedido | cantidad | `sale_order_line.product_uom_qty` | 1 | En la unidad de la línea, sin convertir (O-11) |
| item_pedido | precioUnitario | `sale_order_line.price_reduce_taxinc` | 1 | Con impuestos y neto de descuento (O-10) |

Ningún atributo del contrato quedó en clase 4. Ninguna vista expone columnas de clientes (DEC-23): `sale_order.partner_id`, `partner_invoice_id` y `partner_shipping_id` no se leen.

### 3.3 Decisiones de significado (propuestas, sin aplicar)

Se registran acá como **propuestas**, igual que DEC-39 a DEC-44 en el P12. No se escribieron en `docs/01-decisiones.md` ni en el código: las decide el autor. Se numeran O-1 a O-11 para no ocupar números DEC.

- **O-1 — Nivel del producto: la variante (`product_product`).** Es la decisión de nivel, como DEC-27 en Medusa y DEC-38 en Saleor. Odoo separa la plantilla (`product_template`: nombre, tipo, unidad, lista de precios) de la variante (`product_product`). Se elige la variante por tres razones:
  - el stock (`stock_quant.product_id`) es por variante;
  - la línea de pedido (`sale_order_line.product_id`) apunta a la variante;
  - el componente de una lista (`mrp_bom_line.product_id`) también.

  Con la plantilla, el stock de una plantilla con variantes habría que sumarlo, y el ranking agruparía variantes distintas.
- **O-2 — Nombre.** El nombre de la plantilla en `en_US` y, si la variante tiene valores de atributo, esos valores entre paréntesis, ordenados por el id del valor de plantilla. No reproduce exactamente el `display_name` de Odoo, que agrega `[default_code]` y ordena por la secuencia del atributo. Los productos con lista no tienen atributos, así que esto solo afecta a nombres del ranking (por ejemplo, `Customizable Desk (Steel, White)`).
- **O-3 — Qué es un insumo.** Toda variante que figura como componente en alguna línea de una lista activa de tipo `normal` o `phantom`, sea o no la lista elegida para su producto. Salen 13 insumos. Un producto puede ser a la vez producto e insumo: Table Top y Wood Panel son componentes y también tienen lista. Aparece en `v_producto` y en `v_insumo` con el mismo id.
- **O-4 — Receta.**
  - **Lista a nivel de plantilla.** Si `mrp_bom.product_id` es nulo, la lista vale para todas las variantes de la plantilla. Se expande a cada variante y se descartan las líneas restringidas a valores de atributo que la variante no tiene, como hace `mrp.bom.line._skip_bom_line`. En los datos, las 8 listas son de plantilla, cada plantilla con lista tiene una sola variante y ninguna línea tiene restricción de atributos: la regla no se ejercita.
  - **Varias listas por producto.** Se toma la que elige `mrp.bom._bom_find`: activa, específica de la variante o de su plantilla, en orden `sequence, product_id, id`. Con la misma secuencia va primero la específica de la variante, porque los nulos quedan al final. Solo Drawer (plantilla 24) tiene dos listas, la 7 (secuencia 1) y la 8 (secuencia 2), con las mismas líneas: se toma la 7.
  - **Productos de tipo servicio.** Se excluyen, como en `_bom_find`.
  - **Mismo componente en varias líneas.** Si aparece en varias líneas de la lista elegida, las cantidades se suman.
- **O-5 — Kit y fabricar.** Entran los dos tipos. Las dos listas definen una composición.
  - En un kit (`phantom`), Odoo calcula la disponibilidad desde los componentes, que es exactamente lo que hace la consulta canónica.
  - En una lista de fabricar, la consulta calcula cuántas unidades se podrían fabricar con el stock de los componentes, sin considerar el stock ya fabricado del propio producto (DEC-28 y DEC-36).
  - **Límite del artefacto:** la consulta explota un solo nivel. Table → Table Top → Wood Panel → Ply Layer es una cadena de tres niveles. Para Table, el stock de Table Top es su stock físico, no lo que se podría fabricar a partir de sus componentes. Tampoco se explotan los kits anidados. No se amplía el motor (regla 6).
- **O-5b — Cabecera y unidades.** `cantidadPorUnidad = (línea.product_qty × factor(unidad de la línea) / factor(unidad del componente)) / (cabecera.product_qty × factor(unidad de la cabecera) / factor(unidad del producto))`. Es la conversión de `uom.uom._compute_quantity` de Odoo 19 (`qty × factor_origen / factor_destino`), **sin redondeo**. Odoo redondea a la precisión de la unidad; la consulta, no. En los datos, todas las cabeceras tienen `product_qty = 1` y todas las unidades son `Units`: ni la división ni la conversión se ejercitan.
- **O-6 — Stock disponible.** `SUM(quantity − reserved_quantity)` en `stock_location.usage = 'internal'`, **de todas las compañías** y de todas las ubicaciones internas, incluidas las archivadas. La demo tiene dos almacenes, `YourCompany` (compañía 1) y `My Company (Chicago)` (compañía 3). Alternativa: filtrar por compañía o por almacén, que es la misma pregunta abierta de DEC-37.
- **O-7 — Activo.** `product_product.active AND product_template.active`.
  - Odoo tiene un mecanismo de archivado propio, en los dos niveles.
  - `sale_ok` y `is_published` son atributos del canal de venta y no dicen si el producto está discontinuado. En Saleor se usó la publicación (DEC-38) porque no había un campo "activo".
  - Efecto de la alternativa: con `is_published`, de los 7 productos con lista solo quedarían Desk Combination y Drawer.
- **O-8 — Qué es un pedido realizado.** `state NOT IN ('draft', 'sent')`: los presupuestos, borrador o enviado, no son pedidos. Odoo 19 no tiene estado `done`; el bloqueo es el booleano `locked`. Queda `sale` y `cancel`.
  - **Ambigüedad:** un presupuesto cancelado sin haberse confirmado también queda en `cancel`, y la base no conserva si llegó a confirmarse. Cuenta en C3 como `cancelado`. No aparece en los datos.
- **O-9 — Fecha.** `date_order` y no `create_date`.
  - `date_order` es la fecha del pedido que muestra Odoo y la que usa su análisis de ventas. Al confirmar, Odoo la actualiza a la fecha de confirmación.
  - La elección importa: 13 de los 29 pedidos `sale` tienen `date_order` en un día distinto de `create_date`. Todos se crearon al instalar la demo, así que con `create_date` todos caerían el 2026-09-26.
  - **Tipo:** `timestamp without time zone` en UTC, que es la convención de Odoo. La vista expone `date_order AT TIME ZONE 'UTC'`, es decir `timestamptz`, como propone DEC-44 en el P12.
  - **Límite de los datos:** ningún pedido cae entre las 00:00 y las 03:00 UTC, así que la conversión no cambia el día de ningún pedido.
- **O-10 — Moneda y montos.** `total = amount_total` y `precioUnitario = price_reduce_taxinc`, los dos con impuestos. El precio es además neto de descuento, como en Saleor. La moneda sale de `sale_order.currency_id`.
  - **Límite de los datos:** `amount_tax = 0` en los 40 pedidos y `price_reduce_taxinc = price_unit` en todas las líneas (sin impuestos ni descuentos), así que esta decisión no se ejercita.
- **O-11 — Cantidad de la línea.** `product_uom_qty`, en la unidad de la línea, sin convertir a la unidad del producto. En los datos no hay ninguna línea con una unidad distinta de la del producto.

---

## 4. Stock producible

### 4.1 Ejecución

Scripts: `scripts/p3_stock.sh` y `scripts/p3_comparar.sh`. Hay dos sesiones:

- **Sesión A** (`odoo`, `REPEATABLE READ READ ONLY`): cálculo manual y canónica en la misma instantánea.
- **Sesión B** (`zd_odoo_lectura`): la canónica, con el texto sin modificar.

Las dos terminaron con `exit=0` entre 13:29:10 y 13:29:11.

Salida de la canónica con el rol de solo lectura (`salidas/p3_stock/B/canonica.txt`; campos `id|nombre|stock_producible|insumo_limitante|stock_insumo_limitante`):

```
63|Plastic Laminate|0|Ply Veneer|0
54|Table|0|Screw|0
8|Desk Combination|0|Corner Desk Left Sit|0.00
64|Table Kit|0|Bolt|0
62|Wood Panel|6|Ply Layer|20.00
55|Table Top|24|Wood Panel|48.00
39|Drawer|45|Drawer Case Black|45.00
```

### 4.2 Cálculo manual

`sql/manual/m_stock_producible.sql` está escrita a mano sobre `product_product`, `product_template`, `mrp_bom`, `mrp_bom_line`, `stock_quant`, `stock_location` y `uom_uom`, sin vistas. Devuelve una fila por par (producto, componente) con su cociente. El mínimo y el insumo limitante se calculan con `awk`, no con `ARRAY_AGG`. Si dos componentes empatan en el mínimo, se listan todos.

La consulta manual replica las decisiones de significado de las vistas: verifica la composición vista + consulta canónica, no esas decisiones. Difiere en dos formulaciones:

- elige la lista con `DISTINCT ON` en lugar de una subconsulta `LIMIT 1`;
- descarta toda línea con restricción de atributos, en lugar de evaluar la restricción. No hay ninguna en los datos.

| Producto | Componentes (disponible / cantidad por unidad = cociente) | Mínimo | Limitante(s) |
|---|---|---|---|
| 8 Desk Combination | Corner Desk Left Sit 0/1 = 0; Drawer Black (id 33) 0/1 = 0; Office Chair Black 7/1 = 7 | 0 | **empate**: Corner Desk Left Sit / Drawer Black |
| 39 Drawer | Drawer Black (id 65) 45/1; Drawer Case Black 45/1 | 45 | **empate**: Drawer Black / Drawer Case Black |
| 54 Table | Table Leg 0/4; Bolt 0/4; Screw 0/10; Table Top 5/1 | 0 | **empate**: Table Leg / Bolt / Screw |
| 55 Table Top | Wood Panel 48/2 = 24 | 24 | Wood Panel |
| 62 Wood Panel | Ply Layer 20/3 = 6,67; Wear Layer 30/1 | 6 | Ply Layer |
| 63 Plastic Laminate | Ply Veneer 0/1 | 0 | Ply Veneer |
| 64 Table Kit | Bolt 0/4; Wood Panel 48/1 | 0 | Bolt |

Comparación sobre `(producto, stock_producible, insumo_limitante)` (`salidas/p3_comparacion.md`):

| Comparación | Filas izq. | Filas der. | Solo izq. | Solo der. |
|---|---|---|---|---|
| manual / canónica (rol de solo lectura) | 7 | 7 | **3** | **3** |
| canónica (`odoo`) / canónica (rol de solo lectura) | 7 | 7 | 0 | 0 |

Las 3 filas de cada lado son los tres empates:

- el manual lista el conjunto empatado (`Drawer Black / Drawer Case Black`, `Table Leg / Bolt / Screw`, `Corner Desk Left Sit / Drawer Black`);
- la canónica devuelve un elemento de ese conjunto (`Drawer Case Black`, `Screw`, `Corner Desk Left Sit`).

Resultado por componente de la tupla:

- **Stock producible:** coincide en las 7 filas.
- **Insumo limitante:** con una comparación que acepta cualquier miembro del conjunto empatado (no preregistrada, desvío D-1), coinciden 7 de 7.

### 4.3 Datos no representativos

- **Cantidades por unidad:** no son todas 1. Hay líneas con 2 (Wood Panel en Table Top), 3 (Ply Layer), 4 (Table Leg, Bolt) y 10 (Screw). La aritmética proporcional se ejercita.
- **Insumos compartidos:** hay dos, Bolt (Table y Table Kit) y Wood Panel (Table Top y Table Kit).
- **No se ejercitan:**
  - cabeceras con `product_qty ≠ 1` y unidades distintas de `Units` (O-5b);
  - listas por variante y líneas con atributos (O-4);
  - componentes con varias variantes.
- **Existencias en cero:** muchos insumos tienen stock 0 (Table Leg, Bolt, Screw, Ply Veneer, Drawer Black id 33). Esto produce mínimos en 0 y los empates de 4.2.
- **Nombres repetidos:** hay dos productos distintos llamados "Drawer Black" (ids 33 y 65, plantillas 19 y 47). La consulta canónica devuelve el nombre del insumo limitante, no su id: en la salida no se distinguen.

### 4.4 Modificación controlada

Valores fijados por la regla 4.1 del preregistro y commiteados antes de ejecutar (`ESPERADO_P3_4.md`, estado leído en `salidas/p3_4_estado_previo_output.txt` a las 13:29:41):

1. **Insumo compartido de menor id:** 57, Bolt (compartido por 54 Table y 64 Table Kit; el otro compartido es 62).
2. **Línea de menor id con Bolt:** la 6 (lista 2, Table). `product_qty` pasa de 4 a **12**.
3. **Existencia:** Bolt no tenía ningún `stock_quant` interno. Se insertó uno con `quantity = 7`, `reserved_quantity = 0`, en la ubicación 5 (`lot_stock_id` del almacén 1), compañía 1.

Ejecución (`scripts/p3_4_modificacion.sh`, `salidas/p3_4_modificacion_output.txt`, de 13:30:27 a 13:30:28, `exit=0`):

- una sola transacción, `BEGIN ... ROLLBACK`, con una guarda que aborta si el `UPDATE` o el `INSERT` no aplicaron. La guarda devolvió `ok`;
- la canónica corrió dentro con `SET ROLE zd_odoo_lectura`. Así se ejecuta con los privilegios del rol de solo lectura y ve los cambios no confirmados (desvío D-2).

| Producto | Esperado (escrito antes) | Canónica después | Coincide |
|---|---|---|---|
| 54 Table | 0; limitante en el empate {Table Leg, Screw}; Bolt 7/12 = 0,58 deja de empatar | `0 / Table Leg` | sí |
| 64 Table Kit | 1 (`FLOOR(7/4 = 1,75)`), Bolt, `stock_insumo_limitante = 7` | `1 / Bolt / 7` | sí |
| 8, 55, 62, 63 | sin cambios | sin cambios | sí |
| 39 Drawer | sin cambios | stock 45 sin cambios; **limitante `Drawer Case Black` → `Drawer Black`** | stock sí; limitante cambió dentro del empate |

Comparación del estado modificado contra el cálculo manual dentro de la misma transacción (`salidas/p3_4_comparacion.md`):

- **Stock producible:** 7 de 7.
- **Diferencia literal:** 3/3, otra vez solo empates.
- **Con empates:** 7 de 7.

Las salidas crudas están en `salidas/p3_4_stock/` (`antes_canonica.txt`, `despues_canonica.txt` y `despues_manual_filas.txt`).

### 4.5 El insumo limitante con empates no está determinado

La canónica elige el insumo limitante con `(ARRAY_AGG(ins.nombre ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1]`, sin desempate. Con dos cocientes iguales, el primero depende del orden en que el plan entrega las filas.

Evidencia: en Drawer los datos no cambiaron (su lista, sus componentes y sus existencias quedaron iguales), y la canónica devolvió `Drawer Case Black` antes y `Drawer Black` después de la modificación, en la misma transacción. El resultado es igualmente correcto en los dos casos, porque los dos son mínimos, pero **no es reproducible**.

No es un defecto del mapeo de Odoo: está en el texto de la consulta, idéntico para todos los esquemas. No se corrigió, porque la consulta no se toca. Se deja para el autor: un desempate por id (`ORDER BY cociente, ins.id`) lo haría determinista.

### 4.6 Reversión

Verificación desde una sesión nueva (`salidas/p3_4_verificacion_output.txt`, 13:30:28):

- la línea 6 volvió a `product_qty = 4.00`;
- Bolt tiene 0 quants internos;
- `stock_quant` tiene 67 filas con `max(id) = 67`, igual que antes de la modificación;
- la canónica, con `SET ROLE zd_odoo_lectura`, es **byte a byte idéntica** a la de antes de la modificación y a la de la corrida 4.1 (sesión B), según `cmp`.

---

## 5. Reporte diario

### 5.1 Ejecución

Scripts: `scripts/p4_reporte.sh` y `scripts/p4_comparar.sh`. Las sesiones son las mismas que en stock:

- **A** (`odoo`, `REPEATABLE READ READ ONLY`): manuales y canónicas;
- **B** (`zd_odoo_lectura`): canónicas.

Corrida de 13:31:50 a 13:31:57, `exit=0` en las dos. Días evaluados:

- los 13 días con pedidos en `v_pedido`, zona `America/Argentina/Buenos_Aires`;
- el día vacío **2026-08-21**, el anterior al primero con pedidos. Un conteo sobre `v_pedido` confirmó 0 pedidos (`salidas/p4_dias_output.txt`).

C1 y C3 de la canónica con el rol de solo lectura:

| Día | C1 (pedidos, facturación, ticket) | C3 |
|---|---|---|
| 2026-08-21 (vacío) | 0, 0, 0 | sin filas |
| 2026-08-22 | 1, 831.00, 831.00 | sale 1 |
| 2026-08-26 | 2, 6545.50, 3272.75 | sale 2 |
| 2026-08-29 | 1, 951.00, 951.00 | sale 1 |
| 2026-09-05 | 1, 1096.50, 1096.50 | sale 1 |
| 2026-09-12 | 1, 1541.50, 1541.50 | sale 1 |
| 2026-09-19 | 2, 1253.00, 626.50 | sale 2 |
| 2026-09-20 | 1, 900.00, 900.00 | sale 1 |
| 2026-09-21 | 1, 750.00, 750.00 | sale 1 |
| 2026-09-22 | 1, 1199.00, 1199.00 | sale 1 |
| 2026-09-23 | 1, 1047.00, 1047.00 | sale 1 |
| 2026-09-24 | 1, 1599.00, 1599.00 | sale 1 |
| 2026-09-25 | 1, 1349.00, 1349.00 | sale 1 |
| 2026-09-26 | 15, 21463.00, 1430.87 | sale 15 |

C2 devolvió 33 filas en total entre los 14 días, con 13 productos el 2026-09-26. Las salidas por día y consulta están en `salidas/p4_reporte/{A,B}/`, incluida `c2_ranking_top5`, que es informativa.

### 5.2 Cálculo manual

`sql/manual/m1_ventas.sql`, `m2_ranking.sql` y `m3_estados.sql`, sobre `sale_order` y `sale_order_line`, más `product_*` para el nombre. No usan vistas y difieren de ellas en la formulación del rango de fechas: convierten los **límites** a UTC (`:'desde'::timestamptz AT TIME ZONE 'UTC'`) en lugar de convertir la columna. Replican las mismas decisiones de significado.

Comparación (`salidas/p4_comparacion.md`): en los **14 días × 3 bloques**, la diferencia simétrica manual/canónica (B) es **0/0** en todos, y la canónica A es idéntica a la B en todos. Tuplas comparadas:

- C1: `(cantidad_pedidos, facturacion_total, ticket_promedio)`;
- C2: `(productoId, nombre, unidades_vendidas, total_generado)`;
- C3: `(estado, cantidad)`.

Los montos se comparan a 3 decimales.

### 5.3 Modificación controlada

Aplicación de la regla 4.2 (`scripts/p4_3_modificacion.sh`, de 13:33:42 a 13:33:43, `exit=0`):

- **Día:** el de más pedidos no cancelados, **2026-09-26** (15).
- **Pedido:** el de menor id no cancelado, **id 4, `S00004`**, estado `sale`, `amount_total` 2240.00 USD.
- **Líneas del pedido (`producto|cantidad|precioUnitario`):** `3|16|75`, `6|10|45`, `41|3|150`, `5|2|70`.
- **Ejecución:** `UPDATE sale_order SET state = 'cancel'` dentro de una transacción terminada en `ROLLBACK`, con una guarda (`ok`). Las canónicas corrieron antes y después sobre los 14 días, dentro de la transacción, con `SET ROLE zd_odoo_lectura`.

Efectos esperados, calculados con `scripts/p4_3_esperado.sh` desde la salida "antes", el pedido y sus líneas, contra la salida "después" (`salidas/p4_3_comparacion.md`):

| Bloque (2026-09-26) | Filas esperadas | Filas después | Solo esperado | Solo después |
|---|---|---|---|---|
| ventas | 1 | 1 | 0 | 0 |
| ranking | 11 | 11 | 0 | 0 |
| estados | 2 | 2 | 0 | 0 |

- **C1:** de `15 | 21463.00 | 1430.87` a `14 | 19223.00 | 1373.07` (21463 − 2240 = 19223; 19223 / 14 = 1373.07).
- **C2:**
  - salen Virtual Interior Design (16 unidades, 1200) y Large Meeting Table (3, 450);
  - Office Chair pasa de 3 / 158 a 1 / 18;
  - Office Lamp pasa de 11 / 490 a 1 / 40;
  - el resto no cambia.
- **C3:** de `sale 15` a `sale 14` y `cancelado 1`.
- **Demás días:** 39 salidas, todas idénticas antes y después.

**Reversión.** Desde una sesión nueva (`salidas/p4_3_verificacion_output.txt`, 13:33:43):

- `sale_order` volvió a `draft 9`, `sale 29`, `sent 2`;
- las 42 salidas canónicas (14 días × 3) son idénticas a las de "antes" y a las de la corrida 5.1 (sesión B): 0 distintas en cada comparación.

### 5.4 Monedas

Una sola moneda, **USD**, en cada uno de los 13 días con pedidos (`count(DISTINCT moneda) = 1`; `salidas/p4_dias_output.txt`). Los 40 pedidos de la base, incluidos los presupuestos, son en USD.

### 5.5 Qué no ejercitan los datos

- No hay ningún pedido cancelado de origen: el estado `cancelado` solo aparece en la modificación controlada.
- No hay impuestos ni descuentos (O-10).
- Ningún pedido cae en la franja en que la conversión de zona cambia el día (O-9).
- Hay una sola moneda.
- No hay líneas con una unidad distinta de la del producto (O-11).

Sí se ejercita la elección `date_order` contra `create_date` (O-9). También se ejercita la mezcla de productos de servicio (Virtual Interior Design, Virtual Home Staging) con productos físicos en el ranking: C2 los incluye porque la consulta no filtra por tipo.

---

## 6. Obligatoriedad

Atributos del contrato que cada consulta lee efectivamente, contra `src/contrato.ts`. No se corrigió `contrato.ts`.

| Consulta | Atributos leídos |
|---|---|
| Stock producible (`04_consulta_canonica.sql`) | `producto.id`, `producto.nombre`, `producto.activo`; `receta_componente.productoId`, `insumoId`, `cantidadPorUnidad`; `insumo.id`, `insumo.nombre`, `insumo.stockDisponible` |
| C1 | `pedido.estado`, `pedido.fechaCreacion`, `pedido.total` |
| C2 | `item_pedido.productoId`, `pedidoId`, `cantidad`, `precioUnitario`; `pedido.id`, `estado`, `fechaCreacion`; `producto.id`, `producto.nombre` |
| C3 | `pedido.estado`, `pedido.fechaCreacion` |

**Leídos pero opcionales en el contrato:**

- `item_pedido.precioUnitario` (opcional), leído por C2 en `SUM(i.cantidad * i."precioUnitario")`. Si una vista lo dejara en `NULL`, C2 correría sin error y `total_generado` saldría 0 por el `COALESCE`: un resultado incorrecto y silencioso. Es la misma situación que DEC-36 resolvió para `producto.activo`.

**Declarados pero no leídos por las consultas de su automatización:**

| Entidad.atributo | Obligatoriedad | Automatizaciones declaradas | Lo lee |
|---|---|---|---|
| `producto.stockDisponible` | obligatorio | stock-fisico, reporte-diario | ninguna de C1–C3 |
| `producto.sku` | opcional | stock-fisico, reporte-diario | ninguna de C1–C3 |
| `pedido.numero` | opcional | reporte-diario | ninguna |
| `pedido.moneda` | opcional | reporte-diario | ninguna. C1 suma `total` sin mirar la moneda: con pedidos en dos monedas sumaría importes no comparables sin error. En Odoo es un solo valor por día (5.4) |
| `item_pedido.id` | obligatorio | reporte-diario | ninguna |
| `pedido.id` | obligatorio | reporte-diario | solo C2 (reunión); C1 y C3 no lo leen |
| `insumo.unidadMedida`, `insumo.codigo` | opcional | stock-producible | no los lee |

`producto.activo` (stock-fisico y stock-producible) lo lee la de stock producible, como se declara. `producto.stockDisponible` lo lee stock-fisico según el contrato, pero esa consulta no forma parte de esta evaluación.

---

## 7. Veredicto por criterio

| Criterio | Veredicto | Evidencia |
|---|---|---|
| **R1.** Alguna consulta canónica necesita editar su texto | **No se cumple** | Las cinco corrieron con el SHA-256 del preregistro, desde su ruta original, con `exit=0`: stock en 4.1 y 4.4; C1–C3 y top5 en 5.1 y 5.3. Todos los hashes están en `salidas/p*_hash.txt` |
| **R2.** El stock producible difiere del cálculo manual, o la modificación controlada no da exactamente lo esperado | **Se cumple en su lectura literal, solo por el insumo limitante** | `stock_producible` coincide en 7 de 7 en la corrida base y en 7 de 7 dentro de la modificación. En los productos afectados por la modificación, stock y limitante dieron exactamente lo esperado (Table Kit `1/Bolt/7`; Table 0 con limitante dentro del empate previsto). La diferencia simétrica literal de la tupla preregistrada, en cambio, es **3/3**, y en Drawer, que no fue modificado, el limitante cambió dentro de su empate. La causa es la falta de desempate en `ARRAY_AGG` de la consulta canónica (4.5), no el mapeo. Ninguna diferencia es un stock distinto ni un limitante fuera del conjunto de mínimos |
| **R3.** Algún resultado del reporte diario difiere del cálculo manual, o la modificación no da los efectos esperados | **No se cumple** | 14 días × 3 bloques con diferencia simétrica 0/0. La modificación da 0/0 contra lo esperado en los tres bloques y 39 de 39 salidas de otros días sin cambio. Tras la reversión, 42 de 42 salidas son idénticas |

Ningún atributo quedó en clase 4, por lo que no hay inaplicabilidad que reportar.

---

## 8. Desvíos del preregistro e incidentes

**Desvíos.**

- **D-1 — Comparación con empates.** El preregistro compara la tupla `(producto, stock_producible, insumo_limitante)` sin prever empates. Se reporta la comparación literal, que da 3/3, y además una comparación que acepta cualquier miembro del conjunto empatado, que da 7/7. Esta segunda **no estaba preregistrada**. El veredicto de R2 usa la literal.
- **D-2 — Canónica dentro de la transacción con `SET ROLE`.** En las dos modificaciones controladas, la canónica corrió dentro de la transacción de escritura del superusuario `odoo`, con `SET ROLE zd_odoo_lectura`, y no en una sesión aparte del rol de solo lectura. Una sesión aparte no vería los cambios no confirmados. `SELECT current_user` dentro de la transacción devolvió `zd_odoo_lectura`.
- **D-3 — Rol de las consultas manuales.** Las consultas manuales corrieron con `odoo`, porque el rol de solo lectura no puede leer tablas base, por diseño. Las canónicas corrieron con los dos roles, con salidas idénticas.
- **D-4 — La regla fija eligió un producto con el mínimo en otro componente.** La regla 4.1 eligió la línea de Table, donde el mínimo sigue en 0 por Table Leg y Screw. Se reporta tal cual, sin elegir otra línea. El efecto proporcional se ve en Table Kit.
- **D-5 — Día vacío.** Es el que fija la regla: 2026-08-21. No hubo que retroceder.
- **D-6 — Lectura de filas después del paso 1.** Antes de escribir las vistas se leyeron filas de `mrp_bom`, `mrp_bom_line`, `uom_uom`, `stock_location` y de las líneas de pedido, en forma agregada: `salidas/p2_exploracion*_output.txt`, a las 13:26:30 y 13:26:51. Fue después del commit del preregistro y del paso 1, así que no contradice el preregistro, pero las vistas se escribieron conociendo esos datos.

**Incidentes.**

- **I-1 — Contraseñas en una salida.** `psql -e` imprimió las contraseñas de los dos roles en `salidas/p2_roles_output.txt`. Se reemplazaron por `<redactada>` antes del primer commit que incluye el archivo. Se verificó con `git grep` que no aparecen en ningún commit ni archivo de `experimentos/odoo` (fuera de `.env`, que no se versiona).
- **I-2 — `CREATE` sobre `public` para cualquier rol.** El primer control (`salidas/p2_controles_output.txt`, 13:28:05) mostró que `zd_odoo_lectura` **podía crear una tabla** (`CREATE TABLE zd_prueba` → `CREATE TABLE`). La base que crea Odoo deja `=UC/pg_database_owner` sobre `public`: `PUBLIC` tiene `CREATE`. Corrección (`salidas/p2_correccion_i2_output.txt`, 13:28:24):
  - se borró `zd_prueba`;
  - se ejecutó `REVOKE CREATE ON SCHEMA public FROM PUBLIC`;
  - queda `has_schema_privilege('zd_odoo_lectura','public','CREATE') = f`. El creador y `odoo` conservan `CREATE`.

  Los controles repetidos (`p2_controles_2_output.txt`, 13:28:25) dan `permission denied for schema public`. Es un cambio de privilegios de la base, no del código de Odoo. **Consecuencia para el procedimiento de alta (6.7.1):** en Odoo no alcanza con no otorgar `CREATE`; hay que revocarlo de `PUBLIC`.
- **I-3 — Líneas ajenas en una salida.** En `salidas/p3_4_stock/despues_manual.txt` quedaron dos líneas ajenas (`SET` y `zd_odoo_lectura`), porque el `\o` seguía abierto al cambiar de rol. Se filtraron a `despues_manual_filas.txt`, las filas de 6 campos. No afecta a los valores.
- **I-4 — Script de comparación reescrito.** El primer intento de agregar la comparación con empates a `scripts/p3_comparar.sh` dejó un `awk` roto: no produjo resultados y se reescribió el script. No hay datos afectados.
- **I-5 — Log de instalación ignorado.** `salidas/p0_instalacion.log` coincide con `*.log` del `.gitignore`. Se agregó con `git add -f` para conservar la evidencia de la instalación.

---

## 9. Fechas y horas de las ejecuciones

Todas el 2026-09-26, hora de Buenos Aires (-03:00). Las horas de servidor en UTC figuran en cada salida.

| Hora | Paso | Salida |
|---|---|---|
| 13:21:00 | Commit del preregistro `385b170` | — |
| 13:23:26 – 13:26:02 | Instalación de Odoo con datos de demostración | `p0_instalacion.log` |
| 13:26:07 | Paso 1: catálogo y conteos | `p1_aplicabilidad_output.txt` |
| 13:26:30, 13:26:51 | Exploración previa a las vistas (D-6) | `p2_exploracion_output.txt`, `p2_exploracion2_output.txt` |
| 13:28:02 – 13:28:03 | Roles | `p2_roles_output.txt` |
| 13:28:03 – 13:28:04 | Creación de vistas | `p2_vistas_output.txt` |
| 13:28:04 | `GRANT` al rol de solo lectura | `p2_grant_output.txt` |
| 13:28:05 | Controles de acceso (I-2) | `p2_controles_output.txt` |
| 13:28:24 – 13:28:25 | Corrección de I-2 y controles repetidos | `p2_correccion_i2_output.txt`, `p2_controles_2_output.txt` |
| 13:29:10 – 13:29:11 | Stock producible: canónica y manual | `p3_stock_A_output.txt`, `p3_stock_B_output.txt` |
| 13:29:41 | Estado previo de la modificación de stock | `p3_4_estado_previo_output.txt` |
| 13:30:04 | Commit de lo esperado `b163bc8` | `ESPERADO_P3_4.md` |
| 13:30:27 – 13:30:28 | Modificación controlada de stock y verificación | `p3_4_modificacion_output.txt`, `p3_4_verificacion_output.txt` |
| 13:31:50 – 13:31:57 | Reporte diario: días, canónicas y manuales | `p4_dias_output.txt`, `p4_reporte_A_output.txt`, `p4_reporte_B_output.txt` |
| 13:33:42 – 13:33:43 | Modificación controlada del reporte y verificación | `p4_3_modificacion_output.txt`, `p4_3_verificacion_output.txt` |

El texto exacto de cada consulta ejecutada está en los archivos `*_input.sql` de `experimentos/odoo/salidas/`. Las consultas canónicas se leyeron con `\i` desde copias verificadas por hash.

### Commits de la rama `experimento/odoo`

| Commit | Fecha | Contenido |
|---|---|---|
| `385b170469328118ef8743f7393551d701f66650` | 2026-09-26 13:21:00 -03:00 | Preregistro |
| `b163bc8462b40c08ebc95bd845f857920fdbe856` | 2026-09-26 13:30:04 -03:00 | Instancia, vistas, stock producible y esperado de la modificación controlada |
| `2c1ee7cc5dcc414d2e366f8fca6a15859f1e9346` | 2026-09-26 13:38:07 -03:00 | Reporte diario, modificaciones controladas y bitácora (commit final del experimento) |

Esta tabla se agregó en un commit posterior, que solo modifica esta sección. Un commit no puede contener su propio hash.
