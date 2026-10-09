# Consola v2 — arquitectura, pantallas y adopción

Rediseño de la consola del implementador (P1). Fuente: `uploads/prompt-claude-design-consola.md` (estado al 2026-10-09: CH-01 a CH-24 archivados, CH-25 implementado a la espera de verificación visual). **Reemplaza la sección CONSOLA de `pantallas.md`.** No toca el panel (P2).
Mockup navegable (HTML + CSS + JS plano, sin build): `ui_kits/consola/index.html`.

Leyenda de estado: **EXISTE** = hay interfaz hoy (rediseñar manteniendo comportamiento e ids) · **API** = existe la API, la pantalla es nueva · **PENDIENTE** = diseño anticipado.

---

## 1. Arquitectura de información

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ BARRA DE TENANT (violeta, sticky, siempre visible)                CH-06      │
│ Tenant activo · nombre · id · [Dado de baja] · conectividad* · Operador* ·   │
│                                                       [Cambiar tenant]       │
├───────────────────────┬──────────────────────────────────────────────────────┤
│ NAVEGACIÓN 232 px     │ ENCABEZADO DE PANTALLA                               │
│                       │  alcance (Global / Tenant activo: X) · change        │
│ ◎ GLOBAL              │  Título · descripción             [acción primaria]  │
│   Tenants        API  │──────────────────────────────────────────────────────│
│   Plantillas     API  │ CONTENIDO                                            │
│   Contrato       API  │                                                      │
│ ───────────────────── │                                                      │
│ ▣ TENANT ACTIVO       │                                                      │
│   Almacén Don Tito    │                                                      │
│   Puesta en marcha    │                                                      │
│     Conexiones y agentes                                                     │
│     Mapeo y validación  API                                                  │
│     Tiempos de alta     API                                                  │
│   Trabajo diario      │                                                      │
│     Consultas         │                                                      │
│     Automatizaciones  │                                                      │
│     Frescura de datos │                                                      │
│     Auditoría   Pendiente                                                    │
└───────────────────────┴──────────────────────────────────────────────────────┘
 * conectividad = PENDIENTE (CH-19d1) · Operador = reservado, "no implementado"
```

**Global vs. tenant activo**
- Global (no dependen del selector): Tenants, Plantillas, Contrato canónico. Encabezado con `ScopeTag scope="global"`: borde punteado + globo.
- Del tenant activo: todo lo demás. Encabezado con `ScopeTag scope="tenant"`: borde sólido + edificio + nombre. En la navegación, el bloque del tenant lleva su nombre arriba.
- El violeta queda solo en la barra de tenant. La distinción global/tenant se hace con borde e ícono, no con color.

**Recorrido de P1** (el orden de la navegación lo sigue de arriba abajo):
`Tenants › alta` → `Conexiones y agentes › nueva conexión › probar` → `Mapeo y validación › mapear › validar` → `Automatizaciones › nueva (2 pasos)` → `Automatizaciones › au_xx › ejecuciones` (ver la primera). `Tiempos de alta` muestra en qué etapa está cada tenant.

**Comportamiento según el tenant**
| Situación | Barra | Pantallas del tenant | Pantallas globales |
|---|---|---|---|
| Ningún tenant elegido | Ámbar: "Ningún tenant seleccionado" + Elegir tenant | Encabezado + EmptyState "Elegí un tenant para operar" con botón | Normales |
| Tenant activo | Violeta | Normales | Normales |
| Tenant dado de baja | Violeta + chip "Dado de baja · congelado" | Banner neutro (ícono archivo): "X está dado de baja desde el dd/mm. La baja congela todo…"; **todas las acciones que crean, ejecutan o modifican quedan deshabilitadas**; lectura e historial disponibles | Normales |

**Rutas del mockup** (hash; los nombres reales los decide el change): `#tenants`, `#plantillas`, `#contrato`, `#conexiones`, `#conexiones/agentes`, `#mapeo`, `#tiempos`, `#consultas`, `#automatizaciones`, `#automatizaciones/alta`, `#automatizaciones/{id}`, `#frescura`, `#auditoria`.

**Reglas del esqueleto**
- `<body class="zd-root" data-surface="consola">`. Barra de tenant → `.zd-shell` (navegación + `main.zd-page`).
- Paneles laterales y diálogos empiezan **debajo** de la barra de tenant: nunca la tapan.
- Una acción primaria por pantalla, en el encabezado. El resultado de una acción aparece **pegado al control que la disparó** (problema 2 de hoy).
- Densidad única: controles de 34 px, cuerpo de 14 px, tablas `zd-table--compact`, separación entre bloques `--space-6`/`--space-8` (problema 5).

