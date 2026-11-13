# ZeroDashboard · Estilo y reglas de los videos (v2)

Reglas comunes a los cuatro videos de la presentación. Cada proyecto de video (`zerodashboard-defensa` para las Partes 1, 2 y 4, y `zerodashboard-video` para la Parte 3) escribe su `SPEC.md` a partir de este documento: copia los números de acá y agrega solo sus tomas. Si una toma necesita romper una regla, se cambia primero este documento.

**Fuentes:** el guion es `guion.md` (en esta carpeta). La identidad visual sale de la skill `zerodashboard-design` (`README.md` y `tokens/`). El formato y los defectos prohibidos salen de la skill de HyperFrames (`references/spec.md` y `story.md`).

**Dirección elegida:** A, «el producto es el escenario», con los diagramas de C («plano de obra») en la Parte 2. El movimiento sigue el estilo de los videos de producto de teléfonos: fluido, con resortes suaves, cámara que se acerca a la interfaz y profundidad sutil. De esos videos se toma **solo el ritmo y el tipo de movimiento**, nunca su identidad: ni logos, ni dispositivos de una marca, ni sus colores ni su tipografía.

---

## 1. Objetivo

- **Qué tiene que pasarle al que mira:** que al terminar diga «ZeroDashboard vigila los datos de un comercio y le avisa a tiempo, sin tocar su sistema».
- **Formato:** HyperFrames, 1920 × 1080, 30 fps.
- **Uso:** los videos se proyectan detrás de la narración en vivo. No tienen voz ni música. La voz del orador es el reloj: cada elemento entra cuando se dice la frase que lo nombra.

## 2. El mundo: ZeroDashboard en modo claro

El escenario es la propia interfaz de ZeroDashboard, agrandada para leerse en un proyector. Todo lo que aparece es una pieza que existe en el producto o un objeto del comercio.

### Color

| Rol | Valor | Dónde puede aparecer |
|---|---|---|
| Fondo | `#f7f8f9` plano (`--gray-25`) | Siempre. Sin textura, sin grano, sin viñeta, sin degradé. |
| Superficie | `#ffffff` (`--gray-0`) | Tarjetas, ventanas, pantalla del teléfono. |
| Superficie hundida | `#f0f2f4` (`--gray-50`) | Encabezados de tabla, chips, el «antes» de la Parte 1. |
| Tinta principal | `#13171b` (`--gray-900`) | Títulos y todo texto que hay que leer. |
| Tinta secundaria | `#4a535c` (`--gray-600`) | Subtítulos y rótulos. |
| Tinta terciaria | `#8a949e` (`--gray-400`) | Lo que pasa a segundo plano; líneas de diagrama en reposo. |
| Borde | `#d1d7dc` (`--border-1`) | Tarjetas e inputs. |
| **Acento** | `#0f6b5c` (`--teal-600`), suave `#e7f3f0` (`--teal-50`) | **Una sola cosa por toma:** la palabra clave, la pieza que se está nombrando, el aviso que llega. |
| Correcto | `#1d7536` sobre `#e8f4eb` | Estados «Válida», «ok», ✓. |
| Advertencia | `#8f5300` sobre `#fcf3e1` | Límites (⚠ dos monedas). |
| Error | `#b42318` sobre `#fbeceb` | La falla del agente, ✕ sin recetas, lo «hecho a medida». |

- El violeta del tenant (`#5a2db0`) **no se usa**: en la marca es exclusivo de la barra de tenant de la consola, y la consola solo aparece en la Parte 3, en la grabación real.
- Un estado nunca se dice solo con color: siempre ícono más texto, igual que en la interfaz.

### Tipografía

| Uso | Familia | Peso | Tamaño a 1080 | Interletra |
|---|---|---|---|---|
| Título grande (placa, idea de la toma) | Inter | 700 | 120 a 144 px | −0,035 em |
| Título de toma | Inter | 700 | 72 px | −0,025 em |
| Bajada | Inter | 400 | 40 px | −0,01 em |
| Texto en tarjetas | Inter | 400 / 700 | 32 a 36 px | 0 |
| Rótulo | Inter | 700 | 28 px (mínimo) | 0 |
| SQL e ids | JetBrains Mono | 400 | 28 px | 0 |

