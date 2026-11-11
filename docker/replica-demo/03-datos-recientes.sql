-- CH-49: makes the dump look recent. It runs once, on an empty volume, on food_store, after
-- 01-esquema-y-datos.sql and 02-lector.sh. The dump itself stays untouched; everything here is
-- an in-place change of its data. The dump already has items for all 99 orders (194 lines), so
-- no line is added.

-- Relative dates: the newest order of the dump is from 2026-09-16. Shifting every order and
-- line timestamp by the days elapsed since then puts that order on the load day and the 99
-- orders in the last 30 days, so the 7-, 30- and 90-day report periods all have rows.
UPDATE public.pedido
   SET created_at = created_at + (now()::date - DATE '2026-09-16') * INTERVAL '1 day',
       updated_at = updated_at + (now()::date - DATE '2026-09-16') * INTERVAL '1 day';

UPDATE public.detalle_pedido
   SET created_at = created_at + (now()::date - DATE '2026-09-16') * INTERVAL '1 day',
       updated_at = updated_at + (now()::date - DATE '2026-09-16') * INTERVAL '1 day';

-- Products 7, 8 and 9 have no recipe, so they are the only ones stock-fisico reads. Small,
-- distinct values make each threshold change visible: at 10 two rows (9 and 4), at 20 three
-- (18 as well), at 5 one (4).
UPDATE public.product SET stock_quantity = 18 WHERE id = 7;
UPDATE public.product SET stock_quantity = 9 WHERE id = 8;
UPDATE public.product SET stock_quantity = 4 WHERE id = 9;
