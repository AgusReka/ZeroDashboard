/**
 * CH-34 (DEC-176): one fixed example SELECT per contract entity, shown on the Mapping screen
 * as a starting point the operator can copy into an empty editor.
 *
 * Each statement is the demo replica's view rewritten as a plain SELECT, over the `food_store`
 * schema (`docker/replica-demo/01-esquema-y-datos.sql`, views `v_producto`, `v_pedido`,
 * `v_item_pedido`, `v_insumo` and `v_receta_componente`): no `CREATE VIEW`, no `public.`
 * prefix, and no trailing `;` (the stored statement is a single SELECT). Tables take an alias
 * without `AS`, so every `AS` in a select list is a column alias; camelCase aliases are
 * quoted because Postgres folds unquoted identifiers to lowercase.
 *
 * The keys are the contract's entity names. The contract has no entity-name union type, so
 * `src/mapeo-ejemplos.test.ts` enforces that the keys and the aliases equal the contract.
 * The console writes this constant into its inline script once; it is code, not stored data.
 */
export const EJEMPLOS_MAPEO: Readonly<Record<string, string>> = {
  producto: [
    'SELECT',
    '  p.id::text AS id,',
    '  p.name AS nombre,',
    '  p.stock_quantity AS "stockDisponible",',
    '  NULL::text AS sku,',
    '  p.available AS activo',
    'FROM product p',
    'WHERE p.deleted_at IS NULL',
  ].join('\n'),
  pedido: [
    'SELECT',
    '  p.id::text AS id,',
    '  p.created_at AS "fechaCreacion",',
    "  CASE WHEN ep.codigo = 'CANCELADO' THEN 'cancelado' ELSE ep.codigo::text END AS estado,",
    '  p.total AS total,',
    '  NULL::integer AS numero,',
    '  NULL::text AS moneda',
    'FROM pedido p',
    'JOIN estado_pedido ep ON ep.id = p.estado_id',
    'WHERE p.deleted_at IS NULL',
  ].join('\n'),
  item_pedido: [
    'SELECT',
    '  dp.id::text AS id,',
    '  dp.pedido_id::text AS "pedidoId",',
    '  dp.producto_id::text AS "productoId",',
    '  dp.cantidad AS cantidad,',
    '  dp.producto_precio_unitario AS "precioUnitario"',
    'FROM detalle_pedido dp',
    'WHERE dp.deleted_at IS NULL',
  ].join('\n'),
  insumo: [
    'SELECT',
    '  i.id::text AS id,',
    '  i.name AS nombre,',
    '  i.stock_quantity AS "stockDisponible",',
    '  NULL::text AS "unidadMedida",',
    '  NULL::text AS codigo',
    'FROM ingredient i',
    'WHERE i.deleted_at IS NULL',
  ].join('\n'),
  receta_componente: [
    'SELECT',
    '  pi.product_id::text AS "productoId",',
    '  pi.ingredient_id::text AS "insumoId",',
    '  pi.quantity AS "cantidadPorUnidad"',
    'FROM product_ingredient pi',
    'JOIN product p ON p.id = pi.product_id AND p.deleted_at IS NULL',
    'JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL',
  ].join('\n'),
};
