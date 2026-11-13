# Guion del video de ZeroDashboard

Recorrido de punta a punta sobre la demo (CH-49). Duración objetivo: 9 a 10 minutos. Cada paso indica qué hacer en pantalla, qué decir y cuánto dura aproximadamente. Los textos entre «» son los de la interfaz.

---

## Antes de grabar

**Levantar la demo desde cero** (borra los volúmenes de desarrollo):

```bash
docker compose --profile demo --profile correo --profile agente down -v
docker compose --profile demo --profile correo --profile agente up -d --build
curl http://localhost:3000/health   # {"status":"ready","db":"connected"}
```

- **Variables en `.env`:**
  - `SEED_DEMO=1`, `REPLICA_DEMO_PASSWORD`, `DEMO_OPERADOR_CLAVE`, `DEMO_PANEL_CORREO` y `DEMO_PANEL_CLAVE`.
  - Para el correo: `SMTP_HOST=mailpit` y `SMTP_PORT=1025`.
  - Para el paso 7: `DEMO_AGENTE_TOKEN`. Sin el perfil `agente`, el paso 7 se saltea.
- **Pestañas abiertas, en este orden:**
  1. `http://localhost:3000/consola`, con la sesión ya iniciada como `demo` y el tenant «Food Store» elegido.
  2. `http://localhost:8026` (Mailpit).
  3. `http://localhost:3000/panel`, sin sesión.
- **Mailpit:** la automatización de cada minuto ya lo está llenando. Antes de grabar, borrar todos los mensajes para que el correo nuevo se vea claro.
- **Texto para pegar:** tener a mano el SQL de la plantilla del paso 3.

**Datos de la demo que aparecen en el video:**
- **Productos sin receta de Food Store:** Brownie de Chocolate (4), Agua Mineral 500ml (9) y Coca Cola 500ml (18).
- **Insumos con menos stock:** Huevo (8), Jalapeños (30) y Bacon (40).

---

## 0. Apertura (30 s)

**Pantalla:** `http://localhost:3000/`, con las dos puertas.

**Decir:** «ZeroDashboard le da automatizaciones operativas a un comercio chico sin tocar su plataforma de venta. Se conecta a una réplica de solo lectura de su base, la traduce a un contrato común y sobre eso corre avisos y reportes. Hay dos lados: la consola, donde trabaja el implementador, y el panel, que usa el dueño del negocio.»

---

## 1. Consola: el tenant ya está conectado y mapeado (1 min)

1. En la consola, mostrar la barra superior: «Operando sobre **Food Store**».
2. Ir a **Conexiones**. Mostrar `food-store-demo`, con «Última prueba: OK». Apretar **Probar conexión** y esperar «OK · N ms».
3. Si se levantó con el agente, ir a **Agentes** y mostrar «Activo · creado el …».
4. Ir a **Mapeo y validación**. Mostrar las cinco entidades en «Válida», y al pie la franja «Puesta en marcha» con las etapas en «✓ Hecho».

**Decir:** «Cada negocio tiene su base distinta. Una vez, el implementador escribe cómo se lee cada entidad (productos, pedidos, insumos) en un contrato común y lo valida. A partir de ahí, todo lo demás funciona igual para cualquier negocio. Acá la conexión pasa por un agente que corre del lado del cliente: el cliente no abre ningún puerto.»

---

## 2. Consultas: solo lectura (1 min)

1. Ir a **Consultas** → **Nueva consulta**.
2. Elegir la conexión y pegar:
   ```sql
   SELECT nombre, "stockDisponible" FROM v_producto WHERE activo ORDER BY "stockDisponible" LIMIT 5
   ```
3. Apretar **Ejecutar consulta** (Ctrl + Enter) y mostrar «Última ejecución: OK · … · 5 filas».
4. Reemplazar por:
   ```sql
   UPDATE v_producto SET "stockDisponible" = 0
   ```
