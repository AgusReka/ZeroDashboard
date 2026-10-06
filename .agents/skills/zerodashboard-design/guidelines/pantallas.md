# Especificación de pantallas — ZeroDashboard

Cada pantalla lleva **historia · change · estado**. En el HTML, el contenedor de cada pantalla tiene `data-change="CH-xx"` y `data-estado="existe|parcial|pendiente"` (buscables con `grep`). Los datos de ejemplo viven en `ui_kits/datos-muestra.js` (DATOS DE MUESTRA). No se definen endpoints ni rutas: los decide el change que implementa.

Estados comunes a toda pantalla con datos remotos:
- **Cargando**: `LoadingState` (skeleton en listas, spinner en acciones). Nunca pantalla en blanco.
- **Vacío**: `EmptyState` con qué falta y la acción siguiente.
- **Error**: `ErrorState` (bloque) o `Banner tone="error"` (acción puntual), siempre con `role="alert"` y salida (reintentar / volver).
- **Éxito**: `Banner tone="ok"` descartable, o el resultado directo.

Leyenda: EXISTE = rediseñar manteniendo ids y comportamiento · PARCIAL = hay API o versión básica, diseñar completa · PENDIENTE = diseño anticipado.

---

## CONSOLA (P1 · Implementador)
Superficie densa, escritorio primero. Toda pantalla vive bajo la **barra de tenant activo**. Mockup: `ui_kits/consola/index.html`.

### C-01 Barra de tenant activo — T4 · CH-06 · EXISTE
- **Propósito**: mitigar el error humano más probable (operar contra el tenant equivocado).
- **Muestra**: nombre del tenant, id, conectividad del agente.
- **Estados**: con tenant (violeta) · sin tenant (ámbar, "Ningún tenant seleccionado", bloquea acciones de escritura).
- **Acciones**: Cambiar tenant → diálogo con lista, confirma con el nombre completo en el botón ("Operar sobre Panadería La Espiga").
- **Reglas**: sticky, siempre visible, color `--tenant` exclusivo. Componente `TenantBar`.

### C-02 Editor de consultas — B1 · CH-04 · EXISTE
- **Propósito**: escribir y ejecutar SQL de solo lectura contra el tenant activo.
- **Muestra**: nombre, descripción, editor monoespaciado, resultado paginado, duración, filas.
- **Estados**: cargando (spinner "Ejecutando consulta…") · éxito (DataTable) · sin filas (EmptyState) · **rechazo** de sentencias que no son de lectura (Banner error con sentencia y línea) · **timeout** (Banner error con límite y "Reintentar") · **tope de filas** (Banner warn inline sobre la tabla).
- **Acciones**: Ejecutar consulta (primaria), Guardar, Versiones.

### C-03 Parámetros declarados — B3 · CH-11 · EXISTE
- **Muestra**: por parámetro `:nombre`, tipo (entero/texto/fecha/decimal), valor de prueba, si es opcional.
- **Estados**: error por tipo inválido en el Field del valor.

### C-04 Consultas guardadas — B2 · CH-05 · EXISTE
- **Muestra**: lista con nombre, descripción, versión, última edición. Clic carga en el editor.
- **Estados**: vacío ("Todavía no guardaste consultas").

### C-05 Historial de versiones — B4 · CH-25 · PENDIENTE
- **Datos**: `version` (entero, 4) · `fecha` (fecha-hora, 02/10 18:40) · `autor` (texto, Lucía) · `nota` (texto, "Agrega filtro por depósito") · `es_actual` (booleano).
- **Estados**: cargando (skeleton) · una sola versión (texto "Esta es la versión inicial") · error.
- **Acciones**: Comparar con la actual, Restaurar (confirma).
- Mockup: panel lateral en Consultas → Versiones.

