# Patrones de interfaz administrativa — consola P1

Reglas para diseñar y evolucionar la consola del implementador (P1) **sobre la implementación existente**. Extiende `README.md`, `consola.md` y `lenguaje.md`; no los reemplaza ni agrega identidad visual: todo se resuelve con los tokens y las clases `.zd-*` que ya existen.

**Fuentes** (2026-11): `EXPLORE` (auditoría funcional y UX/UI del código de `src/consola/consola.ts`; las referencias `Lnnn` son líneas de ese archivo) y capturas de Metabase usadas **solo como referencia de patrones** (distribución, jerarquía, interacción), nunca de identidad.

Cada regla tiene un id (`N3`, `W6`…) para citarla en PROPOSE y APPLY.

---

## 0. Cómo usar esta guía en el flujo SDD

**Orden de autoridad** cuando dos fuentes no coinciden:
1. **Comportamiento** → el código actual y el EXPLORE. El diseño nunca agrega capacidades ni cambia reglas de negocio.
2. **Patrón de interfaz** → esta guía.
3. **Especificación de pantallas** → `consola.md` (v2 de 2026-10; ver su sección "Estado real" al principio).
4. **Fundamentos visuales y tokens** → `README.md` y `tokens.json`. Esta guía no los modifica.

**PROPOSE** — por cada vista o problema, una ficha:
- **Problema**: qué falla hoy, con su referencia (`EXPLORE §3`, `L3536`). Marcar si es *verificado* o *hipótesis*.
- **Patrón**: id de esta guía (`C2`, `W6`).
- **Cambio mínimo**: qué se mueve, qué texto cambia, qué estado se agrega. Boceto ASCII si cambia la distribución.
- **Qué no cambia**: ids, endpoints, reglas de negocio, comportamiento intencional.
- **Riesgo técnico**: ids que se mueven, estados que dependen de clases (ver §12, guarda G3'), tests afectados.

**APPLY** — un patrón por change, ids que se mueven sin renombrarse, estados expresados con atributos (§12), y el checklist del §14 antes de cerrar.

---

## 1. Referencias externas (Metabase u otras)

Se toma la **estructura**, nunca la **piel**.

| Se toma | No se toma |
|---|---|
| Ubicación de zonas (barra de contexto arriba del editor, resultado debajo, panel de referencia a la derecha) | Colores, fondo oscuro, azul de marca, tipografía, radios, sombras |
| Orden y agrupación de la navegación (grupos con encabezado, lo secundario al pie) | Ilustraciones de fondo, mascotas, saludos ("Hola, Agustín") |
| Anatomía de diálogos (título con el objeto, una línea de consecuencia, botón con verbo + objeto) | Asistentes de IA ("Dejá que Metabot lo arregle"): anti-alcance |
| Estados en el lugar del resultado (vacío didáctico, error con detalle técnico encajonado) | Barras de herramientas de solo íconos crípticos (`{=}`, `{x}`) |
| Línea de estado del resultado (filas · duración) | Búsqueda global, botón global "Nuevo", "Continuá donde lo dejaste": no existen en el sistema |
| Toolbar de lista (búsqueda + filtro + tabla con acciones al final de la fila) | Botón Ejecutar solo con ícono; "Guardar" como enlace de texto |

Si un patrón de la referencia necesita datos o una API que la consola no tiene (por ejemplo, listar las tablas de la réplica), **no se adopta**: se anota en "Propuestas" de `consola.md`.

---

## 2. Navegación multi-tenant (N)

- **N1 · Dos alcances, dos bloques con título.** El bloque global se titula "Global"; el bloque del tenant se titula con **el nombre del tenant activo** (id en mono debajo). Ningún grupo queda sin título: hoy "Puesta en marcha" y "Trabajo diario" flotan sin decir de qué dependen (EXPLORE §3).
- **N2 · Orden = dependencia real.** Dentro de "Puesta en marcha": Agentes *(opcional: solo redes privadas)* → Conexiones → Mapeo y validación → Usuarios del panel → Tablero del cliente. La opción "vía agente" de Conexiones solo aparece si existe el agente (`L5295`), así que Agentes va antes.
- **N3 · Lo secundario va al pie.** "Tiempos de alta" es una métrica de investigación (P4): va separada al pie de la navegación con su propio encabezado ("Investigación"), como la Papelera en Metabase. No compite con el recorrido.
- **N4 · Catálogo global que se prueba con un tenant.** Plantillas y Reportes se definen globalmente pero no se guardan sin tenant activo, conexión y mapeo validado (`L6128`, `L6887`). En la navegación siguen en "Global", con meta "Se prueba con el tenant activo"; en su encabezado, `ScopeTag global` + línea "Prueba sobre: {tenant} · {conexión}". Sin tenant, la pantalla se puede leer y las acciones Probar/Guardar quedan deshabilitadas con el motivo al lado (B2).
- **N5 · Prerrequisitos visibles, nunca ítems ocultos ni deshabilitados.** Los ítems de navegación siempre se ven y se pueden abrir. Si falta un paso previo, la pantalla lo dice con el estado "bloqueado" (E6) y un enlace al paso que falta.
- **N6 · Marcas de avance (opcional).** Si la consola ya calcula la etapa (Tiempos de alta), cada ítem de "Puesta en marcha" puede llevar una marca **ícono + texto accesible** (circle-check "Hecho" / circle-dashed "Pendiente"). Nada que requiera datos nuevos.
- **N7 · Un solo camino para cambiar de tenant.** Siempre por el diálogo de la barra con «Operar sobre {nombre}». El botón "Elegir como activo" de la tabla de Tenants abre **el mismo diálogo** con ese tenant preseleccionado. Hoy hay dos caminos y solo uno confirma (EXPLORE §3).
- **N8 · Cambios sin guardar.** Si la vista tiene cambios sin guardar, el diálogo de cambio de tenant lo dice dentro del diálogo: "Tenés cambios sin guardar en Tablero del cliente. Si cambiás de tenant, se descartan." (Hoy se descartan sin aviso.)
- **N9 · Orientación.** Toda vista tiene `PageHeader` con alcance; las subvistas llevan migas ("Automatizaciones › au_12"). Un hash desconocido muestra "Esta sección no existe" con enlace a la vista inicial, en lugar de abrir Consultas sin avisar.

```
┌ BARRA DE TENANT (violeta) ─ Tenant activo: Almacén Don Tito · ten_7f3a ── [Cambiar tenant] ┐
├──────────────────────────────┬──────────────────────────────────────────────────────────────┤
│ GLOBAL                       │                                                              │
│   Tenants                    │                                                              │
│   Contrato canónico          │                                                              │
│   Plantillas   se prueba ↓   │                                                              │
│   Reportes     se prueba ↓   │                                                              │
│ ──────────────────────────── │                                                              │
│ ALMACÉN DON TITO  ten_7f3a   │                                                              │
│  PUESTA EN MARCHA            │                                                              │
│   ✓ Agentes (opcional)       │                                                              │
│   ✓ Conexiones               │                                                              │
│   ○ Mapeo y validación       │                                                              │
│   ○ Usuarios del panel       │                                                              │
│   ○ Tablero del cliente      │                                                              │
│  TRABAJO DIARIO              │                                                              │
│   Consultas · Automatizaciones · Frescura de datos · Auditoría                              │
│ ──────────────────────────── │                                                              │
│ INVESTIGACIÓN                │                                                              │
│   Tiempos de alta            │                                                              │
└──────────────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 3. Anatomía de pantalla (P)

Cuatro zonas, siempre en este orden:
1. **Encabezado** (`PageHeader`): alcance · título · una frase de propósito · acción primaria.
2. **Franja de contexto** (opcional): de qué depende la vista y en qué estado está (`.zd-statusline`, guía de puesta en marcha G1, banner de estado de la pantalla).
3. **Contenido**.
4. **Feedback** pegado al control que lo disparó.

- **P1 · Una sola acción primaria por pantalla**, en el encabezado. En formularios largos, la primaria del formulario vive en su pie (F7). Una acción destructiva nunca ocupa el lugar de la primaria.
- **P2 · Frase de propósito obligatoria**: qué se hace acá + para qué sirve en el flujo. Hoy Consultas y Frescura no la tienen (EXPLORE §3).
- **P3 · El título no se repite** en h1 y h2 (Frescura hoy).
- **P4 · Anchos**: tablas y bancos de trabajo usan todo el ancho (máx. 1280 px); formularios en una columna de hasta 720 px; panel de referencia 280–320 px.
- **P5 · Diálogo, panel lateral o página.** Elegir por la duración y el tamaño de la tarea:

| Contenedor | Para | Ejemplos |
|---|---|---|
| `Dialog` | Confirmar, o completar 1 a 3 campos | Baja de tenant, guardar consulta (nombre + descripción), nuevo agente |
| `Drawer` | Ver o editar un detalle sin perder la lista | Detalle de ejecución, detalle de conexión, versiones |
| Página o subvista con hash | El trabajo principal de la vista; cualquier cosa con scroll o que tome más de un minuto | Editor de Consultas, editor de Plantilla o Reporte, Mapeo de una entidad |

  El editor de Consultas hoy vive en un modal con SQL, parámetros, resultados y paginación (EXPLORE §3): debe ser página.

---

## 4. Banco de trabajo SQL (W) — Consultas, Mapeo, Plantillas, Reportes

Las cuatro vistas escriben SQL contra una conexión y miran un resultado. Comparten **un mismo esqueleto**; cambian solo el panel de referencia y la acción posterior a ejecutar.

```
┌ PageHeader: alcance · título · propósito ─────────────────────────── [acción primaria] ┐
├ Barra de contexto: Conexión [cx_01 · Réplica principal ▾] · Parámetros: :umbral [25] · Filas por página [50 ▾] ┤
├───────────────────────────────────────────────────────────────┬─────────────────────────┤
│  1  SELECT p.id, p.nombre, s.cantidad                         │ REFERENCIA        [×]   │
│  2  FROM v_producto p                                         │ Lo que depende de la    │
│  3  …                                                         │ vista: campos del       │
│                                                               │ contrato, vistas        │
│ [▶ Ejecutar consulta]  Ctrl + Enter        [Guardar] [Más ▾]  │ canónicas, parámetros   │
├───────────────────────────────────────────────────────────────┤ declarados.             │
│ 12 filas · 301 ms · cx_01 · [Cortado en el tope]  (statusline)│                         │
│ ┌ tabla de resultado / error / vacío ─────────────────────┐   │                         │
└───────────────────────────────────────────────────────────────┴─────────────────────────┘
```

- **W1 · Mismo esqueleto en las cuatro vistas.** Si P1 aprende uno, aprende todos.
- **W2 · Contexto antes que el editor.** La conexión (y el tenant, por la barra) se ve arriba del SQL. Nunca se ejecuta sin la conexión visible.
- **W3 · Parámetros cerca del editor.** Los **valores de prueba** van en la barra de contexto, uno por parámetro (`:nombre` en mono + campo), como hace Metabase con "Param: valor ×". La **declaración** (tipo, opcional) va en un bloque plegable debajo del editor.
- **W4 · Ejecutar con texto y atajo visible.** «Ejecutar consulta» + "Ctrl + Enter" al lado. Mientras corre: botón en estado cargando ("Ejecutando…"), resultado anterior atenuado con `aria-busy`.
- **W5 · Resultado debajo, sin saltos.** Primero la línea de estado (filas, duración, conexión, tope) y después la tabla. El resultado reemplaza el área; nunca abre otra ventana.
- **W6 · Error en el lugar del resultado.** Título humano ("La consulta no se pudo ejecutar") + regla en una frase + bloque mono copiable con el detalle (SQLSTATE, línea, mensaje del motor) + acción siguiente. Nunca solo "HTTP 500".
- **W7 · Antes de ejecutar, un vacío didáctico** en el área de resultado: "Ejecutá la consulta para ver el resultado acá (Ctrl + Enter)."
- **W8 · Panel de referencia solo con datos que la consola ya tiene**: contrato canónico, campos esperados de la entidad, vistas canónicas que arma el mapeo, parámetros declarados. **No** listar tablas o columnas de la réplica si no existe esa API (sería una capacidad nueva). Plegable, con scroll propio.
- **W9 · Altura del editor**: mínimo 8 líneas visibles; el resultado ocupa el resto. Redimensionar es deseable solo si es barato.

---

## 5. Formularios técnicos complejos (F)

- **F1 · Secciones numeradas en el orden en que se piensa la tarea**: qué es → de dónde salen los datos → parámetros → salida → prueba. Cada sección con título y una frase de propósito. Sin pestañas: un error escondido en una pestaña no se ve.
- **F2 · Etiqueta siempre visible arriba**, ayuda debajo, ejemplo en la ayuda (no en el placeholder). Mono solo para SQL, ids y expresiones.
- **F3 · Opcionales marcados "(opcional)"** en la etiqueta. Lo no marcado es obligatorio.
- **F4 · Probar antes de guardar (comportamiento intencional, se explica).** Pie de acciones con dos estados:
  - Sin prueba exitosa: primaria **Probar**; Guardar deshabilitado con el motivo al lado: "Guardar se habilita con una prueba exitosa."
  - Con prueba exitosa: primaria **Guardar**; al lado, "Última prueba: OK · 14:02 · 12 filas".
  - Si el código invalida la prueba al editar, decirlo ("Cambiaste el SQL: volvé a probar"). Si no la invalida, no prometerlo.
- **F5 · Las restricciones se explican antes de chocar con ellas.**
  - Plantilla o reporte en uso: banner neutro arriba al abrir, "Esta plantilla la usan 3 automatizaciones: no se edita. Duplicala para hacer cambios.", con «Duplicar plantilla» como primaria.
  - Conexión: en el alta, "Una conexión registrada no se edita ni se borra. Probala antes de guardar."
  - Tokens y claves: banner ok con el valor en mono, «Copiar» y "No se vuelve a mostrar".
- **F6 · Errores junto al campo**; si hay más de uno, resumen arriba con enlaces y foco al primero.
- **F7 · Pie de acciones**: alineado a la derecha, primaria a la derecha, «Cancelar» a su izquierda (igual que en `Dialog`). Fijo (sticky) en formularios largos.
- **F8 · Cambios sin guardar**: aviso al salir de la vista o cambiar de tenant (N8).

---

## 6. Tablas y listados (T)

- **T1 · Toolbar arriba de la tabla**: búsqueda (si la lista puede pasar de ~10 elementos) + filtros + contador ("12 consultas"). La acción de crear va en el encabezado, no en la toolbar.
- **T2 · Orden de columnas**: identidad primero (nombre + id en mono, más chico, en la misma celda) → estado (badge) → datos → fechas → acciones al final.
- **T3 · Densidad**: hasta ~7 columnas visibles a 1280 px. Lo que sobra (SQL resumido, error completo) va al panel de detalle. Auditoría (9 columnas) y Automatizaciones son candidatas: *hipótesis*, validar con la app corriendo.
- **T4 · Acciones de fila**: hasta 2 visibles como `ghost`. La destructiva va **siempre última, separada, en variante danger** (ícono + texto en `--error-text`); nunca con el mismo aspecto que una inocua (EXPLORE §3). Con más de 2 acciones, «Más acciones» en un menú.
- **T5 · Fila clicable → panel de detalle.** Los botones de la fila no disparan el clic de la fila.
- **T6 · Estados distintos**: cargando (skeleton), vacío (qué falta + acción), filtrado sin resultados ("Ninguna consulta coincide con 'stock'" + «Limpiar filtros»), error (con «Reintentar»).
- **T7 · Una sola zona horaria en toda la consola**, rotulada una vez por vista (encabezado de columna o statusline: "Hora de Buenos Aires (UTC−3)"). Mientras Automatizaciones use la del servidor y las listas la del navegador (EXPLORE §3), cada una debe rotular la suya.
- **T8 · Listas de elementos guardados** (consultas guardadas): cada ítem muestra nombre, versión vigente, conexión y última edición; búsqueda arriba; el ítem cargado con `aria-current`.

---

## 7. Estados y feedback (E)

- **E1 · Un solo sistema de avisos: `Banner` (`.zd-banner`).** El `.banner` propio se migra. Ubicación por alcance:
  - resultado de una acción → pegado al control que la disparó;
  - estado de la pantalla → debajo del encabezado;
  - estado global (sin tenant, tenant dado de baja) → barra de tenant.
  - **Con un diálogo abierto, el feedback va dentro del diálogo.** Nada queda detrás del velo (hoy el banner global queda detrás).
- **E2 · Acciones asíncronas**: el botón pasa a cargando con verbo en gerundio ("Probando…", "Validando…"), queda deshabilitado y no mueve el layout.
- **E3 · Éxito**: banner ok descartable **o** el resultado mismo, no los dos. Si hay paso siguiente, el banner lo ofrece (G2).
- **E4 · Errores en lenguaje humano** (fórmula de `lenguaje.md`): qué no se pudo + por qué + qué hacer + detalle técnico en mono al final. Los errores HTTP se traducen (tabla en `lenguaje.md`).
- **E5 · Estado = ícono + texto**, siempre (regla existente).
- **E6 · Estado "bloqueado por prerrequisito"**: `EmptyState` con ícono `lock`, título "Primero {paso que falta}", una frase de por qué y el botón «Ir a {vista}». Ejemplo en Plantillas sin mapeo validado: "Primero validá el mapeo de este tenant. Las plantillas se prueban sobre las vistas canónicas que arma el mapeo." · «Ir a Mapeo y validación».

---

## 8. Confirmaciones graduadas (C)

Un solo patrón (`Dialog`), con cuatro niveles según la gravedad. Hoy cada acción confirma de una forma distinta y "Desactivar automatización" no confirma (`L3536`).

| Nivel | Cuándo | Cómo | Acciones actuales |
|---|---|---|---|
| **C0** | Reversible y sin impacto | Sin confirmación; banner de resultado | Probar, ejecutar, duplicar |
| **C1** | Reversible con impacto | `Dialog`: título "¿{Acción} {objeto}?", una línea de consecuencia, botón primario con verbo + objeto | Desactivar usuario (se reactiva), Restaurar versión (crea una nueva, no borra), Cambiar de tenant |
| **C2** | Irreversible | `Dialog` + "No se puede deshacer." + consecuencias en lista corta; botón **danger**; foco inicial en «Cancelar» | Desactivar automatización (no se reactiva), Revocar token |
| **C3** | Irreversible y de alcance amplio | C2 + escribir el nombre para habilitar el botón | Baja de tenant |

Reglas comunes: «Cancelar» a la izquierda, acción a la derecha; Esc cierra; el foco queda dentro del diálogo y vuelve al control que lo abrió al cerrar (hoy no se retiene ni se devuelve, EXPLORE §3). La confirmación en línea dentro de la fila deja de usarse.

---

## 9. Ayuda contextual y microcopy (M)

- **M1 · Cada pantalla dice qué es y dónde está en el flujo**: "Paso 3 de la puesta en marcha. Escribí un SELECT por entidad y validalo: sin mapeo validado no se pueden probar plantillas ni reportes."
- **M2 · La jerga se explica la primera vez que aparece en cada pantalla**: texto de ayuda bajo el campo o `<abbr title="…">`. Las definiciones están en el glosario de consola de `lenguaje.md` (réplica, cron, SQLSTATE, token, vista canónica…). Los términos se pueden usar en la consola; lo que no se puede es dejarlos sin explicar.
- **M3 · Lo intencional se explica, no se esconde** (F5): conexiones que solo se duplican, guardar con prueba, tokens y claves que se muestran una vez.
- **M4 · Voseo en todo.** "Usted" en la consola es un defecto (hoy hay mezcla, EXPLORE §3).
- **M5 · Los textos nombran los controles tal como se llaman.** Si el botón dice «Ejecutar consulta», la ayuda no dice "Probá".
- **M6 · Las etiquetas de alcance dicen la verdad.** "Global" solo para lo que funciona sin tenant; lo demás lleva la aclaración de N4.

---

## 10. Flujos guiados y reducción de pasos (G)

- **G1 · Guía de puesta en marcha como capa, no como asistente.** Una franja de contexto en cada vista de "Puesta en marcha" con las etapas que **ya calcula** Tiempos de alta:
  `Puesta en marcha: ✓ Conexión · ● Mapeo (estás acá) · ○ Usuarios del panel · ○ Tablero · ○ Primera automatización — Siguiente: Usuarios del panel →`
  Usa `.zd-statusline` + íconos de estado con texto. No reemplaza las pantallas, no bloquea el uso libre y no requiere datos nuevos.
- **G2 · "Siguiente paso" al terminar cada etapa.** El banner de éxito ofrece el enlace a la etapa siguiente (hoy solo existe después de crear el tenant).
- **G3 · Menos saltos**: si hay una sola conexión, viene preseleccionada; los enlaces llevan a la entidad o al registro exacto (`#mapeo/producto`); después de resolver un prerrequisito, se ofrece volver a la vista de origen.
- **G4 · `Stepper` solo para altas de varios pasos** (alta de automatización). La puesta en marcha completa no es un wizard.
- **G5 · Lineal y fijo** (regla existente): nada de nodos, flujos ni ramas.

---

## 11. Consistencia entre vistas (K)

- **K1 · Mismos verbos para las mismas acciones**: Nueva/Nuevo {objeto}, Probar, Guardar, Duplicar, Desactivar, Revocar, Restaurar, Ver ejecuciones.
- **K2 · Mismas posiciones**: primaria en el encabezado; acciones de formulario abajo a la derecha; acciones de fila al final; destructiva al final de todo.
- **K3 · Plantillas y Reportes comparten esqueleto** (comparten diálogo hoy): mismas secciones, en el mismo orden; solo cambia la sección de salida (mensaje o gráfico).
- **K4 · Las diferencias de comportamiento se señalan, no se igualan desde el diseño.** Ej.: duplicar una plantilla vacía sus textos y duplicar un reporte los conserva (EXPLORE §3). El diseño no lo cambia: lo marca en PROPOSE como decisión pendiente y, mientras tanto, lo avisa en el diálogo de duplicar.
- **K5 · El mismo estado se ve igual en todas partes**: token de agente y clave de usuario usan el mismo banner de "una sola vez"; "en uso, solo duplicar" usa el mismo banner en Plantillas, Reportes y Conexiones.

---

## 12. Restricción técnica: estados por atributo (guarda G3')

- El HTML se arma en el servidor, el JS es inline y sin framework, y **la guarda G3' impide que el script asigne clases `zd-*`**. Hay un puente en `L110–320`.
- Por eso, todo estado que cambia en el cliente se expresa con **atributos** que el CSS ya pueda leer: `hidden`, `disabled`, `aria-current`, `aria-selected`, `aria-expanded`, `aria-invalid`, `aria-busy`, `data-estado`, `data-tone`. Las clases `zd-*` las pone el servidor.
- Antes de proponer un estado, verificar en el puente qué atributos traduce. Si una propuesta necesita una clase dinámica, debe decir explícitamente **"propone cambiar G3'"** y justificarlo. Esto explica por qué `zd-badge`, `zd-kv`, `zd-statusline`, `zd-compare`, `zd-cron` y `zd-tabs` existen pero no se usan.
- Accesibilidad mínima en lo que se toque: foco dentro de diálogos (C), `label` asociado en cada campo (hoy faltan en Mapeo), `role="alert"` en errores, `aria-live="polite"` en la línea de estado del resultado.

---

## 13. Aplicación a las vistas prioritarias

### Navegación y barra de tenant — intervención alta
N1–N9 sobre `SideNav` y `TenantBar` existentes. Cambios de orden y títulos, sin pantallas nuevas. Sin tenant: el bloque del tenant se titula "Ningún tenant" y cada vista muestra el `EmptyState` "Elegí un tenant para operar".

### Consultas — intervención alta
- Encabezado con propósito: "Explorá la réplica del tenant activo con SQL de solo lectura. Usala para revisar un mapeo, una plantilla o un reporte antes de guardarlos. Plantillas y automatizaciones no usan estas consultas."
- El editor pasa de modal a página (P5) con el esqueleto W. Columna izquierda de consultas guardadas con búsqueda, versión vigente y conexión (T8).
- Panel de referencia (W8) con el contrato canónico y las vistas canónicas.
- Enlaces cruzados en el panel o al pie: «Ir a Mapeo y validación», «Ir a Plantillas». Solo navegación: no se inventa "usar esta consulta en una plantilla".

### Mapeo y validación — intervención alta
```
┌ PageHeader · franja G1 ─────────────────────────────────────── [Validar mapeo] ┐
│ ENTIDADES                │ producto · SELECT                 │ CAMPOS ESPERADOS │
│ ✓ producto   validada    │ 1 SELECT id, nombre, …            │ ✓ id       entero │
│ ● stock      sin validar │                                   │ ✓ nombre   texto  │
│ ○ pedido     sin SELECT  │ [▶ Probar SELECT]                 │ ✗ stock_minimo    │
│ ○ item_pedido            │ 12 filas · 210 ms                 │   falta           │
│                          │ (resultado)                       │                   │
└──────────────────────────┴───────────────────────────────────┴───────────────────┘
```
- Lista de entidades con estado (ícono + texto) a la izquierda; banco de trabajo (W) en el centro; **campos esperados del contrato** a la derecha como checklist, contrastados con el último resultado.
- Arriba del botón, qué hace falta para validar, en una frase tomada del código (no inventar reglas).
- Resultado de la validación: banner con conteo ("4 de 6 entidades validadas") + por entidad, qué campo falta o qué tipo no coincide, con enlace a la entidad.

### Plantillas — intervención media (Reportes con el mismo esqueleto)
Página de edición con secciones numeradas (F1):
1. **Qué es**: nombre, descripción, tolerancia de frescura. Ayuda: "Una plantilla es una automatización reutilizable: una consulta sobre las vistas canónicas, parámetros que completa cada automatización y el mensaje que se envía."
2. **Consulta**: banco de trabajo W con referencia de vistas canónicas.
3. **Parámetros**: declaración (nombre, tipo, opcional) y valor de prueba.
4. **Mensaje**: textos y formato, con la vista previa al costado.
5. **Prueba**: resultado + vista previa del mensaje con ese resultado.
Pie fijo con F4. Si está en uso, banner F5 y «Duplicar plantilla». Encabezado con N4 ("Prueba sobre: {tenant} · {conexión}").

### Automatizaciones — solo ajustes puntuales
- «Desactivar» con confirmación C2: "¿Desactivar au_12?" · "No se puede reactivar. El historial de ejecuciones se conserva." · botón danger «Desactivar au_12».
- Desactivar como acción danger al final de la fila (T4).
- Zona horaria rotulada (T7). Estados con `StatusBadge`. Nada más.

### Reportes — mantener
Mismo esqueleto que Plantillas (K3); para la vista previa del resultado se permite `Tabs` "Tabla | Gráfico" (dos vistas del mismo resultado). Sin cambios de estructura general.

---

## 14. Checklist para PROPOSE y APPLY

- [ ] ¿La propuesta usa solo capacidades que el sistema ya tiene? (nada de APIs, datos ni pantallas nuevas sin marcarlo)
- [ ] ¿Respeta los tokens, componentes y la identidad actual? (nada tomado de la piel de una referencia)
- [ ] ¿El alcance (global o tenant) se ve en el encabezado y la etiqueta dice la verdad? (N4, M6)
- [ ] ¿Hay una sola acción primaria y la destructiva está separada y en danger? (P1, T4)
- [ ] ¿El contenedor (diálogo, panel lateral o página) es el correcto para la tarea? (P5)
- [ ] ¿Cada estado tiene su versión: cargando, vacío, filtrado vacío, error, bloqueado, éxito? (T6, E6)
- [ ] ¿El feedback aparece junto al control y nunca detrás de un diálogo? (E1)
- [ ] ¿La confirmación tiene el nivel correcto? (C0–C3)
- [ ] ¿La jerga está explicada, todo está en voseo y los textos nombran los controles tal como se llaman? (M2, M4, M5)
- [ ] ¿Los comportamientos intencionales están explicados? (F5)
- [ ] ¿Los estados dinámicos se expresan con atributos y no con clases `zd-*` puestas por JS? (§12)
- [ ] ¿Los ids se mueven sin renombrarse y los tests siguen encontrando los elementos?
- [ ] ¿Foco, etiquetas y `role="alert"` en lo que se tocó?
- [ ] ¿Las hipótesis del EXPLORE (densidad, cantidad de pasos, dos pestañas con distinto tenant) se validaron con la app corriendo antes de cerrar?