5. Ejecutar y mostrar «La consulta no se pudo ejecutar», con «La consulta fue rechazada: solo se permiten lecturas. Se encontró UPDATE.»
6. Salir con **Cancelar** y confirmar que se descartan los cambios.

**Decir:** «La consola permite explorar los datos del cliente, pero nunca escribir. Una sentencia que modifica se rechaza antes de llegar a la base, y además todo corre en una transacción de solo lectura.»

---

## 3. Plantilla nueva escrita en vivo (2 min 30 s)

Es la parte central: una automatización nueva, escrita desde la consola sin tocar código.

1. Ir a **Plantillas** → **Nueva plantilla**.
2. **1 · Qué es:**
   - Nombre: `Insumos por agotarse`
   - Automatización: `stock-fisico`
   - Título para el cliente: `Insumos por agotarse`
   - Descripción para el cliente: `Te avisamos cuando un insumo de tus recetas se está terminando.`
3. **2 · Datos:**
   - Entidades: marcar solo `insumo`.
   - Sentencia SQL:
     ```sql
     SELECT
       i.nombre AS "Insumo",
       i."stockDisponible" AS "Stock"
     FROM v_insumo i
     WHERE i."stockDisponible"::numeric <= :umbral
     ORDER BY i."stockDisponible"::numeric ASC, i.nombre ASC
     ```
   - **Agregar parámetro:** Nombre `umbral`, Tipo `numero`.
     - Rótulo para el operador: `Stock mínimo por insumo`
     - Ayuda: `Avisa cuando un insumo llega a esta cantidad o menos.`
4. **3 · Salida:**
   - Encabezado del mensaje: `Estos insumos se están terminando:`
   - Línea por fila: `{Insumo}: quedan {Stock}`
5. **4 · Prueba:**
   - Conexión: `food-store-demo`; umbral: `40`.
   - **Probar plantilla**: salen 3 filas (Huevo 8, Jalapeños 30, Bacon 40).
   - Mostrar el pie: «Última prueba: OK · … · 3 filas».
6. **Guardar plantilla.**

**Decir:**
- «El implementador escribe la plantilla con SQL sobre las vistas del contrato, no sobre las tablas del cliente. Por eso la misma plantilla sirve para cualquier negocio que tenga sus insumos mapeados.»
- «Antes de guardar, hay que probarla contra una conexión real: si cambia el SQL, hay que volver a probar.»
- «El rótulo del parámetro es para quien da de alta la automatización: va a ver "Stock mínimo por insumo" en lugar de un nombre técnico.»

---

## 4. Alta de la automatización (1 min 30 s)

1. Ir a **Automatizaciones** → **Nueva automatización**.
2. **Conexión y plantilla:** conexión `food-store-demo` y la tarjeta «Insumos por agotarse». Apretar **Completar parámetros**.
3. **Parámetros y horario:**
   - «Stock mínimo por insumo»: `40`. Señalar la ayuda que aparece debajo del campo.
   - Frecuencia: **Personalizado (expresión cron)**, con `* * * * *` (cada minuto, solo para el video).
   - Canal: Correo.
   - Destinatarios: `encargado@food-store.example, compras@food-store.example`
   - «Mínimo de filas para avisar»: `2`. Mostrar la ayuda: «… es cuántos productos tienen que cumplir la condición, no el valor de la condición».
   - Mostrar la vista previa: «Se envía con: 2 filas o más».
4. Apretar **Crear automatización**.
5. En la fila nueva, apretar **Vista previa**. Mostrar el mensaje con el encabezado y una línea por insumo, sin que se envíe nada. **Cerrar**.

**Decir:** «Son dos números distintos: el stock mínimo define qué insumos entran en el aviso, y el mínimo de filas define si vale la pena avisar. Con 2, un solo insumo bajo no manda nada.»

---

## 5. El aviso llega (45 s)

