-- C3. Pedidos por estado (Anexo C, 4.3) sobre el contrato canonico. Incluye cancelados.
-- Parametros psql: :desde y :hasta, rango [desde, hasta) en la zona de la sesion.
SELECT
    p.estado,
    COUNT(*) AS cantidad
FROM v_pedido p
WHERE p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta'
GROUP BY p.estado
ORDER BY cantidad DESC, p.estado;
