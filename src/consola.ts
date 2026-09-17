import type { FastifyInstance } from 'fastify';

/**
 * The whole console: one self-contained HTML document held as a constant.
 *
 * No static-file plugin and no template engine is used on purpose. `@fastify/static`
 * would add a runtime dependency *and* a build step (`tsc` does not copy non-TS
 * files) for a single document, and a frontend framework would add a toolchain and a
 * third-party script origin for a textarea and a table.
 *
 * **Every value coming from the API is assigned through `textContent`, never
 * `innerHTML`.** The rows are arbitrary third-party data read from a tenant's
 * replica, and this is the project's first browser surface: `innerHTML` would make a
 * stored `<script>` in the tenant's data execute in the operator's session. That is a
 * mechanism, not a convention — it is the one reviewable boundary that makes this
 * page safe to point at untrusted data.
 *
 * The saved-queries list is the second data source under that same rule. Its `nombre`
 * and `descripcion` are operator-authored rather than third-party, but they are
 * *persisted and replayed later*, which is a stored-input surface whichever hand typed
 * them — so they are rendered through `textContent` too, and a loaded statement
 * reaches the editor as `textarea.value`, never as markup.
 *
 * The inline script uses string concatenation rather than JS template literals so the
 * document can live inside this TypeScript template literal without escaping.
 */
