/**
 * P-08 «Tablero» of the client panel (CH-48b, R3h, R4h, R5h, DEC-183, DEC-201).
 *
 * Strings only: the page-local styles, the static markup of the nav and the dashboard
 * section, and the dashboard script. `src/panel/panel.ts` places them in the shell. The
 * script runs before the automations script, which stays the last one on the page.
 *
 * What the script holds is memory only (DEC-93): the cards, the chosen period of each card
 * and the run queue. Nothing is written to storage, and a reload starts from the server's
 * defaults. Every value from the server enters the page through `textContent`. The tenant
 * is never named: the routes take it from the session cookie (rule 2).
 *
 * Bar and line reports draw with the vendored Chart.js (CH-48c, DEC-184, DEC-200), loaded by
 * the shell before this script, with the token colors read through `getComputedStyle`. The
 * table of the same rows stays in the card, folded; without `Chart` it shows open instead.
 */

/** Panel-local rules, tokens only, with the `panel-` prefix (the shared sheets stay verbatim). */
export const ESTILOS_TABLERO = `
  /* P-08 Tablero (CH-48): the nav as a second row under the header, then one column of report cards. */
  .panel-nav { position: sticky; top: 60px; z-index: 19; background: var(--surface-card);
    padding: 0 max(var(--space-6), calc((100% - var(--panel-max)) / 2 + var(--space-6))); }
  .zd-root .panel-nav a.zd-tab { height: 44px; font-size: var(--text-md); color: var(--text-2); text-decoration: none; }
  .zd-root .panel-nav a.zd-tab:hover { color: var(--text-1); }
  .zd-root .panel-nav a.zd-tab[aria-current="page"] { color: var(--accent-text); border-bottom-color: var(--accent); }
  .panel-avisos, .panel-tablero { display: grid; gap: var(--gap-section); }
  .panel-tablero__cabeza { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--space-5); }
  .panel-reporte__cabeza { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-5); }
  .panel-tablero__cabeza > div, .panel-reporte__textos { min-width: 0; flex: 1 1 16rem; }
  .panel-main .panel-frescura { margin-top: var(--space-2); }
  .panel-reporte { display: grid; gap: var(--space-5); min-width: 0; }
  .panel-reporte__textos .zd-h2 { overflow-wrap: anywhere; }
  .panel-periodo { flex: 0 1 14rem; }
  .panel-numero { display: grid; gap: var(--space-2); }
  .panel-numero__etiqueta { margin: 0; color: var(--text-2); font-size: var(--text-sm); }
  .panel-numero__valor { margin: 0; font-size: var(--text-3xl); font-weight: var(--weight-semibold);
    line-height: var(--leading-tight); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .panel-reporte .zd-table { font-size: var(--text-base); }
  .panel-reporte .zd-table .is-num { font-size: inherit; }
  .panel-reporte .zd-table th.is-num { font-family: inherit; font-size: var(--text-xs); }
  .panel-reporte .zd-state { padding: var(--space-6) var(--space-4); }
  .panel-grafico { position: relative; height: 220px; min-width: 0; }
  .panel-datos > summary { cursor: pointer; padding: var(--space-3) 0; font-weight: var(--weight-semibold); color: var(--text-2); }
  .panel-datos[open] > summary { margin-bottom: var(--space-4); }
  .panel-notas { display: grid; gap: var(--space-2); }
  .panel-nota { margin: 0; font-size: var(--text-sm); color: var(--text-2); }
`;

/** «Tablero» and «Avisos» as hash links; the script shows the nav only when there are reports. */
export const MARCADO_NAV = `<!-- P-08 Tablero (CH-48): the nav between the two views, shown only with reports. -->
<nav id="nav-panel" class="zd-tabs panel-nav" aria-label="Secciones" hidden>
  <a id="nav-tablero" class="zd-tab" href="#tablero">Tablero</a>
  <a id="nav-avisos" class="zd-tab" href="#avisos">Avisos</a>
</nav>
`;