- Inter y JetBrains Mono vienen con HyperFrames. La interfaz real usa la tipografía del sistema, y Inter es la más cercana.
- Inter, en el paquete de HyperFrames, trae los pesos 400, 700 y 900. No usar 500 ni 600.
- Números con `font-variant-numeric: tabular-nums` y en formato argentino: 1.520,5 · 03/10 08:00.
- Mayúsculas solo al principio de la oración (*sentence case*), sin punto final en los títulos.
- «ZeroDashboard» se escribe en Inter 700 con −0,02 em. No hay isotipo: no se dibuja ninguno.

### Forma y profundidad

- **Tarjetas:** blanco, borde de 1,5 px `#d1d7dc`, radio 24 px (el radio de 10 px de la interfaz, escalado), relleno de 40 px.
- **Sombra de reposo:** `0 2px 4px rgba(16,24,32,.06), 0 12px 32px rgba(16,24,32,.08)`.
- **Sombra de la pieza activa:** `0 4px 8px rgba(16,24,32,.08), 0 28px 64px rgba(16,24,32,.14)`. Es la que da el efecto de «se levanta hacia vos».
- **Profundidad por planos:** hasta tres planos. El de atrás va a escala 0,94 y opacidad 0,5. La profundidad se logra con escala, sombra y opacidad; **nunca con desenfoque ni vidrio**.
- **Íconos:** el set Lucide de la marca (`.claude/skills/zerodashboard-design/assets/icons/`), trazo 2 px escalado, en tinta o en acento.

### Los objetos

Cada cosa que la historia necesita se dibuja como la pieza real del producto:

| Objeto | Cómo se dibuja |
|---|---|
| **El aviso** | La tarjeta de automatización del panel: título, insignia de estado con ícono, última y próxima revisión, «Ajustar». |
| **El correo** | El correo HTML real: asunto «⚠️ Insumos por agotarse (3)» y su tabla. |
| **El teléfono** | Un teléfono genérico: cuerpo `#13171b`, radio 64 px, bisel de 14 px, pantalla blanca. Ocupa por lo menos el 60 % del alto del cuadro. Sin marca ni modelo reconocible. Adentro va el clip de Telegram grabado por el orador. |
| **El tablero** | Las tarjetas del tablero del panel: número grande, tabla y gráfico de barras en los colores del sistema. |
| **Los sistemas de venta** | Ventanas con barra superior y el nombre en texto: Food Store, Medusa, Odoo. Sin sus logos. |
| **El idioma común** | Una banda horizontal con cinco chips: Productos · Pedidos · Ítems · Insumos · Recetas. |
| **El candado, el escudo, la llave** | Íconos Lucide del set de la marca, `lock` («nunca escribe»), `shield-check` («cada comercio ve lo suyo») y `key-round` («claves cifradas»), a 96 px, cada uno con su línea de texto. |

## 3. Los diagramas de la Parte 2 (plano de obra)

Dentro del mismo mundo claro, la Parte 2 explica con diagramas que **se construyen pieza por pieza** mientras el orador habla. Nunca aparece un diagrama terminado de golpe.

- **Línea:** trazo de 3 px, puntas redondeadas, `#8a949e` en reposo y `#0f6b5c` cuando se nombra.
- **Conectores:** rectos con curvas de radio 24 px en los quiebres, sin flechas decorativas. Si hace falta una flecha, punta de 14 px.
- **Cajas de diagrama:** las mismas tarjetas blancas, con un rótulo de 28 px.
- **Cómo se dibuja:** cada línea se traza de punta a punta (`stroke-dashoffset`) y la caja que conecta aparece cuando la línea llega.
- **Lo «hecho a medida»:** las automatizaciones atadas a un sistema se dibujan como líneas que se cruzan y enredan, en `#b42318` al 60 %. Cuando aparece el idioma común, se desenredan y pasan a ser tres líneas rectas en acento.
- **Rótulos:** van sobre la pieza que nombran, nunca en una leyenda aparte.

