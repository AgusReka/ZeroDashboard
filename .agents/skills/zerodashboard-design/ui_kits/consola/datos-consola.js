/* DATOS DE MUESTRA — consola. Reemplazables sin tocar el diseño. */
window.DATOS_CONSOLA = {
  tenants: [
    { id: 'ten_7f3a', nombre: 'Almacén Don Tito', estado: 'activo', alta: '12/09/2026', agente: 'conectado', latido: 'hace 12 s' },
    { id: 'ten_2c91', nombre: 'Panadería La Espiga', estado: 'activo', alta: '20/09/2026', agente: 'desconectado', latido: 'hace 3 h' },
    { id: 'ten_b044', nombre: 'Dietética Raíces', estado: 'baja', alta: '02/10/2026', baja: '07/10/2026', agente: 'sin_datos', latido: null }
  ],
  conexiones: {
    ten_7f3a: [
      { id: 'cx_01', nombre: 'Réplica principal', motor: 'PostgreSQL 15.4', host: 'replica.dontito.local', puerto: 5432, base: 'tienda', usuario: 'zd_lectura', alta: '12/09 10:14', prueba: { ok: true, cuando: 'hoy 08:12', latencia: '42 ms', tablas: 38 } },
      { id: 'cx_02', nombre: 'Réplica sucursal norte', motor: 'MySQL 8.0', host: '10.0.4.12', puerto: 3306, base: 'norte', usuario: 'zd_ro', alta: '18/09 16:40', prueba: { ok: false, cuando: 'ayer 19:02', error: 'Acceso denegado para el usuario "zd_ro"', sqlstate: '28000' } }
    ],
    ten_2c91: [
      { id: 'cx_07', nombre: 'Agente PC administración', motor: 'PostgreSQL 14.9', host: 'vía agente', puerto: null, base: 'espiga', usuario: 'lector', alta: '20/09 12:01', prueba: { ok: true, cuando: 'hoy 05:40', latencia: '180 ms', tablas: 21 } }
    ],
    ten_b044: [
      { id: 'cx_11', nombre: 'Réplica', motor: 'PostgreSQL 15.2', host: 'db.raices.com.ar', puerto: 5432, base: 'raices', usuario: 'zd', alta: '02/10 09:30', prueba: { ok: true, cuando: '06/10 18:00', latencia: '61 ms', tablas: 17 } }
    ]
  },
  agentes: {
    ten_7f3a: [{ id: 'ag_01', nombre: 'Servidor local tienda', token: 'zd_ag_••••8f2c', alta: '12/09 10:02', estado: 'conectado', latido: 'hace 12 s', revocado: false }],
    ten_2c91: [{ id: 'ag_02', nombre: 'PC administración', token: 'zd_ag_••••a17e', alta: '20/09 11:48', estado: 'desconectado', latido: 'hace 3 h', revocado: false }],
    ten_b044: []
  },
  enRiesgo: {
    ten_2c91: [
      { automatizacion: 'au_21 · Alerta de stock físico', proxima: '09/10 16:00' },
      { automatizacion: 'au_22 · Reporte diario', proxima: '10/10 07:00' }
    ]
  },
  sql: 'SELECT p.sku, p.nombre, p.deposito,\n       p.stock_actual, p.stock_minimo\nFROM productos p\nWHERE p.stock_actual < :umbral\n  AND (:deposito IS NULL OR p.deposito = :deposito)\nORDER BY p.stock_actual ASC;',
  parametros: [
    { nombre: 'umbral', tipo: 'entero', valor: '25' },
    { nombre: 'deposito', tipo: 'texto', valor: '' }
  ],
  resultado: [
    { sku: 'ALM-0201', nombre: 'Fideos tirabuzón 500 g', deposito: 'Central', stock_actual: 0, stock_minimo: 40 },
    { sku: 'ALM-0103', nombre: 'Harina 000 1 kg', deposito: 'Sucursal Norte', stock_actual: 3, stock_minimo: 30 },
    { sku: 'ALM-0012', nombre: 'Yerba mate 1 kg', deposito: 'Central', stock_actual: 8, stock_minimo: 20 },
    { sku: 'ALM-0150', nombre: 'Dulce de leche 400 g', deposito: 'Central', stock_actual: 11, stock_minimo: 12 },
    { sku: 'ALM-0047', nombre: 'Aceite de girasol 1,5 L', deposito: 'Central', stock_actual: 14, stock_minimo: 24 },
    { sku: 'ALM-0188', nombre: 'Arroz largo fino 1 kg', deposito: 'Sucursal Norte', stock_actual: 19, stock_minimo: 25 },
    { sku: 'ALM-0233', nombre: 'Tomate triturado 520 g', deposito: 'Central', stock_actual: 22, stock_minimo: 30 },
    { sku: 'ALM-0290', nombre: 'Galletitas de agua 3x', deposito: 'Sucursal Norte', stock_actual: null, stock_minimo: 18 }
  ],
  guardadas: [
    { id: 'q_31', nombre: 'Stock bajo por depósito', descripcion: 'Productos por debajo del mínimo, por depósito.', vigente: 4, editada: '02/10 18:40' },
    { id: 'q_28', nombre: 'Ventas del día', descripcion: 'Pedidos confirmados de las últimas 24 h.', vigente: 2, editada: '28/09 10:05' },
    { id: 'q_19', nombre: 'Insumos para producción', descripcion: 'Insumos y rendimiento por receta.', vigente: 7, editada: '21/09 16:22' }
  ],
  versiones: [
    { v: 4, fecha: '02/10 18:40', nota: 'Agrega filtro por depósito', sql: null },
    { v: 3, fecha: '30/09 09:12', nota: 'Parámetro :umbral', sql: 'SELECT p.sku, p.nombre,\n       p.stock_actual, p.stock_minimo\nFROM productos p\nWHERE p.stock_actual < :umbral\nORDER BY p.stock_actual ASC;' },
    { v: 2, fecha: '25/09 15:01', nota: 'Ordena por stock', sql: 'SELECT p.sku, p.nombre, p.stock_actual\nFROM productos p\nWHERE p.stock_actual < p.stock_minimo\nORDER BY p.stock_actual ASC;' },
    { v: 1, fecha: '24/09 11:30', nota: '', sql: 'SELECT sku, nombre, stock_actual\nFROM productos\nWHERE stock_actual < stock_minimo;' }
  ],
  plantillas: [
    { id: 'stock_fisico', nombre: 'Alerta de stock físico', descripcion: 'Avisa cuando un producto queda por debajo del mínimo.', icon: 'package', tolerancia: '1 h' },
    { id: 'stock_producible', nombre: 'Alerta de stock producible', descripcion: 'Avisa cuando los insumos no alcanzan para producir.', icon: 'boxes', tolerancia: '2 h', motivo: 'El mapeo marca «receta» como inaplicable para este tenant.' },
    { id: 'reporte_diario', nombre: 'Reporte diario', descripcion: 'Resumen del día enviado por correo a la mañana.', icon: 'file-text', tolerancia: '24 h' }
  ],
  automatizaciones: {
    ten_7f3a: [
      { id: 'au_11', plantilla: 'Alerta de stock físico', conexion: 'cx_01', cron: '0 8 * * *', cronTexto: 'Todos los días a las 08:00', estado: 'activa', alta: '14/09 11:20', destinatario: 'compras@dontito.com.ar' },
      { id: 'au_12', plantilla: 'Reporte diario', conexion: 'cx_01', cron: '30 7 * * 1-6', cronTexto: 'Lunes a sábado a las 07:30', estado: 'activa', alta: '15/09 09:02', destinatario: 'tito@dontito.com.ar' },
      { id: 'au_13', plantilla: 'Alerta de stock físico', conexion: 'cx_02', cron: '0 */2 * * *', cronTexto: 'Cada 2 horas', estado: 'inactiva', alta: '19/09 17:45', destinatario: 'norte@dontito.com.ar' }
    ],
    ten_2c91: [
      { id: 'au_21', plantilla: 'Alerta de stock físico', conexion: 'cx_07', cron: '0 */4 * * *', cronTexto: 'Cada 4 horas', estado: 'activa', alta: '21/09 10:00', destinatario: 'compras@laespiga.com.ar' },
      { id: 'au_22', plantilla: 'Reporte diario', conexion: 'cx_07', cron: '0 7 * * *', cronTexto: 'Todos los días a las 07:00', estado: 'activa', alta: '21/09 10:05', destinatario: 'duenia@laespiga.com.ar' }
    ],
    ten_b044: [
      { id: 'au_31', plantilla: 'Reporte diario', conexion: 'cx_11', cron: '0 8 * * *', cronTexto: 'Todos los días a las 08:00', estado: 'inactiva', alta: '03/10 12:00', destinatario: 'raices@raices.com.ar' }
    ]
  },
  ejecuciones: [
    { id: 'ej_9046', inicio: '09/10 08:00:02', fin: '09/10 08:00:04', duracion: '1,8 s', filas: 3, estado: 'ok', notificacion: 'enviada', intentos: 1, error: null },
    { id: 'ej_9045', inicio: '08/10 08:00:00', fin: '08/10 08:00:41', duracion: '41,2 s', filas: 3, estado: 'reintentando', notificacion: 'pendiente', intentos: 2, error: 'Se canceló la consulta por tiempo máximo (30 s). SQLSTATE 57014' },
    { id: 'ej_9044', inicio: '07/10 10:00:00', fin: '—', duracion: '—', filas: null, estado: 'omitida', notificacion: 'no corresponde', intentos: 0, error: 'La ejecución anterior seguía en curso.' },
    { id: 'ej_9043', inicio: '07/10 08:00:01', fin: '07/10 08:00:30', duracion: '29,6 s', filas: null, estado: 'interrumpida', notificacion: 'no enviada', intentos: 1, error: 'El proceso se reinició durante la ejecución.' },
    { id: 'ej_9042', inicio: '06/10 08:00:01', fin: '06/10 08:00:09', duracion: '8,2 s', filas: null, estado: 'fallo', notificacion: 'no enviada', intentos: 3, error: 'No existe la relación "productos_stock". SQLSTATE 42P01' },
    { id: 'ej_9041', inicio: '05/10 08:00:01', fin: '05/10 08:00:02', duracion: '1,2 s', filas: 0, estado: 'ok', notificacion: 'sin datos', intentos: 1, error: null }
  ]
};