const DOCUMENTO_CONSOLA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroDashboard — Consola de consultas</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 62rem; padding: 1.5rem; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .25rem; }
  .ayuda { margin: 0 0 1.25rem; opacity: .75; font-size: .9rem; }
  label { display: block; font-size: .85rem; font-weight: 600; margin: .75rem 0 .25rem; }
  input, textarea { width: 100%; box-sizing: border-box; font: inherit; padding: .4rem .5rem; }
  textarea { font-family: ui-monospace, monospace; resize: vertical; }
  .controles { display: flex; align-items: flex-end; gap: .75rem; margin-top: .75rem; }
  .controles label { margin: 0 0 .25rem; }
  .controles > div { width: 10rem; }
  button { font: inherit; padding: .45rem 1rem; cursor: pointer; }
  button[disabled] { cursor: not-allowed; opacity: .5; }
  .banner { margin: 1rem 0 0; padding: .7rem .9rem; border-left: .3rem solid #b3261e; background: rgba(179,38,30,.12); white-space: pre-wrap; }
  .banner.exito { border-left-color: #1a7f37; background: rgba(26,127,55,.12); }
  .estado { margin: 1rem 0 .25rem; font-size: .85rem; opacity: .8; }
  .tabla-contenedor { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { border: 1px solid rgba(128,128,128,.4); padding: .3rem .5rem; text-align: left; vertical-align: top; white-space: pre-wrap; }
  th { position: sticky; top: 0; background: rgba(128,128,128,.15); }
  td.nulo { opacity: .5; font-style: italic; }
  .paginacion { display: flex; gap: .75rem; margin-top: .75rem; }
  #guardadas { list-style: none; padding: 0; margin: .75rem 0 0; }
  #guardadas li { display: flex; align-items: baseline; gap: .6rem; padding: .4rem 0; border-bottom: 1px solid rgba(128,128,128,.25); }
  #guardadas li .ayuda { margin: 0; }
</style>
</head>
<body>
<h1>Consola de consultas</h1>
<p class="ayuda">Solo lectura. La sentencia se ejecuta dentro de una transacción de solo lectura y se rechaza si el rol conectado puede escribir.</p>

<form id="formulario">
  <label for="conexion">Identificador de la conexión registrada</label>
  <input id="conexion" type="text" autocomplete="off" spellcheck="false" placeholder="por ejemplo: 0f1c…" required>

  <label for="sql">Sentencia SQL</label>
  <textarea id="sql" rows="8" spellcheck="false" required>SELECT 1</textarea>

  <div class="controles">
    <div>
      <label for="limite">Filas por página</label>
      <input id="limite" type="number" min="1" max="200" value="50">
    </div>
    <button id="ejecutar" type="submit">Ejecutar</button>
  </div>
</form>

<!--
  Saved queries live OUTSIDE #formulario on purpose. #conexion and #sql are required,
  so a name field inside the same form would let browser validation block *execution*
  until a name was typed. #guardar is type="button" for the mirror-image reason: the
  default type="submit" would run the form's submit handler and execute the query
  instead of saving it.
-->
<section id="guardado">
  <h2>Consultas guardadas</h2>
  <p class="ayuda">Guarda la sentencia que está ahora en el editor. No se puede editar ni borrar una consulta guardada: para corregirla, se guarda otra.</p>

  <label for="nombre">Nombre</label>
  <input id="nombre" type="text" autocomplete="off" placeholder="por ejemplo: Stock producible">

  <label for="descripcion">Descripción (opcional)</label>
  <input id="descripcion" type="text" autocomplete="off">

  <div class="controles">
    <button id="guardar" type="button">Guardar consulta</button>
  </div>

  <ul id="guardadas"></ul>
</section>

<p id="banner" class="banner" role="alert" hidden></p>
<p id="estado" class="estado" hidden></p>

<div class="tabla-contenedor">
  <table id="resultados"><thead></thead><tbody></tbody></table>
</div>

<div class="paginacion">
  <button id="anterior" type="button" disabled>Página anterior</button>
  <button id="siguiente" type="button" disabled>Página siguiente</button>
</div>

<script>
'use strict';

// One legible message per closed {fase, categoria} pair the API can return. The
// console renders only these fields, so no raw driver error can reach the page.
var MENSAJES = {
  'conexion:tiempo-agotado': 'No se pudo conectar con el destino dentro del tiempo permitido.',
  'conexion:host-inalcanzable': 'El destino rechazó la conexión o no es alcanzable desde la aplicación.',
  'conexion:dns-no-resuelve': 'El nombre del host guardado no se pudo resolver.',
  'conexion:credenciales-invalidas': 'El destino rechazó las credenciales guardadas para esta conexión.',
  'conexion:base-inexistente': 'La base de datos indicada en la conexión no existe en el destino.',
  'conexion:error-desconocido': 'La conexión con el destino falló por un motivo no reconocido.',
  'permisos:rol-superusuario': 'El rol conectado es superusuario: evita toda verificación de permisos, así que la ejecución se rechaza sin enviar la sentencia.',
  'permisos:rol-con-escritura-en-tabla': 'El rol conectado tiene permiso de escritura (INSERT, UPDATE, DELETE o TRUNCATE) sobre al menos una tabla. Use un rol de solo lectura.',
  'permisos:rol-con-create-en-esquema': 'El rol conectado tiene permiso CREATE a nivel de esquema. Use un rol de solo lectura.',
  'ejecucion:tiempo-agotado': 'La consulta superó el tiempo máximo de ejecución y fue cancelada.',
  'ejecucion:no-es-lectura': 'La sentencia intenta escribir o modificar la estructura de la base, y la transacción es de solo lectura. Nada se ejecutó.',
  'ejecucion:permiso-denegado': 'El rol conectado no tiene permiso sobre alguno de los objetos que la consulta necesita.',
  'ejecucion:error-sintaxis': 'La sentencia es inválida, o contiene más de una sentencia en un mismo envío. Solo se admite una por ejecución.',
  'ejecucion:error-datos': 'La consulta es válida pero falló al procesar los datos (por ejemplo, una división por cero).',
  'ejecucion:error-desconocido': 'La ejecución falló por un motivo no reconocido.'
};
var MENSAJE_GENERICO = 'La ejecución falló y la consola no pudo identificar el motivo.';

var formulario = document.getElementById('formulario');
var entradaConexion = document.getElementById('conexion');
var entradaSql = document.getElementById('sql');
var entradaLimite = document.getElementById('limite');
var botonEjecutar = document.getElementById('ejecutar');
var botonAnterior = document.getElementById('anterior');
var botonSiguiente = document.getElementById('siguiente');
var entradaNombre = document.getElementById('nombre');
var entradaDescripcion = document.getElementById('descripcion');
var botonGuardar = document.getElementById('guardar');
var listaGuardadas = document.getElementById('guardadas');
var banner = document.getElementById('banner');
var estado = document.getElementById('estado');
var encabezado = document.querySelector('#resultados thead');
var cuerpoTabla = document.querySelector('#resultados tbody');

var pagina = { desplazamiento: 0, limite: 50, hayMas: false, siguiente: null };

// One alert region for the whole page, deliberately not one per section: a save
// failure and an execution failure overwrite each other, which is simpler than two
// competing alert regions and keeps a single place where the operator looks.
function mostrarBanner(texto) {
  banner.className = 'banner';
  banner.textContent = texto;
  banner.hidden = false;
}

// Same region, success wording. The save flow has to say out loud that the statement
// was stored; reusing the failure styling for that would be a lie in red.
function mostrarConfirmacion(texto) {
  banner.className = 'banner exito';
  banner.textContent = texto;
  banner.hidden = false;
}

function ocultarBanner() {
  banner.className = 'banner';
  banner.textContent = '';
  banner.hidden = true;
}

function vaciar(nodo) {
  while (nodo.firstChild) { nodo.removeChild(nodo.firstChild); }
}

function limpiarResultados() {
  vaciar(encabezado);
  vaciar(cuerpoTabla);
  estado.hidden = true;
  botonAnterior.disabled = true;
  botonSiguiente.disabled = true;
}

function textoDeCelda(valor) {
  if (valor === null || valor === undefined) { return 'NULL'; }
  if (typeof valor === 'object') { return JSON.stringify(valor); }
  return String(valor);
}

function renderizar(cuerpo) {
  vaciar(encabezado);
  vaciar(cuerpoTabla);

  var filaEncabezado = document.createElement('tr');
  cuerpo.columnas.forEach(function (nombre) {
    var celda = document.createElement('th');
    celda.textContent = String(nombre);
    filaEncabezado.appendChild(celda);
  });
  encabezado.appendChild(filaEncabezado);

  cuerpo.filas.forEach(function (fila) {
    var tr = document.createElement('tr');
    fila.forEach(function (valor) {
      var celda = document.createElement('td');
      if (valor === null || valor === undefined) { celda.className = 'nulo'; }
      celda.textContent = textoDeCelda(valor);
      tr.appendChild(celda);
    });
    cuerpoTabla.appendChild(tr);
  });
}

function describirPagina(cuerpo) {
  var desde = cuerpo.paginacion.desplazamiento;
  var cantidad = cuerpo.filas.length;
  var texto = cantidad === 0
    ? 'Sin filas en esta página.'
    : 'Filas ' + (desde + 1) + ' a ' + (desde + cantidad) + '.';
  if (cuerpo.paginacion.hayMas) { texto += ' Hay más resultados.'; }
  estado.textContent = texto + ' ' + cuerpo.duracionMs + ' ms.';
  estado.hidden = false;
}

function mensajeDeFallo(cuerpo) {
  var clave = String(cuerpo.fase) + ':' + String(cuerpo.categoria);
  var base = Object.prototype.hasOwnProperty.call(MENSAJES, clave) ? MENSAJES[clave] : MENSAJE_GENERICO;
  return cuerpo.codigo ? base + ' (SQLSTATE ' + cuerpo.codigo + ')' : base;
}

async function ejecutar(desplazamiento) {
  ocultarBanner();
  botonEjecutar.disabled = true;

  var limite = parseInt(entradaLimite.value, 10);
  if (!(limite >= 1 && limite <= 200)) { limite = 50; }

  var respuesta;
  try {
    respuesta = await fetch('/consultas/ejecutar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conexionId: entradaConexion.value.trim(),
        sql: entradaSql.value,
        limite: limite,
        desplazamiento: desplazamiento
      })
    });
  } catch (fallaDeRed) {
    // A rejected fetch must not be silent either: the page says so instead.
    botonEjecutar.disabled = false;
    mostrarBanner('No se pudo contactar con la aplicación. Verifique que siga en línea e intente de nuevo.');
    return;
  }
  botonEjecutar.disabled = false;

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (cuerpo === null) {
    limpiarResultados();
    mostrarBanner('La aplicación respondió algo que la consola no pudo interpretar (HTTP ' + respuesta.status + ').');
    return;
  }
  if (respuesta.status === 404) {
    limpiarResultados();
    mostrarBanner('No existe una conexión registrada con ese identificador.');
    return;
  }
  if (respuesta.status === 400) {
    var campos = Array.isArray(cuerpo.campos) ? cuerpo.campos.join(', ') : '';
    limpiarResultados();
    mostrarBanner('La solicitud es inválida. Revise estos campos: ' + (campos === '' ? 'el cuerpo enviado' : campos) + '.');
    return;
  }
  if (respuesta.status !== 200) {
    limpiarResultados();
    mostrarBanner('La aplicación respondió HTTP ' + respuesta.status + '.');
    return;
  }
  if (cuerpo.resultado !== 'ok') {
    limpiarResultados();
    mostrarBanner(mensajeDeFallo(cuerpo));
    return;
  }

  renderizar(cuerpo);
  pagina = {
    desplazamiento: cuerpo.paginacion.desplazamiento,
    limite: cuerpo.paginacion.limite,
    hayMas: cuerpo.paginacion.hayMas,
    siguiente: cuerpo.paginacion.siguienteDesplazamiento
  };
  describirPagina(cuerpo);
  botonAnterior.disabled = pagina.desplazamiento <= 0;
  botonSiguiente.disabled = !pagina.hayMas;
}