---

## 2. Pantallas

Formato: historia · change · estado. Contenedor con `data-change` y `data-estado`. Estados comunes (cargando / vacío / error / éxito) como en `pantallas.md`.

### C-01 Barra de tenant activo — T4 · CH-06 · EXISTE
- **Muestra**: "Tenant activo", nombre, id, chip de baja si corresponde, conectividad del agente (PENDIENTE), lugar reservado para el operador, Cambiar tenant.
- **Estados**: ningún tenant (ámbar) · tenant elegido (violeta) · tenant dado de baja (violeta + chip).
- **Cambiar tenant**: diálogo con la lista (nombre, id, alta, conectividad o "Dado de baja"); botón de confirmación «Operar sobre {nombre}»; enlace a Tenants para alta y baja.
- **Operador**: `.zd-operator` con borde punteado: "Operador: no implementado". Lo va a necesitar la auditoría.

### C-02 Tenants — sin change de UI · API
- **Datos**: `id` (ten_7f3a) · `nombre` · `estado` (activo / dado de baja) · `alta` (fecha) · `baja` (fecha o vacío) · `conexiones` (entero) · `automatizaciones_activas` (entero).
- **Acciones**: Nuevo tenant (diálogo: nombre) · Elegir como activo · Dar de baja (diálogo: «Dar de baja {nombre}»; texto: congela conexiones, consultas y automatizaciones; no se borra nada).
- **Estados**: vacío ("Todavía no hay tenants") · baja hecha (Banner ok) · el activo dado de baja (la barra pasa a estado congelado).

### C-03 Plantillas — CH-21, CH-24 · API (solo lectura)
- **Datos**: `id` · `nombre` · `descripcion` · `campos_requeridos` (lista de entidad.campo) · `tolerancia_frescura` (texto, "1 h").
- Global. Tabla; clic abre un panel lateral con los campos requeridos.

### C-04 Contrato canónico — M1 · CH-08 · API (solo lectura)
- **Datos**: `entidad` · `campo` · `tipo` · `requerido` (sí/no) · `depende_de` (lista) · `usado_por` (plantillas).
- Global. Tabla agrupada por entidad (fila de encabezado por entidad).

### C-05 Conexiones y agentes — A1, C1, C2 · CH-03, CH-19b, CH-19d1, CH-19d2 · API / PENDIENTE — **con mockup**
Pestañas **Conexiones | Agentes** (dos maneras de llegar a la réplica del mismo tenant; justifica `Tabs`).
- **Conexiones (CH-03 · API)**
  - Datos: `id` (cx_01) · `nombre` · `motor` · `host` · `puerto` · `base` · `usuario` · `alta` · última prueba: `ok`, `cuando`, `latencia`, `tablas_visibles`, `error`, `sqlstate`.
  - Acciones: Nueva conexión (panel lateral: nombre, host, puerto, base, usuario, contraseña → «Guardar y probar») · Probar (por fila o en el detalle) · clic en fila → panel lateral de detalle.
  - Credenciales: la contraseña **nunca se muestra de vuelta**; el detalle dice "Guardada cifrada · no se muestra".
  - Estados: sin conexiones (EmptyState: primer paso de la puesta en marcha) · probando (badge "Probando…") · OK (latencia, motor, tablas) · falla (mensaje + SQLSTATE).
- **Agentes (CH-19b · API)**
  - Datos: `id` · `nombre` · `token_parcial` (zd_ag_••••8f2c) · `alta` · `revocado`.
  - Acciones: Nuevo agente (diálogo: nombre) → Banner ok con el token completo en mono, «Copiar token», "no se vuelve a mostrar" · Revocar (diálogo «Revocar token»; explica impacto en las automatizaciones).
  - Conectividad (CH-19d1 · PENDIENTE): columna con `ConnectivityIndicator` (conectado / desconectado / sin latidos + último latido) y badge "Pendiente".
  - En riesgo (CH-19d2 · PENDIENTE): Banner warn arriba de la tabla con automatizaciones y próxima ejecución.

### C-06 Mapeo y validación — M2, M3, M4 · CH-09, CH-10 · API
- **Datos**: `entidad` · `campo_canonico` · `tipo` · `columna_origen` (o vacío) · `resultado` (mapeado / falta / tipo incompatible / inaplicable) · `motivo` · `plantillas_afectadas`.
- **Acciones**: elegir columna (select con las columnas de la conexión), Marcar entidad como inaplicable (con motivo obligatorio), Validar mapeo, Guardar.
- **Estados**: todo válido (Banner ok) · faltantes (Banner warn con conteo y plantillas bloqueadas) · inaplicable siempre con su motivo a la vista.

