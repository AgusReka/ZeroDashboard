# Revisión de UX y de estilo de la interfaz — 2026-11-10

Revisión general de los recorridos principales de la consola (`/consola`, P1) y del panel (`/panel`, P2), más el análisis de la pregunta «¿una landing unilateral que luego se divida?». Es una revisión: no se modificó código ni documentación existente. Las referencias a decisiones (DEC-nn) son a `docs/01-decisiones.md`; las referencias a la guía de diseño son a `.claude/skills/zerodashboard-design/`.

---

## 1. Resumen

El producto está en buen estado general: la consola tiene una estructura clara (navegación global / tenant activo, barra de tenant violeta, pop-ups con pruebas previas al guardado y avisos de por qué «Guardar» está cerrado), el panel habla en lenguaje de negocio sin ninguna jerga técnica y se ve bien a 390 px, y no hubo ninguna excepción de JavaScript en ninguna pantalla recorrida. Los problemas están en los bordes: estados vacíos y errores, mensajes que no coinciden con lo que pasó, y dos fallas de contraste que esconden acciones.

Los cinco problemas principales:

1. **P-01 (Alta).** En el panel, «Abrir Telegram» (la acción primaria de la tarjeta de vínculo) se ve casi ilegible: texto verde oscuro sobre fondo verde petróleo, contraste de 1,4 a 1.
2. **P-02 (Alta).** El ingreso del panel no tiene ninguna salida para quien olvidó la contraseña ni dice a quién pedirla (hoy solo la repone el operador, DEC-156).
3. **C-01 (Alta).** En la consola hay dos tenants llamados «Food Store» indistinguibles en el selector, y el cambio de tenant es inmediato, sin el diálogo de confirmación que pide la guía. Es el riesgo que la barra de tenant existe para evitar.
4. **C-03 y P-03 (Media).** Si se envía el ingreso con un campo vacío, tanto la consola como el panel responden «No se pudo contactar con la consola» / «No pudimos conectar con el servidor»: el servidor contestó 400 y el mensaje dice que no está.
5. **C-02, C-07, C-10 (Media).** Primera pantalla de la consola sin guía de qué hacer; una sentencia `UPDATE` se rechaza con el texto «la sentencia es inválida, o contiene más de una» en lugar de «solo lectura»; y la pantalla Usuarios del panel muestra «Elegí un tenant…» con un tenant activo.

Totales: 30 hallazgos, 3 Alta, 19 Media, 8 Baja. Recomendación sobre `/consola` y `/panel`: sección 6 (resumen: no unificar el ingreso; sí una landing neutra con dos puertas, que hoy no existe y cuya ausencia hace que `/` devuelva JSON crudo).

---

## 2. Método

- **Herramienta.** Chrome headless (v156) manejado por el protocolo DevTools desde Node 22, contra `http://localhost:3000` (demo sembrada, sin reiniciar ni reconstruir). Se capturaron PNG y el texto visible de cada pantalla, y se registraron excepciones (`Runtime.exceptionThrown`), errores de consola y respuestas de red fallidas.
- **Anchos.** Consola a 1280 px (además un pop-up a 1280×720, una pantalla a 1024 px donde solo se comprobó que no hay desborde horizontal, y una captura a 390 px de la consola que no se evaluó, porque la guía fija 1024 px como mínimo). Panel a 1280 y a 390 px.
- **Tema.** El navegador de la revisión se forzó a claro; se tomó una captura en oscuro de la consola y otra del panel (no se analizaron en detalle). La interfaz no tiene botón de tema, sigue al sistema (decisión de la guía, `consola.md` sección 7).
- **Recorrido de la consola como primera vez:** ingreso (también clave incorrecta y campos vacíos), sin tenant, alta de tenant, conexión nueva (con una contraseña incorrecta a propósito), mapeo y validación (tenant nuevo y tenant demo), consultas (escritura rechazada, error de sintaxis, consulta válida, pop-up a 720 px de alto), plantillas (panel y «Probar»), reportes (pop-up «Nuevo reporte» y prueba de un reporte existente), alta de automatización en dos pasos (hasta el paso 2, **sin crear**), lista, vista previa y ajuste de automatizaciones, usuarios del panel (alta de uno de prueba), agentes, tablero, frescura, auditoría y tiempos de alta.
- **Recorrido del panel:** ingreso (vacío, clave incorrecta, usuario inexistente, ocho intentos seguidos), inicio, ajuste de una automatización (valores inválidos), tarjeta de Telegram (sin vincular y con código generado), salida.
- **No cubierto.** Tablero de reportes del panel (CH-48) y resultados de filas (CH-27, DEC-93), por consigna. Tampoco: envío real de correos ni Mailpit, vínculo real con Telegram, estados «con falla» y «pausada» del panel, advertencia de frescura al activar, alta real de agente y su token, versiones de consultas y restaurar, baja de tenant (destructiva), guardar plantillas o reportes, guardar el tablero, lectores de pantalla y navegación por teclado, otros navegadores, anchos intermedios.
- **Datos que se crearon** (en la base de desarrollo): ver sección 7.
- **Limitación.** El estado de la tarjeta de Telegram del panel cambió durante la revisión: en las primeras cargas decía «Por ahora no podés recibir avisos por Telegram.» y después «Vincular Telegram». Se asume que el entorno cambió de configuración; se evaluaron ambos estados.
- **Referencias.** Guía de diseño (readme, `pantallas.md`, `lenguaje.md`, `consola.md`), guías de usuario `docs/guia/*.md`, y como lectura subordinada `interface-design` e `impeccable` (`clarify.md`, `harden.md`); no se ejecutó el CLI de `impeccable`.
- **Evidencia.** Capturas en `C:/Users/messi/AppData/Local/Temp/claude/2c7e9cc7ed3b3fd6/2be4ff62-e3fe-4735-a58d-f1e786596d48/scratchpad/ux/capturas/` (se cita el nombre de archivo en cada hallazgo; `cNN` consola, `pNN` panel).

