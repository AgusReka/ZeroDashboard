-- Réplica mínima del esquema de Medusa 2.x relevante para el contrato,
-- con las características del seed oficial documentadas en CH-16:
-- 4 productos, 20 variantes, 20 inventory_item, required_quantity=1 en
-- el 100% de los vínculos, ningún inventory_item compartido,
-- unit_of_measure NULL en 20 de 20.
DROP SCHEMA IF EXISTS medusa CASCADE;
CREATE SCHEMA medusa;
SET search_path TO medusa;

CREATE TABLE product (id text PRIMARY KEY, title text, status text);
CREATE TABLE product_variant (id text PRIMARY KEY, product_id text REFERENCES product(id), title text, sku text);
CREATE TABLE inventory_item (id text PRIMARY KEY, title text, sku text, unit_of_measure text);
CREATE TABLE inventory_level (inventory_item_id text REFERENCES inventory_item(id), stocked_quantity int, reserved_quantity int);
CREATE TABLE product_variant_inventory_item (variant_id text REFERENCES product_variant(id), inventory_item_id text REFERENCES inventory_item(id), required_quantity int);

INSERT INTO product VALUES
 ('prod_1','Medusa T-Shirt','published'), ('prod_2','Medusa Sweatshirt','published'),
 ('prod_3','Medusa Sweatpants','published'), ('prod_4','Medusa Shorts','published');

-- 20 variantes: 5 talles x 4 productos
INSERT INTO product_variant
SELECT 'var_'||n, 'prod_'||(1+((n-1)/5)), t.talle, 'SKU-'||n
FROM generate_series(1,20) n
JOIN (VALUES (1,'S / White'),(2,'M / White'),(3,'L / White'),(4,'XL / White'),(5,'S / Black')) AS t(k,talle)
  ON t.k = 1+((n-1)%5);

-- 20 inventory_item, uno por variante, unit_of_measure NULL en todos
INSERT INTO inventory_item
SELECT 'ii_'||n, pv.title, 'SKU-'||n, NULL
FROM generate_series(1,20) n JOIN product_variant pv ON pv.id = 'var_'||n;

INSERT INTO inventory_level SELECT 'ii_'||n, 100 - n, 0 FROM generate_series(1,20) n;

-- Inventory Kit: required_quantity = 1 en todos, sin items compartidos
INSERT INTO product_variant_inventory_item
SELECT 'var_'||n, 'ii_'||n, 1 FROM generate_series(1,20) n;