### C-07 Tiempos de alta — G1 · CH-15 · API
- **Datos**: por etapa `etapa` (alta, conexión probada, mapeo validado, primera automatización, primera ejecución OK) · `marca` (fecha-hora o vacío) · `desde_anterior` (duración).
- Lista vertical de etapas con KeyValueList; etapa no alcanzada = "—" y badge neutro "Pendiente".

### C-08 Consultas — B1, B2, B3, B4 · CH-04, CH-05, CH-11, CH-25 · EXISTE — **con mockup**
Dos columnas: **Guardadas** (220 px) | **Editor + resultado**. El resultado está pegado debajo del editor.
- **Editor (CH-04)**: conexión (select, id + nombre) · filas por página (25/50/100) · SQL mono · Ejecutar (primario; Ctrl + Enter).
- **Parámetros declarados (CH-11)**: filas `:nombre` (mono) · tipo (entero, decimal, texto, fecha, booleano) · valor (vacío = NULL) · quitar; «Agregar parámetro».
- **Resultado**: línea de estado (`.zd-statusline`: filas, duración, conexión, badge "Cortado en el tope (1.000 filas)") + tabla paginada (números a la derecha, NULL en itálica).
  - Estados: sin ejecutar (EmptyState) · ejecutando (spinner) · éxito · sin filas · cortado en el tope · error de sintaxis / sentencia de escritura / timeout → Banner error con explicación legible y `SQLSTATE` en mono.
- **Guardadas (CH-05)**: lista (nombre, descripción, versión vigente, última edición) → clic = Cargar al editor. «Consulta nueva». Sin consulta cargada: «Guardar consulta» (diálogo: nombre, descripción).
- **Versiones (CH-25)**, con una consulta cargada: franja arriba del editor con nombre + badge "Versión N · vigente" + «Guardar como nueva versión» (diálogo: nota opcional; botón «Guardar versión N+1») + «Versiones».
  - Panel lateral: lista (versión, fecha, nota o "Sin nota"); la vigente con badge **ícono + "Vigente"**; las demás: «Comparar con la actual», «Restaurar».
  - Comparar: panel ancho con **dos bloques de texto lado a lado, sin diff** (`.zd-compare`).
  - Restaurar: diálogo «Restaurar versión N»; crea la versión N+1, nunca borra. Banner ok al terminar.

### C-09 Automatizaciones — D1, D2, D3, N3 · CH-12, CH-13, CH-21 · EXISTE — **con mockup**
- **Lista**: automatización (plantilla + id) · conexión · cron (expresión mono + texto humano) · estado (Activa / Desactivada) · alta · acciones (Ver ejecuciones, Desactivar).
  - Desactivar: diálogo «Desactivar au_xx»; el historial se conserva.
  - Vacío: "Este tenant no tiene automatizaciones" + «Nueva automatización».
- **Alta en dos pasos** (`#automatizaciones/alta`), con `Stepper`:
  1. Conexión (select) + plantilla en tarjetas (`TemplatePicker`). Las no disponibles: deshabilitadas, borde punteado, candado + motivo (`.zd-template__why`), enlazado con `aria-describedby`.
  2. Parámetros de la plantilla · frecuencia + hora → **cron resultante en vivo** (`.zd-cron`: expresión + texto) · destinatario · vista previa del correo al costado. «Volver» / «Crear automatización».
- **Estados**: creada → vuelve a la lista con Banner ok y la primera ejecución.

### C-10 Ejecuciones de una automatización — X2, X4, X5, X7 · CH-13, CH-17a, CH-17b · EXISTE — **con mockup**
- Ruta: Automatizaciones › au_xx. Resumen (`KeyValueList layout="grid"`: conexión, cron, destinatario, estado).
- **Tabla**: inicio · fin · duración · filas · estado (OK / Fallo / Omitida por solapamiento / Interrumpida / Reintentando (n/3)) · notificación (Enviada / No enviada / Sin datos / Pendiente / No corresponde) · intentos · error (truncado, completo en `title`).
- Filtro por estado. Clic en fila → panel lateral con todo el detalle y el error en mono.