1. Esperar al minuto siguiente (se puede hablar del paso anterior mientras tanto).
2. Ir a Mailpit y abrir el correo «⚠️ Insumos por agotarse (3)», enviado a los dos destinatarios. Mostrar el encabezado y las tres líneas.
3. Volver a la consola, a **Ver ejecuciones** de la automatización nueva. Mostrar la fila con estado `ok` y la notificación «Enviada».

**Decir:** «El aviso llega a varios destinatarios en un solo correo, y cada ejecución queda registrada.»

*(Con Telegram configurado, mostrar acá también el mensaje en el chat.)*

---

## 6. Panel del cliente (2 min)

1. En `http://localhost:3000/panel`, ingresar con `DEMO_PANEL_CORREO` y `DEMO_PANEL_CLAVE`.
2. **Tablero:** mostrar los cuatro reportes de Food Store (ventas, lo más vendido, ventas por día, stock) y cambiar el **Período**.
3. **Avisos** («Mis automatizaciones»):
   - Mostrar la tarjeta «Insumos por agotarse», recién creada, con el texto para el cliente.
   - En la tarjeta «Aviso de stock bajo» que dice «un producto llegue a **10** unidades o menos», apretar **Ajustar**.
   - Cambiar «Cantidad mínima» de 10 a `20` y **Guardar cambios**: «Guardamos tus cambios».
   - En el siguiente minuto, el correo de Mailpit pasa de 2 a 3 productos (se suma Coca Cola 500ml).
   - Ajustar a `5`: queda un solo producto, menos que el mínimo de 2. En la consola, en **Ver ejecuciones**, aparece «No enviada: menos filas que el mínimo».
4. **Salir** e ingresar con la variante `+cafe` del correo. Mostrar el tablero de «Café del Puerto»: otros números y tres reportes.

**Decir:**
- «El dueño del negocio no ve SQL: ve sus avisos en su idioma y puede ajustar lo que le importa, como la cantidad mínima o la hora.»
- «Cada negocio ve solo lo suyo: este es otro tenant, con su propia base y sus propios números.»

---

## 7. Falla provocada y recuperación (1 min; solo con el perfil `agente`)

1. En una terminal: `docker compose stop agente`.
2. Esperar al minuto siguiente:
   - En la consola, **Ver ejecuciones**: estado `fallo`, con el error «… (SQLSTATE ESINAGENTE)».
   - En el panel, la tarjeta pasa a «Con falla», con «No pudimos completar esta automatización esta vez».
3. `docker compose start agente`. La ejecución siguiente vuelve a `ok` y el panel vuelve a «Activa».

**Decir:** «Si el agente del cliente se cae, la falla queda registrada con su causa para el implementador, y el cliente ve un mensaje claro sin detalles técnicos. Cuando el agente vuelve, todo sigue solo.»

---

## 8. Cierre (20 s)

**Pantalla:** la consola en **Automatizaciones**. Desactivar la automatización «Insumos por agotarse» (**Desactivar**, confirmar) para dejar de recibir correos.

**Decir:** «Una conexión de solo lectura, un contrato común y plantillas escritas desde la consola: con eso, cualquier comercio chico tiene avisos y reportes sin cambiar su sistema.»

---

## Si algo sale mal

| Síntoma | Qué hacer |
|---|---|
| La app no arranca y pide `down -v` | El volumen de la réplica es viejo: usar el arranque desde cero de arriba. |
| La tarjeta de la plantilla aparece deshabilitada en el alta | La entidad `insumo` no está validada en esa conexión: revisar **Mapeo y validación**. |
| No llega el correo | Revisar `SMTP_HOST=mailpit` y `SMTP_PORT=1025`, y que la automatización esté «Activa». |
| «Guardar plantilla» no se habilita | Leer la línea del pie: falta probar, cambió algo desde la prueba o falta el nombre. |
| El paso 7 no falla | La conexión de Food Store se creó directa: necesita `DEMO_AGENTE_TOKEN` y el arranque desde cero. |
