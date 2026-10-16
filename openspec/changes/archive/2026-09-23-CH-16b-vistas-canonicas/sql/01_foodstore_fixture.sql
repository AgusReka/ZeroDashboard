-- ============================================================
-- Fixture de prueba: réplica mínima del esquema de Food Store
-- NO son datos de la tesis. Es un fixture para verificar que las
-- vistas canónicas y la consulta canónica son EQUIVALENTES a la
-- consulta original de WF-01c. Los valores se eligieron para
-- reproducir la tabla de divergencia de la sección 6.2.2.
-- ============================================================
DROP SCHEMA IF EXISTS foodstore CASCADE;
CREATE SCHEMA foodstore;
SET search_path TO foodstore;

CREATE TABLE product (
  id             serial PRIMARY KEY,
  name           text NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  available      boolean NOT NULL DEFAULT true,
  deleted_at     timestamptz
);

CREATE TABLE ingredient (
  id             serial PRIMARY KEY,
  name           text NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  deleted_at     timestamptz
);

CREATE TABLE product_ingredient (
  product_id    integer NOT NULL REFERENCES product(id),
  ingredient_id integer NOT NULL REFERENCES ingredient(id),
  quantity      numeric NOT NULL,
  PRIMARY KEY (product_id, ingredient_id)
);

-- Productos sin receta (régimen de stock físico)
INSERT INTO product (name, stock_quantity) VALUES
  ('Agua Mineral 500ml', 200),
  ('Brownie', 45);

-- Productos con receta (régimen de stock producible)
-- stock_quantity son los valores residuales que el backend ignora
INSERT INTO product (name, stock_quantity) VALUES
  ('Hamburguesa BBQ Bacon', 30),
  ('Hamburguesa Picante',   20),
  ('Hamburguesa Nueva',      0),
  ('Hamburguesa Doble',     25),
  ('Hamburguesa Clasica',   50),
  ('Aros de Cebolla',       80);

INSERT INTO ingredient (name, stock_quantity) VALUES
  ('Bacon', 40), ('Jalapenos', 24), ('Queso cheddar', 31),
  ('Carne vacuna', 76), ('Tomate', 47), ('Cebolla', 67),
  ('Pan', 500);

-- Recetas. Cantidades elegidas para reproducir la tabla 6.2.2:
-- BBQ Bacon: Bacon 40/2 = 20 (limitante)
INSERT INTO product_ingredient (product_id, ingredient_id, quantity)
SELECT p.id, i.id, v.q FROM (VALUES
  ('Hamburguesa BBQ Bacon','Bacon',2),        ('Hamburguesa BBQ Bacon','Pan',1),
  ('Hamburguesa Picante','Jalapenos',1),      ('Hamburguesa Picante','Pan',1),
  ('Hamburguesa Nueva','Queso cheddar',1),    ('Hamburguesa Nueva','Pan',1),
  ('Hamburguesa Doble','Carne vacuna',2),     ('Hamburguesa Doble','Pan',1),
  ('Hamburguesa Clasica','Tomate',1),         ('Hamburguesa Clasica','Pan',1),
  ('Aros de Cebolla','Cebolla',1)
) AS v(prod, ing, q)
JOIN product p ON p.name = v.prod
JOIN ingredient i ON i.name = v.ing;
