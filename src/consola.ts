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
  .estado { margin: 1rem 0 .25rem; font-size: .85rem; opacity: .8; }
  .tabla-contenedor { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { border: 1px solid rgba(128,128,128,.4); padding: .3rem .5rem; text-align: left; vertical-align: top; white-space: pre-wrap; }
  th { position: sticky; top: 0; background: rgba(128,128,128,.15); }
  td.nulo { opacity: .5; font-style: italic; }
  .paginacion { display: flex; gap: .75rem; margin-top: .75rem; }
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
var banner = document.getElementById('banner');
var estado = document.getElementById('estado');
var encabezado = document.querySelector('#resultados thead');
var cuerpoTabla = document.querySelector('#resultados tbody');

var pagina = { desplazamiento: 0, limite: 50, hayMas: false, siguiente: null };

function mostrarBanner(texto) {
  banner.textContent = texto;
  banner.hidden = false;
}

function ocultarBanner() {
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

formulario.addEventListener('submit', function (evento) {
  evento.preventDefault();
  ejecutar(0);
});

botonSiguiente.addEventListener('click', function () {
  ejecutar(pagina.siguiente === null ? pagina.desplazamiento : pagina.siguiente);
});

botonAnterior.addEventListener('click', function () {
  ejecutar(Math.max(0, pagina.desplazamiento - pagina.limite));
});
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
