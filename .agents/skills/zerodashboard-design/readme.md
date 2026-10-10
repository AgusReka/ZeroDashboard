# ZeroDashboard — Design System

Sistema visual y especificación de pantallas de **ZeroDashboard**: plataforma multi-tenant de automatización de reportes y alertas para e-commerce PYME. Se conecta en **solo lectura** a la base de la tienda, corre automatizaciones programadas con un patrón fijo (**consulta → condición → notificación → registro**) y envía el resultado por correo. Catálogo inicial: alerta de stock físico, alerta de stock producible, reporte diario.

## Fuentes
- `docs/design/prompt-claude-design.md` (en la raíz del repositorio) — brief del producto (superficies, matriz de pantallas con historia/change/estado al 2026-10-03, restricciones de alcance y técnicas). **Única fuente.** No se recibió código, Figma, screenshots ni logo.
- Repositorio referido por el brief (no adjunto): `src/consola.ts` (la UI actual se sirve como string de TypeScript desde Fastify), `AGENTS.md` (regla 1: nada de SQL en el panel), `openspec/changes/archive`, `docs/01-decisiones.md`.
- Decisión pendiente (no tomada acá): cómo se sirven los archivos de UI (string en `src/consola.ts` vs. estáticos). Se registra antes de CH-22.

## Superficies
1. **CONSOLA** (P1 · Implementador) — herramienta interna del proveedor; ve todos los tenants; usuario técnico. Densa, utilitaria, escritorio primero.
2. **PANEL** (P2 · Administrador PYME) — el cliente; ve solo su tenant (deducido de la sesión); no técnico; **nunca ve SQL ni términos de base de datos**. Más aire, lenguaje de negocio, móvil primero.
3. **CORREO** — reporte HTML (tablas + estilos inline) con versión "sin datos".

Mismos tokens y componentes; la diferencia se hace con `data-surface="panel"` en `<body>` (cuerpo 16 px, controles 44 px, más espacio) y con el lenguaje.

## Principios
1. **Inequívoco antes que lindo.** El tenant activo se ve siempre (barra violeta fija); el estado se dice con texto + ícono, nunca solo con color.
2. **Serio y sobrio.** Neutros fríos, un acento verde petróleo, sombras mínimas. Nada decorativo.
3. **Consola = precisión.** Monoespaciada para SQL e ids, tablas compactas, errores con el dato técnico.
4. **Panel = tranquilidad.** Frases completas, qué pasó y qué hacemos. Sin jerga.
5. **Lineal y fijo.** No hay flujos, nodos ni ramificaciones: el diseño nunca sugiere que se pueden encadenar pasos.

---

## CONTENT FUNDAMENTALS
- **Idioma**: español rioplatense neutro con **voseo** ("elegí", "tenés", "podés"). Sin lunfardo.
- **Persona**: el producto habla como "nosotros" y al usuario de "vos". "Te avisamos por correo…", "No pudimos armar tu resumen…".
- **Casing**: sentence case en todo (títulos, botones, menús). Eyebrows en MAYÚSCULAS chicas con tracking (`.zd-eyebrow`).
- **Botones**: verbo en infinitivo + objeto. "Ejecutar consulta", "Probar conexión", "Revocar token", "Activar de todos modos". Nunca "OK", "Sí", "Enviar" a secas.
- **Tono**: confiable, claro, sin exclamaciones ni entusiasmo de marketing. Ni "¡Genial!" ni "Ups".
- **Emoji**: nunca. Unicode solo en el correo (✓ ⚠) porque no se pueden garantizar SVGs.
- **Números y fechas**: es-AR — 1.240 · 1,8 s · 03/10 08:00 · relativos "hace 12 s", "hace 3 h 10 min".
- **Errores**: consola = qué se rechazó + regla + dato técnico en mono ("La consulta fue rechazada: solo se permiten lecturas"). Panel = qué no pasó + por qué en términos del negocio + qué hacemos + si tiene que hacer algo.
- Glosario completo de negocio vs. técnico: `guidelines/lenguaje.md`.

Ejemplos:
- Panel, falla: "No pudimos armar tu resumen de esta mañana. Tu tienda tardó demasiado en responder. Lo intentamos de nuevo a las 09:30; no tenés que hacer nada."
- Panel, ajuste: "Los cambios rigen desde la próxima revisión."
- Consola, tope: "Tope de filas alcanzado. Se muestran las primeras 1.000 filas de 4.812."
- Consola, token: "Agente creado. Copiá el token ahora: no se vuelve a mostrar."

