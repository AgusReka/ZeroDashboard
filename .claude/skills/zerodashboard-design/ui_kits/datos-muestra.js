/* DATOS DE MUESTRA — reemplazables sin tocar el diseño. Tienda de alimentos ficticia. */
window.DATOS_MUESTRA = {
  tenants: [
    { id: 'ten_7f3a', nombre: 'Almacén Don Tito', agente: 'conectado', latido: 'hace 12 s', frescura: '4 min' },
    { id: 'ten_2c91', nombre: 'Panadería La Espiga', agente: 'desconectado', latido: 'hace 3 h', frescura: '3 h 10 min' },
    { id: 'ten_b044', nombre: 'Dietética Raíces', agente: 'sin_datos', latido: null, frescura: '—' }
  ],
  productos: [
    { sku: 'ALM-0012', nombre: 'Yerba mate 1 kg', deposito: 'Central', stock_actual: 8, stock_minimo: 20 },
    { sku: 'ALM-0047', nombre: 'Aceite de girasol 1,5 L', deposito: 'Central', stock_actual: 14, stock_minimo: 24 },
    { sku: 'ALM-0103', nombre: 'Harina 000 1 kg', deposito: 'Sucursal Norte', stock_actual: 3, stock_minimo: 30 },
    { sku: 'ALM-0150', nombre: 'Dulce de leche 400 g', deposito: 'Central', stock_actual: 11, stock_minimo: 12 },
    { sku: 'ALM-0188', nombre: 'Arroz largo fino 1 kg', deposito: 'Sucursal Norte', stock_actual: 19, stock_minimo: 25 },
    { sku: 'ALM-0201', nombre: 'Fideos tirabuzón 500 g', deposito: 'Central', stock_actual: 0, stock_minimo: 40 },
    { sku: 'ALM-0233', nombre: 'Tomate triturado 520 g', deposito: 'Central', stock_actual: 22, stock_minimo: 30 },
    { sku: 'ALM-0290', nombre: 'Galletitas de agua 3x', deposito: 'Sucursal Norte', stock_actual: null, stock_minimo: 18 }
  ],
  consultasGuardadas: [
    { id: 'q_31', nombre: 'Stock bajo por depósito', descripcion: 'Productos por debajo del mínimo, por depósito.', version: 4, editada: '02/10 18:40', autor: 'Lucía' },
    { id: 'q_28', nombre: 'Ventas del día', descripcion: 'Pedidos confirmados de las últimas 24 h.', version: 2, editada: '28/09 10:05', autor: 'Martín' },
    { id: 'q_19', nombre: 'Insumos para producción', descripcion: 'Insumos y rendimiento por receta.', version: 7, editada: '21/09 16:22', autor: 'Lucía' }
  ],
  versiones: [
    { v: 4, fecha: '02/10 18:40', autor: 'Lucía', nota: 'Agrega filtro por depósito' },
    { v: 3, fecha: '30/09 09:12', autor: 'Lucía', nota: 'Parámetro :umbral' },
    { v: 2, fecha: '25/09 15:01', autor: 'Martín', nota: 'Ordena por stock' },
    { v: 1, fecha: '24/09 11:30', autor: 'Martín', nota: 'Versión inicial' }
  ],
  sqlEjemplo: 'SELECT p.sku, p.nombre, p.deposito,\n       p.stock_actual, p.stock_minimo\nFROM productos p\nWHERE p.stock_actual < :umbral\n  AND (:deposito IS NULL OR p.deposito = :deposito)\nORDER BY p.stock_actual ASC;',
  parametros: [
    { nombre: 'umbral', tipo: 'entero', valor: '25', requerido: true },
    { nombre: 'deposito', tipo: 'texto', valor: '', requerido: false }
  ],
  plantillas: [
    { id: 'stock_fisico', nombre: 'Alerta de stock físico', descripcion: 'Avisa cuando un producto queda por debajo del mínimo.', icon: 'package', meta: 'Tolerancia de frescura: 1 h', tolerancia: 60 },
    { id: 'stock_producible', nombre: 'Alerta de stock producible', descripcion: 'Avisa cuando los insumos no alcanzan para producir.', icon: 'boxes', meta: 'Tolerancia de frescura: 2 h', tolerancia: 120 },
    { id: 'reporte_diario', nombre: 'Reporte diario', descripcion: 'Resumen del día enviado por correo a la mañana.', icon: 'file-text', meta: 'Tolerancia de frescura: 24 h', tolerancia: 1440 }
  ],
  automatizaciones: [
    { id: 'au_11', plantilla: 'stock_fisico', nombre: 'Stock bajo — Central', consulta: 'Stock bajo por depósito', horario: 'Todos los días 08:00', destino: 'compras@dontito.com.ar', estado: 'activa', ultima: 'exitosa', ultimaHora: '03/10 08:00', proxima: '04/10 08:00' },
    { id: 'au_12', plantilla: 'reporte_diario', nombre: 'Reporte diario de ventas', consulta: 'Ventas del día', horario: 'Lun a sáb 07:30', destino: 'tito@dontito.com.ar', estado: 'activa', ultima: 'reintentando', ultimaHora: '03/10 07:30', proxima: '04/10 07:30' },
    { id: 'au_13', plantilla: 'stock_producible', nombre: 'Insumos de panificados', consulta: 'Insumos para producción', horario: 'Cada 2 h, 06:00–20:00', destino: 'produccion@dontito.com.ar', estado: 'pausada', ultima: 'fallida', ultimaHora: '01/10 14:00', proxima: '—' }
  ],
  ejecuciones: [
    { id: 'ej_9046', automatizacion: 'Reporte diario de ventas', inicio: '03/10 07:30:00', fin: '—', duracion: '—', filas: null, estado: 'reintentando', intento: '2/3', error: 'Tiempo de espera agotado (30 s) al consultar la réplica.' },
    { id: 'ej_9045', automatizacion: 'Stock bajo — Central', inicio: '03/10 08:00:02', fin: '03/10 08:00:04', duracion: '1,8 s', filas: 3, estado: 'exitosa' },
    { id: 'ej_9044', automatizacion: 'Stock bajo — Central', inicio: '03/10 08:00:02', fin: '03/10 08:00:02', duracion: '0,1 s', filas: 3, estado: 'duplicado_evitado', error: 'El correo de esta ventana ya se había enviado (ej_9045). No se reenvió.' },
    { id: 'ej_9043', automatizacion: 'Insumos de panificados', inicio: '02/10 14:00:00', fin: '—', duracion: '—', filas: null, estado: 'omitida', error: 'La ejecución anterior seguía en curso.' },
    { id: 'ej_9042', automatizacion: 'Insumos de panificados', inicio: '02/10 12:00:00', fin: '02/10 12:00:30', duracion: '30,0 s', filas: null, estado: 'interrumpida', error: 'El proceso se reinició durante la ejecución.' },
    { id: 'ej_9041', automatizacion: 'Insumos de panificados', inicio: '01/10 14:00:01', fin: '01/10 14:00:09', duracion: '8,2 s', filas: null, estado: 'fallida', error: 'relation "recetas_insumos" does not exist (42P01)' },
    { id: 'ej_9040', automatizacion: 'Reporte diario de ventas', inicio: '02/10 07:30:00', fin: '02/10 07:30:03', duracion: '2,6 s', filas: 41, estado: 'exitosa' },
    { id: 'ej_9039', automatizacion: 'Stock bajo — Central', inicio: '02/10 08:00:01', fin: '02/10 08:00:02', duracion: '1,2 s', filas: 0, estado: 'sin_datos' }
  ],
  agentes: [
    { id: 'ag_01', tenant: 'Almacén Don Tito', nombre: 'Servidor local tienda', token: 'zd_ag_••••8f2c', alta: '12/09', estado: 'conectado', latido: 'hace 12 s' },
    { id: 'ag_02', tenant: 'Panadería La Espiga', nombre: 'PC administración', token: 'zd_ag_••••a17e', alta: '20/09', estado: 'desconectado', latido: 'hace 3 h' },
    { id: 'ag_03', tenant: 'Dietética Raíces', nombre: 'Sin instalar', token: 'zd_ag_••••03bd', alta: '02/10', estado: 'sin_datos', latido: null }
  ],
  enRiesgo: [
    { tenant: 'Panadería La Espiga', automatizacion: 'Stock de harinas', proxima: '03/10 16:00' },
    { tenant: 'Panadería La Espiga', automatizacion: 'Reporte diario', proxima: '04/10 07:00' }
  ],
  mapeo: [
    { entidad: 'producto', campo: 'sku', tipo: 'texto', origen: 'productos.codigo', estado: 'ok' },
    { entidad: 'producto', campo: 'nombre', tipo: 'texto', origen: 'productos.descripcion', estado: 'ok' },
    { entidad: 'producto', campo: 'stock_actual', tipo: 'entero', origen: 'stock.cantidad', estado: 'ok' },
    { entidad: 'producto', campo: 'stock_minimo', tipo: 'entero', origen: null, estado: 'falta' },
    { entidad: 'receta', campo: 'insumo_id', tipo: 'entero', origen: null, estado: 'inaplicable', motivo: 'La tienda no fabrica productos propios.' }
  ],
  /* PANEL — tenant deducido de la sesión */
  sesion: { usuario: 'Héctor (Tito) Gómez', correo: 'tito@dontito.com.ar', negocio: 'Almacén Don Tito' },
  panel: [
    { id: 'au_11', titulo: 'Aviso de stock bajo', descripcion: 'Te avisamos por correo cuando un producto queda por debajo del mínimo que elijas.', estado: 'activa', ultima: 'Hoy 08:00 · 3 productos con poco stock', proxima: 'Mañana 08:00', frecuencia: 'Todos los días', umbral: 20, hora: '08:00', dias: 'todos', correo: 'compras@dontito.com.ar' },
    { id: 'au_12', titulo: 'Resumen diario de ventas', descripcion: 'Cada mañana te llega un resumen de lo vendido el día anterior.', estado: 'con_falla', ultima: 'Hoy 07:30 · No se pudo enviar', proxima: 'Volvemos a intentar 09:30', frecuencia: 'Lunes a sábado', falla: { titulo: 'No pudimos armar tu resumen de esta mañana', cuerpo: 'Tu tienda tardó demasiado en responder. Lo intentamos de nuevo a las 09:30; no tenés que hacer nada. Si vuelve a pasar, te avisamos.' }, hora: '07:30', dias: 'lun-sab', correo: 'tito@dontito.com.ar' },
    { id: 'disp_1', titulo: 'Aviso de insumos para producir', descripcion: 'Te avisamos cuando lo que tenés no alcanza para fabricar tus productos.', disponible: true, tolerancia: '2 h' }
  ],
  frescuraPanel: { ultimaActualizacion: 'hace 3 h 10 min', tolerancia: '2 h' }
};