Criterio de severidad: **Alta** bloquea o confunde sobre lo que pasó; **Media** cuesta tiempo o provoca errores; **Baja** pulido. **Falla** = algo hecho mal; **faltante** = algo que no está y debería.

---

## 3. Hallazgos de la consola (P1)

### Alta

**C-01 · Alta · falla · Barra de tenant y selector (todas las pantallas; `#tenants`)**
- *Qué pasa.* La lista de tenants contiene dos «Food Store» (`c1bf52cd…`, del 15/09, y `31d00000…`, del 10/11) y un «Nuevo Negocio» dado de baja. El selector de la barra muestra solo el nombre: las opciones son «Food Store», «Food Store», «UX prueba». Elegir una opción cambia el tenant al instante, sin diálogo; el nombre completo con el id aparece recién en el centro de la barra («Food Store (31d00000…)») con el id cortado, y no se puede copiar. La elección se recuerda en el navegador. (`c05-sin-tenant-tenants.png`, `c06-…`, `c10-tenant-creado.png`.)
- *Por qué importa.* Operar contra el tenant equivocado es el error que, según DEC-15 y la guía (C-01), la barra debe evitar. Con nombres repetidos, la barra no lo evita: P1 tendría que leer un id truncado para distinguirlos.
- *Sugerencia.* (1) Que el selector muestre el nombre y un fragmento del id en cada opción (los selectores de conexión ya lo hacen: «food-store-demo (31d00000…)»). (2) Implementar el diálogo «Cambiar tenant» con botón «Operar sobre {nombre}» que la guía ya especifica. (3) Datos de demo: que los tenants no se llamen igual (ver C-20).
- *Skill.* Encaja: `consola.md` C-01 ya pide el diálogo con confirmación y la lista con nombre, id y alta; la implementación se aparta.

### Media

**C-02 · Media · faltante · Primera pantalla y recorrido de puesta en marcha (`/consola`, `#tenants`)**
- *Qué pasa.* `/consola` sin tenant abre «Consultas» (no «Tenants»), con la barra ámbar «Ningún tenant seleccionado» y un cuerpo casi vacío: «Consultas guardadas — Abrí una consulta…». No hay «Elegí un tenant para operar» con botón (lo que pide `consola.md` en «Comportamiento según el tenant»). Tras crear un tenant, la consola se queda en Tenants («Se creó el tenant «UX prueba» y quedó como activo.») sin indicar el paso siguiente (conexión). La ayuda del recorrido existe solo fuera de la interfaz (`docs/guia/02`). (`c04-consola-sin-tenant.png`, `c10-tenant-creado.png`.)
- *Por qué importa.* P1 es una persona técnica que nunca usó el software: necesita saber por dónde empezar. Hoy la primera impresión es una página en blanco en la pantalla de uso diario.
- *Sugerencia.* Pantalla de inicio por defecto en Tenants (o en la primera etapa pendiente); el EmptyState con botón en las pantallas del tenant sin tenant; y, tras «Crear y elegir», un enlace «Siguiente: registrar la conexión».
- *Skill.* El EmptyState encaja (lo especifica `consola.md`). Un indicador de progreso de la puesta en marcha (hoy lo cubre «Tiempos de alta», que es para P4) sería una adición: requiere cambio en la guía.

**C-03 · Media · falla · Ingreso de la consola (`/consola`)**
- *Qué pasa.* Enviar el formulario con nombre o clave vacíos muestra «No se pudo ingresar — No se pudo contactar con la consola. Revisá que la aplicación esté en marcha y volvé a intentar.» El formulario tiene `novalidate` y el servidor responde 400 `solicitud-invalida`; el script trata todo lo que no sea 401 como error de red (`MENSAJE_RED`). (`c03-login-vacio.png`.)
- *Por qué importa.* El mensaje dice que el servidor no responde cuando sí respondió; P1 pierde tiempo buscando un problema que no existe.
- *Sugerencia.* Distinguir 400 («Completá el nombre y la clave.») de los errores de red y 5xx.
- *Skill.* Encaja con `lenguaje.md` (errores: qué se rechazó y por qué).

**C-04 · Media · falla · Resultado de «Guardar y probar» una conexión (`#conexiones`)**
- *Qué pasa.* Con una contraseña incorrecta, el resultado es una línea de texto chico bajo el encabezado: «Guardada. La prueba falló: credenciales-invalidas (28P01).» Sin Banner, sin ícono, sin qué hacer; la categoría aparece con el nombre interno en kebab. (`c20-conexion-resultado.png`.)
- *Por qué importa.* Es el primer error real que verá P1 y es fácil de pasar por alto; además no dice si la conexión quedó guardada y usable.
- *Sugerencia.* Banner de error (`role="alert"`) junto a la fila de la conexión: «La conexión se guardó, pero la prueba falló: el usuario o la contraseña fueron rechazados (28P01).» más la acción siguiente.
- *Skill.* Encaja: `pantallas.md` (C-06 y estados comunes) pide Banner error con el mensaje del motor.

**C-05 · Media · faltante · Conexión con datos erróneos (`#conexiones`, `#mapeo`)**
- *Qué pasa.* Una conexión registrada no se edita ni se borra (límite documentado en `docs/guia/02`). Un error de tipeo en la contraseña obliga a registrar otra y deja la fallida en la lista y en todos los selectores («UX prueba conexion» sigue elegible). En Mapeo, con esa conexión elegida, no se avisa que su última prueba falló: se muestran cinco áreas de texto vacías y «Sin mapear». (`c22-mapeo-conexion-mala.png`.)
- *Por qué importa.* El error más probable en una primera conexión no tiene salida limpia.
- *Sugerencia.* Mínimo: mostrar el estado de la última prueba en la lista y en los selectores, y advertirlo en Mapeo. Mayor: permitir «Probar con otra contraseña» o corregir la conexión.
- *Skill.* La advertencia encaja. Editar conexiones contradice un límite documentado: requiere DEC.

