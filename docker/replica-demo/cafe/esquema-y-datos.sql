-- CH-49 (DEC-206): the cafe_demo database, the data source of the second demo tenant. It runs
-- from 04-cafe-demo.sh on the cafe_demo database, never on food_store. The table and column
-- names differ from the canonical contract on purpose, so the mapping per client is visible:
-- the five v_* views at the end expose exactly the canonical columns. Every row comes from
-- generate_series over now() and from arithmetic on the day number: no random(), so two loads
-- of the same day give the same data.

CREATE TABLE public.items (
    id integer PRIMARY KEY,
    title text NOT NULL,
    stock_units integer NOT NULL,
    enabled boolean NOT NULL,
    deleted boolean NOT NULL
);

CREATE TABLE public.supplies (
    id integer PRIMARY KEY,
    label text NOT NULL,
    units_left numeric(10,2) NOT NULL,
    unit text NOT NULL
);

CREATE TABLE public.recipes (
    item_id integer NOT NULL REFERENCES public.items (id),
    supply_id integer NOT NULL REFERENCES public.supplies (id),
    qty numeric(10,3) NOT NULL,
    PRIMARY KEY (item_id, supply_id)
);

CREATE TABLE public.sales (
    id integer PRIMARY KEY,
    sold_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    amount numeric(10,2) NOT NULL
);

CREATE TABLE public.sale_lines (
    id integer PRIMARY KEY,
    sale_id integer NOT NULL REFERENCES public.sales (id),
    item_id integer NOT NULL REFERENCES public.items (id),
    units integer NOT NULL,
    unit_price numeric(10,2) NOT NULL
);

INSERT INTO public.items (id, title, stock_units, enabled, deleted) VALUES
    (1, 'Café espresso', 60, true, false),
    (2, 'Medialuna', 40, true, false),
    (3, 'Tostado de jamón y queso', 25, true, false),
    (4, 'Café con leche', 55, true, false),
    (5, 'Cheesecake', 12, true, false),
    (6, 'Jugo de naranja', 30, true, false),
    (7, 'Alfajor', 8, true, false),
    (8, 'Té en hebras', 0, false, false);

INSERT INTO public.supplies (id, label, units_left, unit) VALUES
    (1, 'Café en grano', 12.00, 'kg'),
    (2, 'Leche', 30.00, 'l'),
    (3, 'Harina', 20.00, 'kg'),
    (4, 'Jamón cocido', 4.00, 'kg'),
    (5, 'Queso', 6.00, 'kg'),
    (6, 'Naranjas', 15.00, 'kg');

INSERT INTO public.recipes (item_id, supply_id, qty) VALUES
    (1, 1, 0.018),
    (2, 3, 0.060),
    (3, 3, 0.100),
    (3, 4, 0.050),
    (3, 5, 0.060),
    (4, 1, 0.018),
    (4, 2, 0.200),
    (6, 6, 0.400);

-- 90 days of sales: day d (0 = today) has 2 + d % 3 sales, so 2 to 4. Sale numbers run from the
-- oldest to the newest; one in 15 is cancelled ('anulada'). Each sale is placed in the past, so
-- none is later than the load time. The amount is filled from the lines just below.
INSERT INTO public.sales (id, sold_at, status, amount)
SELECT row_number() OVER (ORDER BY d.d DESC, k.k) AS id,
       now() - d.d * INTERVAL '1 day' - (k.k + 1) * INTERVAL '95 minutes',
       CASE WHEN row_number() OVER (ORDER BY d.d DESC, k.k) % 15 = 0 THEN 'anulada' ELSE 'pagada' END,
       0
  FROM generate_series(0, 89) AS d (d)
 CROSS JOIN LATERAL generate_series(1, 2 + d.d % 3) AS k (k);

-- 1 to 3 lines per sale. The items of a sale are (3 * id + 5 * line) % 8 + 1: distinct within a
-- sale, and spread over the whole menu across the 90 days.
INSERT INTO public.sale_lines (id, sale_id, item_id, units, unit_price)
SELECT row_number() OVER (ORDER BY s.id, l.l),
       s.id,
       (3 * s.id + 5 * l.l) % 8 + 1,
       1 + (s.id + l.l) % 3,
       (ARRAY[2800, 1500, 4200, 3300, 4800, 3000, 1200, 2500])[(3 * s.id + 5 * l.l) % 8 + 1]
  FROM public.sales s
 CROSS JOIN LATERAL generate_series(1, 1 + s.id % 3) AS l (l);

UPDATE public.sales s
   SET amount = t.amount
  FROM (SELECT sale_id, sum(units * unit_price) AS amount FROM public.sale_lines GROUP BY sale_id) t
 WHERE t.sale_id = s.id;

-- The canonical views: same column names and types as the food_store views, ids as text.
CREATE VIEW public.v_producto AS
 SELECT id::text AS id,
        title AS nombre,
        stock_units AS "stockDisponible",
        NULL::text AS sku,
        enabled AS activo
   FROM public.items
  WHERE NOT deleted;

CREATE VIEW public.v_insumo AS
 SELECT id::text AS id,
        label AS nombre,
        units_left AS "stockDisponible",
        unit AS "unidadMedida",
        NULL::text AS codigo
   FROM public.supplies;

CREATE VIEW public.v_receta_componente AS
 SELECT item_id::text AS "productoId",
        supply_id::text AS "insumoId",
        qty AS "cantidadPorUnidad"
   FROM public.recipes;

CREATE VIEW public.v_pedido AS
 SELECT id::text AS id,
        sold_at AS "fechaCreacion",
        CASE WHEN status = 'anulada' THEN 'cancelado' ELSE status END AS estado,
        amount AS total,
        id AS numero,
        'ARS'::text AS moneda
   FROM public.sales;

CREATE VIEW public.v_item_pedido AS
 SELECT id::text AS id,
        sale_id::text AS "pedidoId",
        item_id::text AS "productoId",
        units AS cantidad,
        unit_price AS "precioUnitario"
   FROM public.sale_lines;
