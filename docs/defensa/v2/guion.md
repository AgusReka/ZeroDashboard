# ZeroDashboard · Guion de la presentación (v2, borrador)

**Autor:** Javier Agustín Recabarren · **Director:** Alberto Cortez
**Carrera:** Tecnicatura Universitaria en Programación · UTN, Facultad Regional Mendoza · 2026

> **Qué cambia respecto de la v1** (`../v1/`). La presentación se centra en el producto: qué es ZeroDashboard, qué problema resuelve y cómo funciona. La tesis queda de respaldo: sus resultados aparecen como evidencia de que el producto funciona, sin hipótesis ni vocabulario académico.
>
> **Ritmo de referencia:** unas 2,3 palabras por segundo (≈ 140 por minuto). Diez minutos es el piso, no el techo.
>
> **Regla de lenguaje:** lo que se dice tiene que entenderse escuchado una sola vez. Nada de "heterogéneo", "canónico", "refutable", "granularidad" ni "esquema" en la narración. Si una idea necesita una palabra técnica, la palabra va en pantalla y la explicación va en la voz.

---

## Parte 1 · Qué es ZeroDashboard (2 min | 00:00 – 02:00)

### Texto del guion

> Buenos días. Mi nombre es Javier Agustín Recabarren, y les voy a presentar ZeroDashboard, el proyecto final de mi Tecnicatura en Programación, dirigido por el profesor Alberto Cortez.
>
> Empiezo con una escena que se repite en cualquier comercio que vende por internet. Son las ocho de la mañana. Antes de abrir, alguien entra al sistema de ventas, revisa qué productos se están por terminar, cuenta cuántos pedidos entraron ayer y arma, a mano, el resumen del día. Mañana lo va a hacer de nuevo. Y pasado también.
>
> Lo curioso es que toda esa información ya existe. El sistema de ventas la guarda: cada producto, cada pedido, cada insumo. El problema no es que falten datos. El problema es que nadie los mira a tiempo, y que mirarlos cuesta horas de trabajo que no le agregan valor al negocio.
>
> ZeroDashboard resuelve eso. Se conecta a la información que el comercio ya tiene, la vigila por él y le avisa cuando algo necesita su atención. Por ejemplo: "te quedan tres insumos por debajo del mínimo". El aviso llega por correo o por Telegram, directo al celular del dueño. Y además le arma un tablero con sus números del día, siempre actualizados, sin que tenga que pedirlos.
>
> Todo eso pasa sin tocar el sistema del comercio. No hay que instalarle nada, no hay que cambiarle nada, y ZeroDashboard nunca puede modificar un solo dato: solo lee.
>
> En resumen, el comercio deja de buscar la información y pasa a recibirla.

*(≈ 270 palabras)*

### Apoyo visual

- **Placa de apertura:** «ZeroDashboard» en grande. Debajo, una línea: «Tus datos ya saben lo que pasa. ZeroDashboard te avisa.» Al pie: autor, director, UTN FRM 2026.
- **La escena de las 8 a. m.:** un reloj y tres tareas manuales que se apilan (revisar stock, contar pedidos, armar el resumen) y se repiten «mañana» y «pasado».
- **El giro:** las tareas se apagan y aparecen tres resultados: un aviso en un celular, un correo y un tablero con números.
- **La garantía:** un candado con «Solo lectura · sin instalar nada en tu sistema».

---

## Parte 2 · El problema de fondo y cómo lo resuelve (2 min 30 s | 02:00 – 04:30)

### Texto del guion

> Ahora, automatizar un comercio no es una idea nueva. Lo nuevo es cómo hacerlo para muchos comercios a la vez.
>
> Este proyecto nació de una experiencia previa. Para un comercio gastronómico de prueba, Food Store, armé tres automatizaciones: un control de stock, respuestas a consultas frecuentes y un reporte diario. Funcionaron. Pero tenían una trampa: estaban hechas a medida. Cada una dependía de cómo ese sistema en particular organiza su información. Si mañana quería ofrecerle lo mismo a un segundo comercio, con otro sistema de ventas, tenía que empezar de cero.
>
> Y eso, como negocio, no escala. Si cada cliente nuevo cuesta lo mismo que el primero, el servicio nunca se vuelve rentable.
>
> La idea central de ZeroDashboard es poner un traductor en el medio. Cada comercio guarda la información a su manera, con sus propios nombres. ZeroDashboard define un idioma común, con cinco conceptos que cualquier comercio entiende: productos, pedidos, los ítems de cada pedido, insumos y recetas. Cuando se suma un cliente, se traduce su sistema a ese idioma común, una sola vez.
>
> A partir de ahí, cada automatización se escribe en el idioma común. Y por eso sirve para todos los comercios conectados. La escribo una vez, y la ofrezco a todos mis clientes.
>
> Hay otro detalle que importa en gastronomía. Algunos productos se compran hechos, como una gaseosa, y su stock se cuenta. Otros se elaboran, como una pizza, y lo que importa es cuántas puedo armar con los insumos que tengo. ZeroDashboard calcula las dos cosas.
>
> Y todo con una regla que no se negocia: ZeroDashboard nunca escribe en la base del comercio. Lo garantiza dos veces, antes de ejecutar y durante la ejecución. Cada comercio ve solo su información, y las claves de acceso se guardan cifradas.