### C-11 Frescura de datos — F1, F2 · CH-24 · EXISTE
- **Datos**: `ventana_desactualizacion` (minutos, editable) · `ultima_actualizacion_replica` (relativa) · por plantilla `tolerancia` y `estado` (Al día / Desactualizada / Sin declarar, con ícono y texto).
- **Acciones**: Guardar ventana · «Marcar réplica actualizada ahora».
- Composición: tarjeta con `KeyValueList` + acción; debajo `DataTable` de plantillas.

### C-12 Auditoría — A5 · sin change · PENDIENTE
- **Datos**: `fecha_hora` · `tenant` · `conexion` · `consulta` (nombre o "ad hoc") · `sql_resumen` (mono, truncado) · `filas` · `duracion` · `resultado` (OK / rechazada / timeout) · `operador` (columna reservada: "—" hasta que exista identidad).
- Solo lectura, filtros por fecha y resultado.

---

## 3. Tabla change → pantallas

| Change | Pantalla | Estado |
|---|---|---|
| CH-03 | C-05 Conexiones | API |
| CH-04 | C-08 Consultas: editor y resultado | EXISTE |
| CH-05 | C-08 Consultas: guardadas | EXISTE |
| CH-06 | C-01 Barra de tenant | EXISTE |
| CH-08 | C-04 Contrato canónico | API |
| CH-09, CH-10 | C-06 Mapeo y validación | API |
| CH-11 | C-08 Consultas: parámetros | EXISTE |
| CH-12, CH-13 | C-09 Automatizaciones · C-10 Ejecuciones | EXISTE |
| CH-15 | C-07 Tiempos de alta | API |
| CH-17a, CH-17b | C-10 Ejecuciones: estados | EXISTE |
| CH-19b | C-05 Agentes | API |
| CH-19d1 | C-01 y C-05: conectividad | PENDIENTE |
| CH-19d2 | C-05: automatizaciones en riesgo | PENDIENTE |
| CH-21 | C-09 Alta en dos pasos · C-03 Plantillas | EXISTE / API |
| CH-24 | C-11 Frescura · C-03 tolerancias | EXISTE |
| CH-25 | C-08 Consultas: versiones | EXISTE (verificación visual pendiente) |
| — | C-02 Tenants | API, sin change de UI |
| — | C-12 Auditoría | PENDIENTE, sin change |

---

## 4. Componentes nuevos

| Componente | Clases `.zd-*` | Estados / variantes |
|---|---|---|
| SideNav | `.zd-shell` `.zd-sidenav` `__brand` `__group` `__heading` `__scope` `__tenant` `__subheading` `__item[aria-current=page]` `__meta` `__foot` | activo · hover · marca "API"/"Pendiente" · sin tenant ("Ninguno") |
| PageHeader | `.zd-pagehead` `__text` `__crumbs` `__meta` `__desc` `__actions` | con/sin migas · con/sin acciones |
| ScopeTag | `.zd-scope` `--global` `--tenant` `--none` | global (punteado) · tenant (sólido) · sin tenant (ámbar) |
| Tabs | `.zd-tabs` `.zd-tab[role=tab][aria-selected]` `.zd-tab__count` | seleccionada · hover · flechas izq./der. |
| Drawer (panel lateral) | `.zd-drawer` `--wide` `__head` `__body` `__foot` | 420 px · ancho 900 px (comparar) · debajo de la barra de tenant |
| Dialog | `.zd-dialog-backdrop` `.zd-dialog` `__title` `__body` `__actions` | confirmación primaria · destructiva (danger) |
| KeyValueList | `.zd-kv` `--stack` · `.zd-kvgrid` | filas · grilla · apilada |
| (CSS sin componente) | `.zd-statusline` · `.zd-compare` · `.zd-cron` · `.zd-split` · `.zd-list` `__item[aria-current]` · `.zd-badge--pending` · `.zd-template__why` · `.zd-tenantbar__flag` · `.zd-operator` · `.zd-page` | — |

Todos usan los tokens existentes; ninguno usa violeta.

---

## 5. Adopción incremental (en orden)

Cada paso entra solo, sin romper los demás. Los `id` actuales se **mueven, no se renombran**.