## 4. Movimiento

El movimiento es lo que más carga el estilo de video de producto: todo se desliza, se apoya y frena suave, sin rebotes exagerados.

### Curvas por rol

| Rol | Curva (GSAP) | Duración |
|---|---|---|
| Entrada de una pieza | `expo.out` | 27 cuadros (0,9 s) |
| Entrada de un título | `power4.out`, por palabra con 3 cuadros de separación | 24 cuadros |
| Una pieza que se apoya (tarjeta, chip, teléfono) | resorte con amortiguación 0,8 (en GSAP, `back.out(1.2)` como máximo) | 21 cuadros |
| Movimiento de cámara (acercarse, alejarse, recorrer) | `power3.inOut` | 36 a 60 cuadros |
| Traspaso de una toma a la otra | `power2.inOut` | 18 cuadros |
| Salida | `power2.in` | 12 cuadros |
| Línea de diagrama | `power2.inOut` | 30 cuadros |

- **Entrada de una pieza:** opacidad 0→1, y +40 px→0, escala 0,96→1. Sin desenfoque.
- **Escalonado:** las piezas de un grupo entran con 4 cuadros de separación, nunca todas juntas.
- **Una sola jugada principal por toma.** Lo secundario recorre del 50 al 70 % de esa distancia y arranca 3 a 6 cuadros después. El resto queda quieto.
- **Algo nuevo cada 2 a 4 segundos**, siguiendo la frase que se está diciendo.

### Cámara

- La cámara es un contenedor que se mueve, se acerca y se aleja sobre el escenario. No hay cortes secos entre tomas de un mismo video.
- **Acercarse a un detalle:** escala 1→1,6 en 45 cuadros, centrado en la pieza que se nombra. El resto del cuadro sigue visible y se apaga a opacidad 0,35.
- **Paralaje:** cuando la cámara se mueve, el plano de atrás recorre el 60 % de lo que recorre el plano del frente.
- **Cadena de objetos:** cada toma termina en la pieza que abre la siguiente. Por ejemplo: la tarjeta del aviso se convierte en el correo, que se convierte en el teléfono.

### Énfasis y retirada

- **Énfasis:** la pieza nombrada sube a la sombra activa, escala 1→1,03 en 15 cuadros, y su borde o su texto pasa al acento.
- **Retirada:** lo que deja de importar baja a opacidad 0,3 en 18 cuadros. No sale del cuadro hasta que cambia la toma.
- **Cierre de cada video:** todo el escenario baja a opacidad 0 y sube 12 px en los últimos 14 cuadros.

## 5. Sincronía con la voz

- La narración en vivo marca el tiempo. **Ritmo estimado, hasta medirlo con el guion v2:** se usan los ritmos medidos en la v1, que son 2,37 palabras por segundo en la Parte 1, 2,32 en la Parte 2 y 2,04 en la Parte 4, con arranque en 0,8 s. Cuando el orador grabe su lectura del v2, se reemplazan acá y se reajustan los tiempos de cada toma.
- Para que el ajuste sea barato, los tiempos de cada toma se calculan a partir de una sola tabla de frases por video (frase, cantidad de palabras, inicio), no se escriben a mano en cada escena.
- Cada pieza entra **cuando se dice la palabra que la nombra**, no antes.
- El texto en pantalla **no repite la frase hablada palabra por palabra**: resume o pone el dato. Por ejemplo, la voz dice «te quedan tres insumos por debajo del mínimo» y la pantalla muestra la tarjeta con «3 insumos por agotarse».
- Cada video termina con 2 s de margen quietos sobre la última toma, por si el orador se atrasa.

## 6. Texto en pantalla