### C-06 Alta y prueba de conexión — A1 · CH-03 · PARCIAL
- **Datos**: `host` (texto, replica.dontito.local) · `puerto` (entero, 5432) · `base` (texto, tienda) · `usuario` (texto, zd_lectura) · `contraseña` (secreto) · resultado: `exito` (booleano), `latencia_ms` (entero, 42), `motor_version` (texto, PostgreSQL 15.4), `tablas_visibles` (entero, 38), `es_solo_lectura` (booleano), `error` (texto).
- **Estados**: probando (botón loading) · éxito (Banner ok con latencia) · usuario con permisos de escritura (Banner warn: no se puede guardar) · error de red/credenciales (Banner error con mensaje del motor).

### C-07 Contrato canónico — M1 · CH-08 · PARCIAL
- **Datos**: `entidad` (texto, producto) · `campo` (texto, stock_minimo) · `tipo` (texto, entero) · `requerido` (booleano) · `usado_por` (lista de plantillas, [stock_fisico]) · `depende_de` (lista de campos).
- **Estados**: cargando · error. Solo lectura. Sin mockup (DataTable agrupada por entidad).

### C-08 Mapeo de esquema por tenant — M2 · CH-09 · PARCIAL
- **Datos**: `campo_canonico` · `columna_origen` (texto o vacío, stock.cantidad) · `tipo_origen` · `estado` (mapeado / falta / inaplicable).
- **Acciones**: elegir columna (select con columnas del tenant), Guardar.

### C-09 Validación de mapeo e inaplicables — M3, M4 · CH-10 · PARCIAL
- **Datos**: `campo` · `resultado` (ok / falta / tipo incompatible / inaplicable) · `motivo` (texto, "La tienda no fabrica productos propios") · `plantillas_afectadas` (lista).
- **Estados**: todo válido (Banner ok) · faltantes (Banner warn con conteo + plantillas bloqueadas) · inaplicable siempre con motivo visible.
- Mockup: Conexión y mapeo.

### C-10 Automatizaciones: listado y alta — D1 · CH-12, CH-13 · EXISTE
- **Muestra**: nombre, plantilla, consulta, horario, destino, última ejecución (badge + hora), próxima, estado (activa/pausada).
- **Acciones**: Nueva automatización, Pausar/Reanudar, abrir ejecuciones.

### C-11 Alta en dos pasos — D2 · CH-21 · PENDIENTE
- **Paso 1** Elegir plantilla (TemplatePicker). **Paso 2** Completar parámetros.
- **Datos**: `plantilla_id` · `nombre` (texto) · `consulta_guardada_id` · parámetros de la plantilla (p. ej. `umbral` entero 25, `deposito` texto opcional) · `frecuencia` (enum) · `hora` (hh:mm, 08:00) · `destinatarios` (lista de correos) · `primera_ejecucion` (fecha-hora calculada).
- **Estados**: validación por campo · creada (Banner ok en el listado).

### C-12 Catálogo inicial de plantillas — D3 · CH-21 · PENDIENTE
- **Datos**: `id` · `nombre` · `descripcion` · `icono` · `tolerancia_frescura` (minutos, 60) · `campos_requeridos` (lista).
- Plantillas: Alerta de stock físico · Alerta de stock producible · Reporte diario. Una plantilla con mapeo incompleto aparece deshabilitada con motivo.

### C-13 Formato de correo de la plantilla — N3 · CH-21 · PENDIENTE
- **Datos**: `asunto` (con variables de negocio) · `titulo` · `columnas_visibles` · `texto_sin_datos`.
- Vista previa en el paso 2 del alta. Referencia completa en `ui_kits/correo/`.

### C-14 Ejecuciones — X2 · CH-13 · EXISTE
- **Muestra**: id, automatización, inicio, fin, duración, filas, estado, error.
- **Acciones**: filtrar por automatización y estado, abrir detalle (panel lateral).

### C-15 Estados de ejecución — X4, X5, X7 · CH-17a, CH-17b · EXISTE
- `omitida` (por solapamiento: la anterior seguía en curso) · `interrumpida` (el proceso se reinició) · `reintentando` (con intento n/m). Badge con ícono + texto propio; detalle con explicación.

### C-16 Aviso de notificación duplicada evitada — X6 · CH-18 · EXISTE
- Estado `duplicado_evitado` en la tabla + Banner neutral en detalle, referenciando la ejecución que sí envió.

