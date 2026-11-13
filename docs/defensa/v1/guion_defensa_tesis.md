# Estructura de Presentación de Tesis (10 Minutos)

**Trabajo:** *Un contrato de datos canónico para automatizar procesos de comercio electrónico sobre plataformas heterogéneas. Diseño y evaluación sobre un caso de origen y tres plataformas de código abierto.*
**Autor:** Javier Agustín Recabarren · **Director:** Alberto Cortez
**Carrera:** Tecnicatura Universitaria en Programación · UTN, Facultad Regional Mendoza · 2026

> **Nota de preparación.** La plantilla original del pedido mencionaba SBOM, vulnerabilidades y un tablero Kanban de remediación. Esos temas no figuran en la tesis. Este guion sigue la tesis (`docs/Tesis_Final_Recabarren.md`) y el video de la demo de ZeroDashboard.
>
> **Ritmo de referencia:** unas 130 a 140 palabras por minuto. Cada bloque de texto está escrito para leerse en ese ritmo, dentro de su ventana de tiempo.

---

## Parte 1: Introducción (1.5 min | 00:00 - 01:30)

### Texto del Guion (lo que diré en voz alta)

> Buenos días. Mi nombre es Javier Agustín Recabarren y voy a presentar mi trabajo final de la Tecnicatura Universitaria en Programación, dirigido por el profesor Alberto Cortez: *Un contrato de datos canónico para automatizar procesos de comercio electrónico sobre plataformas heterogéneas*.
>
> El punto de partida es concreto. Muchas pequeñas y medianas empresas venden sobre una plataforma de comercio electrónico que ya registra en su base de datos todo lo que la operación necesita: productos, existencias, pedidos. Sin embargo, procesos como controlar el stock o armar un reporte diario siguen siendo manuales, porque la plataforma no siempre expone ese dato por una interfaz, y la organización no siempre puede modificarla.
>
> Existe una vía que no requiere la colaboración de la plataforma: leer directamente su base de datos, en modo de solo lectura. Pero esa vía tiene un costo, y ese costo es el tema de este trabajo: la automatización queda atada al esquema de una instalación, y lo que se construye para un comercio no se transfiere al siguiente.
>
> El propósito de la tesis fue especificar un contrato de datos canónico contra el cual las automatizaciones se escriban una sola vez, y evaluar hasta dónde ese contrato es portable entre plataformas distintas y dónde deja de serlo.

*(≈ 200 palabras)*

### Sugerencia visual (Diapositiva)

- **Fondo oscuro y sobrio** (gris carbón `#13171b`), con un acento verde azulado (`#3ea38e`), los colores de ZeroDashboard.
- **Título:** «Un contrato de datos canónico para comercio electrónico».
- **Subtítulo:** «Automatizaciones que se escriben una vez y corren sobre plataformas heterogéneas».
- **Pie:** nombre del autor, director, UTN FRM y año.
- **Isologotipo:** marca «ZeroDashboard» chica en una esquina, porque es el prototipo y no el objeto evaluado.
- Sin viñetas ni párrafos.

---

## Parte 2: El Problema y la Propuesta (2 min | 01:30 - 03:30)

### Texto del Guion

> El problema surgió de un estudio previo. Sobre Food Store, una instancia de demostración de un comercio gastronómico, automaticé con n8n tres procesos: el control de existencias, la atención de consultas frecuentes y un reporte operativo diario. Funcionó, y mostró que automatizar operando sobre la base de datos era viable. Pero también mostró dos limitaciones.
>
> La primera es de transferibilidad: cada consulta nombraba tablas y columnas de esa plataforma en particular. Llevar el catálogo a otro comercio implicaba reescribirlo entero.
>
> La segunda es estructural: en un comercio gastronómico conviven dos regímenes de inventario. Algunos productos tienen un stock almacenado. Otros, los elaborados, tienen una disponibilidad que se calcula a partir de sus insumos y de su receta. Una automatización que funciona donde la plataforma modela recetas no tiene cómo funcionar donde no las modela, por mejor que se la reescriba.
>
> Ambas limitaciones remiten a un problema conocido en integración de datos: dar acceso uniforme a fuentes con esquemas heterogéneos. La propuesta lo lleva al dominio acotado de la automatización operativa: un contrato canónico de cinco entidades y veinticuatro atributos (producto, pedido, ítem de pedido, insumo y componente de receta) que cada instalación realiza como una capa de vistas relacionales sobre su propio esquema. La automatización se escribe una vez contra el contrato, y lo único que cambia entre plataformas es esa capa de correspondencias.
>
> Lo formulé con dos hipótesis refutables. La primera es de portabilidad: la automatización de stock producible ejecuta sin modificar su texto y con resultado correcto sobre un esquema independiente. La segunda es de límite: esa automatización solo es aplicable donde la plataforma registra qué componentes consume cada producto.

*(≈ 270 palabras)*

### Sugerencia visual (Diapositiva)

