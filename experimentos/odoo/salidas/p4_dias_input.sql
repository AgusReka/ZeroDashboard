SET TIME ZONE 'America/Argentina/Buenos_Aires';
SELECT now() AS hora_servidor, current_user;
SELECT "fechaCreacion"::date AS dia, count(*) AS pedidos, count(*) FILTER (WHERE estado <> 'cancelado') AS no_cancelados,
       count(DISTINCT moneda) AS monedas, string_agg(DISTINCT moneda, ',') AS cuales
FROM v_pedido GROUP BY 1 ORDER BY 1;
SELECT min("fechaCreacion")::date - 1 AS dia_vacio_candidato,
       (SELECT count(*) FROM v_pedido WHERE "fechaCreacion"::date = (SELECT min("fechaCreacion")::date - 1 FROM v_pedido)) AS pedidos_ese_dia
FROM v_pedido;