*(≈ 330 palabras)*

### Apoyo visual

1. **«Hecho a medida no escala».** Tres comercios, cada uno con su sistema de ventas (Food Store, Medusa, Odoo), y encima de cada uno su propia automatización, enredada y en rojo apagado. Un contador: «cliente nuevo = empezar de cero».
2. **«Un idioma común».** Tres capas:
   - **Arriba:** una sola automatización, en verde azulado.
   - **Al medio:** el idioma común, una banda con cinco chips: Productos · Pedidos · Ítems · Insumos · Recetas.
   - **Abajo:** los tres sistemas, cada uno conectado a la banda con una línea fina («se traduce una vez»).
   - Frase al pie: «Se escribe una vez. Sirve para todos.»
3. **«Comprado o elaborado».** Una gaseosa con «stock: 24» y una pizza con «se pueden armar: 6», calculado a partir de sus insumos.
4. **«Seguro por diseño».** Tres íconos: candado («nunca escribe»), escudo («cada comercio ve lo suyo»), llave («claves cifradas»).

---

## Parte 3 · ZeroDashboard en funcionamiento (≈ 5 min | 04:30 – 09:30)

> **Estado:** todas las escenas se probaron en la demo. Cada una lleva una nota «Validado» con lo que hay que tener en cuenta al grabar.
>
> **Dos personajes:** el **implementador**, que trabaja en la consola, y el **dueño del comercio**, que usa el panel. El recorrido sigue el orden real de una puesta en marcha.
>
> **Antes de grabar:** arrancar la demo desde cero (`down -v`). La validación dejó en la base una plantilla «Insumos por agotarse» que chocaría con la que se crea en vivo en la Escena 4.

### Escena 1 · Cómo se suma un cliente (≈ 40 s) [validado]

- **Validado:** no se hace un alta en vivo. Se muestran dos comercios que ya están conectados. «Probar conexión» da verde en los dos: la conexión de Café del Puerto es directa y la de Food Store pasa por su agente.
- **Qué se ve:** la lista de comercios en la consola. Se abre Café del Puerto, se ve su conexión y se aprieta «Probar conexión», que da verde. Después, la pantalla de Agentes de Food Store, con su agente conectado.
- **Narración:**
  > Así se suma un cliente. Este es Café del Puerto. Para darlo de alta se carga el comercio y cómo llegar a su información, y se prueba la conexión: en verde, lista. Si el comercio no quiere abrir su red, como Food Store, se instala un pequeño agente que corre de su lado y es él quien se conecta con ZeroDashboard.

### Escena 2 · La traducción al idioma común (≈ 40 s) [validado]

- **Validado:** el mapeo de Café del Puerto tiene las cinco entidades en «Válida». Lo que no se corrió es el botón «Validar mapeo» sobre Café: conviene probarlo una vez antes de grabar. El error no se provoca en vivo, para no romper un mapeo que ya funciona: se cuenta con la voz.
- **Qué se ve:** la pantalla de mapeo de Café del Puerto. Las cinco entidades, cada una con el SELECT que la traduce y su estado «Válida». Se aprieta «Validar mapeo» y todo queda en verde.
- **Narración:**
  > Después, el sistema del comercio se traduce al idioma común: productos, pedidos, ítems, insumos y recetas. Cada uno se escribe una vez y se valida. Si algo falta o está mal escrito, ZeroDashboard lo marca antes de que llegue al cliente. Cuando todo está en verde, el comercio está listo para recibir automatizaciones.

### Escena 3 · Explorar los datos sin riesgo (≈ 30 s)

- **Qué se ve:** una consulta que devuelve los productos con menos stock. Después, un intento de modificar datos que se rechaza antes de llegar a la base.
- **Narración:**
  > Desde la consola puedo explorar la información del cliente. Pero modificarla, nunca: si lo intento, ZeroDashboard lo frena antes de llegar a su base.

### Escena 4 · Una automatización nueva, sin programar (≈ 60 s)