/** The dashboard section: heading, freshness line, «Actualizar», a notice and the card list. */
export const MARCADO_TABLERO = `  <!-- P-08 Tablero (CH-48): cards are built by the script; values enter through textContent. -->
  <section id="seccion-tablero" class="panel-tablero" data-screen-label="Tablero" data-change="CH-48" data-estado="existe" aria-labelledby="titulo-tablero" hidden>
    <div class="panel-tablero__cabeza">
      <div>
        <h1 id="titulo-tablero" class="zd-h1">Tablero</h1>
        <p class="zd-muted">Tus reportes, con los datos de tu negocio.</p>
        <p id="tablero-frescura" class="zd-meta panel-frescura"></p>
      </div>
      <button id="boton-actualizar" class="zd-btn zd-btn--secondary" type="button">
        <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>
        Actualizar
      </button>
    </div>
    <div id="tablero-aviso" class="zd-banner zd-banner--error" role="alert" hidden>
      <svg class="zd-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
      <div>
        <p class="zd-banner__title">No pudimos actualizar el tablero.</p>
        <p class="zd-banner__body">Volvé a intentar en unos minutos.</p>
      </div>
    </div>
    <div id="lista-tablero" class="panel-lista"></div>
  </section>
`;

/**
 * The dashboard script, ES5 like the rest of the page and wrapped in its own function so
 * its names never meet the automations script. No template literal and no `${` inside.
 */