**C-06 · Media · faltante · Formulario «Nueva conexión» (`#conexiones`)**
- *Qué pasa.* Solo la contraseña tiene ayuda. Servidor, Puerto, Base de datos y Usuario no explican nada: ni que el usuario debe ser de solo lectura, ni que `localhost` no sirve dentro de Docker (`docs/guia/02` lo advierte). (`c17-conexion-form.png`.) La validación de campos vacíos usa la burbuja nativa del navegador, a diferencia del diálogo «Nuevo tenant», que muestra «Escribí el nombre del tenant.» en línea.
- *Por qué importa.* Es el paso donde más se atasca un técnico que no conoce el producto.
- *Sugerencia.* Ayudas cortas bajo Servidor y Usuario y validación en línea coherente.
- *Skill.* Encaja con el patrón de Field (`.zd-help`, `.zd-field-error`).

**C-07 · Media · falla · Error al ejecutar una sentencia de escritura (`#consultas`)**
- *Qué pasa.* `UPDATE producto SET stock = 0` produce «La sentencia es inválida, o contiene más de una sentencia en un mismo envío. Solo se admite una por ejecución. (SQLSTATE 42601)». El mensaje es idéntico al de un error de sintaxis (`SELEC * FROM producto`). (`c29-consulta-escritura.png`, `c30-consulta-sintaxis.png`.)
- *Por qué importa.* P1 no se entera de que la regla que se aplicó es «solo lecturas»; puede perder tiempo buscando una sentencia duplicada que no existe.
- *Sugerencia.* Detectar el caso y decir lo que la guía propone: «La consulta fue rechazada: solo se permiten lecturas. Se encontró UPDATE.»
- *Skill.* Encaja: `lenguaje.md` fija esa fórmula para consola.

**C-08 · Media · falla · Errores y estados de prueba como texto suelto (varias pantallas)**
- *Qué pasa.* Los errores de la consulta, el «Validación terminada.», el «Guardada. La prueba falló…» y «Probá la consulta para poder guardarla.» son líneas de texto chico, sin ícono, sin `role="alert"` visible y sin diferenciación de color. «Probar» con conexión y sentencia vacías no muestra nada. (`c28-consulta-probar-vacia.png`, `c29-…`.)
- *Por qué importa.* La guía dice que el estado nunca se comunica solo con texto gris: aquí ni siquiera es un estado destacado, y es fácil no ver que algo falló.
- *Sugerencia.* Usar Banner (error/ok/warn) para resultados de acciones, pegado al control que las disparó.
- *Skill.* Encaja: principio 1 de la guía y estados comunes de `pantallas.md`.

**C-09 · Media · falla · «Nueva consulta» es un pop-up largo con las acciones al pie (`#consultas`)**
- *Qué pasa.* El editor, los parámetros, la paginación, «Probar», «Guardar consulta» y el resultado viven dentro de un pop-up. A 1280×720 el pop-up tiene su propio scroll y los botones quedan fuera de vista: hay que desplazar dentro del pop-up para ejecutar. (`c27b-consulta-dialogo-viewport720.png`.) La guía describe una pantalla con editor y resultado pegado debajo y «Ejecutar» (Ctrl + Enter) como acción primaria; aquí se llama «Probar».
- *Por qué importa.* Ejecutar una consulta es la acción más repetida de la herramienta.
- *Sugerencia.* Acción primaria visible (pie fijo del pop-up) y el resultado junto a ella; o devolver el editor a una pantalla como en `consola.md` C-08.
- *Skill.* Se aparta de `consola.md` C-08. Si fue una decisión (DEC-173 unifica los pop-ups de plantillas y reportes), conviene confirmarla y actualizar la guía.

**C-10 · Media · falla · Mensaje obsoleto en «Usuarios del panel» (`#usuarios`)**
- *Qué pasa.* Con un tenant activo, bajo el encabezado se lee «Elegí un tenant para ver sus usuarios del panel.» mientras la tabla ya muestra al usuario. En un tenant sin usuarios el mensaje tampoco corresponde (debería ser «Este tenant todavía no tiene usuarios del panel»). Desaparece solo después de crear un usuario. (`c07-usuarios.png`, `c15-usuarios-vacio.png`.)
- *Por qué importa.* Dice lo contrario de lo que está pasando.
- *Sugerencia.* Limpiar el texto cuando hay tenant y usar un estado vacío propio.
- *Skill.* Encaja (estado vacío: qué falta + acción).

**C-11 · Media · faltante · Estados vacíos (Automatizaciones, Ejecuciones, Mapeo, Frescura, Auditoría)**
- *Qué pasa.* Automatizaciones de un tenant nuevo muestra una tabla con solo encabezados y un título «Ejecuciones» sin contenido (sin «Este tenant no tiene automatizaciones» ni acción). En Mapeo, la tabla «Automatizaciones» queda vacía con encabezados. Sin tenant, Frescura muestra el campo «Ventana» y los botones «Guardar ventana» y «Marcar réplica actualizada ahora» activos, y Auditoría los filtros. (`c14-autom-vacio.png`, `c05-sin-tenant-frescura.png`.)
- *Por qué importa.* No hay indicación de qué falta ni de la acción siguiente; controles activos sin tenant invitan a un clic que no hace nada.
- *Sugerencia.* EmptyState por pantalla («Este tenant no tiene automatizaciones» + «Nueva automatización») y controles deshabilitados sin tenant.
- *Skill.* Encaja: `consola.md` C-09 define «Este tenant no tiene automatizaciones» + botón.