- **Validado:** se guarda con título y descripción para el cliente y se prueba contra la conexión de Food Store. Hay que escribir la condición con `<= :umbral`. Con `<`, el Bacon, que tiene exactamente 40, queda afuera y salen dos insumos en lugar de tres.
- **Qué se ve:** plantilla nueva «Insumos por agotarse», escrita en el idioma común, probada contra una conexión real (tres insumos en cuarenta o menos) y guardada. Se completan el título y la descripción para el cliente: sin ellos, el panel muestra «Automatización de tu negocio».
- **Narración:**
  > Ahora, lo central. Creo una automatización nueva: insumos por agotarse. Fíjense que no menciona nada propio de Food Store: está escrita en el idioma común, así que sirve para cualquier comercio conectado. La pruebo con datos reales antes de guardarla: hay tres insumos con cuarenta unidades o menos.

### Escena 5 · Activarla para el cliente (≈ 45 s)

- **Qué se ve:** alta de la automatización para Food Store: stock mínimo, mínimo de filas, horario y canal. Vista previa del mensaje.
- **Narración:**
  > La activo para este cliente. Elijo dos números: el stock mínimo, que decide qué insumos entran en el aviso, y cuántos tienen que estar en falta para que valga la pena avisar. Elijo el horario y el canal. Y antes de activarla veo el mensaje exacto que va a recibir.

### Escena 6 · El aviso llega (≈ 45 s) [validado · clip de celular]

- **Validado:** el correo llega a Mailpit y el aviso de Telegram llega al celular. Ojo: las dos automatizaciones de la semilla también mandan un correo por minuto, así que la bandeja de Mailpit se llena rápido. Conviene vaciarla antes de la toma.
- **Qué se ve:** el correo en la bandeja y, al lado, dentro de un marco de teléfono, el **video grabado con el celular**: el aviso llegando al bot de Telegram. Después, la lista de ejecuciones con su estado.
- **Narración:**
  > Al minuto, llega el aviso. Por correo, a los destinatarios que elegí, o directo al celular del dueño, por Telegram. Y cada ejecución queda registrada con su resultado.

### Escena 7 · Lo que ve el dueño del comercio (≈ 60 s) [validado, con un ajuste]

- **Validado:** el tablero muestra sus cuatro reportes con datos, y en Avisos aparece la automatización recién creada con su título. Ajustar el stock mínimo funciona. **La hora no se puede ajustar** en una automatización que corre cada minuto (responde `horario-no-editable`), así que en el video solo se ajusta el stock mínimo.
- **Qué se ve:** el panel del cliente. Primero el **tablero**, con sus reportes en vivo (un número grande, una tabla, un gráfico). Después **Avisos**, donde aparece **la automatización recién creada**. El dueño ajusta el stock mínimo.
- **Narración:**
  > Del otro lado está el dueño del negocio. Él no ve código: ve su tablero, con sus números del día, siempre actualizados. Y en sus avisos ya aparece el que acabamos de crear para él. Si quiere, ajusta lo que le importa, como el stock mínimo.

### Escena 8 · Cada comercio, lo suyo (≈ 15 s)

- **Qué se ve:** el panel de otro comercio, Café del Puerto, con información distinta.
- **Narración:**
  > Y cada comercio ve solo lo suyo. Este es otro cliente, con su propia información.

### Escena 9 · Cuando algo falla (≈ 40 s) [validado]

- **Validado:** con el agente detenido, la ejecución queda fallida con `ESINAGENTE`. Al volver a levantarlo, la siguiente sale bien. Las fallas que se veían antes en el video venían de la semilla, y quedaron corregidas en el PR #282.
- **Qué se ve:** se detiene el agente del cliente. La ejecución queda como fallida, con su causa para el implementador, y el dueño ve un mensaje claro. El agente vuelve y la siguiente ejecución sale bien.
- **Narración:**
  > ¿Y si se corta la conexión? Apago el agente del comercio. La ejecución queda registrada como fallida, con la causa para mí, y el dueño ve un mensaje claro, sin tecnicismos. Cuando el agente vuelve, todo sigue solo.

### Escena 10 · Cierre de la demo (≈ 15 s)

- **Narración:**
  > Ese es ZeroDashboard: solo lee, habla un idioma común con todos los comercios, y una automatización escrita una vez trabaja para todos.

### Candidatas a sumar (según lo que se valide)