export const SCRIPT_TABLERO = `(function () {
var NS_SVG = 'http://www.w3.org/2000/svg';
var EN_CURSO_MAXIMO = 3;
var SIN_FECHA = 'Todavía no tenemos la fecha de actualización de tus datos.';
var REINTENTAR = 'Volvé a intentar en unos minutos.';
var ESTADOS = {
  'sin-datos': { titulo: 'No hay datos para este período.', cuerpo: '', reintentar: false, vacio: true },
  'no-disponible': { titulo: 'No podemos mostrar este reporte por ahora.', cuerpo: 'Si sigue así, avisale a quien te dio acceso.', reintentar: false, vacio: false },
  'tiempo-agotado': { titulo: 'Tu tienda tardó demasiado en responder.', cuerpo: REINTENTAR, reintentar: true, vacio: false },
  'sin-conexion': { titulo: 'No pudimos llegar a los datos de tu negocio.', cuerpo: REINTENTAR, reintentar: true, vacio: false },
  'error': { titulo: 'No pudimos cargar este reporte.', cuerpo: REINTENTAR, reintentar: true, vacio: false }
};
var ICONO_ALERTA = [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M12 8v4' }], ['path', { d: 'M12 16h.01' }]];
var ICONO_VACIO = [['polyline', { points: '22 12 16 12 14 15 10 15 8 12 2 12' }], ['path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }]];
var NUMEROS = new Intl.NumberFormat('es-AR');
var nav = document.getElementById('nav-panel');
var enlaceTablero = document.getElementById('nav-tablero');
var enlaceAvisos = document.getElementById('nav-avisos');
var seccionTablero = document.getElementById('seccion-tablero');
var seccionAvisos = document.getElementById('seccion-avisos');
var lista = document.getElementById('lista-tablero');
var lineaFrescura = document.getElementById('tablero-frescura');
var botonActualizar = document.getElementById('boton-actualizar');
var avisoTablero = document.getElementById('tablero-aviso');
var tarjetas = [];
var cola = [];
var enCurso = 0;
var leyendo = false;
var conTablero = false;
var zona = 'UTC';
var contador = 0;
function nodo(etiqueta, clase, texto) {
  var n = document.createElement(etiqueta);
  if (clase) { n.className = clase; }
  if (texto !== undefined) { n.textContent = texto; }
  return n;
}
function icono(formas) {
  var svg = document.createElementNS(NS_SVG, 'svg');
  svg.setAttribute('class', 'zd-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  for (var i = 0; i < formas.length; i++) {
    var forma = document.createElementNS(NS_SVG, formas[i][0]);
    for (var clave in formas[i][1]) {
      if (Object.prototype.hasOwnProperty.call(formas[i][1], clave)) { forma.setAttribute(clave, formas[i][1][clave]); }
    }
    svg.appendChild(forma);
  }
  return svg;
}
// ---- Sections: «Tablero» and «Avisos» ------------------------------------------------------
function marcar(enlace, actual) {
  if (actual) { enlace.setAttribute('aria-current', 'page'); } else { enlace.removeAttribute('aria-current'); }
}
function aplicarSeccion() {
  if (!conTablero) {
    nav.hidden = true;
    seccionTablero.hidden = true;
    seccionAvisos.hidden = false;
    return;
  }
  var avisos = window.location.hash === '#avisos';
  nav.hidden = false;
  seccionTablero.hidden = avisos;
  seccionAvisos.hidden = !avisos;
  marcar(enlaceTablero, !avisos);
  marcar(enlaceAvisos, avisos);
}
// ---- Dates and numbers ---------------------------------------------------------------------
function relleno(valor) {
  return ('0' + valor).slice(-2);
}
function fechaHora(iso) {
  var opciones = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  var formato;
  try {
    opciones.timeZone = zona;
    formato = new Intl.DateTimeFormat('es-AR', opciones);
  } catch (e) {
    delete opciones.timeZone;
    formato = new Intl.DateTimeFormat('es-AR', opciones);
  }
  var partes = {};
  formato.formatToParts(new Date(iso)).forEach(function (parte) { partes[parte.type] = parte.value; });
  return relleno(partes.day) + '/' + relleno(partes.month) + ', ' + relleno(partes.hour) + ':' + relleno(partes.minute);
}
var DIA = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
var INSTANTE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/;
// A whole or decimal number as text, as the driver returns a COUNT or a SUM ("26", "1520.50").
// A leading zero ("007") or an exponent keeps the value as text: codes are never numbers.
var NUMERO_TEXTO = /^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$/;
function diaMes(texto) {
  var partes = DIA.exec(texto);
  return partes ? partes[3] + '/' + partes[2] : texto;
}
function anioActual() {
  var ahora = new Date(Date.now());
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zona, year: 'numeric' }).format(ahora);
  } catch (e) {
    return String(ahora.getFullYear());
  }
}
// «Desde el dd/mm», with the year when it is not the current one in the business's time zone.
function fechaDesde(texto) {
  var partes = DIA.exec(texto);
  if (!partes) { return texto; }
  return partes[3] + '/' + partes[2] + (partes[1] === anioActual() ? '' : '/' + partes[1]);
}
function comoNumero(valor) {
  if (typeof valor === 'number') { return isFinite(valor) ? valor : null; }
  if (typeof valor === 'string' && NUMERO_TEXTO.test(valor)) {
    var numero = Number(valor);
    return isFinite(numero) ? numero : null;
  }
  return null;
}
function vacio(valor) {
  return valor === null || valor === undefined || valor === '';
}
function textoDeValor(valor) {
  if (vacio(valor)) { return '\\u2014'; }
  if (typeof valor === 'number') { return NUMEROS.format(valor); }
  if (typeof valor === 'boolean') { return valor ? 'Sí' : 'No'; }
  var texto = String(valor);
  if (DIA.test(texto)) { return diaMes(texto); }
  if (INSTANTE.test(texto) && !isNaN(Date.parse(texto))) { return fechaHora(texto); }
  return texto;
}
function textoDeDias(dias) {
  return dias === 1 ? 'Último día' : 'Últimos ' + dias + ' días';
}
function pintarFrescura(iso) {
  var instante = typeof iso === 'string' ? Date.parse(iso) : NaN;
  if (isNaN(instante)) {
    lineaFrescura.textContent = SIN_FECHA;
    return;
  }
  var minutos = Math.max(0, Math.floor((Date.now() - instante) / 60000));
  var hace;
  if (minutos < 1) { hace = 'menos de 1 min'; }
  else if (minutos < 60) { hace = minutos + ' min'; }
  else if (minutos < 48 * 60) { hace = Math.floor(minutos / 60) + ' h'; }
  else { hace = Math.floor(minutos / (24 * 60)) + ' días'; }
  lineaFrescura.textContent = 'Datos de tu negocio actualizados hace ' + hace + ' \\u00b7 ' + fechaHora(iso);
}
// ---- Card bodies ---------------------------------------------------------------------------
function soltarGrafico(tarjeta) {
  if (tarjeta.grafico) {
    var grafico = tarjeta.grafico;
    tarjeta.grafico = null;
    grafico.destroy();
  }
}
function vaciar(tarjeta) {
  soltarGrafico(tarjeta);
  tarjeta.cuerpo.textContent = '';
  tarjeta.cuerpo.removeAttribute('aria-busy');
}
function pintarCarga(tarjeta) {
  vaciar(tarjeta);
  tarjeta.cuerpo.setAttribute('aria-busy', 'true');
  var esqueleto = nodo('div', 'panel-esqueleto');
  esqueleto.setAttribute('aria-label', 'Cargando ' + tarjeta.reporte.titulo);
  esqueleto.appendChild(nodo('span', 'zd-skeleton panel-esqueleto__linea'));
  esqueleto.appendChild(nodo('span', 'zd-skeleton panel-esqueleto__corta'));
  tarjeta.cuerpo.appendChild(esqueleto);
}
function pintarEstado(tarjeta, estado) {
  var texto = ESTADOS[estado] || ESTADOS.error;
  vaciar(tarjeta);
  var caja = nodo('div', texto.reintentar ? 'zd-state zd-state--error' : 'zd-state');
  caja.setAttribute('role', texto.reintentar ? 'alert' : 'status');
  var marco = nodo('span', 'zd-state__icon');
  marco.appendChild(icono(texto.vacio ? ICONO_VACIO : ICONO_ALERTA));
  caja.appendChild(marco);
  caja.appendChild(nodo('p', 'zd-state__title', texto.titulo));
  if (texto.cuerpo) { caja.appendChild(nodo('p', 'zd-state__body', texto.cuerpo)); }
  if (texto.reintentar) {
    var acciones = nodo('div', 'zd-state__actions');
    var boton = nodo('button', 'zd-btn zd-btn--secondary', 'Reintentar');
    boton.type = 'button';
    boton.addEventListener('click', function () { encolar(tarjeta); });
    acciones.appendChild(boton);
    caja.appendChild(acciones);
  }
  tarjeta.cuerpo.appendChild(caja);
}
// A column is numeric when it has a value and every value is a number or a number as text.
function columnaNumerica(filas, c) {
  var presentes = 0;
  var todas = filas.every(function (fila) {
    if (vacio(fila[c])) { return true; }
    presentes += 1;
    return comoNumero(fila[c]) !== null;
  });
  return todas && presentes > 0;
}
function tablaDe(titulo, columnas, filas) {
  var envoltura = nodo('div', 'zd-table-wrap');
  var desplazable = nodo('div', 'zd-table-scroll');
  var tabla = nodo('table', 'zd-table');
  tabla.appendChild(nodo('caption', 'zd-sr', titulo));
  var numericas = [];
  var cabeza = nodo('thead');
  var filaCabeza = nodo('tr');
  for (var c = 0; c < columnas.length; c++) {
    numericas.push(columnaNumerica(filas, c));
    var celdaCabeza = nodo('th', numericas[c] ? 'is-num zd-num' : '', String(columnas[c].titulo));
    celdaCabeza.setAttribute('scope', 'col');
    filaCabeza.appendChild(celdaCabeza);
  }
  cabeza.appendChild(filaCabeza);
  tabla.appendChild(cabeza);
  var cuerpo = nodo('tbody');
  for (var f = 0; f < filas.length; f++) {
    var fila = nodo('tr');
    for (var k = 0; k < columnas.length; k++) {
      var valor = filas[f][k];
      var texto = numericas[k] && !vacio(valor) ? NUMEROS.format(comoNumero(valor)) : textoDeValor(valor);
      fila.appendChild(nodo('td', numericas[k] ? 'is-num zd-num' : '', texto));
    }
    cuerpo.appendChild(fila);
  }
  tabla.appendChild(cuerpo);
  desplazable.appendChild(tabla);
  envoltura.appendChild(desplazable);
  return envoltura;
}
function numeroDe(columnas, filas) {
  var caja = nodo('div', 'panel-numero');
  caja.appendChild(nodo('p', 'panel-numero__etiqueta', String(columnas[0].titulo)));
  caja.appendChild(nodo('p', 'panel-numero__valor', NUMEROS.format(filas[0][0])));
  return caja;
}
// ---- Charts: Chart.js on a canvas, one series, colored from the design tokens --------------
function colores() {
  var estilo = window.getComputedStyle(document.body);
  return {
    serie: estilo.getPropertyValue('--accent').trim(),
    texto: estilo.getPropertyValue('--text-2').trim(),
    grilla: estilo.getPropertyValue('--border-1').trim(),
    fuente: estilo.getPropertyValue('--font-sans').trim()
  };
}
function indiceDe(columnas, rol, otro) {
  for (var i = 0; i < columnas.length; i++) {
    if (columnas[i].rol === rol) { return i; }
  }
  return otro;
}
// Writes the token colors on a chart's series and options: when it is drawn and on a theme change.
function tintar(serie, opciones, c) {
  serie.backgroundColor = c.serie;
  serie.borderColor = c.serie;
  serie.pointBackgroundColor = c.serie;
  var ejes = [opciones.scales.x, opciones.scales.y];
  for (var i = 0; i < ejes.length; i++) {
    ejes[i].ticks.color = c.texto;
    ejes[i].ticks.font = { family: c.fuente };
    ejes[i].grid.color = c.grilla;
    ejes[i].border.color = c.grilla;
  }
  opciones.scales.y.title.color = c.texto;
  opciones.scales.y.title.font = { family: c.fuente };
  opciones.plugins.tooltip.titleFont = { family: c.fuente };
  opciones.plugins.tooltip.bodyFont = { family: c.fuente };
}
function retintar() {
  var c = null;
  for (var i = 0; i < tarjetas.length; i++) {
    var grafico = tarjetas[i].grafico;
    if (grafico) {
      c = c || colores();
      tintar(grafico.data.datasets[0], grafico.options, c);
      grafico.update();
    }
  }
}
// On a narrow chart a long bar label is cut, so the bars keep their height; the tooltip and the
// table keep the whole text. Chart.js calls it with the scale as this.
var ANGOSTO = 600;
var LARGO_ETIQUETA = 12;
function etiquetaCorta(valor) {
  var texto = String(this.getLabelForValue(valor));
  return this.chart.width < ANGOSTO && texto.length > LARGO_ETIQUETA ? texto.slice(0, LARGO_ETIQUETA - 1) + '\\u2026' : texto;
}
// Draws the chart into the card body; answers false when it cannot, so the table shows open.
function graficoDe(tarjeta, columnas, filas) {
  var columnaEtiqueta = indiceDe(columnas, 'etiqueta', 0);
  var columnaValor = indiceDe(columnas, 'valor', 1);
  if (columnaValor >= columnas.length) { return false; }
  var valores = filas.map(function (fila) { return fila[columnaValor]; });
  if (!valores.every(function (v) { return typeof v === 'number' && isFinite(v); })) { return false; }
  var linea = tarjeta.reporte.visualizacion === 'linea';
  var caja = nodo('div', 'panel-grafico');
  var lienzo = nodo('canvas');
  lienzo.setAttribute('role', 'img');
  lienzo.setAttribute('aria-label', tarjeta.reporte.titulo + ': valores de ' + NUMEROS.format(Math.min.apply(null, valores)) +
    ' a ' + NUMEROS.format(Math.max.apply(null, valores)) + '.');
  caja.appendChild(lienzo);
  tarjeta.cuerpo.appendChild(caja);
  var serie = linea
    ? { label: String(columnas[columnaValor].titulo), data: valores, borderWidth: 2, pointRadius: 3, tension: 0, fill: false }
    : { label: String(columnas[columnaValor].titulo), data: valores, borderWidth: 0, borderRadius: 4, maxBarThickness: 48 };
  var opciones = {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    locale: 'es-AR',
    plugins: { legend: { display: false }, tooltip: {} },
    scales: {
      x: { ticks: {}, grid: { display: false }, border: {} },
      y: { beginAtZero: true, title: { display: true, text: String(columnas[columnaValor].titulo) }, ticks: {}, grid: {}, border: { display: false } }
    }
  };
  if (!linea) { opciones.scales.x.ticks.callback = etiquetaCorta; }
  tintar(serie, opciones, colores());
  try {
    tarjeta.grafico = new Chart(lienzo, {
      type: linea ? 'line' : 'bar',
      data: { labels: filas.map(function (fila) { return textoDeValor(fila[columnaEtiqueta]); }), datasets: [serie] },
      options: opciones
    });
  } catch (e) {
    tarjeta.grafico = null;
    caja.hidden = true;
    return false;
  }
  return true;
}
function pintarResultado(tarjeta, respuesta) {
  var estado = respuesta && typeof respuesta.estado === 'string' ? respuesta.estado : 'error';
  if (estado !== 'ok') {
    pintarEstado(tarjeta, ESTADOS[estado] ? estado : 'error');
    return;
  }
  var columnas = respuesta.columnas;
  var filas = respuesta.filas;
  var vista = tarjeta.reporte.visualizacion;
  var bien = Array.isArray(columnas) && columnas.length > 0 && Array.isArray(filas) && filas.length > 0 &&
    filas.every(function (fila) { return Array.isArray(fila); });
  if (!bien || (vista === 'numero' && typeof filas[0][0] !== 'number')) {
    pintarEstado(tarjeta, 'error');
    return;
  }
  vaciar(tarjeta);
  var titulo = tarjeta.reporte.titulo;
  if (vista === 'numero') {
    tarjeta.cuerpo.appendChild(numeroDe(columnas, filas));
  } else if (vista === 'barras' || vista === 'linea') {
    // The chart goes above the table, which folds; without Chart.js the table is the body, open.
    var dibujado = typeof Chart === 'function' && graficoDe(tarjeta, columnas, filas);
    var datos = nodo('details', 'panel-datos');
    datos.open = !dibujado;
    datos.appendChild(nodo('summary', '', 'Ver los datos en una tabla'));
    datos.appendChild(tablaDe(titulo, columnas, filas));
    tarjeta.cuerpo.appendChild(datos);
  } else {
    tarjeta.cuerpo.appendChild(tablaDe(titulo, columnas, filas));
  }
  var notas = nodo('div', 'panel-notas');
  if (respuesta.periodo && typeof respuesta.periodo.desde === 'string') {
    notas.appendChild(nodo('p', 'panel-nota', 'Desde el ' + fechaDesde(respuesta.periodo.desde)));
  }
  if (respuesta.corte === true && vista !== 'numero') {
    notas.appendChild(nodo('p', 'panel-nota', 'Mostramos solo los primeros ' + filas.length + ' resultados.'));
  }
  if (notas.children.length > 0) { tarjeta.cuerpo.appendChild(notas); }
}
// ---- Runs: at most three at a time, in dashboard order -------------------------------------
function pendiente() {
  if (leyendo) { return true; }
  for (var i = 0; i < tarjetas.length; i++) {
    if (tarjetas[i].pendiente) { return true; }
  }
  return false;
}
function revisarActualizar() {
  var ocupado = pendiente();
  botonActualizar.disabled = ocupado;
  if (ocupado) { seccionTablero.setAttribute('aria-busy', 'true'); } else { seccionTablero.removeAttribute('aria-busy'); }
}
function rutaDe(tarjeta) {
  return '/api/panel/tablero/' + encodeURIComponent(tarjeta.reporte.id) + '/resultado' +
    (tarjeta.dias === null ? '' : '?dias=' + tarjeta.dias);
}
function encolar(tarjeta) {
  tarjeta.generacion += 1;
  tarjeta.pendiente = true;
  pintarCarga(tarjeta);
  cola.push({ tarjeta: tarjeta, generacion: tarjeta.generacion });
  revisarActualizar();
  avanzar();
}
function avanzar() {
  while (enCurso < EN_CURSO_MAXIMO && cola.length > 0) {
    var entrada = cola.shift();
    // A card asked again, or a dashboard read again, makes the older entry useless.
    if (entrada.generacion === entrada.tarjeta.generacion && !entrada.tarjeta.descartada) { pedir(entrada); }
  }
}
function pedir(entrada) {
  enCurso += 1;
  fetch(rutaDe(entrada.tarjeta), { credentials: 'same-origin' }).then(function (respuesta) {
    if (respuesta.status === 401) {
      window.location.reload();
      return null;
    }
    if (respuesta.status !== 200) { return { estado: 'error' }; }
    return respuesta.json().catch(function () { return { estado: 'error' }; });
  }, function () {
    return { estado: 'error' };
  }).then(function (cuerpo) {
    enCurso -= 1;
    var tarjeta = entrada.tarjeta;
    try {
      if (cuerpo !== null && entrada.generacion === tarjeta.generacion && !tarjeta.descartada) {
        tarjeta.pendiente = false;
        pintarResultado(tarjeta, cuerpo);
      }
    } catch (e) {
      pintarEstado(tarjeta, 'error');
    }
    revisarActualizar();
    avanzar();
  });
}
// ---- Cards ---------------------------------------------------------------------------------
function conPeriodo(reporte) {
  return reporte.periodo !== null && typeof reporte.periodo === 'object' && Array.isArray(reporte.periodo.dias) &&
    reporte.periodo.dias.length > 0;
}
function selectorDePeriodo(tarjeta, prefijo) {
  var id = prefijo + '-periodo';
  var caja = nodo('div', 'zd-field panel-periodo');
  var rotulo = nodo('label', 'zd-label', 'Período');
  rotulo.setAttribute('for', id);
  var select = nodo('select', 'zd-select');
  select.id = id;
  var dias = tarjeta.reporte.periodo.dias;
  for (var i = 0; i < dias.length; i++) {
    var opcion = nodo('option', '', textoDeDias(dias[i]));
    opcion.value = String(dias[i]);
    select.appendChild(opcion);
  }
  select.value = String(tarjeta.dias);
  // The choice lives in this card only: nothing is stored, and a reload starts on the default.
  select.addEventListener('change', function () {
    tarjeta.dias = Number(select.value);
    encolar(tarjeta);
  });
  caja.appendChild(rotulo);
  caja.appendChild(select);
  return caja;
}
function crearTarjeta(reporte) {
  contador += 1;
  var prefijo = 'reporte-' + contador;
  var periodo = conPeriodo(reporte);
  var predeterminado = periodo ? reporte.periodo.predeterminado : null;
  var tarjeta = {
    reporte: reporte,
    dias: periodo ? (reporte.periodo.dias.indexOf(predeterminado) === -1 ? reporte.periodo.dias[0] : predeterminado) : null,
    generacion: 0,
    pendiente: false,
    descartada: false,
    grafico: null
  };
  var articulo = nodo('article', 'zd-card panel-reporte');
  articulo.setAttribute('aria-labelledby', prefijo + '-titulo');
  var cabeza = nodo('div', 'panel-reporte__cabeza');
  var textos = nodo('div', 'panel-reporte__textos');
  var titulo = nodo('h2', 'zd-h2', reporte.titulo);
  titulo.id = prefijo + '-titulo';
  textos.appendChild(titulo);
  if (typeof reporte.descripcion === 'string' && reporte.descripcion !== '') {
    textos.appendChild(nodo('p', 'zd-muted', reporte.descripcion));
  }
  cabeza.appendChild(textos);
  if (periodo) { cabeza.appendChild(selectorDePeriodo(tarjeta, prefijo)); }
  articulo.appendChild(cabeza);
  tarjeta.cuerpo = nodo('div', 'panel-reporte__cuerpo');
  articulo.appendChild(tarjeta.cuerpo);
  tarjeta.elemento = articulo;
  return tarjeta;
}
function pintarTablero(cuerpo) {
  zona = typeof cuerpo.zonaHoraria === 'string' ? cuerpo.zonaHoraria : 'UTC';
  for (var i = 0; i < tarjetas.length; i++) {
    tarjetas[i].descartada = true;
    tarjetas[i].pendiente = false;
    soltarGrafico(tarjetas[i]);
  }
  cola = [];
  tarjetas = [];
  lista.textContent = '';
  var reportes = cuerpo.reportes.filter(function (reporte) {
    return reporte !== null && typeof reporte === 'object' && typeof reporte.id === 'string' && typeof reporte.titulo === 'string';
  });
  conTablero = reportes.length > 0;
  pintarFrescura(cuerpo.datos ? cuerpo.datos.actualizadosEn : null);
  for (var j = 0; j < reportes.length; j++) {
    var tarjeta = crearTarjeta(reportes[j]);
    tarjetas.push(tarjeta);
    lista.appendChild(tarjeta.elemento);
  }
  aplicarSeccion();
  for (var k = 0; k < tarjetas.length; k++) { encolar(tarjetas[k]); }
  revisarActualizar();
}
function cargarTablero() {
  leyendo = true;
  avisoTablero.hidden = true;
  revisarActualizar();
  return fetch('/api/panel/tablero', { credentials: 'same-origin' }).then(function (respuesta) {
    if (respuesta.status === 401) {
      window.location.reload();
      return null;
    }
    if (respuesta.status !== 200) { return false; }
    return respuesta.json().catch(function () { return false; });
  }, function () {
    return false;
  }).then(function (cuerpo) {
    leyendo = false;
    if (cuerpo === null) { return; }
    if (!cuerpo || !Array.isArray(cuerpo.reportes)) {
      // The first read failing leaves the page as it was before the dashboard: «Avisos» only.
      avisoTablero.hidden = !conTablero;
      revisarActualizar();
      return;
    }
    pintarTablero(cuerpo);
  });
}
botonActualizar.addEventListener('click', function () { cargarTablero(); });
window.addEventListener('hashchange', aplicarSeccion);
// A theme change, from the system or from data-theme, re-reads the tokens of every live chart.
if (typeof window.matchMedia === 'function') {
  var esquema = window.matchMedia('(prefers-color-scheme: dark)');
  if (esquema && typeof esquema.addEventListener === 'function') { esquema.addEventListener('change', retintar); }
}
if (typeof window.MutationObserver === 'function') {
  new window.MutationObserver(retintar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
cargarTablero();
})();
`;