**C-12 · Media · falla · Mapeo y validación (`#mapeo`)**
- *Qué pasa.* Tras «Validar mapeo» el único resultado es «Validación terminada.» en texto chico: no dice si el mapeo es válido ni cuántas entidades fallaron (el estado «Válida» está en cada entidad, más abajo). Hay cinco botones «Guardar» (uno por entidad) y un «Validar mapeo» global sin relación visible. La tabla de automatizaciones usa slugs y códigos internos: `stock-fisico`, `bloqueada` / `inaplicable` / `aplicable`, «producto: entidad-no-mapeada». (`c24-mapeo-validado.png`, `c22-…`.)
- *Por qué importa.* Es el paso de más fricción técnica; el diseño pide Banner ok o warn con conteo y plantillas bloqueadas.
- *Sugerencia.* Banner de resumen («Mapeo válido: 5 de 5 entidades. Las 3 automatizaciones quedan disponibles.») y nombres de plantilla en lugar del slug; razones en español («Falta mapear: producto»).
- *Skill.* Encaja con `consola.md` C-06 (resumen y plantillas afectadas).

**C-13 · Media · falla · Alta de automatización, paso 2 (`#automatizaciones`)**
- *Qué pasa.* El primer campo se llama «umbral» (nombre interno del parámetro, sin explicación ni unidad) y a continuación hay otro umbral, «Mínimo de filas para avisar». Un recién llegado no distingue «stock mínimo por producto» de «cuántos productos tienen que cumplirlo». (`c40-wizard-paso2.png`.) Lo demás está bien resuelto (cron en vivo, vista previa del correo, «Para: sin destinatario…»).
- *Por qué importa.* Es el campo que más se va a configurar mal.
- *Sugerencia.* Etiqueta y ayuda por parámetro desde la plantilla («Stock mínimo por producto — avisa cuando un producto llega a esta cantidad o menos») y un ejemplo en la ayuda del mínimo de filas.
- *Skill.* Encaja; es contenido de plantilla.

**C-14 · Media · faltante · Alta de un usuario del panel (`#usuarios`)**
- *Qué pasa.* Tras «Crear usuario» aparece la clave generada («Pasásela por un canal seguro: no se vuelve a mostrar.») con «Copiar» y «Ya la guardé», pero no se dice la dirección del panel ni qué correo usar: P1 debe saber que se entra por `/panel`. (`c46-usuario-clave.png`.) La clave y el correo no se pueden copiar juntos.
- *Por qué importa.* Es el momento en que P1 le entrega el acceso a un dueño de negocio sin experiencia: el mensaje que le mande define si P2 llega o no al panel.
- *Sugerencia.* Un bloque «Qué enviarle al usuario» con dirección, correo y clave, copiable de una vez.
- *Skill.* No está en la guía: cambio menor (consola y lenguaje).

**C-15 · Media · falla · «Salir» ilegible en la barra violeta (todas las pantallas con tenant)**
- *Qué pasa.* Con tenant activo, «Salir» es texto gris (`rgb(74,83,92)`) sobre violeta (`rgb(90,45,176)`): contraste de aproximadamente 1,1 a 1, prácticamente invisible. Sobre la barra ámbar (sin tenant) se lee bien. (`c10-tenant-creado.png`.)
- *Por qué importa.* Cerrar sesión en una máquina compartida es una acción de seguridad que no debería ser difícil de encontrar.
- *Sugerencia.* Color del texto de la barra para los controles de la derecha.
- *Skill.* Encaja: tokens; el violeta es exclusivo de la barra y su texto debe contrastar.

**C-20 · Media · falla · Datos de demo visibles (varias pantallas)**
- *Qué pasa.* El reporte del tablero se llama «Recorrido 1794315526090 unidades por producto» (sobrante de una prueba, visible en Reportes y en Tablero del cliente, aunque su título para el cliente es «Lo más vendido»). Existen dos «Food Store» (C-01) y un «Nuevo Negocio». Las listas muestran «Plantilla 21b00000-…» en Auditoría. (`c07-tablero.png`, `c07-reportes.png`.)
- *Por qué importa.* La demo es lo que se ve en el video (CH-49): una primera impresión con nombres de prueba y duplicados.
- *Sugerencia.* Normalizar la semilla de la demo (un solo tenant demo, nombres legibles) antes de grabar. No es un defecto del producto.
- *Skill.* No aplica.

### Baja

**C-16 · Baja · falla · Fechas ISO crudas**
La columna «Creada» de Automatizaciones y la fecha de cada consulta guardada muestran `2026-11-10T12:57:17.144Z`, a diferencia del resto de la consola (`10/11/2026 09:57`). Además es UTC, mientras otras pantallas muestran hora local. Encaja con `lenguaje.md` (dd/mm, 24 h). (`c07-automatizaciones.png`, `c07-consultas.png`.)

**C-17 · Baja · falla · Auditoría con ids crudos**
La columna «Consulta» dice «Plantilla 21b00000-0000-4000-8000-000000000001» o «Reporte 478a136b-…». Es lo documentado (`docs/guia/07`, `consola.md` C-12 para las pruebas de reporte), pero el id solo no le dice a P1 qué se ejecutó; conviene el nombre con el id como dato secundario. Requiere un ajuste menor de la guía. (`c07-auditoria.png`.)

**C-18 · Baja · falla · Lenguaje de la consola**
«declare cada :nombre» (el resto del producto usa voseo: «declará»); botones sin objeto: «Probar», «Guardar», «Siguiente», «Ver», «Filtrar» (la guía pide verbo + objeto: «Ejecutar consulta», «Probar conexión»); «Probar» significa tres cosas distintas (consulta, conexión, plantilla). Encaja con `readme.md` (botones) y `lenguaje.md`.