1. **Hoja compartida.** Agregar `styles.css` (tokens + `components.css`) junto al string actual de `src/consola.ts`, `data-surface="consola"` en `<body>`. Sin cambios de marcado: solo tipografía y color. Riesgo nulo.
2. **Barra de tenant (CH-06).** Reemplazar su marcado por `.zd-tenantbar` manteniendo ids y el selector. Agregar los estados "ningún tenant" y "dado de baja" (este último deshabilita acciones con un solo flag en `<body>`, p. ej. `data-congelado`).
3. **Esqueleto sin mover nada.** Envolver la página actual en `.zd-shell` con la navegación lateral; cada ítem es un **ancla** a la sección existente (`#consultas`, `#automatizaciones`, `#frescura`). La página sigue siendo una sola: el script y los tests no cambian.
4. **Separar en pantallas por hash.** Mostrar una sección por vez según `location.hash` (`hidden` en las demás). Mismo DOM, mismos ids: los tests que buscan elementos siguen encontrándolos.
5. **Consultas (CH-04/05/11/25).** Reordenar dentro de su sección: guardadas a la izquierda, resultado **inmediatamente debajo** del botón Ejecutar, versiones en `.zd-drawer`. Resuelve el problema 2.
6. **Automatizaciones (CH-12/13/21, CH-17).** Lista → alta y ejecuciones como sub-vistas (`#automatizaciones/alta`, `#automatizaciones/{id}`). Ejecuciones con panel lateral de detalle.
7. **Frescura (CH-24).** Solo reencuadre con `PageHeader` + tarjeta.
8. **Pantallas nuevas sobre API existente**, cada una independiente, en el orden del recorrido: Conexiones (CH-03) → Tenants → Agentes (CH-19b) → Mapeo y validación (CH-09/10) → Plantillas y Contrato (solo lectura) → Tiempos de alta (CH-15).
9. **PENDIENTES** cuando exista el backend: conectividad (CH-19d1) en barra y agentes; en riesgo (CH-19d2); Auditoría.

**Mapa de ids**: no tuve acceso a `src/consola.ts`, así que el mockup no reproduce los ids actuales. Antes del paso 3, completar esta tabla leyendo el archivo:

| id actual | Pantalla destino | Contenedor nuevo |
|---|---|---|
| (completar) | C-08 Consultas | `section[data-change~="CH-04"]` |

---

## 6. Propuestas (detectadas, NO diseñadas)
- Ver de un vistazo en qué etapa está cada tenant (columna "Etapa" en Tenants, a partir de Tiempos de alta).
- Reactivar una automatización desactivada (hoy solo se desactiva).
- Editar una automatización existente (horario, destinatario) sin recrearla.
- Volver a mostrar el detalle de la última prueba de cada conexión en Consultas al elegirla.
- Atajo "Ejecutar de nuevo con otros parámetros" desde el detalle de una ejecución fallida.
- Identidad del operador (requiere autenticación: decisión de producto, registrar en `docs/01-decisiones.md`).

## 7. Pendientes al importar (2026-10-09)

Esta guía se importó de la exportación de Claude Design sin sus cambios al panel (que revertían DEC-93). Antes de implementar cualquier pantalla de acá (CH-30), resolver:

1. **Mapeo de ids.** Esta guía se escribió sin ver `src/consola.ts` y el mockup usa ids propios (`q-sql`, `q-result`, `a-cx`…). Los ids de la consola real (lista `IDS` de `src/consola.test.ts`) son contrato con el script y los tests: se mueven de lugar, no se renombran. Completar la tabla de la sección 5 contra esa lista.
2. **El mockup no es código portable.** Arma el HTML con `innerHTML` y tiene unos 55 estilos en línea. La consola real escribe todo como texto con nodos y no asigna clases `zd-*` desde el script (guardia G3'). Usarlo como referencia visual; los estilos en línea pasan a clases.
3. **Fuera del inventario del prompt.** El botón de modo claro u oscuro de la barra lateral (el modo va por tokens y por la preferencia del sistema) no se implementa sin decisión.
4. **Conectividad.** La barra de tenant y el selector muestran conectado, desconectado y último latido como si existieran: son de CH-19d1 y CH-19d2, no construidos. Hasta entonces, no se muestran.
5. **Campos que la API no devuelve hoy.** Por ejemplo, cantidad de conexiones y de automatizaciones activas por tenant (C-02), tablas visibles y latencia de una conexión. Cada uno es un cambio de API que se decide en su change, no en el diseño.
6. **Cómo se sirven las pantallas.** Esta guía asume una sola página en `/consola` con secciones por `#ancla`. Es una decisión de arquitectura abierta en `openspec/changes/CH-30-rediseno-de-la-consola/exploration.md`.
7. **Changes reales.** C-02 Tenants, C-05 Conexiones y agentes, C-06 Mapeo y C-12 Auditoría figuran como "sin change": corresponden a CH-30 (cortes b, c y d) y a CH-20 (auditoría, que depende de CH-29 para el "por quién"). Ver `docs/02-mapa-de-changes.md`.
