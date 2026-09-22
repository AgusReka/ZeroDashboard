-- Réplica mínima del almacenamiento de productos de WooCommerce.
-- WooCommerce guarda productos como custom post type de WordPress:
-- wp_posts (post_type='product' | 'product_variation') + wp_postmeta
-- con los atributos como pares clave-valor (_sku, _stock, _price...).
DROP SCHEMA IF EXISTS woo CASCADE;
CREATE SCHEMA woo;
SET search_path TO woo;

CREATE TABLE wp_posts (
  ID bigint PRIMARY KEY, post_title text, post_type text,
  post_status text, post_parent bigint, post_date timestamptz
);
CREATE TABLE wp_postmeta (
  meta_id bigserial PRIMARY KEY, post_id bigint, meta_key text, meta_value text
);

INSERT INTO wp_posts VALUES
 (10,'Café en grano 1kg','product','publish',0,now()),
 (11,'Taza cerámica','product','publish',0,now()),
 (12,'Molinillo manual','product','publish',0,now());

-- Los atributos viven como filas, no como columnas
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES
 (10,'_sku','CAF-1KG'), (10,'_stock','18'), (10,'_stock_status','instock'), (10,'_price','12500'),
 (11,'_sku','TAZ-CER'), (11,'_stock','4'),  (11,'_stock_status','instock'), (11,'_price','4800'),
 (12,'_sku','MOL-MAN'), (12,'_stock','0'),  (12,'_stock_status','outofstock'),(12,'_price','21000');