**C-19 · Baja · falla · Pulido**
Título «Automatizaciones» repetido (encabezado y subtítulo de la tabla) con un párrafo de 60 palabras; la etiqueta de alcance dice «Del tenant activo» sin el nombre del tenant (la guía lo incluye); el título de la pestaña es siempre «ZeroDashboard — Consola de consultas»; los números del resultado de una consulta se alinean a la izquierda (la guía pide a la derecha en mono tabular); el estado de la automatización («activa») es texto, no badge; el navegador pide `/favicon.ico` en cada carga y recibe 400 (y 401 en el ingreso), lo que ensucia la consola del navegador. Encaja con la guía en los cinco puntos de diseño; el favicon queda como mejora técnica.

---

## 4. Hallazgos del panel (P2)

### Alta

**P-01 · Alta · falla · Tarjeta «Avisos por Telegram», botón «Abrir Telegram» (`/panel`)**
- *Qué pasa.* Al generar el código, el enlace «Abrir Telegram» se dibuja con texto verde oscuro (`rgb(11,85,73)`) sobre el fondo verde petróleo del botón primario (`rgb(15,107,92)`): contraste de aproximadamente 1,4 a 1. Se ve como un rectángulo verde con una palabra subrayada casi invisible. Pasa igual a 390 y a 1280 px. (`p13-telegram-codigo-390.png`.) El estilo de enlace pisa el color del botón.
- *Por qué importa.* Es la acción que la propia tarjeta indica («Tocá «Abrir Telegram» y después «Iniciar»»). Un dueño de negocio sin experiencia no puede encontrarla ni leerla.
- *Sugerencia.* Que `a.zd-btn--primary` use el color de texto del botón (revisar la especificidad frente al estilo de enlace).
- *Skill.* Encaja: `.zd-btn --primary` ya define el texto claro; es un defecto de implementación.

**P-02 · Alta · faltante · Ingreso del panel sin salida si se olvida la contraseña (`/panel`)**
- *Qué pasa.* La pantalla de ingreso solo tiene «Correo», «Contraseña» e «Ingresar», y el pie «Entrás directo a tu negocio; no hace falta elegirlo.» No hay «Olvidé mi contraseña», ni a quién escribirle, ni un correo de contacto. La clave la repone el operador (DEC-156) pero la interfaz no lo dice. (`p01-login-390.png`.)
- *Por qué importa.* El dueño que olvida la clave (la generó el sistema y se la pasaron por otro canal, DEC-155) queda sin camino: no sabe si el sistema falló o si debe llamar a alguien.
- *Sugerencia.* Una línea de ayuda bajo el botón: «¿No tenés o perdiste tu clave? Pedísela a quien te dio acceso.» Con DEC-156 vigente no hace falta un flujo nuevo, solo el texto.
- *Skill.* Cambio menor en `pantallas.md` P-01 (hoy no contempla este estado) y en `lenguaje.md`. Un restablecimiento autónomo por correo revertiría DEC-156 (opciones b/c): requiere DEC.

### Media

**P-03 · Media · falla · Ingreso con un campo vacío (`/panel`)**
- *Qué pasa.* Con el correo o la contraseña vacíos: «No pudimos ingresarte — No pudimos conectar con el servidor. Volvé a intentar en unos minutos.» El servidor respondió 400. Con clave incorrecta, el mensaje es correcto: «El correo o la contraseña no coinciden.» (`p02-login-vacio-390.png`, `p03-login-error-390.png`.)
- *Por qué importa.* El dueño deduce que el sistema está caído y espera; es el error más común de un formulario.
- *Sugerencia.* «Escribí tu correo y tu contraseña.» para 400; reservar «no pudimos conectar» a errores de red.
- *Skill.* Encaja con `lenguaje.md` (qué no pasó + qué hacer).

**P-04 · Media · faltante · «Otras automatizaciones disponibles» sin acción ni explicación (`/panel`)**
- *Qué pasa.* Debajo de las activas hay una tarjeta punteada con «Aviso de productos que ya casi no podés armar» y una descripción, sin botón, sin «Activar» y sin decir qué hacer. `pantallas.md` P-02 lista «Activar» como acción de las disponibles. (`p05-home-390.png`.)
- *Por qué importa.* La tarjeta parece una oferta; el dueño busca cómo activarla y no hay nada. Para un usuario sin experiencia es una calle sin salida.
- *Sugerencia.* O el botón «Activar» (si se decide que el panel active; requeriría confirmar qué pasa con la conexión y el mapeo) o la frase «Para activarla, pedísela a quien te dio acceso».
- *Skill.* La guía pide la acción «Activar»; la implementación no la tiene. Requiere decidir si la activación desde el panel está en alcance (hoy no hay DEC al respecto en lo revisado) y, en cualquier caso, actualizar la guía.

**P-05 · Media · faltante · Vínculo con Telegram: «nuestro bot» sin nombre, sin alternativa (`/panel`)**
- *Qué pasa.* La tarjeta dice «También podés mandarle este código a nuestro bot: FFSH 84PV», pero no dice cuál es el bot. Si «Abrir Telegram» no funciona (en el escritorio, o por P-01), no hay otra vía. Al recargar la página el código desaparece («Ya generaste un código. Si no lo tenés a mano, generá otro.», diseño de DEC-196) y hay que volver a generarlo. (`p13-…`, `p14-telegram-visita-posterior-390.png`.)
- *Por qué importa.* El vínculo es el único paso de P2 que cruza a otra aplicación; debe poder completarse sin adivinar.
- *Sugerencia.* Mostrar el nombre del bot (por ejemplo «@NombreDelBot») junto al código.
- *Skill.* Cambio menor en `pantallas.md` P-07 (datos) y probablemente un campo más en la respuesta de la API.