### C-17 Tiempos de alta de un tenant — G1 · CH-15 · PARCIAL
- **Datos**: `tenant` · `fecha_alta` · `conexion_ok_en` (duración) · `mapeo_completo_en` · `primera_ejecucion_en` · `total` (duración, "2 d 4 h").
- **Estados**: hito pendiente se muestra "—" con badge neutral. Sin mockup.

### C-18 Agentes: alta, listado y revocación — C1 · CH-19b · PENDIENTE (en curso)
- **Datos**: `id` · `tenant` · `nombre` (texto, PC administración) · `token_parcial` (zd_ag_••••a17e) · `token_completo` (solo una vez al crear) · `fecha_alta` · `revocado` (booleano).
- **Estados**: recién creado (Banner ok con token y Copiar, "no se vuelve a mostrar") · revocación con diálogo de confirmación (botón danger) · revocado.

### C-19 Estado de conectividad — C2 · CH-19d1, CH-19d2 · PENDIENTE
- **Datos**: `estado` (conectado / desconectado / sin_datos) · `ultimo_latido` (relativo, "hace 12 s").
- Aparece en la barra de tenant, el selector de tenant y la lista de agentes (`ConnectivityIndicator`).

### C-20 Automatizaciones en riesgo por tenant inalcanzable — C2 · CH-19d2 · PENDIENTE
- **Datos**: `tenant` · `automatizacion` · `proxima_ejecucion` · `desconectado_desde`.
- Banner warn con tabla en Agentes y conectividad.

### C-21 Auditoría de consultas — A5 · CH-20 · PENDIENTE
- **Datos**: `fecha_hora` · `usuario` · `tenant` · `consulta` (nombre o "ad hoc") · `sql_resumen` (mono, truncado) · `filas` · `duracion` · `resultado` (ok / rechazada / timeout).
- Solo lectura, filtros por usuario/tenant/fecha. Sin mockup.

### C-22 Frescura — F1, F2 · CH-24 · PENDIENTE
- **Datos**: por tenant `ultima_actualizacion` (relativo, "hace 3 h 10 min") y `ventana_desactualizacion`; por plantilla `tolerancia` (minutos). Badge `desactualizada` cuando ventana > tolerancia.
- Sin mockup.

---

## PANEL (P2 · Administrador PYME) — toda la superficie es nueva
Más aire (`data-surface="panel"`: cuerpo 16 px, controles 44 px), móvil primero, lenguaje de negocio, **nunca SQL**. Mockup: `ui_kits/panel/index.html`.

### P-01 Ingreso — T3 · CH-22 · PENDIENTE
- **Datos**: `correo` · `contraseña`. El tenant se deduce de la sesión: nunca se elige ni se muestra un selector.
- **Estados**: error de credenciales ("El correo o la contraseña no coinciden") · ingresando (botón loading).

### P-02 Mis automatizaciones — P1h · CH-22 · PENDIENTE
- **Datos**: `titulo` (de negocio, "Aviso de stock bajo") · `descripcion` · `estado` (activa / con_falla / pausada) · `ultima_ejecucion` (texto de negocio, "Hoy 08:00 · 3 productos con poco stock") · `proxima_ejecucion` · `frecuencia`. Disponibles: `titulo`, `descripcion`, `tolerancia`.
- **Estados**: sin activas (EmptyState "Todavía no activaste ninguna automatización") · cargando (skeleton de tarjetas).
- **Acciones**: Ajustar, Activar. (No hay "Ver último resultado": DEC-93 no persiste las filas; el cliente recibe el resultado por correo.)

### P-03 Aviso de falla en lenguaje de negocio — P3h · CH-22 · PENDIENTE
- **Datos**: `titulo` (qué no pasó, "No pudimos armar tu resumen de esta mañana") · `cuerpo` (por qué en términos del negocio + qué hacemos + si tiene que hacer algo) · `proximo_intento`.
- Banner error inline dentro de la tarjeta. Nunca códigos, nombres de tablas ni "réplica".

