-- Corrida contra la base real food_store: las tablas viven en el
-- esquema "public" (único esquema no-sistema de esta base). El
-- SET search_path TO foodstore original apuntaba al fixture; se
-- quita porque "public" ya es el esquema por defecto de la conexión.
-- ============================================================
-- VISTAS CANÓNICAS sobre Food Store (el esquema de origen)
-- Contrapartida de las cinco vistas de CH-16 sobre Medusa.
--
-- Principio: las vistas exponen HECHOS CRUDOS, no cálculos.
-- stockDisponible es el stock declarado, no el producible.
-- Si la vista precalculara el producible, la divergencia
-- entre declarado y producible desaparecería de la capa
-- canónica y el hallazgo central sería inobservable.
-- ============================================================

CREATE OR REPLACE VIEW v_producto AS
SELECT
  p.id::text                AS id,
  p.name                    AS nombre,
  p.stock_quantity          AS "stockDisponible",  -- declarado, crudo
  NULL::text                AS sku,                -- SIN ORIGEN en Food Store
  p.available                AS activo
FROM product p
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_insumo AS
SELECT
  i.id::text                AS id,
  i.name                    AS nombre,
  i.stock_quantity          AS "stockDisponible",
  NULL::text                AS "unidadMedida",     -- SIN ORIGEN en Food Store
  NULL::text                AS codigo              -- SIN ORIGEN en Food Store
FROM ingredient i
WHERE i.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_receta_componente AS
SELECT
  pi.product_id::text       AS "productoId",
  pi.ingredient_id::text    AS "insumoId",
  pi.quantity               AS "cantidadPorUnidad"
FROM product_ingredient pi
JOIN product p    ON p.id = pi.product_id  AND p.deleted_at IS NULL
JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL;
