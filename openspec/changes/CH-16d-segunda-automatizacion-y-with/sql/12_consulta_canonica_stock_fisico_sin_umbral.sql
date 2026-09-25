-- ============================================================
-- Variante de 11_consulta_canonica_stock_fisico.sql SIN la
-- condición de umbral, para comparar conjuntos no vacíos.
-- Única diferencia con 11: se quita la línea del umbral.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
