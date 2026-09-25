-- C1. Ventas del dia (Anexo C, 4.1) sobre el contrato canonico.
-- Parametros psql: :desde y :hasta, rango [desde, hasta) en la zona de la sesion.
SELECT
    COUNT(*) AS cantidad_pedidos,
    COALESCE(SUM(p.total), 0) AS facturacion_total,
    COALESCE(ROUND(AVG(p.total), 2), 0) AS ticket_promedio
FROM v_pedido p
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta';