**P-06 · Media · falla · Validación de «Cantidad mínima» (`/panel`, ajuste)**
- *Qué pasa.* Con `-3` el formulario responde «No cambiaste ningún dato.» (no corresponde); vacío responde «Ingresá un número válido.»; `2,5` se guarda sin objeciones («Guardamos tus cambios — Se aplican desde la próxima revisión.») aunque la guía define el umbral como entero y la unidad es «unidades». (Con `2.5` la automatización de la demo quedó modificada; se restauró a `5`, ver sección 7.) (`p08-ajustar-error-numero-390.png`, `p11-ajustar-guardado-390.png`.)
- *Por qué importa.* Un valor imposible para un conteo de unidades llega al motor, y el mensaje de rechazo no explica el problema.
- *Sugerencia.* Entero mayor o igual a 0 con mensaje propio («Escribí un número entero, 0 o más.»).
- *Skill.* Encaja con `pantallas.md` P-04 (umbral entero, validación por campo).

### Baja

**P-07 · Baja · falla · La tarjeta de Telegram ocupa el primer lugar sin tener acciones**
En el estado «no disponible» (visto al comienzo de la sesión) la primera cosa que ve el dueño es «Por ahora no podés recibir avisos por Telegram.»: un mensaje sin acción arriba de «Mis automatizaciones», que en 390 px empuja el contenido principal unos 160 px. Con vínculo disponible, la tarjeta arriba es razonable (CH-43). Sugerencia: ocultar la tarjeta cuando no hay nada que hacer, o ponerla debajo de las automatizaciones. Encaja con la guía (P-07 la define «arriba de Mis automatizaciones»; hay que revisar el caso sin acciones). (`p05-home-390.png`.)

**P-08 · Baja · falla · Formato de fecha «mié 11-11, 09:00»**
«Próxima revisión» mezcla día de la semana con `11-11`; la guía fija `dd/mm` y relativos («03/10 08:00»). Propuesta: «mañana 09:00» o «11/11, 09:00». Encaja con `lenguaje.md`. (`p05-home-1280.png`.)

**P-09 · Baja · faltante · La tarjeta no dice la regla vigente ni a dónde llega el aviso**
Para saber con qué mínimo se avisa y a qué correo, hay que abrir «Ajustar». La tarjeta muestra última revisión, próxima y frecuencia, pero no «Te avisamos cuando un producto llegue a 5 unidades o menos, a panel-demo@example.com». Con CH-48 la pantalla va a competir por espacio; conviene resolverlo antes. Cambio menor en la guía (P-02: datos de la tarjeta).

**P-10 · Baja · falla · Pie del ingreso**
«Entrás directo a tu negocio; no hace falta elegirlo.» habla de una elección (de tenant) que el dueño no concibe: es lenguaje de la arquitectura. Sugerencia: «Con tu correo entrás a tu negocio.» o quitarlo. Encaja con `lenguaje.md` (el panel no usa la noción de tenant). (`p01-login-1280.png`.)

---

## 5. Cosas que funcionan bien

- **Barra de tenant.** El cambio de color (ámbar sin tenant, violeta con tenant) es inequívoco, y las pantallas globales llevan etiqueta de alcance.
- **Pop-ups con candado explicado.** «Guardar» cerrado con el motivo («Probá el reporte antes de guardarlo»), ayudas con el tope de caracteres en Reportes, descarte con confirmación al cerrar, y «Probar en el tenant activo» que pide elegir conexión con un texto claro.
- **Alta de automatización.** Dos pasos con Stepper, tarjetas de plantilla, cron en vivo con texto humano y vista previa del correo con el asunto, el destinatario y el mínimo.
- **Secretos de un solo uso.** La clave de un usuario del panel y el token se muestran una vez con «Copiar» y «Ya la guardé».
- **Panel.** Lenguaje de negocio sin ninguna palabra técnica, formulario de ajuste con ayudas cortas y unidad («unidades»), aviso de éxito «Guardamos tus cambios — Se aplican desde la próxima revisión.», buen aspecto y sin desbordes a 390 px, y error de credenciales correcto y sin pistas sobre si el correo existe.
- **Ingreso de la consola.** Mismo mensaje para nombre inexistente y clave errónea (DEC-154).
- **Estabilidad.** Ninguna excepción de JavaScript en ninguna de las pantallas recorridas; la consola del navegador solo registró los 400/401 esperados y el favicon.
- **Documentación.** Las guías de usuario y `Límite` explicitan lo que el producto no hace: ahorra preguntas, aunque varias de esas limitaciones son las que aparecen como fricción en esta revisión (C-05).

---

## 6. `/consola` y `/panel`: análisis y recomendación

**La pregunta del usuario:** «Algo que me confunde es tener /consola y /panel, ¿no sería mejor tener una landing unilateral que luego se divida?»

### 6.1 Cómo es hoy

- **`/` no sirve nada útil.** `GET /` devuelve `401 {"error":"sesion-invalida"}` en JSON, igual que `/consola/` (con barra final), `/panel/`, `/login` y cualquier ruta inexistente: el guard de DEC-152 alcanza todo lo no exento, y la cabecera de `registerConsolaRoute` lo dice («`/` is left unclaimed»). Solo `/consola` y `/panel` (exactos) devuelven HTML.
- **Cómo llega cada usuario.** P1 llega por el README (`http://localhost:3000/consola`) o porque conoce la dirección. P2 solo sabe la dirección si P1 se la pasa: la consola no la muestra al crear el usuario (C-14) y la guía de usuario (`docs/guia/07`) la nombra en prosa. Ninguna de las dos pantallas de ingreso menciona a la otra; el ingreso de la consola, además, muestra «Las cuentas de operador se crean con `npm run operador:alta`», visible para cualquiera que llegue.
- **Dos cuentas, dos cookies.** `zd_consola_session` y `zd_panel_session`, ambas `HttpOnly; Path=/; SameSite=Lax; Secure`, con tablas propias (`SesionConsola`, `SesionPanel`) y vigencias distintas (12 horas la consola, 30 días el panel).

