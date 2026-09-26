-- Vistas canonicas sobre Odoo Community 19.0 (base odoo, esquema public).
-- Se crean con zd_odoo_creador (actor con CREATE sobre el esquema, 6.7.1). El rol de solo lectura
-- zd_odoo_lectura recibe SELECT solo sobre estas cinco vistas.
-- Decisiones de significado: docs/bitacora/bitacora_odoo.md, seccion 3. Resumen en los comentarios.

-- Nombre visible de una variante: nombre de la plantilla (idioma en_US, el unico activo) y, si la
-- variante tiene valores de atributo, esos valores entre parentesis, ordenados por id del valor de plantilla.
-- Auxiliar: no es parte del contrato y el rol de solo lectura no recibe SELECT sobre ella.
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

-- Disponible por variante: suma de quantity - reserved_quantity en ubicaciones internas, de todas las
-- companias. Auxiliar, igual que la anterior.
CREATE VIEW zd_disponible_variante AS
SELECT q.product_id, SUM(q.quantity - q.reserved_quantity) AS disponible
FROM stock_quant q
JOIN stock_location l ON l.id = q.location_id
WHERE l.usage = 'internal'
GROUP BY q.product_id;

-- v_producto: una fila por variante (product_product), como DEC-27.
CREATE VIEW v_producto AS
SELECT pp.id::text                        AS id,
       n.nombre                           AS nombre,
       COALESCE(d.disponible, 0)          AS "stockDisponible",   -- hecho crudo (DEC-28), no producible
       pp.default_code                    AS sku,
       (pp.active AND pt.active)          AS activo               -- archivado en variante o plantilla
FROM product_product pp
JOIN product_template pt ON pt.id = pp.product_tmpl_id
JOIN zd_nombre_variante n ON n.product_id = pp.id
LEFT JOIN zd_disponible_variante d ON d.product_id = pp.id;

-- v_insumo: toda variante que figura como componente en alguna linea de una lista activa
-- (fabricar o kit). Los componentes de Odoo tambien son productos.
CREATE VIEW v_insumo AS
SELECT pp.id::text                        AS id,
       n.nombre                           AS nombre,
       COALESCE(d.disponible, 0)          AS "stockDisponible",   -- en la unidad del producto (uom_id)
       u.name->>'en_US'                   AS "unidadMedida",
       pp.default_code                    AS codigo
FROM product_product pp
JOIN product_template pt ON pt.id = pp.product_tmpl_id
JOIN uom_uom u ON u.id = pt.uom_id
JOIN zd_nombre_variante n ON n.product_id = pp.id
LEFT JOIN zd_disponible_variante d ON d.product_id = pp.id
WHERE EXISTS (SELECT 1 FROM mrp_bom_line l JOIN mrp_bom b ON b.id = l.bom_id
              WHERE l.product_id = pp.id AND b.active AND b.type IN ('normal', 'phantom'));

-- v_receta_componente: para cada variante que no es servicio, la lista que Odoo elegiria
-- (mrp.bom._bom_find: activas, especifica de la variante o de su plantilla, orden sequence, product_id, id;
-- a igual sequence, la especifica de la variante va primero). Tipos 'normal' (fabricar) y 'phantom' (kit).
-- Se descartan las lineas cuyos valores de atributo no corresponden a la variante (_skip_bom_line).
-- cantidadPorUnidad = cantidad de la linea en la unidad del componente / cantidad de la cabecera en la
-- unidad del producto (conversion de Odoo 19: qty * factor_origen / factor_destino, sin redondeo).
-- Si el mismo componente aparece en varias lineas de la lista elegida, se suman.
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
WHERE NOT EXISTS (   -- linea restringida a valores de atributo que la variante no tiene
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

-- v_pedido: pedidos confirmados y cancelados. Se excluyen los presupuestos (draft, sent).
CREATE VIEW v_pedido AS
SELECT so.id::text                               AS id,
       (so.date_order AT TIME ZONE 'UTC')        AS "fechaCreacion",  -- UTC sin zona en la base -> timestamptz
       CASE WHEN so.state = 'cancel' THEN 'cancelado'
            ELSE so.state::text END              AS estado,
       so.amount_total                           AS total,            -- con impuestos
       so.name                                   AS numero,
       c.name                                    AS moneda
FROM sale_order so
JOIN res_currency c ON c.id = so.currency_id
WHERE so.state NOT IN ('draft', 'sent');

-- v_item_pedido: lineas con producto (se excluyen secciones y notas, display_type no nulo).
CREATE VIEW v_item_pedido AS
SELECT sol.id::text                   AS id,
       sol.order_id::text             AS "pedidoId",
       sol.product_id::text           AS "productoId",   -- variante, igual que v_producto.id
       sol.product_uom_qty            AS cantidad,       -- en la unidad de la linea (product_uom_id)
       sol.price_reduce_taxinc        AS "precioUnitario" -- con impuestos, neto de descuento
FROM sale_order_line sol
WHERE sol.display_type IS NULL;