## VISUAL FOUNDATIONS
- **Color**: neutros grises fríos (`--gray-*`) para casi todo; acento **verde petróleo** `--teal-600 #0f6b5c` para la acción primaria, selección y enlaces. Semánticos con trío `-soft / -border / -text`: ok (verde), advertencia (ámbar), error (rojo), información (azul), neutro. **Tenant activo = violeta `--tenant #5a2db0`, exclusivo de la barra** — ningún otro elemento usa violeta.
- **Modo oscuro**: `prefers-color-scheme: dark` o `data-theme="dark"` en `<html>`. Solo cambian los alias semánticos (`--surface-*`, `--text-*`, `--border-*`, semánticos); los componentes no se tocan.
- **Tipografía**: `system-ui` para interfaz y una monoespaciada del sistema (`ui-monospace, Menlo, Consolas`) para SQL, ids y códigos. Sin webfonts. Escala 12/13/14/16/18/20/24/30. Consola cuerpo 14 px; panel 16 px. Pesos 400/500/600/700; títulos 600. Números con `tabular-nums`.
- **Espaciado**: escala `--space-1…12` (2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64). Padding de tarjeta 16 px (consola) / 24 px (panel).
- **Fondos**: planos. Página `--surface-page` levemente gris, tarjetas blancas. Sin imágenes, gradientes, texturas ni ilustraciones. (Única excepción: el shimmer del skeleton.)
- **Bordes**: 1 px `--border-1` en tarjetas, tablas e inputs (`--border-2`). El borde hace el trabajo; las sombras son mínimas.
- **Sombras**: `--shadow-1` tarjetas (casi imperceptible), `--shadow-2` hover/sticky, `--shadow-3` diálogos. Sin sombras internas.
- **Radios**: 3/4/6/10/14 px + pill. Controles 6, tarjetas y tablas 10, badges pill, tags 4.
- **Tarjetas**: fondo `--surface-card`, borde 1 px, radio 10, `--shadow-1`. Variante "disponible": fondo hundido, borde punteado, sin sombra. Nunca borde de color a la izquierda.
- **Hover**: superficies → `--surface-hover`; primario → `--accent-hover` (más oscuro); secundario → borde más fuerte. **Press**: `translateY(1px)`, sin escala.
- **Foco**: anillo `--focus-ring` (azul) 2 px con offset 2 px en todo elemento interactivo (`:focus-visible`).
- **Movimiento**: mínimo. Transiciones de color 120 ms `cubic-bezier(.2,0,0,1)`. Spinner y skeleton; nada de rebotes ni entradas animadas. `prefers-reduced-motion` ralentiza los giros.
- **Transparencia/blur**: solo el velo de los diálogos (`rgba(12,15,18,.45)`), sin blur.
- **Layout**: consola = barra de tenant sticky (40 px) + navegación 232 px (global arriba, tenant activo abajo) + contenido max 1280 px; paneles laterales y diálogos nunca tapan la barra de tenant; funciona desde 1024 px. Panel = header sticky 60 px + columna max 960 px, una columna en móvil.
- **Datos**: tablas con encabezado hundido, números a la derecha en mono tabular, NULL en itálica gris (consola) o "—" (panel).
- **Estados**: siempre ícono + texto en badges y banners. Ningún estado se distingue solo por color.