Dos diapositivas, sin código ni capturas de la plataforma:

1. **«Hoy: una automatización por esquema».** A la izquierda, tres cilindros de base de datos con nombres distintos (Food Store, Medusa, Odoo), cada uno con su propia automatización enredada encima, en rojo apagado. A la derecha, dos íconos simples que representan los dos regímenes de stock: una caja (stock almacenado) y una receta con insumos (stock calculado).
2. **«Propuesta: escribir una vez».** Un esquema en tres capas horizontales:
   - **Arriba:** la automatización, una sola caja, en verde azulado.
   - **Al medio:** el contrato canónico, una banda con las cinco entidades como chips.
   - **Abajo:** las bases de cada plataforma, unidas al contrato por la capa de vistas, dibujada como líneas finas.

   Al pie, las dos hipótesis en una línea cada una: **H1 Portabilidad** y **H2 Límite de aplicabilidad**.

---

## Parte 3: Demostración Core (3 min | 03:30 - 06:30)

### Corte de video recomendado

- **Archivo:** el render más reciente en `zerodashboard-video/renders/`. Dura 2:48, se ve a pantalla completa, no tiene textos en pantalla, no tiene voz y solo lleva efectos de sonido.
- **Arranque:** pasar a pantalla completa al terminar la Parte 2 y dar play exactamente en **03:30**. El video termina en **06:18**. Los 12 s que quedan son para el cierre hablado y el paso a la Parte 4.
- **Qué muestra:** el prototipo ZeroDashboard en uso, del lado del implementador (la consola) y del lado del comercio (el panel). Hay cortes en las esperas: el aviso que llega «un minuto después» y la caída y vuelta del agente.

> **Aclaración para decir o tener a mano:** lo que se ve es el prototipo en su estado actual, posterior al congelamiento de la tesis del 24/09/2026. El objeto evaluado en la tesis es el contrato y su procedimiento de adaptación, no la aplicación. El prototipo es el instrumento.

### Texto del Guion (sincronizado para narrar durante el video)

Cada tramo indica el reloj de la presentación y, entre corchetes, el tiempo del video. Las frases están medidas para unas 2,3 palabras por segundo y caben en su tramo.

#### *03:30 - 04:15* · Conexión, mapeo al contrato y solo lectura [video 0:00 - 0:45]

- **03:30 [0:00]**, inicio y Conexiones:
  > Este es ZeroDashboard, el prototipo con el que probé el contrato. La consola se conecta a la réplica del comercio en solo lectura, a través de un agente del cliente.
- **03:44 [0:14]**, Mapeo y validación:
  > Después se mapean las cinco entidades al contrato y se validan, una sola vez por instalación.
- **03:51 [0:21]**, Consultas:
  > Desde la consola se pueden explorar los datos del cliente. Un SELECT devuelve los productos con menos stock. Pero nunca escribir: un UPDATE se rechaza antes de llegar a la base, y además cada consulta corre en una transacción de solo lectura. Son las dos capas de garantía de la tesis.

#### *04:15 - 05:15* · Una automatización nueva escrita contra el contrato [video 0:45 - 1:42]

- **04:15 [0:45]**, Nueva plantilla:
  > Ahora, lo central: una automatización nueva, «Insumos por agotarse», sin tocar código.
- **04:24 [0:54]**, se tipea el SQL:
  > La consulta no lee tablas de Food Store: lee la vista canónica de insumo, con los nombres del contrato. Sirve para cualquier comercio mapeado.
- **04:37 [1:07]**, prueba y guardado:
  > Antes de guardar, se prueba contra una conexión real: tres insumos bajo cuarenta.
- **04:45 [1:15]**, Nueva automatización:
  > La doy de alta sobre la conexión del cliente. Hay dos números: el stock mínimo define qué insumos entran en el aviso, y el mínimo de filas define si vale la pena avisar. Con dos, un insumo solo no dispara nada.
- **05:04 [1:34]**, Vista previa:
  > La vista previa muestra el mensaje exacto, sin enviarlo.

#### *05:15 - 06:30* · El aviso, el panel del comercio y la recuperación ante fallas [video 1:42 - 2:48 + cierre]

- **05:12 [1:42]**, Mailpit y ejecuciones:
  > Al minuto siguiente llega el aviso: un solo correo, a los dos destinatarios. Y cada ejecución queda registrada, con su estado.
- **05:26 [1:56]**, Panel del cliente:
  > Del otro lado, el dueño del negocio. No ve SQL: ve sus reportes y sus avisos en su idioma, incluido el recién creado. Y ajusta lo que le importa, como la cantidad mínima.
- **05:45 [2:15]**, Café del Puerto:
  > Cada negocio ve solo lo suyo: este es otro comercio.
- **05:51 [2:21]**, falla provocada:
  > Ahora detengo el agente del cliente. La ejecución queda registrada como fallida, con su causa para el implementador, y el cliente ve un mensaje claro.
- **06:08 [2:38]**, vuelve el agente:
  > El agente vuelve y todo sigue solo.