- **A lo sumo 6 palabras por línea, una línea a la vez.** En los diagramas, hasta 10 palabras.
- Cada línea queda en pantalla por lo menos 0,5 s más 0,3 s por palabra. La última, por lo menos 2 s.
- Si sobran palabras, se cortan palabras. **Nunca se achica la letra** por debajo de 28 px.
- **Voseo** y tono de la marca: «Te avisamos», «Tus números del día». Sin signos de exclamación salvo en la placa final («¡Gracias!»).
- **Palabras prohibidas en pantalla:** heterogéneo, canónico, esquema, refutable, hipótesis, granularidad, entidad, atributo, tenant, réplica, *query*, *endpoint*. Se reemplazan por: sistema distinto, idioma común, forma de guardar los datos, comercio y copia de su información.
- **Palabras de marketing prohibidas:** revolucionario, sin esfuerzo, mágico, desbloquear, potenciar, «en segundos» (salvo que esté medido).
- **Datos:** solo datos reales que salgan de la tesis, de la demo o de la guía. Un número de ejemplo se marca como ejemplo.

## 7. Sonido

- **Sin música y sin voz:** el orador habla encima.
- **Efectos:** solo en un hecho visible y a volumen 0,16. Un *pop* suave cuando aterriza una pieza clave (una por toma como máximo), y un roce suave en un cambio de toma grande. Se alternan dos o tres tomas del mismo efecto.
- Se usan los efectos ya acreditados en `assets/sfx/CREDITS.md` de cada proyecto, o nuevos con su crédito.
- La Parte 3 conserva su propio diseño de sonido (clics del cursor, aviso que llega).

## 8. La Parte 3 (la demo)

Es una grabación real de la interfaz, no un video de animación. Se trata con las mismas reglas de cámara:

- **Acercamientos** a la zona donde pasa la acción, con `power3.inOut` en 36 cuadros y escala de 1,3 a 1,8.
- **Cursor** siempre visible, sin efectos de clic llamativos. A lo sumo un anillo de 40 px en acento al 30 % que se desvanece en 10 cuadros.
- **Cortes en las esperas:** cuando se espera el minuto del aviso, un traspaso de 18 cuadros, sin carteles de «un minuto después».
- **El clip de Telegram:** dentro del teléfono de la sección 2, al lado del correo. El clip se convierte a H.264 de cuadros constantes a 30 fps antes de usarse.
- La interfaz no se retoca: lo que se ve es el producto tal como es.

## 9. Prohibido

- Fondo negro o azul oscuro con piezas chicas flotando en el medio.
- Degradés de cualquier tipo, vidrio esmerilado, desenfoque decorativo, brillos, destellos, partículas, órbitas o anillos que brillan.
- Texto de colores en degradé, texto que se escribe letra por letra, texto que se mueve mientras se lee, títulos que siguen derivando después de apoyarse.
- Todo centrado; todo apareciendo a la vez; todas las piezas entrando del mismo modo, toma tras toma.
- Viñetas de diapositiva, tres tarjetas en fila como recurso, grillas de indicadores como relleno.
- El nombre o un logo fijo en una esquina. El nombre aterriza una sola vez con peso, en la placa de apertura y en la final.
- Marcos, esquinas, retículas o lecturas tipo pantalla de nave como decoración.
- Confeti, giros, rebotes más fuertes que `back.out(1.2)`.
- El violeta del tenant, emoji (salvo el ⚠️ que trae el asunto del correo real) y logos de terceros.
- Isotipo inventado para ZeroDashboard.

Después del primer render, cada defecto que aparezca igual se agrega a esta lista.

## 10. Control de calidad

En cada video, antes de entregar:

- `npx hyperframes check --json` sin errores.
- Capturas de revisión (`snapshot --review`) en el primer cuadro, en la jugada principal de cada toma y en el último cuadro. Cada captura tiene que leerse sola, como un afiche terminado.
- El primer cuadro nunca es negro ni el nombre solo.
- Ningún texto por debajo de 28 px, y todo dentro del 90 % seguro del cuadro.
- La lista de prohibidos revisada toma por toma.
- La duración de cada toma coincide con el tiempo medido de su frase.
