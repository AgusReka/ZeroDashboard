-- ============================================================
-- CONSULTA CANÓNICA: stock físico (WF-01a), productos sin receta.
-- Versión canónica de la consulta de la sección 4.2 de
-- docs/bitacora/estudio_previo/bitacora_WF-01.md.
-- Solo usa v_producto y v_receta_componente. Umbral: <= 20.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
