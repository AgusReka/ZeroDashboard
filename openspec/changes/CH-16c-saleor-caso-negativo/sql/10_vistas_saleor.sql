-- 08_vistas_saleor.sql
-- Capa de correspondencias sobre Saleor. Crear con un rol que tenga CREATE sobre el esquema
-- (el mismo requisito de dos actores de la sección 6.7.1).
--
-- Se crea SOLO v_producto. v_insumo y v_receta_componente NO se crean: el paso 07 debe mostrar
-- que no hay de dónde derivarlas. Esa ausencia, y no un error de ejecución, es la evidencia.
--
-- DECISIONES QUE ESTE ARCHIVO APLICA (confirmadas por el autor el 24/09/2026):
-- (1) sigue a DEC-27; (2) es DEC-37; (3) es DEC-38. Registrarlas en docs/01-decisiones.md antes de crear la vista.
--
--   (1) Granularidad: una fila por variante (igual que DEC-27 en Medusa).
--
--   (2) Agregación de stock entre depósitos: Saleor registra el stock por variante Y depósito.
--       Acá se suma sobre todos los depósitos y se resta lo ya asignado a pedidos.
--       Alternativas: sumar sin restar lo asignado; tomar un solo depósito; filtrar por canal.
--       Es la misma pregunta que quedó abierta para insumo.stockDisponible en Medusa.
--
--   (3) producto.activo: Saleor no tiene un campo "activo" en la variante ni en el producto;
--       la publicación depende del canal (product_productchannellisting.is_published).
--       Acá se toma "publicado en al menos un canal". Es una decisión de granularidad, no una columna.
--       IMPORTANTE: la consulta canónica filtra WHERE pr.activo = true. Si activo quedara NULL,
--       la consulta devolvería cero filas SIN ERROR (ver nota en PROTOCOLO_Saleor.md).

CREATE OR REPLACE VIEW v_producto AS
SELECT
    pv.id::text                                            AS id,
    CASE WHEN pv.name IS NULL OR pv.name = '' THEN p.name
         ELSE p.name || ' - ' || pv.name END               AS nombre,
    COALESCE(SUM(s.quantity - s.quantity_allocated), 0)    AS "stockDisponible",
    pv.sku                                                 AS sku,
    EXISTS (
        SELECT 1 FROM product_productchannellisting pcl
        WHERE pcl.product_id = p.id AND pcl.is_published
    )                                                      AS activo
FROM product_productvariant pv
JOIN product_product p ON p.id = pv.product_id
LEFT JOIN warehouse_stock s ON s.product_variant_id = pv.id
GROUP BY pv.id, pv.name, pv.sku, p.id, p.name;

-- Verificación mínima de la vista (guardar la salida):
SELECT count(*) AS filas_v_producto,
       count(*) FILTER (WHERE activo) AS activas,
       count(sku) AS con_sku
FROM v_producto;
SELECT * FROM v_producto ORDER BY nombre LIMIT 10;

-- Permiso de lectura para el rol de operación (reemplazar el nombre del rol):
-- GRANT SELECT ON v_producto TO <rol_solo_lectura>;