## ICONOGRAPHY
- **Set**: [Lucide](https://lucide.dev) (`lucide-static@0.460.0`), línea 2 px, esquinas redondeadas, 24×24. **Sustitución**: el brief no define set; se eligió Lucide por su trazo neutro y licencia ISC.
- **Implementación**: SVG inline (como pide el brief). 72 íconos copiados en `assets/icons/*.svg` y embebidos en `components/core/iconData.js`; el componente `Icon` los renderiza con `currentColor`. En HTML plano, pegar el SVG con `class="zd-icon" aria-hidden="true"`.
- **Uso**: acompañan texto (botones, badges, banners, nav). Ícono solo únicamente en botones con `aria-label` + `title`. Tamaño 1.15em; 14 px en badges; 20 px en banners.
- **Mapa semántico**: circle-check exitosa · circle-x fallida · loader-circle en curso (gira) · refresh-cw reintentando · skip-forward omitida · ban interrumpida · copy-check duplicado evitado · inbox sin datos · triangle-alert advertencia · plug/unplug conectividad · building-2 tenant · store negocio (panel).
- **Sin emoji, sin icon font, sin PNG.** El correo usa unicode (✓ ⚠) porque los clientes de correo no renderizan SVG de forma confiable.
- **Logo**: no se proveyó. El nombre "ZeroDashboard" se escribe en `system-ui` 700 con tracking −0.02em. No dibujar un isotipo.

---

## Índice
- `styles.css` — punto de entrada (solo `@import`).
- `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css` — tokens (base + alias, claro/oscuro, densidad por superficie).
- `components/components.css` — clases `.zd-*` usables desde **HTML plano sin build**.
- `components/<grupo>/` — componentes React (`.jsx` + `.d.ts` + `.prompt.md` + card).
- `guidelines/consola.md` — **consola v2**: arquitectura de información, especificación por pantalla, tabla change → pantallas, componentes nuevos, adopción incremental, propuestas.
- `guidelines/pantallas.md` — especificación del **panel** y el **correo** (la sección consola es histórica: manda `consola.md`).
- `guidelines/lenguaje.md` — glosario negocio/técnico y fórmulas de copy.
- `guidelines/cards/` — cards de fundamentos.
- `ui_kits/datos-muestra.js` — **DATOS DE MUESTRA** (reemplazables sin tocar el diseño).
- `ui_kits/consola/` — mockup navegable de la consola v2 en **HTML + CSS + JS plano** (`index.html`, `app.js`, una pantalla por `.js`, `datos-consola.js`).
- `assets/icons.js` — íconos como `window.ZD_ICONS` para HTML plano.
- `ui_kits/panel/` — mockup navegable del panel.
- `ui_kits/correo/` — correo con datos y sin datos (HTML de correo real).
- `assets/icons/` — SVGs de Lucide.
- `SKILL.md` — skill para Claude Code.

## Components
Cada uno mapea a una clase CSS para la implementación sin framework.
- **Icon** (`core/`) — `.zd-icon` · adición intencional: envoltorio del set de íconos.
- **Button** (`core/`) — `.zd-btn --primary|--secondary|--ghost|--danger --sm|--lg --icon`.
- **Field** (`forms/`) — `.zd-field .zd-label .zd-input|.zd-select|.zd-textarea .zd-help .zd-field-error`.
- **DataTable** (`data/`) — `.zd-table-wrap .zd-table .zd-pager`.
- **StatusBadge** (`data/`) — `.zd-badge --ok|--warn|--error|--info`; exporta también `ESTADOS`.
- **Banner** (`feedback/`) — `.zd-banner --tone`, role="alert" en error/warn.
- **EmptyState**, **LoadingState**, **ErrorState** (`feedback/`) — `.zd-state`, `.zd-spinner`, `.zd-skeleton`.
- **TenantBar** (`tenant/`) — `.zd-tenantbar` · CH-06.
- **ConnectivityIndicator** (`tenant/`) — `.zd-conn` · CH-19d.
- **AutomationCard** (`automation/`) — `.zd-auto-card` · CH-22.
- **TemplatePicker** (`automation/`) — `.zd-templates .zd-template` · CH-21.
- **Stepper** (`automation/`) — `.zd-steps .zd-step` · CH-21.
- **SideNav** (`navigation/`) — `.zd-shell .zd-sidenav` · navegación lateral global / tenant activo.
- **Tabs** (`navigation/`) — `.zd-tabs .zd-tab` · solo para vistas hermanas (Conexiones | Agentes).
- **PageHeader** (`layout/`) — `.zd-pagehead` · encabezado con alcance, change y acción primaria.
- **ScopeTag** (`layout/`) — `.zd-scope --global|--tenant|--none`.
- **KeyValueList** (`layout/`) — `.zd-kv`, `.zd-kvgrid`.
- **Drawer** (`overlay/`) — `.zd-drawer` · panel lateral bajo la barra de tenant.
- **Dialog** (`overlay/`) — `.zd-dialog` · confirmación con acción + objeto.

### Intentional additions
- **Icon** — envoltorio para renderizar Lucide como SVG inline con currentColor.

## Implementación (restricciones técnicas del brief)
La interfaz real es **HTML + CSS + JS plano** servido por Fastify, sin build. Los componentes React existen para que este sistema sea navegable y reutilizable en prototipos; **el agente que implementa debe usar `styles.css` + el markup de clases `.zd-*`** (ver cada `.prompt.md` y el DOM renderizado de los mockups). Una hoja compartida, un HTML por pantalla, JS plano. Agregar `data-change` y `data-estado` al contenedor de cada pantalla.

## Qué NO hacer (anti-alcance y anti-patrones)
- Nada de editor SQL, constructor visual de consultas ni consola en el **PANEL**.
- Nada de editor visual de flujos, nodos, ramificaciones, bucles ni transformaciones encadenadas.
- Nada de IA, chat ni asistente.
- Nada de facturación, planes ni cobro.
- Nada de ejecución por webhook: todo es programado.
- No agregar pantallas fuera de `guidelines/pantallas.md`.
- No usar el violeta `--tenant` fuera de la barra de tenant.
- No comunicar estado solo con color; no usar placeholder como etiqueta; no mostrar ids, códigos ni términos técnicos en el panel.
- No gradientes, ilustraciones, emoji ni tarjetas con borde de color a la izquierda.
- No React/Tailwind ni dependencias con build en la implementación real.

## Sugerencias fuera de alcance (anotadas, no diseñadas)
- Vista "Hoy" en el panel con un resumen de todas las revisiones del día.
- Pausar una automatización desde el panel (hoy solo ajustar).
- Notificación al implementador cuando un agente pasa a desconectado.
- Comparación lado a lado de versiones de consulta (CH-25 la menciona como acción; el diff visual no está diseñado).