### 6.2 Decisiones detrás de la separación

- **DEC-04** («Dos superficies separadas»): P1 escribe SQL; P2 no. Es la base del diferencial del producto (regla 1).
- **DEC-136**: rutas dedicadas `/panel` y `/api/panel/auth/*`; se rechazó embeber el ingreso del panel en la consola (opción b). Reconoce la consecuencia: «Hay dos puntos de entrada HTML (`/consola` y `/panel`)».
- **DEC-134 y DEC-135**: sesión del panel con cookie `HttpOnly` y tabla propia; el tenant sale solo de la sesión (regla 2); la cabecera `X-Tenant-Id` no tiene efecto en el panel.
- **DEC-151, DEC-152, DEC-153, DEC-154**: operadores en tablas propias, con cookie de nombre distinto, guard obligatorio con lista cerrada de exenciones comparada contra el patrón de ruta, alta del primer operador por comando y pantalla de ingreso mínima. DEC-151 rechazó explícitamente reusar `Usuario` con tenant nulo y un rol porque «mezcla las dos superficies que DEC-04 separa».
- **DEC-15**: en la consola el tenant llega explícito en cada petición (aceptable por ser la superficie del implementador).
- **No hay ninguna DEC sobre la ruta raíz.** Una landing, o un cambio de `/`, requiere registrarla antes (AGENTS.md).

### 6.3 Implicaciones de seguridad de un punto de entrada compartido

- Una página **estática y sin datos** en `/` no toca la sesión ni la base: no cambia el modelo de aislamiento. Es exenta del guard y de la cabecera de tenant por fila exacta, y el test de `src/app/rutas.test.ts` (cada ruta protegida o en la lista) obliga a registrarla.
- Un **ingreso único** sí cambia el modelo: un mismo formulario consultaría dos tablas de cuentas distintas (`Operador` y `Usuario`), con las consecuencias siguientes:
  - Riesgo de **enumeración por tiempo o por mensaje** entre las dos clases de cuenta; habría que igualar tiempos (hash de relleno) y mensajes.
  - **Ambigüedad de identidad:** el nombre de operador admite de 1 a 64 caracteres sin espacios (la guía no prohíbe `@`), y el panel entra por correo; un operador llamado como un correo de P2 colisionaría.
  - **Políticas distintas** (vigencia 12 h frente a 30 d; la clave del panel la genera el sistema y la del operador se elige con 12 o más caracteres) pasarían a decidirse en una sola ruta; cualquier error de enrutamiento emite la cookie equivocada (una sesión de consola a un cliente es la peor falla posible del producto).
  - **La estructura que sostiene la regla 2** (rutas del panel separadas y tenant solo de la sesión) deja de ser visible en el código; la auditoría y los tests pasan a depender de una rama condicional.
  - El **ingreso de operadores queda expuesto** al público general del panel, sin que la revisión haya podido comprobar ningún límite de intentos (en el panel, ocho intentos fallidos seguidos desde el navegador no produjeron bloqueo ni demora visible; no se verificó en el servidor).

### 6.4 Opciones

| | A. Dejar como está | B. Landing neutra en `/` con dos puertas | C. Un ingreso único que enruta por tipo de cuenta |
|---|---|---|---|
| Qué es | `/consola` y `/panel` por separado; `/` sigue en JSON 401 | `GET /` estático: «¿Qué querés hacer?» con dos enlaces: «Administro un negocio → Ir a mi panel» y «Configuro ZeroDashboard para un cliente → Ir a la consola». Puede ser también solo un redirect a `/panel` | Un formulario «correo o nombre y clave»; si es operador va a `/consola`, si es usuario del panel a `/panel` |
| Pros | Cero cambios; separación máxima (DEC-04, DEC-136) | Arregla `/` (hoy JSON crudo); un solo enlace para el video y el README; costo bajo; no toca autenticación | Un solo lugar para entrar |
| Contras | `/` y las rutas con barra final siguen devolviendo JSON; nadie le dice a P2 dónde entrar; la pregunta del usuario persiste | Muestra públicamente que existe la consola (aunque ya es alcanzable); una ruta más exenta que mantener y probar | Cambia el modelo de autenticación; riesgos de 6.3; P2 vería «Nombre o correo» (lenguaje de P1); se lo gana poco, porque P2 recibe su enlace directo |
| Qué requiere | Nada; opcionalmente fila exenta para `/` y un texto breve | **Una DEC nueva** (relacionada con DEC-04, DEC-136, DEC-152): ruta `GET /` exacta, exenta del guard y de la cabecera de tenant (lista cerrada + test), HTML plano con la hoja compartida, sin base de datos. Cambios: `src/` (registro de la ruta, lista de exenciones y su test), una pantalla nueva en la guía (fuera de `pantallas.md`/`consola.md`) | **Una DEC nueva que reemplaza en parte DEC-136 y DEC-151**; nuevo endpoint de ingreso con las dos tablas, política común de intentos, reglas de nombres (sin `@` en operadores), cambios en ambos ingresos y sus tests de aislamiento |
| Seguridad | Sin cambios | Sin impacto (página estática, sin datos) | Impacto real (6.3) |
| Se aleja del producto | No | No | Sí: P2 «consume valor, no opera la herramienta» (`00-contexto.md`) |

### 6.5 Recomendación

1. **Hacer la opción B, con la puerta del panel como principal y la de la consola como secundaria**, y registrar antes la DEC (ruta `GET /` exacta, estática, exenta, sin datos). Resuelve lo que confunde (un solo punto de partida, y `/` deja de devolver JSON) sin tocar la autenticación ni la separación que sostiene las reglas 1 y 2.
2. **No unificar el ingreso (C)** salvo que aparezca un requisito real de producto: costo y riesgo altos para un beneficio que se cubre con un enlace.
3. Aparte, y sin depender de la landing: que la consola entregue a P1 la dirección del panel al crear un usuario (C-14) y que el ingreso del panel diga a quién pedir la clave (P-02); y revisar que `/consola/` y `/panel/` con barra final sirvan la pantalla en lugar de JSON.