// --- Saved queries -------------------------------------------------------------
// Every field below reaches the page through textContent, and the loaded statement
// reaches the editor through textarea.value. Both are stored text written earlier and
// replayed now, which makes them a stored-input surface regardless of who typed them:
// a saved nombre that spells out a script tag has to render as visible text.
//
// Note for whoever edits this block: no closing script tag may appear anywhere in this
// inline script, not even inside a comment. The HTML parser ends the script element at
// the first such sequence it sees and hands the rest of the file to the page as markup.

function renderizarGuardadas(cuerpo) {
  vaciar(listaGuardadas);

  var filas = Array.isArray(cuerpo.consultasGuardadas) ? cuerpo.consultasGuardadas : [];

  if (filas.length === 0) {
    var vacia = document.createElement('li');
    vacia.className = 'ayuda';
    vacia.textContent = 'Todavía no hay consultas guardadas.';
    listaGuardadas.appendChild(vacia);
    return;
  }

  filas.forEach(function (fila) {
    var item = document.createElement('li');

    var nombre = document.createElement('span');
    nombre.textContent = String(fila.nombre);
    item.appendChild(nombre);

    // The list shows creadaEn because duplicate names are allowed by design: two rows
    // called "Stock producible" are otherwise indistinguishable in a list.
    var fecha = document.createElement('span');
    fecha.className = 'ayuda';
    fecha.textContent = String(fila.creadaEn);
    item.appendChild(fecha);

    if (fila.descripcion !== null && fila.descripcion !== undefined) {
      var descripcion = document.createElement('span');
      descripcion.className = 'ayuda';
      descripcion.textContent = String(fila.descripcion);
      item.appendChild(descripcion);
    }

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Cargar';
    // The closure captures fila.id, never fila.nombre: the id is the only thing that
    // identifies a row when names can repeat.
    boton.addEventListener('click', function () { cargarGuardada(fila.id); });
    item.appendChild(boton);

    listaGuardadas.appendChild(item);
  });

  // The list is hard-capped server-side and there is no pagination parameter to see
  // past it, so the cut is announced instead of leaving the operator to guess.
  if (cuerpo.truncado) {
    var aviso = document.createElement('li');
    aviso.className = 'ayuda';
    aviso.textContent = 'Se muestran solo las ' + filas.length +
      ' consultas más recientes. Hay más guardadas que esta lista no alcanza a mostrar.';
    listaGuardadas.appendChild(aviso);
  }
}