- **Consultas guardadas con versiones:** muestra que el trabajo del implementador queda ordenado. Hoy la demo trae una sola consulta, con una sola versión: para mostrarlo habría que guardar una segunda versión en vivo.
- **Duplicar una plantilla en uso:** funciona. Editar `stock-fisico` se rechaza porque está en uso, y la copia se puede probar. Las plantillas no se borran, así que la copia queda en el catálogo.
- **Usuarios del panel y auditoría:** funcionan y muestran datos.

---

## Parte 4 · Cómo está hecho, dónde se probó y qué sigue (3 min | 09:30 – 12:30)

### Texto del guion

> **Cómo está hecho.** Detrás de lo que vieron hay una regla simple: separar lo que es igual para todos de lo que es propio de cada comercio. Las automatizaciones solo conocen el idioma común. La traducción de cada comercio vive aparte. Por eso sumar un cliente no obliga a tocar lo que ya funciona.
>
> La seguridad no depende de que alguien se acuerde de cuidarla. Que ZeroDashboard no escriba se controla dos veces. Que un comercio no vea los datos de otro lo impone el propio sistema: si no sabe de qué comercio se trata, no responde. Y las claves de acceso se guardan cifradas, con la llave fuera de la base.
>
> **Dónde se probó.** La pregunta de fondo era si esto funciona de verdad con sistemas distintos. Así que tomé la misma automatización, la que calcula cuántos productos se pueden elaborar, y la corrí sin cambiarle una coma sobre tres sistemas de venta diferentes: Food Store, Medusa y Odoo. En los tres dio el mismo resultado que el sistema original y que la cuenta hecha a mano.
>
> En el camino apareció un error: en Odoo, cuando dos insumos se terminaban al mismo tiempo, la automatización no sabía cuál marcar primero. El problema estaba en cómo estaba escrita la automatización, no en el idioma común. Se corrigió en una segunda versión, sin tocar nada más.
>
> **Hasta dónde llega hoy.** Quiero ser claro con los límites, porque también son resultados. Hay sistemas, como Saleor o WooCommerce, que no guardan recetas. Ahí el cálculo de cuánto se puede elaborar no tiene de dónde salir, y ZeroDashboard no lo puede ofrecer. Y aprendí algo que no esperaba: que una cuenta funcione en todos lados no significa que signifique lo mismo en todos lados. En Saleor, el reporte diario sumó ventas en dos monedas distintas.
>
> **Qué sigue.** El próximo paso es salir de los comercios de prueba y trabajar con comercios reales; medir cuánto cuesta sumar un sistema de ventas nuevo; y enseñarle al idioma común a entender monedas y unidades de medida.
>
> **Cierre.** Quiero agradecer a mi director, Alberto Cortez, por su guía, y a ustedes por su tiempo y su atención. Quedo a disposición para sus preguntas.

*(≈ 400 palabras)*

### Apoyo visual

1. **«Cómo está hecho».** Diagrama simple de tres pisos:
   - **Arriba:** consola (implementador) y panel (dueño del comercio).
   - **Al medio:** ZeroDashboard, con el idioma común y la traducción de cada comercio como cajas separadas.
   - **Abajo:** la información del comercio, con una flecha marcada «solo lectura».
   - Chips al pie: Node.js · TypeScript · PostgreSQL.
2. **«Seguro por diseño».** Los mismos tres íconos de la Parte 2, ahora con una línea cada uno: «se controla dos veces», «sin comercio, no responde», «llave fuera de la base».
3. **«Dónde se probó».** Tres logos de texto (Food Store, Medusa, Odoo), cada uno con un ✓ y «mismo resultado que la cuenta a mano». Debajo, chico: «Odoo: un error de empate, corregido en la versión 2».
4. **«Hasta dónde llega».** ✕ Saleor y WooCommerce: «sin recetas, no hay cálculo de elaborados». ⚠ «Dos monedas, una sola suma».
5. **«Qué sigue».** Tres pasos en línea: Comercios reales → Costo de sumar un sistema → Monedas y unidades.
6. **Placa final.** «ZeroDashboard», y debajo «¡Gracias! ¿Preguntas?». Chico: autor, director, UTN FRM 2026 y `github.com/AgusReka/ZeroDashboard`.

---

## Control de tiempos

| Parte | Ventana | Duración | Apoyo |
|---|---|---|---|
| 1. Qué es ZeroDashboard | 00:00 – 02:00 | 2:00 | Video de apoyo |
| 2. El problema de fondo y cómo lo resuelve | 02:00 – 04:30 | 2:30 | Video de apoyo |
| 3. ZeroDashboard en funcionamiento | 04:30 – 09:30 | ≈ 5:00 | Grabación de la demo + clip de Telegram |
| 4. Cómo está hecho, dónde se probó y qué sigue | 09:30 – 12:30 | 3:00 | Video de apoyo |
