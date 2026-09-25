BEGIN TRANSACTION READ ONLY;
SELECT now() AS instante, pg_backend_pid() AS pid_sesion_nueva;
SELECT id, name, stock_quantity FROM product WHERE id = 8;
ROLLBACK;