- **06:12 [2:42]**, desactivación:
  > Al desactivarla, su historial queda disponible.
- **06:18**, termina el video; volver a las diapositivas:
  > Ese es el patrón que la tesis evalúa: solo lectura, un contrato común y automatizaciones escritas contra el contrato, no contra la plataforma.

---

## Parte 4: Conclusiones, Arquitectura y Cierre (3.5 min | 06:30 - 10:00)

### Texto del Guion

> **Arquitectura.** El prototipo está hecho en Node.js con TypeScript, con una base propia en PostgreSQL. La decisión central es separar el contrato de cada instalación: las vistas canónicas se definen por conexión, y las automatizaciones solo conocen los nombres del contrato. Admití un único motor de base de datos, PostgreSQL, a propósito, para no mezclar la heterogeneidad de esquemas, que es el objeto del trabajo, con la de dialectos SQL. La solo lectura se garantiza en dos capas, transacción de solo lectura y verificación de privilegios del rol; el aislamiento entre clientes falla cerrado, y las credenciales se guardan cifradas con la clave fuera de la base.
>
> **Resultados.** La automatización de stock producible ejecutó sin modificar su texto sobre el esquema de origen, sobre Medusa y sobre Odoo, con el mismo stock producible que la consulta nativa y que el cálculo manual. La hipótesis de portabilidad quedó, sin embargo, parcialmente refutada: en Odoo, cuando dos insumos empatan, la consulta no determinaba cuál es el limitante. La causa fue el texto de la consulta, no el contrato ni las vistas, y una segunda versión lo corrigió sin cambiar el contrato. La hipótesis de límite no fue refutada: en Saleor y en el núcleo de WooCommerce, que no registran recetas, el stock producible resultó inaplicable, como predice la distinción entre demanda independiente y dependiente.
>
> Además, las correspondencias se clasificaron en una clase directa y tres de obstáculo: granularidad, entidad-atributo-valor y ausencia. Solo la ausencia de una entidad determina un límite de aplicabilidad, y es la clase que las clasificaciones clásicas de conflictos de esquema no tratan. También aprendí algo que el diseño no anticipaba: una consulta portable no garantiza que los valores signifiquen lo mismo. En Saleor, el reporte diario sumó importes de dos monedas.
>
> Por eso la conclusión es más acotada que «el contrato es genérico»: el contrato es satisfacible por las plataformas que registran la composición de sus productos, con correspondencias que exigen decisiones de granularidad, y parcialmente insatisfacible por las que no la registran.
>
> **Limitaciones y trabajo futuro.** Los resultados se obtuvieron sobre instancias de demostración, y la reproducibilidad del criterio de clasificación no quedó establecida. Como trabajo futuro quedan medir el costo de adaptar una nueva plataforma, hacer una evaluación con comercios reales, definir la dimensión semántica del contrato, como las monedas y las unidades, y estudiar cómo evolucionan los esquemas en el tiempo.
>
> **Cierre.** Quiero agradecer a mi director, Alberto Cortez, por su guía, y al tribunal por su tiempo y su atención. Quedo a disposición para sus preguntas.

*(≈ 420 palabras, con margen para pausas)*

### Sugerencia visual (Diapositiva)

Tres diapositivas cortas:

1. **«Arquitectura».** Diagrama de componentes simplificado (como la Figura 5.3 de la tesis):
   - Consola y panel arriba.
   - En el centro, el núcleo con contrato, vistas por conexión y motor.
   - Abajo, la base propia y la réplica del cliente unidas por una flecha marcada «solo lectura».
   - Debajo, tres chips: Node.js + TypeScript · PostgreSQL · Solo lectura en dos capas.
2. **«Conclusiones».** Tres viñetas muy cortas, con un ícono cada una:
   - ✓ **Portable** donde hay recetas: Food Store, Medusa, Odoo.
   - ✕ **Inaplicable** sin estructura de composición: Saleor, WooCommerce.
   - ⚠ **Portable no es equivalente**: una misma cifra puede no significar lo mismo.

   Al pie, en gris: «Trabajo futuro: costo de adaptación · evaluación con comercios reales · semántica del contrato».
3. **Placa final.** Fondo oscuro con «¡Gracias!» y, debajo, «¿Preguntas?». Abajo, chico: nombre, director, UTN FRM 2026 y el repositorio `github.com/AgusReka/ZeroDashboard`.

---

## Control de tiempos

| Parte | Ventana | Duración | Apoyo |
|---|---|---|---|
| 1. Introducción | 00:00 - 01:30 | 1:30 | 1 diapositiva |
| 2. Problema y propuesta | 01:30 - 03:30 | 2:00 | 2 diapositivas |
| 3. Demostración | 03:30 - 06:30 | 3:00 | Video de 2:48 + 12 s de cierre hablado |
| 4. Conclusiones y cierre | 06:30 - 10:00 | 3:30 | 3 diapositivas |