async function listarGuardadas() {
  var respuesta;
  try {
    respuesta = await fetch('/consultas-guardadas');
  } catch (fallaDeRed) {
    // A failed listing must never break the execute path: it reports and returns.
    mostrarBanner('No se pudo contactar con la aplicación para leer las consultas guardadas.');
    return;
  }

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (cuerpo === null || respuesta.status !== 200) {
    mostrarBanner('No se pudieron leer las consultas guardadas (HTTP ' + respuesta.status + ').');
    return;
  }

  renderizarGuardadas(cuerpo);
}

async function guardar() {
  ocultarBanner();
  botonGuardar.disabled = true;

  var nombre = entradaNombre.value.trim();

  var respuesta;
  try {
    respuesta = await fetch('/consultas-guardadas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre,
        descripcion: entradaDescripcion.value,
        // Sent verbatim: the API stores the operator's statement as written.
        sql: entradaSql.value
      })
    });
  } catch (fallaDeRed) {
    botonGuardar.disabled = false;
    mostrarBanner('No se pudo contactar con la aplicación. Verifique que siga en línea e intente de nuevo.');
    return;
  }
  botonGuardar.disabled = false;

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (cuerpo === null) {
    mostrarBanner('La aplicación respondió algo que la consola no pudo interpretar (HTTP ' + respuesta.status + ').');
    return;
  }
  if (respuesta.status === 400) {
    var campos = Array.isArray(cuerpo.campos) ? cuerpo.campos.join(', ') : '';
    mostrarBanner('La solicitud es inválida. Revise estos campos: ' + (campos === '' ? 'el cuerpo enviado' : campos) + '.');
    return;
  }
  if (respuesta.status === 503) {
    mostrarBanner('La base de la aplicación no tiene todavía un tenant inicializado, así que no se puede guardar una consulta.');
    return;
  }
  if (respuesta.status !== 201) {
    mostrarBanner('La aplicación respondió HTTP ' + respuesta.status + '.');
    return;
  }

  entradaNombre.value = '';
  entradaDescripcion.value = '';
  mostrarConfirmacion('Se guardó la consulta y ya aparece en la lista.');
  await listarGuardadas();
}