### P-04 Ajuste de umbrales y horarios — P2h · CH-23 · PENDIENTE
- **Datos**: `umbral` (entero, 20, sufijo "unidades") · `hora` (08:00) · `dias` (enum) · `destinatarios`. **Sin campos de SQL.**
- **Estados**: validación por campo · guardado (Banner ok "Se aplican desde la próxima revisión").

### P-05 Advertencia de frescura al activar — F3 · CH-26 · PENDIENTE
- **Datos**: `ultima_actualizacion` (relativo) · `tolerancia_requerida` (texto, "2 h").
- Diálogo con Banner warn; el cliente decide: "Ahora no" / "Activar de todos modos".

### P-06 Último resultado — P4h · CH-27 · FUERA DE ALCANCE
- **No implementar.** DEC-93 (D-1) decidió no persistir el contenido de las filas, solo metadatos de ejecución. CH-27 queda fuera de alcance mientras D-1 no se reabra. El mockup `ui_kits/panel` conserva la pantalla solo como referencia visual; no es una pantalla a construir.

---

## CORREO — N1, N2 · CH-14 · EXISTE
Reporte HTML compatible con clientes de correo: tablas, estilos inline, 600 px, sin webfonts, sin imágenes obligatorias. Versión **sin datos** con mensaje claro y sin campos rotos. Referencia: `ui_kits/correo/reporte.html`, `ui_kits/correo/sin-datos.html`.

---

## Tabla resumen change → pantallas

| Change | Pantallas | Estado |
|---|---|---|
| CH-03 | C-06 Alta y prueba de conexión | PARCIAL |
| CH-04 | C-02 Editor de consultas | EXISTE |
| CH-05 | C-04 Consultas guardadas | EXISTE |
| CH-06 | C-01 Barra de tenant activo | EXISTE |
| CH-08 | C-07 Contrato canónico | PARCIAL |
| CH-09 | C-08 Mapeo de esquema | PARCIAL |
| CH-10 | C-09 Validación de mapeo e inaplicables | PARCIAL |
| CH-11 | C-03 Parámetros declarados | EXISTE |
| CH-12, CH-13 | C-10 Automatizaciones · C-14 Ejecuciones | EXISTE |
| CH-14 | Correo (con datos / sin datos) | EXISTE |
| CH-15 | C-17 Tiempos de alta | PARCIAL |
| CH-17a, CH-17b | C-15 Estados de ejecución | EXISTE |
| CH-18 | C-16 Duplicado evitado | EXISTE |
| CH-19b | C-18 Agentes | PENDIENTE (en curso) |
| CH-19d1 | C-19 Conectividad | PENDIENTE |
| CH-19d2 | C-19 Conectividad · C-20 En riesgo | PENDIENTE |
| CH-20 | C-21 Auditoría | PENDIENTE |
| CH-21 | C-11 Alta en dos pasos · C-12 Catálogo · C-13 Formato de correo | PENDIENTE |
| CH-22 | P-01 Ingreso · P-02 Mis automatizaciones · P-03 Aviso de falla | PENDIENTE |
| CH-23 | P-04 Ajustes | PENDIENTE |
| CH-24 | C-22 Frescura | PENDIENTE |
| CH-25 | C-05 Versiones | PENDIENTE |
| CH-26 | P-05 Advertencia de frescura | PENDIENTE |
| CH-27 | P-06 Último resultado | FUERA DE ALCANCE (DEC-93) |

## Componentes → change
| Componente | Historia · Change · Estado |
|---|---|
| TenantBar | T4 · CH-06 · EXISTE |
| ConnectivityIndicator | C2 · CH-19d1/d2 · PENDIENTE |
| DataTable | B1, X2 · CH-04, CH-13 · EXISTE (consola) |
| StatusBadge | X2, X4–X7 · CH-13, CH-17a/b, CH-18 · EXISTE |
| Banner, EmptyState, LoadingState, ErrorState | transversales · todos |
| Field, Button, Icon | transversales · todos |
| AutomationCard | P1h, P3h · CH-22 · PENDIENTE |
| TemplatePicker, Stepper | D2, D3 · CH-21 · PENDIENTE |