---

## 7. Datos creados durante la revisión (base de desarrollo)

- Tenant **«UX prueba»** (`5db61377-fe66-4aa6-8cdc-746f33bde54b`).
- Conexión **«UX prueba conexion»** en «UX prueba», con contraseña incorrecta a propósito (prueba fallida; no se puede borrar desde la consola).
- Usuario del panel **`ux-prueba@example.com`** («UX prueba») en «UX prueba», con una clave generada que no se conservó.
- Un **código de vínculo de Telegram** pendiente en el tenant demo (vence a los 10 minutos).
- Filas de **auditoría** y de **sesión** generadas por las pruebas (validación de mapeo, vista previa de automatización, prueba de reporte, consultas ejecutadas, ingresos).
- **Edición de una fila existente, ya restaurada.** Al probar la validación del panel, un valor `2,5` se guardó en el ajuste de «Aviso de stock bajo» del tenant demo (valor original: 5). Se volvió a guardar `5`; hora, días y destinatario no se alteraron (`panel-demo@example.com`, 09:00, todos los días). Es la única fila existente que se tocó.

No se enviaron correos ni se creó ninguna automatización.

---

## 8. Propuesta de próximos pasos

Agrupo los hallazgos en cambios candidatos. «Antes de CH-48 / CH-49» marca lo que conviene resolver antes de esos cambios.

### 8.1 Arreglos chicos (sin DEC; la guía ya los respalda)

| Cambio candidato | Hallazgos | Cuándo |
|---|---|---|
| **Panel: legibilidad y mensajes** (color de `a.zd-btn--primary`, mensaje de 400 en el ingreso, texto de ayuda de la clave, validación de cantidad, fecha, pie del ingreso) | P-01, P-02 (solo el texto), P-03, P-06, P-08, P-10 | **Antes de CH-49** (P-01 y P-02 se ven en el video) |
| **Consola: mensajes y estados** (400 en ingreso, Banner de resultado de conexión y de consulta, mensaje de escritura rechazada, texto obsoleto de usuarios, estados vacíos, contraste de «Salir») | C-03, C-04, C-07, C-08, C-10, C-11, C-15 | **Antes de CH-49** |
| **Consola: lenguaje y pulido** (fechas, nombres en auditoría, voseo, botones con objeto, títulos, favicon) | C-16, C-17, C-18, C-19 | Cuando convenga |
| **Mapeo y plantillas: contenido** (resumen de validación, nombres de plantilla en lugar de slugs, ayuda de parámetros, ayuda del formulario de conexión) | C-06, C-12, C-13 | Antes de CH-49 si el video recorre el mapeo |
| **Demo: normalizar datos** (un solo tenant demo, nombres legibles del reporte) | C-01 (parte de datos), C-20 | **Antes de CH-49** |

### 8.2 Se apoyan en la guía pero cambian comportamiento

| Cambio candidato | Hallazgos | Observación |
|---|---|---|
| **Diálogo «Cambiar tenant» con confirmación y ids visibles** | C-01 | La guía ya lo especifica; hoy es un select directo. **Antes de CH-49.** |
| **Inicio de la consola y guía de recorrido** (pantalla inicial, EmptyState, «siguiente paso») | C-02 | El EmptyState es de la guía; el indicador de progreso requiere agregarlo a la skill. |
| **Pop-up de consulta con acción primaria visible** | C-09 | Confirmar si la diferencia con `consola.md` C-08 es decisión y actualizar la guía. |
| **Entrega del acceso al cliente** (dirección del panel junto a la clave) | C-14 | Pequeño; actualizar la guía. |

### 8.3 Necesitan una DEC (o una decisión explícita)

| Tema | Hallazgos | Qué hay que decidir |
|---|---|---|
| **Landing neutra en `/`** | Sección 6 | DEC nueva: ruta exenta, qué muestra, jerarquía de las dos puertas. Idealmente **antes de CH-49** (un solo enlace para el video). |
| **Activar automatizaciones desde el panel o pedirlas** | P-04 | Si «Activar» entra en el alcance de P2 o si el texto es «pedísela a quien te dio acceso». Antes de CH-48, porque ese change reorganiza el inicio del panel. |
| **Corregir una conexión registrada** | C-05 | Hoy es un límite documentado; cambiarlo requiere DEC. Mientras tanto, mostrar el estado de la última prueba. |
| **Restablecimiento de clave por el propio dueño** | P-02 | Solo si se quiere ir más allá del texto de ayuda; revertiría DEC-156. No recomendado ahora. |

### 8.4 Cambios de la guía de diseño (propuestas, no se aplican en esta revisión)

- `pantallas.md` P-01: estado «sin clave» (texto de contacto). P-02: datos de la tarjeta (regla vigente, destino) y acciones de las disponibles. P-07: nombre del bot.
- `consola.md`: bloque «Qué enviarle al usuario» en «Usuarios del panel» (C-14); aclarar el pop-up de Consultas (C-09); recorrido inicial (C-02).
- Una pantalla nueva fuera de `pantallas.md` (la landing) exige agregarla a la guía antes de implementarla («No agregar pantallas fuera de `guidelines/pantallas.md`»).

### 8.5 Orden sugerido

1. Antes de **CH-48**: P-04 (decisión), P-07 y P-09 (jerarquía del inicio del panel), P-01.
2. Antes de **CH-49**: los arreglos de 8.1 marcados, el diálogo de cambio de tenant, la DEC y la landing de `/`, y los datos de la demo.
3. Después: pulido y lenguaje (C-16 a C-19).