async function cargarGuardada(id) {
  ocultarBanner();

  var respuesta;
  try {
    respuesta = await fetch('/consultas-guardadas/' + encodeURIComponent(id));
  } catch (fallaDeRed) {
    mostrarBanner('No se pudo contactar con la aplicación. Verifique que siga en línea e intente de nuevo.');
    return;
  }

  var cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (noEsJson) { cuerpo = null; }

  if (cuerpo === null) {
    mostrarBanner('La aplicación respondió algo que la consola no pudo interpretar (HTTP ' + respuesta.status + ').');
    return;
  }
  if (respuesta.status === 404) {
    // The row is gone from under the list; refresh so the stale entry disappears.
    mostrarBanner('Esa consulta guardada ya no existe. Se actualizó la lista.');
    await listarGuardadas();
    return;
  }
  if (respuesta.status !== 200) {
    mostrarBanner('La aplicación respondió HTTP ' + respuesta.status + '.');
    return;
  }

  // A plain value assignment on the textarea: the statement is data, not markup.
  entradaSql.value = cuerpo.consultaGuardada.sql;
  entradaSql.focus();
  // #conexion is deliberately left as it is: nothing binds a saved query to a
  // connection, so the operator chooses which target to run it against.
}

formulario.addEventListener('submit', function (evento) {
  evento.preventDefault();
  ejecutar(0);
});

botonGuardar.addEventListener('click', function () {
  guardar();
});

botonSiguiente.addEventListener('click', function () {
  ejecutar(pagina.siguiente === null ? pagina.desplazamiento : pagina.siguiente);
});

botonAnterior.addEventListener('click', function () {
  ejecutar(Math.max(0, pagina.desplazamiento - pagina.limite));
});

listarGuardadas();
</script>
</body>
</html>
`;

/**
 * `GET /consola`. Takes no `PrismaClient`: the page touches no database of ours — it
 * only talks to `POST /consultas/ejecutar` from the browser. `/` is left unclaimed.
 */
export function registerConsolaRoute(app: FastifyInstance): void {
  app.get('/consola', async (_request, reply) => {
    return reply.code(200).type('text/html; charset=utf-8').send(DOCUMENTO_CONSOLA);
  });
}
