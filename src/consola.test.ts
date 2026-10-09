import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { cronValido } from './automatizaciones.js';
import { registerConsolaRoute } from './consola.js';
import { CONTRATO_CANONICO } from './contrato.js';
import { asuntoCorreo, componerCorreo } from './correo.js';
import { RUTAS_ESTILOS } from './estilos-rutas.js';
import { evaluarVistas } from './plantillas.js';

/**
 * Cases for CH-07 task 4.1/4.2 (spec `query-console`).
 *
 * The document is fetched from the **real route** with `inject()`, its inline script is
 * extracted verbatim, and that script is then *executed* over the minimal DOM below.
 * The structural greps at the end are cheap guards; the behavioural cases are the ones
 * that matter, because the spec's claims are about what the operator sees — that a
 * capped result says so, and that the "load more" control is not offered for it. A grep
 * for the sentence would only prove the string exists in the file.
 *
 * This is **not** a browser test. There is no HTML parser and no layout here, so it says
 * nothing about how the page renders; it says what the script does with a response. The
 * same limitation was recorded in CH-05 and CH-06, where this technique was used ad hoc.
 * The full-document guards (one script element, no markup-assigning property) are what
 * `scripts/smoke.sh` re-checks against the really served bytes.
 */

/** A DOM node, reduced to what the console's script actually touches. */
class Nodo {
  tagName: string;
  id = '';
  className = '';
  type = '';
  hidden = false;
  disabled = false;
  selectedIndex = 0;
  // CH-21c: fields the wizard's later steps set (radio cards, the read-only cron field).
  checked = false;
  name = '';
  readOnly = false;
  // CH-21c PR5: the preview's title bar takes its accent through style.backgroundColor.
  style = { backgroundColor: '' };
  hijos: Nodo[] = [];
  private texto = '';
  private valorPropio = '';
  private atributos = new Map<string, string>();
  private oyentes = new Map<string, Array<(evento: { preventDefault: () => void }) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get firstChild(): Nodo | null {
    return this.hijos[0] ?? null;
  }

  get textContent(): string {
    if (this.hijos.length > 0) {
      return this.hijos.map((hijo) => hijo.textContent).join('');
    }
    return this.texto;
  }

  set textContent(valor: string) {
    // Matches the real thing closely enough for these cases: assigning text replaces
    // every child. It is also the property the whole console renders through, so a
    // stub that silently accepted markup would hide the very thing regla 7 relies on.
    this.hijos = [];
    this.texto = valor;
  }

  get value(): string {
    return this.valorPropio;
  }

  set value(valor: string) {
    this.valorPropio = valor;
    if (this.tagName === 'select') {
      const indice = this.options.findIndex((opcion) => opcion.value === valor);
      this.selectedIndex = indice === -1 ? 0 : indice;
    }
  }

  get options(): Nodo[] {
    return this.hijos.filter((hijo) => hijo.tagName === 'option');
  }

  /** Loading a saved query focuses the editor; there is no focus to model here. */
  focus(): void {}

  /** CH-21c: the stepper's aria-current is the only attribute the script sets by name. */
  setAttribute(nombre: string, valor: string): void {
    this.atributos.set(nombre, String(valor));
  }

  removeAttribute(nombre: string): void {
    this.atributos.delete(nombre);
  }

  getAttribute(nombre: string): string | null {
    return this.atributos.get(nombre) ?? null;
  }

  appendChild(hijo: Nodo): Nodo {
    this.hijos.push(hijo);
    return hijo;
  }

  removeChild(hijo: Nodo): Nodo {
    const indice = this.hijos.indexOf(hijo);
    if (indice !== -1) {
      this.hijos.splice(indice, 1);
    }
    return hijo;
  }

  addEventListener(tipo: string, fn: (evento: { preventDefault: () => void }) => void): void {
    const lista = this.oyentes.get(tipo) ?? [];
    lista.push(fn);
    this.oyentes.set(tipo, lista);
  }

  /** Test-side only: fires what `addEventListener` registered, with a stub event. */
  disparar(tipo: string): void {
    const eventoFalso = { preventDefault: () => {} };
    for (const fn of this.oyentes.get(tipo) ?? []) {
      fn(eventoFalso);
    }
  }

  /** Every descendant carrying `className`, for the visual-distinctness assertions. */
  porClase(clase: string): Nodo[] {
    const encontrados = this.className === clase ? [this as Nodo] : [];
    for (const hijo of this.hijos) {
      encontrados.push(...hijo.porClase(clase));
    }
    return encontrados;
  }
}

/** The ids the console's script looks up, plus the two table sections. */
const IDS = [
  'tenant',
  'tenant-activo',
  'formulario',
  'conexion',
  'sql',
  'parametros',
  'agregar-parametro',
  'limite',
  'ejecutar',
  'anterior',
  'siguiente',
  'nombre',
  'descripcion',
  'guardar',
  'guardadas',
  'banner',
  'estado',
  'auto-plantilla',
  'auto-valores',
  'auto-conexion',
  'auto-cron',
  'auto-destinatario',
  'auto-crear',
  'auto-lista',
  'auto-ejecuciones',
  // CH-21c: the creation wizard (DEC-129).
  'auto-nueva',
  'auto-alta',
  'auto-marca-1',
  'auto-marca-2',
  'auto-paso-1',
  'auto-paso-2',
  'auto-aviso',
  'auto-siguiente',
  'auto-cancelar',
  'auto-resumen',
  'auto-volver',
  // CH-21c PR3: the step-2 schedule (DEC-129).
  'auto-frecuencia',
  'auto-hora',
  'auto-horario-texto',
  // CH-21c PR5: the step-2 email preview (DEC-131).
  'auto-vista-asunto',
  'auto-vista-para',
  'auto-vista-titulo',
  // CH-24: the freshness section (C-22).
  'fresc-ventana',
  'fresc-actualizada',
  'fresc-minutos',
  'fresc-guardar',
  'fresc-marcar',
  'fresc-aviso',
  'fresc-plantillas',
  // CH-25: the versions panel (C-05).
  'versiones',
  'versiones-titulo',
  'versiones-estado',
  'versiones-lista',
  'versiones-cerrar',
] as const;

/** CH-21c: the wizard nodes the markup starts hidden, so the fake starts them hidden too. */
const IDS_OCULTOS_ALTA = ['auto-alta', 'auto-paso-2', 'auto-aviso'];
/** Every node the markup starts hidden: the wizard's, plus CH-25's versions panel. */
const IDS_OCULTOS = [...IDS_OCULTOS_ALTA, 'versiones'];

/**
 * CH-21a G1: the ids the markup must keep for the script, each exactly once. `IDS` plus
 * the bar the T4 comment names and the three containers the script reaches by selector
 * or the smoke greps for.
 */
const IDS_GUARDADOS = [...IDS, 'barra-tenant', 'resultados', 'guardado', 'automatizaciones', 'frescura'];

/** Throws naming the first guarded id that is missing, renamed or duplicated. */
function verificarIds(marcado: string): void {
  for (const id of IDS_GUARDADOS) {
    // Not preceded by a word character or a dash, so a data-id or aria-*id never counts.
    const veces = marcado.match(new RegExp('(?<![\\w-])id="' + id + '"', 'g'))?.length ?? 0;
    assert.equal(veces, 1, 'id="' + id + '" must appear exactly once in the markup, found ' + veces);
  }
}

interface Escenario {
  nodos: Map<string, Nodo>;
  encabezado: Nodo;
  cuerpoTabla: Nodo;
  /** Queued responses, consumed in order by the stubbed `fetch`. */
  respuestas: Array<{ status: number; cuerpo: unknown }>;
  /** `tenant` is the `X-Tenant-Id` header the request carried, `null` when none. */
  peticiones: Array<{ url: string; cuerpo: unknown; tenant: string | null }>;
}

/**
 * Builds the DOM, stubs `fetch`/`localStorage`, and runs the document's inline script
 * inside a function scope. The script is strict-mode `var`-only and has no top-level
 * `await`, so a plain `Function` call is a faithful enough host for it.
 */
function ejecutarConsola(script: string, escenario: Escenario): void {
  const documento = {
    getElementById(id: string): Nodo | null {
      return escenario.nodos.get(id) ?? null;
    },
    querySelector(selector: string): Nodo | null {
      if (selector === '#resultados thead') return escenario.encabezado;
      if (selector === '#resultados tbody') return escenario.cuerpoTabla;
      return null;
    },
    createElement(tagName: string): Nodo {
      return new Nodo(tagName);
    },
    // CH-24: the state badge's icon is an SVG; the fake treats it as any other node.
    createElementNS(_espacio: string, tagName: string): Nodo {
      return new Nodo(tagName);
    },
  };

  const almacenamiento = new Map<string, string>();
  const ventana = {
    localStorage: {
      getItem: (clave: string): string | null => almacenamiento.get(clave) ?? null,
      setItem: (clave: string, valor: string): void => void almacenamiento.set(clave, valor),
      removeItem: (clave: string): void => void almacenamiento.delete(clave),
    },
  };

  const fetchFalso = async (
    url: string,
    opciones?: { body?: string; headers?: Record<string, string> },
  ): Promise<unknown> => {
    escenario.peticiones.push({
      url,
      cuerpo: opciones?.body === undefined ? null : JSON.parse(opciones.body),
      tenant: opciones?.headers?.['X-Tenant-Id'] ?? null,
    });
    const siguiente = escenario.respuestas.shift();
    if (siguiente === undefined) {
      throw new Error(`no queued response for ${url}`);
    }
    return { status: siguiente.status, json: async () => siguiente.cuerpo };
  };

  // eslint-disable-next-line no-new-func -- the point of this suite is to run that code.
  const correr = new Function('document', 'window', 'fetch', script);
  correr(documento, ventana, fetchFalso);
}

/** One `EjecucionExitosa` body, with the fields the console reads. */
function respuestaOk(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resultado: 'ok',
    fase: 'ejecucion',
    columnas: ['id'],
    filas: [[1], [2]],
    corte: null,
    paginacion: {
      limite: 2,
      desplazamiento: 0,
      hayMas: true,
      siguienteDesplazamiento: 2,
      topeFilas: 200,
    },
    duracionMs: 7,
    ...overrides,
  };
}

describe('the console document, served by the real route', () => {
  let app!: FastifyInstance;
  let documento!: string;
  let script!: string;

  before(async () => {
    app = Fastify({ logger: false });
    registerConsolaRoute(app);
    await app.ready();

    const respuesta = await app.inject({ method: 'GET', url: '/consola' });
    assert.equal(respuesta.statusCode, 200);
    documento = respuesta.body;

    const apertura = documento.indexOf('<script>');
    const cierre = documento.indexOf('</' + 'script>');
    assert.ok(apertura !== -1 && cierre > apertura, 'the document must carry one inline script');
    script = documento.slice(apertura + '<script>'.length, cierre);
  });

  after(async () => {
    await app.close();
  });

  // ---- structural guards, re-checked by scripts/smoke.sh on the served bytes --------

  test('exactly one script element, and no markup-assigning property anywhere', () => {
    const cierres = documento.split('</' + 'script>').length - 1;
    assert.equal(cierres, 1, 'a second closing tag truncates the inline script silently');
    // The guard is a substring search, so this assertion cannot name the property it
    // forbids — naming it here would fail the check it is asserting.
    assert.ok(!documento.includes('inner' + 'HTML'));
  });

  test('the row-per-page input carries no upper bound of its own (CH-07)', () => {
    // A literal here would clamp below the deployment's ceiling, so the cut could never
    // be produced from the one surface P1 has.
    assert.ok(!/id="limite"[^>]*max=/.test(documento), 'the limite input must carry no max');
    assert.match(documento, /id="limite"[^>]*min="1"/, 'the lower bound stays');
  });

  test('the credencial-ilegible message exists and never names key material', () => {
    assert.ok(documento.includes("'credencial-ilegible':"), 'the entry must exist');
    assert.ok(!documento.includes('CREDENTIAL_MASTER_KEY'), 'no key variable on this page');
  });

  // ---- CH-21a guards: the restyle may not move what the script depends on -----------

  /** The markup only: everything before the inline script. */
  function marcado(): string {
    return documento.slice(0, documento.indexOf('<script>'));
  }

  /** Spec `query-console`: "All ids present once" and "Requesting the console page". */
  test('CH-21a G1 every id the script depends on appears exactly once in the markup', () => {
    verificarIds(marcado());
    assert.match(marcado(), /<textarea id="sql"/, 'the SQL input control stays');
    assert.match(marcado(), /<button id="ejecutar"[^>]*type="submit"/, 'the execute control stays');
  });

  /** Spec `query-console`: "A renamed id fails the guard". */
  test('CH-21a G1 the id guard fails naming a renamed or a duplicated id', () => {
    assert.throws(() => verificarIds(marcado().replace('id="estado"', 'id="estados"')), /id="estado"/);
    assert.throws(() => verificarIds(marcado() + '<p id="guardar"></p>'), /id="guardar"/);
  });

  /** Spec `query-console`: "Limit attributes preserved"; the script-managed nodes keep their markup. */
  test('CH-21a G2 the script-managed nodes and the limit input keep their exact attributes', () => {
    assert.ok(documento.includes('<p id="banner" class="banner" role="alert" hidden></p>'));
    assert.ok(documento.includes('<strong id="tenant-activo" class="sin-tenant">'));
    assert.ok(documento.includes('<p id="estado" class="estado" hidden></p>'));
    const limite = marcado().match(/<input id="limite"[^>]*>/)?.[0] ?? '';
    assert.match(limite, /min="1"/, 'the lower bound stays');
    assert.ok(!/\bmax=/.test(limite), 'the limite input must carry no max');
  });

  /** Spec `query-console`: "Page links the shared stylesheet". */
  test('CH-21a G3 the page links the shared stylesheet before its one bridge style', () => {
    const enlace = '<link rel="stylesheet" href="/ui/styles.css">';
    assert.equal(documento.split(enlace).length - 1, 1, 'exactly one link to the shared stylesheet');
    assert.ok(RUTAS_ESTILOS.includes('/ui/styles.css'), 'the href is a served stylesheet route');
    assert.equal(documento.split('<style').length - 1, 1, 'exactly one style element');
    assert.ok(documento.indexOf(enlace) < documento.indexOf('<style'), 'the bridge overrides the sheet');
    assert.ok(!documento.includes('max-width: 62rem'), 'the former inline body rule is gone');
    assert.ok(!documento.includes('#barra-tenant { position: sticky'), 'the former inline bar rule is gone');
  });

  /**
   * Spec "Script may reference the shared classes". CH-21c G3': the script names exactly
   * these shared classes, each assigned alone: `porClase` compares by strict equality, so
   * a new class or a second class on one node is a deliberate edit of this list.
   */
  test("CH-21c G3' the script assigns only the picker's shared classes, one per className", () => {
    const tokens = [...new Set(script.match(/zd-[\w-]+/g) ?? [])].sort();
    assert.deepEqual(tokens, ['zd-template', 'zd-template__desc', 'zd-template__name']);
    const asignaciones = script.match(/className = '[^']*'/g) ?? [];
    const compartidas = asignaciones.filter((asignacion) => asignacion.includes('zd-'));
    assert.equal(compartidas.length, 3, 'each shared class is assigned once');
    for (const asignacion of compartidas) {
      assert.ok(!/'[^']* [^']*'/.test(asignacion), 'single class: ' + asignacion);
    }
  });

  /** CH-21c PR2a: what IDS_OCULTOS mirrors, read from the markup itself. */
  test('CH-21c the wizard markup starts closed, on step 1, with type="button" on every button', () => {
    const seccion = marcado().slice(marcado().indexOf('id="automatizaciones"'));
    for (const id of IDS_OCULTOS_ALTA) {
      assert.match(seccion, new RegExp('id="' + id + '"[^>]*\\bhidden\\b'), id + ' starts hidden');
    }
    assert.match(seccion, /<li id="auto-marca-1"[^>]*aria-current="step"/, 'step 1 is current');
    assert.ok(!/<li id="auto-marca-2"[^>]*aria-current/.test(seccion), 'step 2 is not current');
    assert.match(seccion, /<button id="auto-siguiente"[^>]*disabled/, 'Siguiente starts disabled');
    // PR2c: the picker is a radio group the script fills with cards; no label points at it.
    assert.ok(seccion.includes('<div id="auto-plantilla" class="zd-templates" role="radiogroup" aria-label="Plantilla"></div>'));
    assert.ok(!seccion.includes('for="auto-plantilla"'), 'a label for a div names nothing');
    // PR3: four frequencies in this order, a 24 h hour that starts at 08:00, and a cron
    // field that is never hidden (read-only for a preset, the script decides).
    const frecuencias = seccion.match(/<select id="auto-frecuencia"[\s\S]*?<\/select>/)?.[0] ?? '';
    assert.deepEqual([...frecuencias.matchAll(/<option value="([^"]*)"/g)].map((opcion) => opcion[1]),
      ['diaria', 'lun-vie', 'lun-sab', 'personalizado']);
    assert.match(seccion, /<input id="auto-hora" [^>]*type="time" value="08:00"/);
    assert.ok(!/<input id="auto-cron"[^>]*\bhidden\b/.test(seccion), 'the cron field is always visible');
    const botonesSeccion = seccion.match(/<button[^>]*>/g) ?? [];
    assert.ok(botonesSeccion.length >= 5);
    assert.ok(botonesSeccion.every((etiqueta) => etiqueta.includes('type="button"')), 'no button submits');
  });

  // ---- behavioural cases: the script is run, not grepped ----------------------------

  /** Boots the console with the tenants already selectable, then returns the scenario. */
  async function arrancar(tenants = [{ id: 't-1', nombre: 'Food Store' }]): Promise<Escenario> {
    const nodos = new Map<string, Nodo>();
    for (const id of IDS) {
      // CH-21c: auto-conexion is a select from PR2b; auto-plantilla is the card picker's div from PR2c;
      // auto-frecuencia is a select from PR3.
      const nodo = new Nodo(['tenant', 'auto-conexion', 'auto-frecuencia'].includes(id) ? 'select' : 'div');
      nodo.id = id;
      nodo.hidden = IDS_OCULTOS.includes(id);
      nodos.set(id, nodo);
    }
    const escenario: Escenario = {
      nodos,
      encabezado: new Nodo('thead'),
      cuerpoTabla: new Nodo('tbody'),
      respuestas: [{ status: 200, cuerpo: { tenants } }],
      peticiones: [],
    };

    ejecutarConsola(script, escenario);
    // `cargarTenants()` is the script's last statement and is async; let it settle.
    await new Promise((resolver) => setImmediate(resolver));
    return escenario;
  }

  /**
   * Selects the tenant. Switching reloads the saved-query list, the template catalog and
   * the automations list (CH-13), in that request order.
   */
  async function elegirTenant(
    escenario: Escenario,
    guardadas: unknown[] = [],
    automatizaciones: unknown[] = [],
    id = 't-1',
    plantillas: unknown[] = [{ id: 'p-1', nombre: 'Stock diario' }],
  ): Promise<void> {
    const selector = escenario.nodos.get('tenant') as Nodo;
    selector.value = id;
    escenario.respuestas.push(
      { status: 200, cuerpo: { consultasGuardadas: guardadas, truncado: false } },
      { status: 200, cuerpo: { plantillas, truncado: false } },
      { status: 200, cuerpo: { automatizaciones, truncado: false } },
    );
    selector.disparar('change');
    await new Promise((resolver) => setImmediate(resolver));
  }

  /** Fires `evento` on `id` with `cuerpo` queued as the response, and lets it settle. */
  async function enviar(
    escenario: Escenario,
    cuerpo: unknown,
    status = 200,
    id = 'formulario',
    evento = 'submit',
  ): Promise<void> {
    escenario.respuestas.push({ status, cuerpo });
    (escenario.nodos.get(id) as Nodo).disparar(evento);
    await new Promise((resolver) => setImmediate(resolver));
    await new Promise((resolver) => setImmediate(resolver));
  }

  /** Selects the tenant and submits the form with `cuerpo` queued as the response. */
  async function ejecutarCon(
    escenario: Escenario,
    cuerpo: unknown,
    status = 200,
  ): Promise<void> {
    await elegirTenant(escenario);
    await enviar(escenario, cuerpo, status);
  }

  /** The declaration rows currently on the page. */
  function filas(escenario: Escenario): Nodo[] {
    return (escenario.nodos.get('parametros') as Nodo).porClase('parametro');
  }

  /** Nodes of one class inside a row: nombre, tipo, value control or its label. */
  function en(fila: Nodo, clase: string): Nodo {
    return fila.porClase(clase)[0];
  }

  /** Adds a row the way the operator does: Agregar, type the name, pick the tipo, fill. */
  function declarar(escenario: Escenario, nombre: string, tipo: string, valor = ''): Nodo {
    (escenario.nodos.get('agregar-parametro') as Nodo).disparar('click');
    const fila = filas(escenario).at(-1) as Nodo;
    en(fila, 'parametro-nombre').value = nombre;
    en(fila, 'parametro-nombre').disparar('input');
    en(fila, 'parametro-tipo').value = tipo;
    en(fila, 'parametro-tipo').disparar('change');
    en(fila, 'parametro-valor').value = valor;
    return fila;
  }

  /** The body of the last request sent. */
  function ultimoCuerpo(escenario: Escenario): Record<string, unknown> {
    return escenario.peticiones[escenario.peticiones.length - 1].cuerpo as Record<string, unknown>;
  }

  test('the console boots with a tenant and sends the header on a scoped call', async () => {
    const escenario = await arrancar();
    assert.equal(escenario.peticiones[0].url, '/tenants');
    assert.notEqual(escenario.nodos.get('tenant-activo')?.textContent, '');
  });

  /** Spec `query-console`: "Viewing a capped result". */
  test('a capped result states the cap and names the configured number', async () => {
    const escenario = await arrancar();
    await ejecutarCon(
      escenario,
      respuestaOk({
        corte: 'tope-de-filas',
        paginacion: {
          limite: 2,
          desplazamiento: 0,
          hayMas: true,
          siguienteDesplazamiento: 2,
          topeFilas: 2,
        },
      }),
    );

    const estado = escenario.nodos.get('estado') as Nodo;
    assert.equal(estado.hidden, false);
    assert.match(estado.textContent, /cortado en el tope configurado de 2 filas/);
  });

  /** Spec `query-console`: the "load more" control is not offered for a capped result. */
  test('a capped result leaves the next-page control disabled, hayMas notwithstanding', async () => {
    const escenario = await arrancar();
    await ejecutarCon(
      escenario,
      respuestaOk({
        corte: 'tope-de-filas',
        paginacion: {
          limite: 2,
          desplazamiento: 0,
          hayMas: true,
          siguienteDesplazamiento: 2,
          topeFilas: 2,
        },
      }),
    );

    assert.equal(
      (escenario.nodos.get('siguiente') as Nodo).disabled,
      true,
      'the cap denies a next page even though hayMas is true',
    );
  });

  /** Spec `query-console`: "A capped result is not mistaken for a partial page". */
  test('the cut sentence is a distinct node, and never sits beside "Hay más resultados."', async () => {
    const escenario = await arrancar();
    await ejecutarCon(
      escenario,
      respuestaOk({
        corte: 'tope-de-filas',
        paginacion: {
          limite: 2,
          desplazamiento: 0,
          hayMas: true,
          siguienteDesplazamiento: 2,
          topeFilas: 2,
        },
      }),
    );

    const estado = escenario.nodos.get('estado') as Nodo;
    const avisos = estado.porClase('corte');
    assert.equal(avisos.length, 1, 'the cut has its own element, not a fragment of the line');
    assert.equal(avisos[0].tagName, 'strong');
    assert.ok(
      !estado.textContent.includes('Hay más resultados.'),
      'the pagination invitation must not appear next to the cut that denies it',
    );
  });

  test('an ordinary paginated result keeps CH-04 behaviour exactly', async () => {
    const escenario = await arrancar();
    await ejecutarCon(escenario, respuestaOk());

    const estado = escenario.nodos.get('estado') as Nodo;
    assert.match(estado.textContent, /Hay más resultados\./);
    assert.equal(estado.porClase('corte').length, 0, 'no cut sentence on an uncut result');
    assert.equal(
      (escenario.nodos.get('siguiente') as Nodo).disabled,
      false,
      'the next-page control is offered when there really is a next page',
    );
  });

  test('a capped result followed by an uncut one drops the cut sentence', async () => {
    // The status line holds child nodes now; a stale "cortado" surviving into the next
    // result would be a lie the operator has no way to spot.
    const escenario = await arrancar();
    await ejecutarCon(
      escenario,
      respuestaOk({
        corte: 'tope-de-filas',
        paginacion: {
          limite: 2,
          desplazamiento: 0,
          hayMas: true,
          siguienteDesplazamiento: 2,
          topeFilas: 2,
        },
      }),
    );

    escenario.respuestas.push({
      status: 200,
      cuerpo: respuestaOk({
        filas: [[1]],
        paginacion: {
          limite: 50,
          desplazamiento: 0,
          hayMas: false,
          siguienteDesplazamiento: null,
          topeFilas: 200,
        },
      }),
    });
    (escenario.nodos.get('formulario') as Nodo).disparar('submit');
    await new Promise((resolver) => setImmediate(resolver));
    await new Promise((resolver) => setImmediate(resolver));

    const estado = escenario.nodos.get('estado') as Nodo;
    assert.ok(!estado.textContent.includes('cortado en el tope'));
    assert.equal(estado.porClase('corte').length, 0);
  });

  /** Task 4.2: a `409 credencial-ilegible` reads as an instruction, not as "HTTP 409". */
  test('a credencial-ilegible refusal is explained, and the table is cleared', async () => {
    const escenario = await arrancar();
    await ejecutarCon(escenario, { error: 'credencial-ilegible' }, 409);

    const banner = escenario.nodos.get('banner') as Nodo;
    assert.equal(banner.hidden, false);
    assert.match(banner.textContent, /no se pudo descifrar/);
    assert.match(banner.textContent, /volver a registrarla/);
    assert.ok(!banner.textContent.includes('HTTP 409'), 'the raw status is not the message');
    assert.equal(escenario.cuerpoTabla.hijos.length, 0, 'the previous rows are cleared');
  });

  test('the console can ask for a page above the old 200 ceiling', async () => {
    const escenario = await arrancar();
    (escenario.nodos.get('limite') as Nodo).value = '5000';
    await ejecutarCon(escenario, respuestaOk());

    const ejecucion = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(ejecucion.url, '/consultas/ejecutar');
    assert.equal((ejecucion.cuerpo as { limite: number }).limite, 5000);
  });

  // ---- CH-11: query parameters (spec `query-console`, DEC-48, DEC-60) ----------------

  /** Spec "Rendering inputs for a declared parameter"; design "A blank value omits the key". */
  test('a declared parameter renders one control labeled with its nombre, and a blank is omitted', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    const fecha = declarar(escenario, 'desde', 'fecha');
    const booleano = declarar(escenario, 'activo', 'booleano');

    assert.equal(filas(escenario).length, 2);
    assert.equal(en(fecha, 'parametro-leyenda').textContent, 'desde');
    assert.equal(en(fecha, 'parametro-valor').tagName, 'input');
    assert.match(String((en(fecha, 'parametro-valor') as unknown as { placeholder: string }).placeholder), /AAAA-MM-DD/);
    assert.deepEqual(
      en(booleano, 'parametro-valor').options.map((opcion) => opcion.value),
      ['', 'true', 'false'],
    );

    await enviar(escenario, respuestaOk());
    const cuerpo = ultimoCuerpo(escenario);
    assert.deepEqual(cuerpo.parametros, [
      { nombre: 'desde', tipo: 'fecha' },
      { nombre: 'activo', tipo: 'booleano' },
    ]);
    assert.deepEqual(cuerpo.valores, {}, 'a blank control sends no key, never an empty string');
  });

  /** Spec "Submitting collected parameter values"; design Console value-control table. */
  test('execute sends each value with the JSON type its tipo requires', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    declarar(escenario, 'n', 'numero', ' 10 ');
    declarar(escenario, 'b', 'booleano', 'false');
    declarar(escenario, 'f', 'fecha', '2026-09-01');
    declarar(escenario, 't', 'texto', "O'Brien ");
    declarar(escenario, 'x', 'numero', 'diez');

    await enviar(escenario, respuestaOk());
    assert.deepEqual(ultimoCuerpo(escenario).valores, {
      n: 10,
      b: false,
      f: '2026-09-01',
      t: "O'Brien ",
      x: 'diez',
    });
  });

  /** Spec "Declaration saved with the query" and "Declaration loaded with the query". */
  test('save sends the declaration only, and loading rebuilds the rows with empty values', async () => {
    const escenario = await arrancar();
    const guardada = { id: 'g-1', nombre: 'Ventas', descripcion: null, creadaEn: '2026-09-27' };
    await elegirTenant(escenario, [guardada]);
    declarar(escenario, 'desde', 'fecha', '2026-01-01');
    (escenario.nodos.get('nombre') as Nodo).value = 'Ventas';

    // The 201 is followed by the list refresh the save triggers.
    escenario.respuestas.push({ status: 201, cuerpo: { consultaGuardada: guardada } });
    await enviar(escenario, { consultasGuardadas: [guardada], truncado: false }, 200, 'guardar', 'click');
    const guardado = escenario.peticiones[escenario.peticiones.length - 2];
    assert.equal(guardado.url, '/consultas-guardadas');
    assert.deepEqual((guardado.cuerpo as Record<string, unknown>).parametros, [{ nombre: 'desde', tipo: 'fecha' }]);
    assert.ok(!('valores' in (guardado.cuerpo as object)), 'values are never saved (DEC-48)');

    const cargar = (escenario.nodos.get('guardadas') as Nodo).hijos[0].hijos.find((hijo) => hijo.tagName === 'button');
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        consultaGuardada: {
          sql: 'SELECT :a, :b',
          parametros: [
            { nombre: 'a', tipo: 'numero' },
            { nombre: 'b', tipo: 'booleano' },
          ],
        },
      },
    });
    (cargar as Nodo).disparar('click');
    await new Promise((resolver) => setImmediate(resolver));
    await new Promise((resolver) => setImmediate(resolver));

    const cargadas = filas(escenario);
    assert.equal(cargadas.length, 2, 'the loaded declaration replaces the rows on the page');
    assert.deepEqual(
      cargadas.map((fila) => [en(fila, 'parametro-nombre').value, en(fila, 'parametro-tipo').value]),
      [
        ['a', 'numero'],
        ['b', 'booleano'],
      ],
    );
    assert.deepEqual(cargadas.map((fila) => en(fila, 'parametro-valor').value), ['', '']);
  });

  test('switching tenant clears the declaration rows', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    declarar(escenario, 'desde', 'fecha', '2026-01-01');
    await elegirTenant(escenario);
    assert.equal(filas(escenario).length, 0);
  });

  /** Spec "A parameter error is shown legibly": execute. */
  test('each parameter problem is one legible line naming the parameter, never a raw error', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    declarar(escenario, 'desde', 'fecha', '27/09/2026');
    await enviar(
      escenario,
      {
        error: 'solicitud-invalida',
        campos: ['/valores/desde', '/sql'],
        problemas: [
          { parametro: 'desde', motivo: 'valor-invalido', campo: '/valores/desde' },
          { parametro: 'hasta', motivo: 'sin-declarar', campo: '/sql' },
        ],
        stack: 'Error: boom\n    at prepararSentencia',
      },
      400,
    );

    const banner = escenario.nodos.get('banner') as Nodo;
    const lineas = banner.textContent.split('\n');
    assert.equal(lineas.length, 3, 'a heading plus one line per problem');
    assert.match(lineas[1], /«desde»/);
    assert.match(lineas[2], /«hasta»/);
    assert.ok(!banner.textContent.includes('valor-invalido'), 'the motivo code is translated');
    assert.ok(!banner.textContent.includes('sin-declarar'), 'the motivo code is translated');
    assert.ok(!banner.textContent.includes('prepararSentencia'), 'no stack trace reaches the page');

    // A schema refusal carries only campos (an unknown tipo): it still names the row.
    await enviar(escenario, { error: 'solicitud-invalida', campos: ['/parametros/0/tipo'] }, 400);
    assert.match(banner.textContent, /tipo del parámetro «desde»/);
    assert.ok(!banner.textContent.includes('/parametros/0'), 'the index path is mapped to the name');
  });

  /** Spec "A parameter error is shown legibly": save answers with the same lines. */
  test('a save refused for its declaration shows one line per problem', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    declarar(escenario, 'desde', 'fecha');
    (escenario.nodos.get('nombre') as Nodo).value = 'Ventas';
    await enviar(
      escenario,
      {
        error: 'solicitud-invalida',
        campos: ['/parametros', '/parametros/0/nombre'],
        problemas: [
          { parametro: null, motivo: 'nombre-invalido', campo: '/parametros' },
          { parametro: 'desde', motivo: 'sin-usar', campo: '/parametros/0/nombre' },
        ],
      },
      400,
      'guardar',
      'click',
    );

    const lineas = (escenario.nodos.get('banner') as Nodo).textContent.split('\n');
    assert.equal(lineas.length, 3);
    assert.match(lineas[1], /^Declaración de parámetros: /);
    assert.match(lineas[2], /«desde»: está declarado pero la sentencia no lo usa/);
    assert.ok(!lineas.join('\n').includes('sin-usar'));
  });

  // ---- CH-13: automations (spec `query-console`, DEC-78, DEC-79, DEC-80, T4) --------

  /** One `AutomatizacionResumen` row as `GET /automatizaciones` lists it. */
  function automatizacion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'a-1',
      plantillaId: 'p-1',
      conexionId: 'c-1',
      cron: '0 6 * * *',
      activo: true,
      creadaEn: '2026-09-28T00:00:00.000Z',
      ...overrides,
    };
  }

  /** The rows of one automations table, by the class the console gives them. */
  function filasDe(escenario: Escenario, id: string, clase: string): Nodo[] {
    return (escenario.nodos.get(id) as Nodo).porClase(clase);
  }

  /** Every button inside `nodo`, in document order. */
  function botones(nodo: Nodo): Nodo[] {
    return nodo.hijos.flatMap((hijo) => (hijo.tagName === 'button' ? [hijo] : botones(hijo)));
  }

  /** Lets an action that chains two requests settle. */
  async function asentar(): Promise<void> {
    await new Promise((resolver) => setImmediate(resolver));
    await new Promise((resolver) => setImmediate(resolver));
  }

  /** CH-21c: one wizard node by id. */
  function nodo(escenario: Escenario, id: string): Nodo {
    return escenario.nodos.get(id) as Nodo;
  }

  /** CH-21c PR2b: what `GET /conexiones` answers by default, one row per connection id the tests pick. */
  const CONEXIONES = ['c-1', 'c-2', 'c-3', 'c-7', 'c-9', 'c-A'].map((id) => ({ id, nombre: 'Réplica ' + id }));

  /**
   * CH-21c: opens the wizard the way the operator does, with Nueva. Opening asks for the
   * connections (PR2b), answered with `cuerpo` and `status`; a pending `Promise` as `cuerpo`
   * keeps that answer in flight.
   */
  async function abrirAlta(
    escenario: Escenario,
    cuerpo: unknown = { conexiones: CONEXIONES, truncado: false },
    status = 200,
  ): Promise<void> {
    escenario.respuestas.push({ status, cuerpo });
    nodo(escenario, 'auto-nueva').disparar('click');
    await asentar();
  }

  /** CH-21c: the connection dropdown as `[value, text]` pairs, placeholder first. */
  function opcionesConexion(escenario: Escenario): string[][] {
    return nodo(escenario, 'auto-conexion').options.map((opcion) => [opcion.value, opcion.textContent]);
  }

  /** CH-21c PR2c: the template cards of the picker, in catalog order. */
  function tarjetas(escenario: Escenario): Nodo[] {
    return nodo(escenario, 'auto-plantilla').porClase('zd-template');
  }

  /** CH-21c PR2c: the radio input inside one card. */
  function radioDe(tarjeta: Nodo): Nodo {
    return tarjeta.hijos.find((hijo) => hijo.tagName === 'input') as Nodo;
  }

  /**
   * CH-21c PR2c: chooses a card as a click on its label does in a browser: that radio
   * becomes the group's only checked one, then it fires `change`. The fake DOM has no
   * radio groups, so the unchecking of the others is done here.
   */
  function elegirTarjeta(escenario: Escenario, id: string): void {
    const radios = tarjetas(escenario).map(radioDe);
    const elegido = radios.find((radio) => radio.value === id);
    assert.ok(elegido !== undefined, id + ' has a card');
    for (const radio of radios) {
      radio.checked = radio === elegido;
    }
    elegido.disparar('change');
  }

  /** CH-21c step 1: picks the template's card, its detail answered with `parametros`. */
  async function elegirPlantillaAlta(escenario: Escenario, parametros: unknown[] = []): Promise<void> {
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { parametros, entidades: ['producto'] } } });
    elegirTarjeta(escenario, 'p-1');
    await asentar();
  }

  /**
   * CH-21c PR4: the report `GET /conexiones/:id/validacion-mapeo` answers, in contract
   * order, one row per contract entity (`no-mapeada` unless `estados` says otherwise).
   */
  function informeDe(estados: Record<string, string>): { validacionMapeo: { entidades: unknown[] } } {
    return {
      validacionMapeo: {
        entidades: CONTRATO_CANONICO.map((e) => ({ entidad: e.nombre, estado: estados[e.nombre] ?? 'no-mapeada' })),
      },
    };
  }
  const TODO_VALIDO = informeDe(Object.fromEntries(CONTRATO_CANONICO.map((e) => [e.nombre, 'valida'])));

  /** CH-21c PR4: picks a connection from the dropdown; the availability probe answers `informe`. */
  async function elegirConexion(escenario: Escenario, id: string, informe: unknown = TODO_VALIDO, status = 200): Promise<void> {
    escenario.respuestas.push({ status, cuerpo: informe });
    nodo(escenario, 'auto-conexion').value = id;
    nodo(escenario, 'auto-conexion').disparar('change');
    await asentar();
  }

  /** CH-21c step 1: picks the template, then the connection from the dropdown. */
  async function completarPaso1(escenario: Escenario, parametros: unknown[] = [], conexion = 'c-1'): Promise<void> {
    await elegirPlantillaAlta(escenario, parametros);
    assert.ok(opcionesConexion(escenario).some(([valor]) => valor === conexion), conexion + ' is offered');
    await elegirConexion(escenario, conexion);
  }

  /** CH-21c: step 1 completed, then Siguiente, landing on step 2. */
  async function avanzar(escenario: Escenario, parametros: unknown[] = [], conexion = 'c-1'): Promise<void> {
    await completarPaso1(escenario, parametros, conexion);
    nodo(escenario, 'auto-siguiente').disparar('click');
  }

  /**
   * CH-21c PR3: picks a frequency, then types into the field the operator can type in: the
   * hour for a preset, the cron itself for personalizado.
   */
  function fijarHorario(escenario: Escenario, frecuencia: string, valor: string): void {
    nodo(escenario, 'auto-frecuencia').value = frecuencia;
    nodo(escenario, 'auto-frecuencia').disparar('change');
    const campo = nodo(escenario, frecuencia === 'personalizado' ? 'auto-cron' : 'auto-hora');
    assert.ok(!campo.readOnly && !campo.disabled, 'the operator can type in ' + campo.id);
    campo.value = valor;
    campo.disparar('input');
  }

  /** CH-21c: which panel is showing and which marker is current, as `[paso, marca]`. */
  function pasoVisible(escenario: Escenario): [number, number] {
    const paso = [1, 2].filter((n) => !nodo(escenario, 'auto-paso-' + n).hidden);
    const marca = [1, 2].filter((n) => nodo(escenario, 'auto-marca-' + n).getAttribute('aria-current') === 'step');
    assert.ok(paso.length <= 1 && marca.length <= 1, 'one panel and one current marker at most');
    return [paso[0] ?? 0, marca[0] ?? 0];
  }

  /** Spec "Viewing the automations list" and "Deactivating from the console". */
  test('the list shows plantilla, connection, schedule and state; deactivating reloads it', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);

    const [fila] = filasDe(escenario, 'auto-lista', 'automatizacion');
    for (const texto of ['Stock diario', 'c-1', '0 6 * * *', 'activa']) {
      assert.ok(fila.textContent.includes(texto), texto);
    }
    // DEC-79: the only state change offered is deactivation; no edit, delete or reactivate.
    assert.deepEqual(botones(fila).map((nodo) => nodo.textContent), ['Ver ejecuciones', 'Desactivar']);

    escenario.respuestas.push(
      { status: 200, cuerpo: { automatizacion: automatizacion({ activo: false }) } },
      { status: 200, cuerpo: { automatizaciones: [automatizacion({ activo: false })], truncado: false } },
    );
    fila.porClase('desactivar')[0].disparar('click');
    await asentar();

    const baja = escenario.peticiones[escenario.peticiones.length - 2];
    assert.equal(baja.url, '/automatizaciones/a-1/desactivar');
    assert.equal(baja.tenant, 't-1');
    const [desactivada] = filasDe(escenario, 'auto-lista', 'automatizacion');
    assert.ok(desactivada.textContent.includes('desactivada'));
    assert.deepEqual(botones(desactivada).map((nodo) => nodo.textContent), ['Ver ejecuciones']);
  });

  /**
   * Spec "Creating an automation from the console", "Parameters of the chosen template" and
   * "POST body is unchanged"; design: values reuse controlDeValor. CH-21c RW1: through the wizard.
   */
  test('create builds value controls from the template and submits scoped to the active tenant', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);

    await abrirAlta(escenario);
    await avanzar(escenario, [{ nombre: 'desde', tipo: 'fecha' }, { nombre: 'n', tipo: 'numero' }], 'c-2');
    assert.deepEqual(pasoVisible(escenario), [2, 2]);

    const controles = (escenario.nodos.get('auto-valores') as Nodo).porClase('parametro-valor');
    assert.equal(controles.length, 2, 'one control per declared parameter');
    controles[0].value = '2026-01-01';
    controles[1].value = ' 10 ';
    fijarHorario(escenario, 'personalizado', '30 7 * * 1');

    const nueva = automatizacion({ id: 'a-2', conexionId: 'c-2', cron: '30 7 * * 1' });
    escenario.respuestas.push({ status: 201, cuerpo: { automatizacion: nueva } });
    await enviar(escenario, { automatizaciones: [nueva, automatizacion()], truncado: false }, 200, 'auto-crear', 'click');

    const alta = escenario.peticiones[escenario.peticiones.length - 2];
    assert.equal(alta.url, '/automatizaciones');
    assert.equal(alta.tenant, 't-1');
    // No tenantId in the body: the header names the tenant (rule 2).
    assert.deepEqual(alta.cuerpo, {
      plantillaId: 'p-1',
      conexionId: 'c-2',
      valores: { desde: '2026-01-01', n: 10 },
      cron: '30 7 * * 1',
    });
    const filas = filasDe(escenario, 'auto-lista', 'automatizacion');
    assert.equal(filas.length, 2);
    assert.ok(filas[0].textContent.includes('30 7 * * 1'), 'the new automation is listed');
    // The 201 closes and resets the wizard, and says so in the success banner.
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(nodo(escenario, 'auto-nueva').hidden, false);
    assert.equal(nodo(escenario, 'auto-conexion').value, '');
    assert.equal(nodo(escenario, 'banner').className, 'banner exito');
  });

  /** Spec "Viewing an automation's runs"; X2: only closed categories reach the page. */
  test('the runs view shows each run and a classified error for a failed one', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);

    const base = { corte: null, codigoError: null, error: null };
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        ejecuciones: [
          { ...base, id: 'e-1', estado: 'ok', iniciadaEn: '2026-09-28T06:00:01.000Z', finalizadaEn: '2026-09-28T06:00:02.000Z', duracionMs: 850, filas: 42, fase: 'ejecucion' },
          { ...base, id: 'e-2', estado: 'fallo', iniciadaEn: 'i2', finalizadaEn: 'f2', duracionMs: 30000, filas: null, fase: 'ejecucion', error: 'tiempo-agotado', codigoError: '57014' },
          { ...base, id: 'e-3', estado: 'fallo', iniciadaEn: 'i3', finalizadaEn: 'f3', duracionMs: 4, filas: null, fase: 'preparacion', error: 'vista-canonica-no-aprobada', codigoError: 'pedido,cliente' },
        ],
        truncado: false,
      },
    });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ver-ejecuciones')[0].disparar('click');
    await asentar();

    const pedido = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(pedido.url, '/automatizaciones/a-1/ejecuciones');
    assert.equal(pedido.tenant, 't-1');
    const corridas = filasDe(escenario, 'auto-ejecuciones', 'ejecucion');
    assert.equal(corridas.length, 3);
    assert.deepEqual(
      corridas[0].hijos.map((celda) => celda.textContent),
      // CH-14: a run with no notificacion (pre-CH-14) shows the placeholder, never "null".
      // CH-17b: nor intentos, the last column.
      ['2026-09-28T06:00:01.000Z', '2026-09-28T06:00:02.000Z', '850', '42', 'ok', '—', '', '—'],
    );
    assert.match(corridas[1].textContent, /superó el tiempo máximo de ejecución.*\(SQLSTATE 57014\)/);
    assert.ok(!corridas[1].textContent.includes('tiempo-agotado'), 'the category code is translated');
    assert.match(corridas[2].textContent, /antes de conectar.*pedido,cliente/);
  });

  // ---- CH-14: recipient and notification outcome (spec `query-console`) -------------

  /** Spec "Creating with a recipient": sent trimmed, and only when not empty. CH-21c RW2: through the wizard. */
  test('CH-14 6.4 the recipient is sent as destinatario only when one is entered', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    await abrirAlta(escenario);
    await avanzar(escenario);
    fijarHorario(escenario, 'diaria', '06:00');
    (escenario.nodos.get('auto-destinatario') as Nodo).value = ' ops@example.com ';
    escenario.respuestas.push({ status: 201, cuerpo: { automatizacion: automatizacion() } });
    await enviar(escenario, { automatizaciones: [automatizacion()], truncado: false }, 200, 'auto-crear', 'click');
    assert.equal(escenario.peticiones[escenario.peticiones.length - 2].url, '/automatizaciones');
    assert.deepEqual(escenario.peticiones[escenario.peticiones.length - 2].cuerpo, {
      plantillaId: 'p-1',
      conexionId: 'c-1',
      valores: {},
      cron: '0 6 * * *',
      destinatario: 'ops@example.com',
    });

    // Blank (spaces only): no destinatario key at all, so the automation is created without one.
    // The 201 closed the wizard, so the second one is opened and walked again.
    await abrirAlta(escenario);
    await avanzar(escenario);
    fijarHorario(escenario, 'diaria', '06:00');
    (escenario.nodos.get('auto-destinatario') as Nodo).value = '   ';
    escenario.respuestas.push({ status: 201, cuerpo: { automatizacion: automatizacion() } });
    await enviar(escenario, { automatizaciones: [automatizacion()], truncado: false }, 200, 'auto-crear', 'click');
    assert.equal('destinatario' in (escenario.peticiones[escenario.peticiones.length - 2].cuerpo as object), false);
  });

  /**
   * Spec "Invalid recipient shown legibly" and "Server 400 shown in the banner".
   * CH-21c RW3: through the wizard, which stays on step 2 with every typed value.
   */
  test('CH-14 6.4 a rejected recipient is one legible sentence naming the field, never a raw error', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    await abrirAlta(escenario);
    await avanzar(escenario, [{ nombre: 'n', tipo: 'numero' }], 'c-9');
    const [control] = nodo(escenario, 'auto-valores').porClase('parametro-valor');
    control.value = '5';
    fijarHorario(escenario, 'diaria', '06:00');
    (escenario.nodos.get('auto-destinatario') as Nodo).value = 'ops@example.com, otro@example.com';
    await enviar(
      escenario,
      { error: 'solicitud-invalida', campos: ['/destinatario'], stack: 'Error: boom\n    at direccionValida' },
      400,
      'auto-crear',
      'click',
    );
    const banner = (escenario.nodos.get('banner') as Nodo).textContent;
    assert.match(banner, /destinatario/);
    assert.match(banner, /una sola dirección/);
    assert.ok(!banner.includes('/destinatario'), 'the JSON pointer is translated');
    assert.ok(!banner.includes('direccionValida'), 'no stack trace reaches the page');
    assert.ok(!banner.includes('solicitud-invalida'), 'no raw error code reaches the page');
    assert.deepEqual(ultimoCuerpo(escenario), {
      plantillaId: 'p-1',
      conexionId: 'c-9',
      valores: { n: 5 },
      cron: '0 6 * * *',
      destinatario: 'ops@example.com, otro@example.com',
    });
    // The 400 keeps the wizard open on step 2, with what was typed.
    assert.equal(nodo(escenario, 'auto-alta').hidden, false);
    assert.deepEqual(pasoVisible(escenario), [2, 2]);
    assert.equal(nodo(escenario, 'auto-destinatario').value, 'ops@example.com, otro@example.com');
    assert.equal(nodo(escenario, 'auto-cron').value, '0 6 * * *');
    assert.equal(nodo(escenario, 'auto-hora').value, '06:00');
    assert.equal(nodo(escenario, 'auto-conexion').value, 'c-9');
    assert.equal(nodo(escenario, 'auto-valores').porClase('parametro-valor')[0].value, '5');
  });

  // ---- CH-21c PR2a: the wizard shell (spec `query-console`, DEC-129) ---------------

  /** Spec "Wizard opens on step 1" (its request half is W2) and "Step navigation". */
  test('CH-21c W3 Siguiente waits for a connection and a template; Volver keeps both; aria-current moves', async () => {
    const escenario = await arrancar();
    // No tenant: Nueva says so, opens nothing and asks for nothing.
    nodo(escenario, 'auto-nueva').disparar('click');
    assert.match(nodo(escenario, 'banner').textContent, /Elegí un tenant/);
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(escenario.peticiones.length, 1, 'only the boot request');

    await elegirTenant(escenario, [], [automatizacion()]);
    const pedidas = escenario.peticiones.length;
    await abrirAlta(escenario);
    assert.equal(escenario.peticiones.length, pedidas + 1, 'opening asks for the connections only');
    assert.equal(nodo(escenario, 'auto-alta').hidden, false);
    assert.equal(nodo(escenario, 'auto-nueva').hidden, true);
    assert.deepEqual(pasoVisible(escenario), [1, 1]);
    const siguiente = nodo(escenario, 'auto-siguiente');
    assert.equal(siguiente.disabled, true, 'nothing chosen yet');

    await elegirPlantillaAlta(escenario, [{ nombre: 'n', tipo: 'numero' }]);
    assert.equal(siguiente.disabled, true, 'a template without a connection');
    await elegirConexion(escenario, 'c-7');
    assert.equal(siguiente.disabled, false);
    nodo(escenario, 'auto-conexion').value = '';
    nodo(escenario, 'auto-conexion').disparar('change');
    assert.equal(siguiente.disabled, true, 'the placeholder is no connection');
    await elegirConexion(escenario, 'c-7');

    siguiente.disparar('click');
    assert.deepEqual(pasoVisible(escenario), [2, 2]);
    assert.equal(nodo(escenario, 'auto-resumen').textContent, 'Plantilla: Stock diario · Conexión: Réplica c-7 (c-7…)');
    nodo(escenario, 'auto-valores').porClase('parametro-valor')[0].value = '12';

    nodo(escenario, 'auto-volver').disparar('click');
    assert.deepEqual(pasoVisible(escenario), [1, 1]);
    assert.equal(radioDe(tarjetas(escenario)[0]).checked, true, 'the card stays chosen');
    assert.equal(nodo(escenario, 'auto-conexion').value, 'c-7');
    siguiente.disparar('click');
    assert.deepEqual(pasoVisible(escenario), [2, 2]);
    assert.equal(nodo(escenario, 'auto-valores').porClase('parametro-valor')[0].value, '12', 'Volver kept the value');

    // Siguiente re-checks: with the connection unchosen it does not move (a chosen radio
    // card cannot be unchosen by the operator).
    nodo(escenario, 'auto-volver').disparar('click');
    nodo(escenario, 'auto-conexion').value = '';
    siguiente.disparar('click');
    assert.deepEqual(pasoVisible(escenario), [1, 1]);
    assert.equal(escenario.peticiones.length, pedidas + 4, 'the template detail and one probe per connection chosen');
  });

  /** Spec "Tenant switch wipes the wizard" and "Tenant load keeps three requests". */
  test('CH-21c W6 a tenant switch hides and wipes the wizard, and the load stays at three requests', async () => {
    const escenario = await arrancar([
      { id: 't-1', nombre: 'Food Store' },
      { id: 't-2', nombre: 'Otra tienda' },
    ]);
    await elegirTenant(escenario, [], [], 't-1');
    await abrirAlta(escenario);
    await avanzar(escenario, [{ nombre: 'n', tipo: 'numero' }], 'c-A');
    nodo(escenario, 'auto-valores').porClase('parametro-valor')[0].value = '3';
    fijarHorario(escenario, 'diaria', '06:00');
    nodo(escenario, 'auto-destinatario').value = 'ops@example.com';

    const antes = escenario.peticiones.length;
    await elegirTenant(escenario, [], [], 't-2');
    assert.deepEqual(
      escenario.peticiones.slice(antes).map((peticion) => [peticion.url, peticion.tenant]),
      [['/consultas-guardadas', 't-2'], ['/plantillas', 't-2'], ['/automatizaciones', 't-2']],
    );
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(nodo(escenario, 'auto-nueva').hidden, false);
    for (const id of ['auto-conexion', 'auto-destinatario']) {
      assert.equal(nodo(escenario, id).value, '', id + ' is wiped');
    }
    assert.equal(nodo(escenario, 'auto-cron').value, '0 8 * * *', 'the schedule is back to its default (H6)');
    assert.equal(tarjetas(escenario).length, 1, "B's catalog");
    assert.ok(tarjetas(escenario).every((tarjeta) => !radioDe(tarjeta).checked), 'no card stays chosen');
    assert.equal(nodo(escenario, 'auto-valores').hijos.length, 0, 'no value control of A survives');
    assert.deepEqual(opcionesConexion(escenario), [['', 'Elegí una conexión']], 'no connection of A stays selectable');
    assert.equal(nodo(escenario, 'auto-resumen').textContent, '');
    assert.equal(nodo(escenario, 'auto-siguiente').disabled, true);

    await abrirAlta(escenario);
    assert.deepEqual(pasoVisible(escenario), [1, 1], 'reopening starts on step 1');
  });

  /** Design PR2a W7: Cancelar closes and resets. */
  test('CH-21c W7 Cancelar closes the wizard and resets it', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    await abrirAlta(escenario);
    await avanzar(escenario, [{ nombre: 'n', tipo: 'numero' }], 'c-3');
    fijarHorario(escenario, 'personalizado', '0 6 * * *');
    nodo(escenario, 'auto-volver').disparar('click');

    const pedidas = escenario.peticiones.length;
    nodo(escenario, 'auto-cancelar').disparar('click');
    assert.equal(escenario.peticiones.length, pedidas, 'Cancelar sends nothing');
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(nodo(escenario, 'auto-nueva').hidden, false);

    await abrirAlta(escenario);
    assert.deepEqual(pasoVisible(escenario), [1, 1]);
    assert.equal(nodo(escenario, 'auto-conexion').value, '', 'auto-conexion is reset');
    assert.deepEqual([nodo(escenario, 'auto-frecuencia').value, nodo(escenario, 'auto-cron').value], ['diaria', '0 8 * * *']);
    assert.ok(tarjetas(escenario).every((tarjeta) => !radioDe(tarjeta).checked), 'no card stays chosen');
    assert.equal(nodo(escenario, 'auto-valores').hijos.length, 0);
    assert.equal(nodo(escenario, 'auto-siguiente').disabled, true);
  });

  /** Spec "Late response after a tenant switch is ignored" (template detail half). */
  test('CH-21c W10 a template detail answered after a tenant switch builds no value control', async () => {
    const escenario = await arrancar([
      { id: 't-1', nombre: 'Food Store' },
      { id: 't-2', nombre: 'Otra tienda' },
    ]);
    await elegirTenant(escenario, [], [], 't-1');
    await abrirAlta(escenario);
    let responder!: (cuerpo: unknown) => void;
    const diferido = new Promise((resolver) => { responder = resolver; });
    escenario.respuestas.push({ status: 200, cuerpo: diferido });
    elegirTarjeta(escenario, 'p-1');
    await asentar();

    // Tenant B's catalog carries the same template id and B chooses it too (its own detail
    // stays in flight), so only the wizard token can tell the two answers apart.
    await elegirTenant(escenario, [], [], 't-2');
    await abrirAlta(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: new Promise(() => {}) });
    elegirTarjeta(escenario, 'p-1');
    await asentar();
    responder({ plantilla: { parametros: [{ nombre: 'n', tipo: 'numero' }] } });
    await asentar();
    assert.equal(nodo(escenario, 'auto-valores').hijos.length, 0, "A's late detail is dropped");
  });

  // ---- CH-21c PR2b: the connection dropdown (spec `query-console`, DEC-132) ---------

  /** Spec "Wizard opens on step 1" (request half): one GET /conexiones, the dropdown filled as text. */
  test('CH-21c W2 opening asks GET /conexiones for the active tenant and lists each by name and short id', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    const antes = escenario.peticiones.length;
    const norte = { id: '0f8e2c4a-1111-4222-8333-944455556666', nombre: 'Réplica <b>norte</b>' };
    const sur = { id: '7a1b9c3d-aaaa-4bbb-8ccc-dddddddddddd', nombre: 'Réplica norte' };
    await abrirAlta(escenario, { conexiones: [norte, sur], truncado: false });

    assert.deepEqual(
      escenario.peticiones.slice(antes).map((peticion) => [peticion.url, peticion.tenant, peticion.cuerpo]),
      [['/conexiones', 't-1', null]],
    );
    // A name that looks like markup stays text, and the short id tells repeated names apart.
    assert.deepEqual(opcionesConexion(escenario), [
      ['', 'Elegí una conexión'],
      [norte.id, 'Réplica <b>norte</b> (0f8e2c4a…)'],
      [sur.id, 'Réplica norte (7a1b9c3d…)'],
    ]);
    assert.ok(nodo(escenario, 'auto-conexion').options.every((opcion) => opcion.hijos.length === 0), 'text only');
    assert.equal(nodo(escenario, 'auto-conexion').value, '', 'nothing is chosen for the operator');
    assert.equal(nodo(escenario, 'auto-aviso').hidden, true);
    assert.equal(nodo(escenario, 'banner').hidden, true);
  });

  /** Spec "Tenant has no connections"; design: the capped list says so too. */
  test('CH-21c W4 an empty connection list explains itself and keeps Siguiente disabled', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario, { conexiones: [], truncado: false });

    assert.deepEqual(opcionesConexion(escenario), [['', 'No hay conexiones registradas']]);
    const aviso = nodo(escenario, 'auto-aviso');
    assert.equal(aviso.hidden, false);
    assert.match(aviso.textContent, /no tiene conexiones registradas/);
    assert.equal(nodo(escenario, 'banner').hidden, true, 'not an error');
    await elegirPlantillaAlta(escenario);
    assert.equal(nodo(escenario, 'auto-siguiente').disabled, true, 'a template alone does not open step 2');

    nodo(escenario, 'auto-cancelar').disparar('click');
    await abrirAlta(escenario, { conexiones: CONEXIONES, truncado: true });
    assert.equal(opcionesConexion(escenario).length, CONEXIONES.length + 1);
    assert.equal(aviso.hidden, false);
    assert.equal(aviso.textContent, 'Se muestran solo las primeras 6 conexiones, en orden alfabético.');
  });

  /** Spec "Late response after a tenant switch is ignored" (GET /conexiones half). */
  test('CH-21c W5 a GET /conexiones answered after a tenant switch adds no option', async () => {
    const escenario = await arrancar([
      { id: 't-1', nombre: 'Food Store' },
      { id: 't-2', nombre: 'Otra tienda' },
    ]);
    await elegirTenant(escenario, [], [], 't-1');
    let responder!: (cuerpo: unknown) => void;
    await abrirAlta(escenario, new Promise((resolver) => { responder = resolver; }));
    assert.equal(escenario.peticiones.at(-1)?.tenant, 't-1');

    await elegirTenant(escenario, [], [], 't-2');
    await abrirAlta(escenario, { conexiones: [{ id: 'c-B', nombre: 'Réplica B' }], truncado: false });
    responder({ conexiones: [{ id: 'c-A', nombre: 'Réplica A' }], truncado: true });
    await asentar();

    assert.deepEqual(opcionesConexion(escenario), [['', 'Elegí una conexión'], ['c-B', 'Réplica B (c-B…)']]);
    assert.equal(nodo(escenario, 'auto-aviso').hidden, true, "A's truncado notice is dropped too");
  });

  /** Spec "Connections fetch fails": a legible notice, and the wizard and the console keep working. */
  test('CH-21c W9 a failed GET /conexiones shows the banner, keeps step 1 usable, and reopening retries', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    await abrirAlta(escenario, { statusCode: 500, error: 'Internal Server Error', message: 'boom' }, 500);

    const banner = nodo(escenario, 'banner');
    assert.equal(banner.hidden, false);
    assert.equal(banner.textContent, 'La aplicación respondió HTTP 500.');
    assert.equal(nodo(escenario, 'auto-alta').hidden, false, 'the wizard stays open');
    assert.deepEqual(pasoVisible(escenario), [1, 1]);
    assert.deepEqual(opcionesConexion(escenario), [['', 'Elegí una conexión']]);
    assert.match(nodo(escenario, 'auto-aviso').textContent, /No se pudieron cargar las conexiones/);
    await elegirPlantillaAlta(escenario);
    assert.equal(nodo(escenario, 'auto-siguiente').disabled, true);

    nodo(escenario, 'auto-cancelar').disparar('click');
    assert.equal(nodo(escenario, 'auto-alta').hidden, true, 'Cancelar still closes it');
    const antes = escenario.peticiones.length;
    await abrirAlta(escenario);
    assert.deepEqual(escenario.peticiones.slice(antes).map((peticion) => peticion.url), ['/conexiones']);
    assert.equal(opcionesConexion(escenario).length, CONEXIONES.length + 1, 'the retry fills the dropdown');
    assert.equal(nodo(escenario, 'auto-aviso').hidden, true);
    assert.equal(banner.hidden, true);
  });

  // ---- CH-21c PR2c: the template picker (spec `query-console`, DEC-131) -------------

  /** Spec "Known label" and "Unknown label": a card per template, described by its label. */
  test('CH-21c W1 one text-only card per template, described by its label, with a neutral fallback', async () => {
    const escenario = await arrancar();
    const neutra = 'Plantilla del catálogo, sin descripción en la consola.';
    const catalogo = [
      { id: 'p-f', nombre: 'Alerta de stock físico', automatizacion: 'stock-fisico', toleranciaFrescuraMinutos: 60 },
      { id: 'p-p', nombre: 'Alerta de stock producible', automatizacion: 'stock-producible', toleranciaFrescuraMinutos: 120 },
      { id: 'p-o', nombre: 'Reporte <b>diario</b>', automatizacion: 'otra' },
      { id: 'p-c', nombre: 'Constructor', automatizacion: 'constructor' },
      // The elegirTenant fixture's shape: no automatizacion at all.
      { id: 'p-1', nombre: 'Stock diario' },
    ];
    await elegirTenant(escenario, [], [automatizacion()], 't-1', catalogo);
    // An unknown label does not stop the load: the list after the catalog still renders.
    assert.equal(filasDe(escenario, 'auto-lista', 'automatizacion').length, 1);

    const cartas = tarjetas(escenario);
    assert.equal(nodo(escenario, 'auto-plantilla').hijos.length, catalogo.length, 'nothing but the cards');
    assert.deepEqual(
      cartas.map((tarjeta) => [tarjeta.tagName, ...tarjeta.hijos.map((hijo) => hijo.tagName + '.' + hijo.className)]),
      catalogo.map(() => ['label', 'input.', 'span.zd-template__name', 'span.zd-template__desc', 'span.motivo-plantilla']),
      'name and description only (no icon, tolerance or check mark), plus the reason slot of PR4',
    );
    assert.deepEqual(
      cartas.map((tarjeta) => [tarjeta.hijos[1].textContent, tarjeta.hijos[2].textContent]),
      [
        ['Alerta de stock físico', 'Avisa cuando un producto queda por debajo del mínimo.'],
        ['Alerta de stock producible', 'Avisa cuando los insumos no alcanzan para producir.'],
        ['Reporte <b>diario</b>', neutra],
        ['Constructor', neutra],
        ['Stock diario', neutra],
      ],
    );
    assert.ok(cartas.every((tarjeta) => tarjeta.hijos.every((hijo) => hijo.hijos.length === 0)), 'text only');
    assert.ok(!cartas.some((tarjeta) => /60|120/.test(tarjeta.textContent)), 'no tolerance on the card');
    // One radio group: the same name on every input, so the browser's arrow keys move the choice.
    assert.deepEqual(
      cartas.map(radioDe).map((radio) => [radio.type, radio.name, radio.value, radio.checked]),
      catalogo.map((fila) => ['radio', 'auto-plantilla-opcion', fila.id, false]),
    );
  });

  /** Spec "Parameters of the chosen template"; design PR2c W8: of two choices in flight, the later wins. */
  test('CH-21c W8 the later card wins over an earlier detail still in flight, and its id is what is sent', async () => {
    const escenario = await arrancar();
    const catalogo = [{ id: 'p-1', nombre: 'Primera' }, { id: 'p-2', nombre: 'Segunda' }];
    await elegirTenant(escenario, [], [automatizacion()], 't-1', catalogo);
    await abrirAlta(escenario);
    const antes = escenario.peticiones.length;
    let responderPrimera!: (cuerpo: unknown) => void;
    let responderSegunda!: (cuerpo: unknown) => void;
    escenario.respuestas.push(
      { status: 200, cuerpo: new Promise((resolver) => { responderPrimera = resolver; }) },
      { status: 200, cuerpo: new Promise((resolver) => { responderSegunda = resolver; }) },
    );
    elegirTarjeta(escenario, 'p-1');
    await asentar();
    elegirTarjeta(escenario, 'p-2');
    await asentar();
    assert.deepEqual(
      escenario.peticiones.slice(antes).map((peticion) => [peticion.url, peticion.tenant]),
      [['/plantillas/p-1', 't-1'], ['/plantillas/p-2', 't-1']],
    );

    // The later answer lands first, the earlier one after it: the earlier is dropped.
    const controles = (): number => nodo(escenario, 'auto-valores').porClase('parametro-valor').length;
    responderSegunda({ plantilla: { parametros: [{ nombre: 'segunda', tipo: 'texto' }] } });
    await asentar();
    responderPrimera({ plantilla: { parametros: [{ nombre: 'a', tipo: 'texto' }, { nombre: 'b', tipo: 'texto' }] } });
    await asentar();
    assert.equal(controles(), 1, "only Segunda's one control");
    assert.match(nodo(escenario, 'auto-valores').textContent, /segunda/);
    assert.deepEqual(tarjetas(escenario).map((tarjeta) => radioDe(tarjeta).checked), [false, true]);

    // The detail is kept for this wizard: choosing Primera again asks for nothing.
    const pedidas = escenario.peticiones.length;
    elegirTarjeta(escenario, 'p-1');
    await asentar();
    assert.equal(escenario.peticiones.length, pedidas, 'answered from the cache');
    assert.equal(controles(), 2);
    elegirTarjeta(escenario, 'p-2');
    await asentar();

    await elegirConexion(escenario, 'c-1');
    nodo(escenario, 'auto-siguiente').disparar('click');
    assert.deepEqual(pasoVisible(escenario), [2, 2]);
    assert.match(nodo(escenario, 'auto-resumen').textContent, /^Plantilla: Segunda · /);
    nodo(escenario, 'auto-valores').porClase('parametro-valor')[0].value = 'x';
    fijarHorario(escenario, 'diaria', '06:00');
    escenario.respuestas.push({ status: 201, cuerpo: { automatizacion: automatizacion() } });
    await enviar(escenario, { automatizaciones: [automatizacion()], truncado: false }, 200, 'auto-crear', 'click');
    assert.deepEqual(escenario.peticiones[escenario.peticiones.length - 2].cuerpo, {
      plantillaId: 'p-2',
      conexionId: 'c-1',
      valores: { segunda: 'x' },
      cron: '0 6 * * *',
    });
  });

  // ---- CH-21c PR3: the step-2 schedule (spec `query-console`, DEC-129) --------------

  const ZONA_DESPLIEGUE = 'en la zona horaria configurada del despliegue';

  /** Design H1, the table CH-23 reuses: frequency, hour, the cron sent, the sentence's days. */
  const VECTORES_HORARIO: Array<[string, string, string, string]> = [
    ['diaria', '08:30', '30 8 * * *', 'Todos los días'],
    ['lun-vie', '08:30', '30 8 * * 1-5', 'De lunes a viernes'],
    ['lun-sab', '08:30', '30 8 * * 1-6', 'De lunes a sábado'],
    ['diaria', '00:00', '0 0 * * *', 'Todos los días'],
    ['lun-vie', '23:59', '59 23 * * 1-5', 'De lunes a viernes'],
    ['diaria', '07:05', '5 7 * * *', 'Todos los días'],
  ];

  /** Crear with a 500 queued: the wizard stays on step 2, and the body sent is returned. */
  async function crearSinCerrar(escenario: Escenario): Promise<Record<string, unknown>> {
    await enviar(escenario, { error: 'otro' }, 500, 'auto-crear', 'click');
    return ultimoCuerpo(escenario);
  }

  /** Spec "Preset vectors" and "Cron field shows the translation read-only". */
  test('CH-21c H1 each preset sends its cron, shown read-only, and the server accepts it', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    await avanzar(escenario);
    for (const [frecuencia, hora, cron, dias] of VECTORES_HORARIO) {
      fijarHorario(escenario, frecuencia, hora);
      const campo = nodo(escenario, 'auto-cron');
      assert.deepEqual([campo.value, campo.readOnly, campo.hidden], [cron, true, false], frecuencia + ' ' + hora);
      // Before creation the zone is not named: the browser cannot know it (DEC-129).
      assert.equal(nodo(escenario, 'auto-horario-texto').textContent, dias + ' a las ' + hora + ', ' + ZONA_DESPLIEGUE + '.');
      assert.ok(cronValido(cron, 'UTC'), cron + ' is standard cron for the server');
      const cuerpo = await crearSinCerrar(escenario);
      assert.deepEqual(Object.keys(cuerpo).sort(), ['conexionId', 'cron', 'plantillaId', 'valores']);
      assert.equal(cuerpo.cron, cron);
    }
    // Crear reads the hour again instead of trusting the last event: a value changed with
    // no event still decides the cron sent.
    nodo(escenario, 'auto-hora').value = '21:15';
    assert.equal((await crearSinCerrar(escenario)).cron, '15 21 * * *');
  });

  /** Spec "Personalizado makes the cron field editable and passes through". */
  test('CH-21c H2 personalizado makes the cron field editable and sends it unchanged', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    await avanzar(escenario);
    fijarHorario(escenario, 'lun-vie', '09:45');
    nodo(escenario, 'auto-frecuencia').value = 'personalizado';
    nodo(escenario, 'auto-frecuencia').disparar('change');
    // The preset's cron stays as a starting point, and the hour no longer applies.
    const estado = (): unknown[] => [nodo(escenario, 'auto-cron').value, nodo(escenario, 'auto-cron').readOnly,
      nodo(escenario, 'auto-hora').disabled];
    assert.deepEqual(estado(), ['45 9 * * 1-5', false, true]);
    assert.equal(nodo(escenario, 'auto-horario-texto').textContent,
      'Expresión cron estándar de cinco campos, ' + ZONA_DESPLIEGUE + '. Se valida al crear.');
    for (const cron of ['30 7 * * 1', '0 */2 * * *']) {
      fijarHorario(escenario, 'personalizado', cron);
      assert.deepEqual(await crearSinCerrar(escenario), { plantillaId: 'p-1', conexionId: 'c-1', valores: {}, cron });
      assert.equal(nodo(escenario, 'auto-cron').value, cron, 'Crear does not rewrite it');
    }
    // Back to a preset: read-only again, with the translation of the hour.
    fijarHorario(escenario, 'lun-sab', '10:00');
    assert.deepEqual(estado(), ['0 10 * * 1-6', true, false]);
  });

  /** Spec "Invalid hour": the time control is not trusted, every character is checked. */
  test('CH-21c H3 an invalid hour empties the cron, says so, and Crear sends nothing', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    await avanzar(escenario);
    const presets = ['diaria', 'lun-vie', 'lun-sab'];
    // The last two parse as numbers (' 8', '-1'), so only the per-character check refuses them.
    for (const [i, hora] of ['24:00', '8:30', '08:60', 'ab:cd', '', '08:30:00', ' 8:30', '-1:30'].entries()) {
      fijarHorario(escenario, presets[i % presets.length], hora);
      assert.equal(nodo(escenario, 'auto-cron').value, '', JSON.stringify(hora));
      assert.equal(nodo(escenario, 'auto-horario-texto').textContent, 'Elegí una hora válida (HH:MM, 24 horas).');
      const pedidas = escenario.peticiones.length;
      nodo(escenario, 'auto-crear').disparar('click');
      await asentar();
      assert.equal(escenario.peticiones.length, pedidas, 'no request for ' + JSON.stringify(hora));
      assert.equal(nodo(escenario, 'banner').textContent, 'La hora no es válida. Escribí HH:MM en 24 horas, por ejemplo 08:30.');
      assert.deepEqual(pasoVisible(escenario), [2, 2]);
      assert.equal(nodo(escenario, 'auto-crear').disabled, false, 'Crear stays usable');
    }
  });

  /** Spec "Success banner shows first run and zone"; design H4 and H5 (a 201 without the fields). */
  test('CH-21c H4 H5 the 201 banner states the first run in the server zone, or the old sentence', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    const creada = 'Se creó la automatización y ya aparece en la lista.';
    const programada = ' Primera ejecución programada: ';
    const garantia = '. Es un horario, no una garantía: si el servicio no está en marcha a esa hora, esa ejecución no se recupera.';
    const instante = '2026-10-06T11:30:00.000Z';
    const casos: Array<[Record<string, unknown>, string]> = [
      [{ proximaEjecucion: instante, zonaHoraria: 'America/Argentina/Buenos_Aires' },
        creada + programada + '06/10/2026 08:30, zona horaria America/Argentina/Buenos_Aires' + garantia],
      // A zone the browser cannot resolve: the server's instant is shown as it came.
      [{ proximaEjecucion: instante, zonaHoraria: 'Zona/Inexistente' },
        creada + programada + instante + ', zona horaria Zona/Inexistente' + garantia],
      [{}, creada],
    ];
    for (const [extra, texto] of casos) {
      await abrirAlta(escenario);
      await avanzar(escenario);
      escenario.respuestas.push({ status: 201, cuerpo: { automatizacion: automatizacion(), ...extra } });
      await enviar(escenario, { automatizaciones: [automatizacion()], truncado: false }, 200, 'auto-crear', 'click');
      const banner = nodo(escenario, 'banner');
      assert.deepEqual([banner.className, banner.textContent], ['banner exito', texto]);
      assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    }
  });

  /** Spec "Tenant switch wipes the wizard" (schedule half); design H6. */
  test('CH-21c H6 a tenant switch puts the schedule back to every day at 08:00, read-only', async () => {
    const escenario = await arrancar([
      { id: 't-1', nombre: 'Food Store' },
      { id: 't-2', nombre: 'Otra tienda' },
    ]);
    await elegirTenant(escenario, [], [], 't-1');
    await abrirAlta(escenario);
    await avanzar(escenario);
    fijarHorario(escenario, 'personalizado', '5 4 * * 0');

    await elegirTenant(escenario, [], [], 't-2');
    assert.deepEqual(
      [nodo(escenario, 'auto-frecuencia').value, nodo(escenario, 'auto-hora').value, nodo(escenario, 'auto-cron').value,
        nodo(escenario, 'auto-cron').readOnly, nodo(escenario, 'auto-hora').disabled],
      ['diaria', '08:00', '0 8 * * *', true, false],
    );
    assert.equal(nodo(escenario, 'auto-horario-texto').textContent, 'Todos los días a las 08:00, ' + ZONA_DESPLIEGUE + '.');
  });

  // ---- CH-21c PR4: templates the chosen connection cannot run (spec `query-console`, DEC-127) ----

  const AVISO_SIN_SONDEO = 'No se pudo verificar el mapeo de esta conexión. Las plantillas quedan habilitadas; la compuerta de vistas se aplica igual en cada ejecución.';
  const CATALOGO_FISICO = [{ id: 'p-1', nombre: 'Stock físico', automatizacion: 'stock-fisico' }];

  /** The reason under a card, '' while it is hidden. */
  function motivoDe(tarjeta: Nodo): string {
    const motivo = tarjeta.porClase('motivo-plantilla')[0];
    return motivo.hidden ? '' : motivo.textContent;
  }

  /** Chooses a connection with p-1 not yet read: the probe answers `informe`, then p-1's detail answers `entidades`. */
  async function sondear(escenario: Escenario, entidades: string[], informe: unknown, conexion = 'c-1'): Promise<void> {
    escenario.respuestas.push(
      { status: 200, cuerpo: informe },
      { status: 200, cuerpo: { plantilla: { parametros: [], entidades } } },
    );
    nodo(escenario, 'auto-conexion').value = conexion;
    nodo(escenario, 'auto-conexion').disparar('change');
    await asentar();
  }

  /** Shared vectors: the console's mirror must agree with the server's `evaluarVistas` on each. */
  const VECTORES_DISPONIBILIDAD: Array<[string, string[], Record<string, string>]> = [
    ['all valid', ['producto', 'insumo'], { producto: 'valida', insumo: 'valida' }],
    ['no-mapeada', ['producto', 'pedido'], { producto: 'valida' }],
    ['no-validado', ['producto', 'pedido'], { producto: 'valida', pedido: 'no-validado' }],
    ['invalida', ['pedido'], { pedido: 'invalida' }],
    ['DEC-127 stock-fisico without receta_componente', ['producto', 'receta_componente'], { producto: 'valida' }],
    ['several at once', ['producto', 'pedido', 'insumo'], { producto: 'valida', pedido: 'no-validado', insumo: 'invalida' }],
  ];

  /** Spec "Template with a non-valid entity is disabled" and "Template with all entities valid stays enabled". */
  test('CH-21c V1 a card is enabled exactly when the server gate would pass, naming the same entities', async () => {
    for (const [vector, entidades, estados] of VECTORES_DISPONIBILIDAD) {
      const escenario = await arrancar();
      await elegirTenant(escenario, [], [], 't-1', CATALOGO_FISICO);
      await abrirAlta(escenario);
      // The report's M4 block calls stock-fisico applicable whatever receta_componente says: ignored.
      const informe = informeDe(estados);
      const m4 = [{ automatizacion: 'stock-fisico', estado: 'aplicable', motivos: [] }];
      await sondear(escenario, entidades, { validacionMapeo: { ...informe.validacionMapeo, automatizaciones: m4 } });

      const filas = Object.entries(estados)
        .filter(([, estado]) => estado !== 'no-mapeada')
        .map(([entidad, estadoValidacion]) => ({ entidad, sql: 'SELECT 1', estadoValidacion }));
      const compuerta = evaluarVistas(entidades, filas);
      const tarjeta = tarjetas(escenario)[0];
      assert.equal(radioDe(tarjeta).disabled, !compuerta.ok, vector);
      const bloqueadas = compuerta.ok ? [] : compuerta.entidades.map((fila) => fila.entidad);
      assert.deepEqual(entidades.filter((e) => motivoDe(tarjeta).includes(e)), entidades.filter((e) => bloqueadas.includes(e)), vector);
      assert.equal(motivoDe(tarjeta) === '', compuerta.ok, vector + ': a reason only on a disabled card');
      assert.equal(nodo(escenario, 'auto-aviso').hidden, true, vector + ': nothing left to say');
    }
  });

  /** Spec "Template with a non-valid entity is disabled": the reason is plain words, never a state code. */
  test('CH-21c V2 the reason uses the legible words and never a raw state code', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [], 't-1', CATALOGO_FISICO);
    await abrirAlta(escenario);
    const informe = informeDe({ producto: 'valida', pedido: 'no-validado', insumo: 'invalida' });
    await sondear(escenario, ['producto', 'pedido', 'insumo', 'receta_componente'], informe);

    const motivo = motivoDe(tarjetas(escenario)[0]);
    assert.equal(motivo, 'No disponible con esta conexión: pedido (vista sin validar), insumo (la validación de la vista falló), '
      + 'receta_componente (sin vista registrada). Cada ejecución se frenaría antes de conectar.');
    for (const codigo of ['no-mapeada', 'no-validado', 'invalida']) {
      assert.ok(!motivo.includes(codigo), codigo + ' stays out of the text');
    }
  });

  /** Spec "Template with a non-valid entity is disabled"; design V3. */
  test('CH-21c V3 a chosen template that becomes unavailable is deselected with its values and Siguiente', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [], 't-1', CATALOGO_FISICO);
    await abrirAlta(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { parametros: [{ nombre: 'n', tipo: 'numero' }], entidades: ['producto', 'pedido'] } } });
    elegirTarjeta(escenario, 'p-1');
    await asentar();
    assert.equal(nodo(escenario, 'auto-valores').porClase('parametro-valor').length, 1);

    await elegirConexion(escenario, 'c-1', informeDe({ producto: 'valida', pedido: 'no-validado' }));
    const radio = radioDe(tarjetas(escenario)[0]);
    assert.deepEqual([radio.disabled, radio.checked], [true, false]);
    assert.equal(nodo(escenario, 'auto-valores').hijos.length, 0, 'its value controls are gone');
    assert.equal(nodo(escenario, 'auto-siguiente').disabled, true);
    nodo(escenario, 'auto-siguiente').disparar('click');
    assert.deepEqual(pasoVisible(escenario), [1, 1], 'a connection and no template does not advance');

    // A connection that can run it frees the card again; its detail is read from the cache.
    const pedidas = escenario.peticiones.length;
    await elegirConexion(escenario, 'c-2');
    assert.deepEqual([radio.disabled, motivoDe(tarjetas(escenario)[0])], [false, '']);
    elegirTarjeta(escenario, 'p-1');
    await asentar();
    assert.equal(escenario.peticiones.length, pedidas + 1, 'only the second probe');
    assert.equal(nodo(escenario, 'auto-siguiente').disabled, false);
  });

  /** Spec "Late validation response is discarded". */
  test('CH-21c V4 a probe answered after another connection was chosen is discarded', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [], 't-1', CATALOGO_FISICO);
    await abrirAlta(escenario);
    const antes = escenario.peticiones.length;
    let responder!: (cuerpo: unknown) => void;
    escenario.respuestas.push({ status: 200, cuerpo: new Promise((resolver) => { responder = resolver; }) });
    nodo(escenario, 'auto-conexion').value = 'c-1';
    nodo(escenario, 'auto-conexion').disparar('change');
    await asentar();
    assert.equal(nodo(escenario, 'auto-aviso').textContent, 'Verificando las vistas canónicas de la conexión elegida…');

    await sondear(escenario, ['producto'], TODO_VALIDO, 'c-2');
    responder(informeDe({ producto: 'no-validado' }));
    await asentar();
    const tarjeta = tarjetas(escenario)[0];
    assert.deepEqual([radioDe(tarjeta).disabled, motivoDe(tarjeta)], [false, ''], "c-1's report is not applied");
    assert.equal(nodo(escenario, 'auto-aviso').hidden, true);
    assert.deepEqual(
      escenario.peticiones.slice(antes).map((peticion) => peticion.url),
      ['/conexiones/c-1/validacion-mapeo', '/conexiones/c-2/validacion-mapeo', '/plantillas/p-1'],
    );
  });

  /** Spec "Validation fetch fails": every card stays enabled and the notice says why. */
  test('CH-21c V5 a failed, unreadable or incomplete probe leaves every card enabled with the notice', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [], 't-1', CATALOGO_FISICO);
    const noEsJson = { then: (_: unknown, rechazar: (error: Error) => void): void => rechazar(new Error('no es JSON')) };
    const casos: Array<[string, Array<{ status: number; cuerpo: unknown }>]> = [
      ['HTTP 500', [{ status: 500, cuerpo: { error: 'x' } }]],
      ['not JSON', [{ status: 200, cuerpo: noEsJson }]],
      ['no report in the body', [{ status: 200, cuerpo: {} }]],
      ['a template detail fails', [{ status: 200, cuerpo: TODO_VALIDO }, { status: 500, cuerpo: { error: 'x' } }]],
    ];
    for (const [caso, respuestas] of casos) {
      await abrirAlta(escenario);
      escenario.respuestas.push(...respuestas);
      nodo(escenario, 'auto-conexion').value = 'c-1';
      nodo(escenario, 'auto-conexion').disparar('change');
      await asentar();
      const tarjeta = tarjetas(escenario)[0];
      assert.deepEqual([radioDe(tarjeta).disabled, motivoDe(tarjeta)], [false, ''], caso);
      assert.deepEqual([nodo(escenario, 'auto-aviso').hidden, nodo(escenario, 'auto-aviso').textContent], [false, AVISO_SIN_SONDEO], caso);
      nodo(escenario, 'auto-cancelar').disparar('click');
    }
  });

  /** Spec "Late response after a tenant switch is ignored" (validation half). */
  test('CH-21c V6 a probe answered after a tenant switch is dropped without asking for anything more', async () => {
    const escenario = await arrancar([
      { id: 't-1', nombre: 'Food Store' },
      { id: 't-2', nombre: 'Otra tienda' },
    ]);
    await elegirTenant(escenario, [], [], 't-1', CATALOGO_FISICO);
    await abrirAlta(escenario);
    let responder!: (cuerpo: unknown) => void;
    escenario.respuestas.push({ status: 200, cuerpo: new Promise((resolver) => { responder = resolver; }) });
    nodo(escenario, 'auto-conexion').value = 'c-1';
    nodo(escenario, 'auto-conexion').disparar('change');
    await asentar();

    const antes = escenario.peticiones.length;
    await elegirTenant(escenario, [], [], 't-2', CATALOGO_FISICO);
    await abrirAlta(escenario);
    responder(informeDe({ producto: 'no-validado' }));
    await asentar();
    assert.deepEqual(
      escenario.peticiones.slice(antes).map((peticion) => peticion.url),
      ['/consultas-guardadas', '/plantillas', '/automatizaciones', '/conexiones'],
      "A's probe asks for no template detail",
    );
    const tarjeta = tarjetas(escenario)[0];
    assert.deepEqual([radioDe(tarjeta).disabled, motivoDe(tarjeta)], [false, '']);
    assert.equal(nodo(escenario, 'auto-aviso').hidden, true);
    assert.equal(nodo(escenario, 'banner').hidden, true);
  });

  /** The probe is advisory: creation after it failed sends the same body as before CH-21c. */
  test('CH-21c V7 creating after a failed probe sends the unchanged body', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    await elegirPlantillaAlta(escenario);
    await elegirConexion(escenario, 'c-1', { error: 'x' }, 500);
    assert.equal(nodo(escenario, 'auto-aviso').textContent, AVISO_SIN_SONDEO);
    assert.equal(nodo(escenario, 'auto-siguiente').disabled, false);
    nodo(escenario, 'auto-siguiente').disparar('click');
    fijarHorario(escenario, 'diaria', '06:00');
    assert.deepEqual(await crearSinCerrar(escenario), { plantillaId: 'p-1', conexionId: 'c-1', valores: {}, cron: '0 6 * * *' });
  });

  /** Spec "Notification outcomes are legible" and "Send failure visible as failure". */
  test('CH-14 6.5 the runs view labels every notification outcome and explains a failed send', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    const base = { corte: null, codigoError: null, error: null, iniciadaEn: 'i', finalizadaEn: 'f', duracionMs: 1, filas: 3, fase: 'ejecucion', estado: 'ok' };
    const categorias = ['tiempo-agotado', 'servidor-inalcanzable', 'credenciales-invalidas', 'envio-rechazado', 'error-desconocido'];
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        ejecuciones: [
          { ...base, id: 'e-1', notificacion: 'enviada' },
          { ...base, id: 'e-2', notificacion: 'omitida-sin-filas', filas: 0 },
          { ...base, id: 'e-3', notificacion: 'sin-destinatario' },
          { ...base, id: 'e-4', notificacion: 'no-configurada' },
          { ...base, id: 'e-5', notificacion: null },
          { ...base, id: 'e-6', notificacion: 'algo-desconocido' },
          ...categorias.map((error, i) => ({
            ...base, id: `f-${i}`, estado: 'fallo', fase: 'notificacion', filas: 12, error,
            codigoError: error === 'envio-rechazado' ? '550' : null, notificacion: 'fallo-envio',
          })),
        ],
        truncado: false,
      },
    });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ver-ejecuciones')[0].disparar('click');
    await asentar();

    const encabezados = (escenario.nodos.get('auto-ejecuciones') as Nodo).hijos[0].textContent;
    assert.ok(encabezados.includes('Notificación'), encabezados);
    const corridas = filasDe(escenario, 'auto-ejecuciones', 'ejecucion');
    assert.equal(corridas.length, 11);
    assert.deepEqual(
      corridas.slice(0, 6).map((fila) => fila.hijos[5].textContent),
      ['Enviada', 'No enviada: sin filas', 'Sin destinatario', 'Correo no configurado', '—', '—'],
    );
    const fallidas = corridas.slice(6);
    const mensajes = new Set<string>();
    for (const [i, fila] of fallidas.entries()) {
      const celdas = fila.hijos.map((celda) => celda.textContent);
      assert.deepEqual(celdas.slice(3, 6), ['12', 'fallo', 'Falló el envío'], categorias[i]);
      assert.ok(celdas[6].length > 0, `${categorias[i]} has a message`);
      assert.ok(!celdas[6].includes(categorias[i]), `${categorias[i]} is translated`);
      assert.ok(!celdas[6].includes('SQLSTATE'), 'an SMTP reply code is not a SQLSTATE');
      mensajes.add(celdas[6]);
    }
    assert.equal(mensajes.size, categorias.length, 'one distinct message per category');
    assert.match(fallidas[3].hijos[6].textContent, /código SMTP 550/);
    assert.ok(!corridas.some((fila) => fila.textContent.includes('null')), 'null never reaches the page');
  });

  /**
   * CH-18 spec `query-console` (DEC-108): a pending send and an interrupted one are
   * labelled, and a timed-out send never claims the email was not sent.
   */
  test('CH-18 2.12 the runs view labels enviando and incierta, and a timed-out send may have been delivered', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    const base = { corte: null, codigoError: null, error: null, iniciadaEn: 'i', finalizadaEn: 'f', duracionMs: 1, filas: 3, fase: 'ejecucion' };
    const categorias = ['tiempo-agotado', 'servidor-inalcanzable', 'credenciales-invalidas', 'envio-rechazado', 'error-desconocido'];
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        ejecuciones: [
          { ...base, id: 'e-1', estado: 'en-curso', finalizadaEn: null, duracionMs: null, filas: null, fase: null, notificacion: 'enviando' },
          { ...base, id: 'e-2', estado: 'fallo', error: 'interrumpida', duracionMs: null, filas: null, fase: null, notificacion: 'incierta' },
          ...categorias.map((error, i) => ({
            ...base, id: `f-${i}`, estado: 'fallo', fase: 'notificacion', error, notificacion: 'fallo-envio',
          })),
        ],
        truncado: false,
      },
    });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ver-ejecuciones')[0].disparar('click');
    await asentar();

    const [enviando, incierta, ...fallidas] = filasDe(escenario, 'auto-ejecuciones', 'ejecucion')
      .map((fila) => fila.hijos.map((celda) => celda.textContent));
    assert.equal(enviando[5], 'Envío en curso');
    assert.equal(incierta[5], 'Sin confirmar: puede haberse entregado');
    assert.match(incierta[6], /^La corrida se interrumpió por un reinicio del servicio/);

    const [tiempo, ...otras] = fallidas.map((celdas) => celdas[6]);
    assert.match(tiempo, /puede haberse entregado/);
    assert.ok(!tiempo.includes('no se envió'), 'a timed-out send is not claimed undelivered');
    // The other four send failures keep their CH-14 copy.
    assert.deepEqual(otras, [
      'No se pudo conectar con el servidor de correo configurado. La consulta se ejecutó, pero el correo no se envió.',
      'El servidor de correo rechazó las credenciales configuradas. La consulta se ejecutó, pero el correo no se envió.',
      'El servidor de correo rechazó el mensaje o el destinatario. La consulta se ejecutó, pero el correo no se envió.',
      'El envío del correo falló por un motivo no reconocido. La consulta se ejecutó, pero el correo no se envió.',
    ]);
    assert.equal(new Set([tiempo, ...otras]).size, categorias.length, 'one distinct message per category');

    const texto = [enviando, incierta, ...fallidas].flat().join('\n');
    for (const crudo of ['enviando', 'incierta', 'interrumpida', 'fallo-envio', 'null', ...categorias]) {
      assert.ok(!texto.includes(crudo), crudo);
    }
    // The page is one template literal: a backtick in any string would end it.
    assert.ok(!documento.includes(String.fromCharCode(96)), 'no backtick in the served page');
  });

  /** CH-17a spec `query-console`: an overlap skip and an interrupted run are legible. */
  test('CH-17a 2.4 the runs view labels omitida and explains solapamiento and interrumpida', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    const base = { corte: null, codigoError: null, fase: null, duracionMs: null, filas: null, notificacion: null, iniciadaEn: 'i' };
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        ejecuciones: [
          { ...base, id: 'e-1', estado: 'omitida', error: 'solapamiento', finalizadaEn: 'i' },
          { ...base, id: 'e-2', estado: 'fallo', error: 'interrumpida', finalizadaEn: 'arranque' },
          { ...base, id: 'e-3', estado: 'otro-estado', error: 'otro-error', finalizadaEn: null },
        ],
        truncado: false,
      },
    });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ver-ejecuciones')[0].disparar('click');
    await asentar();

    const [omitida, interrumpida, desconocida] = filasDe(escenario, 'auto-ejecuciones', 'ejecucion')
      .map((fila) => fila.hijos.map((celda) => celda.textContent));
    assert.deepEqual(omitida.slice(0, 6), ['i', 'i', '—', '—', 'Omitida', '—']);
    assert.match(omitida[6], /^No se ejecutó: la corrida anterior .* seguía en curso\.$/);
    // A failed status stays as it is; only the error is translated.
    assert.deepEqual(interrumpida.slice(0, 6), ['i', 'arranque', '—', '—', 'fallo', '—']);
    assert.match(interrumpida[6], /^La corrida se interrumpió por un reinicio del servicio/);
    // Values the console does not know still render, raw estado and generic message.
    assert.deepEqual(desconocida.slice(1, 5), ['—', '—', '—', 'otro-estado']);
    assert.match(desconocida[6], /no pudo identificar el motivo/);
    const texto = [...omitida, ...interrumpida, ...desconocida].join('\n');
    for (const crudo of ['solapamiento', 'interrumpida', 'otro-error', 'null']) {
      assert.ok(!texto.includes(crudo), crudo);
    }
  });

  /** CH-17b spec `query-console` "Attempts are shown, null is a placeholder" (DEC-103). */
  test('CH-17b 3.3 the runs view shows intentos last; null and absent are the placeholder', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    const base = { corte: null, codigoError: null, error: null, fase: 'ejecucion', notificacion: null, iniciadaEn: 'i', finalizadaEn: 'f', duracionMs: 1, filas: 3 };
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        ejecuciones: [
          { ...base, id: 'e-1', estado: 'ok', intentos: 3 },
          { ...base, id: 'e-2', estado: 'ok', intentos: 1 },
          { ...base, id: 'e-3', estado: 'omitida', error: 'solapamiento', fase: null, filas: null, intentos: null },
          { ...base, id: 'e-4', estado: 'ok' },
        ],
        truncado: false,
      },
    });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ver-ejecuciones')[0].disparar('click');
    await asentar();

    const encabezados = (escenario.nodos.get('auto-ejecuciones') as Nodo).hijos[0].hijos[0].hijos;
    assert.deepEqual(encabezados.slice(5).map((celda) => celda.textContent), ['Notificación', 'Error', 'Intentos']);
    const corridas = filasDe(escenario, 'auto-ejecuciones', 'ejecucion').map((fila) => fila.hijos.map((c) => c.textContent));
    assert.deepEqual(corridas.map((celdas) => celdas.length), [8, 8, 8, 8]);
    assert.deepEqual(corridas.map((celdas) => celdas[7]), ['3', '1', '—', '—']);
    assert.match(corridas[2][6], /^No se ejecutó: la corrida anterior/, 'Error stays in its column');
    assert.ok(!corridas.flat().some((texto) => texto.includes('null') || texto === 'undefined'));
  });

  /** Spec "Switching tenant updates the automations view" (T4, DEC-15). */
  test('switching tenant clears the runs and reloads the list for the new tenant only', async () => {
    const escenario = await arrancar([
      { id: 't-1', nombre: 'Food Store' },
      { id: 't-2', nombre: 'Otra tienda' },
    ]);
    await elegirTenant(escenario, [], [automatizacion({ conexionId: 'c-A' })], 't-1');
    escenario.respuestas.push({ status: 200, cuerpo: { ejecuciones: [{ id: 'e-1', estado: 'ok' }], truncado: false } });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ver-ejecuciones')[0].disparar('click');
    await asentar();
    assert.equal(filasDe(escenario, 'auto-ejecuciones', 'ejecucion').length, 1);

    await elegirTenant(escenario, [], [automatizacion({ id: 'b-1', conexionId: 'c-B' })], 't-2');

    const filas = filasDe(escenario, 'auto-lista', 'automatizacion');
    assert.equal(filas.length, 1);
    assert.ok(filas[0].textContent.includes('c-B'));
    assert.ok(!filas[0].textContent.includes('c-A'), 'the previous tenant row is gone');
    assert.equal((escenario.nodos.get('auto-ejecuciones') as Nodo).hijos.length, 0, 'the old runs are wiped');
    // Every call went through pedir(): each carries the tenant that was active when sent.
    const llamadas = escenario.peticiones.filter((peticion) => peticion.url !== '/tenants');
    assert.ok(llamadas.every((peticion) => peticion.tenant !== null));
    assert.equal(llamadas[llamadas.length - 1].url, '/automatizaciones');
    assert.equal(llamadas[llamadas.length - 1].tenant, 't-2');
  });

  // ---- CH-21c PR5: the email preview (spec `query-console`, DEC-131) ----------------

  /** Opens the wizard on step 2 for a one-template catalog of the given name and label. */
  async function vistaPrevia(nombre: string, etiqueta: string | undefined): Promise<Escenario> {
    const escenario = await arrancar();
    const fila: Record<string, unknown> = { id: 'p-1', nombre };
    if (etiqueta !== undefined) { fila.automatizacion = etiqueta; }
    await elegirTenant(escenario, [], [], 't-1', [fila]);
    await abrirAlta(escenario);
    await avanzar(escenario);
    return escenario;
  }

  const ETIQUETAS_VISTA = ['stock-fisico', 'stock-producible', 'reporte-diario', 'otra', 'constructor'];

  /** Spec "Preview parity with the server subject"; design E1 and E2. */
  test('CH-21c E1 the preview subject and accent equal the server composer for every label', async () => {
    for (const etiqueta of ETIQUETAS_VISTA) {
      for (const nombre of ['Alerta de stock', 'Reporte diario (Sur) 2']) {
        const escenario = await vistaPrevia(nombre, etiqueta);
        const esperado = asuntoCorreo({ nombre, automatizacion: etiqueta, filas: 0, hayMas: false }).replace(/ \(0\)$/, ' (n)');
        assert.equal(nodo(escenario, 'auto-vista-asunto').textContent, esperado, etiqueta + ' subject');
        const correo = componerCorreo({ nombre, automatizacion: etiqueta, columnas: ['a'], filas: [['x']], hayMas: false, fecha: new Date(0), zona: 'UTC' });
        const neutros = ['#f3f4f6', '#ffffff', '#f9fafb'];
        const acentos = [...correo.html.matchAll(/background:(#[0-9a-f]{6})/gi)].map((m) => m[1]).filter((c) => !neutros.includes(c));
        assert.equal(acentos.length, 1, 'the server html carries exactly one accent');
        const acento = acentos[0];
        assert.equal(nodo(escenario, 'auto-vista-titulo').style.backgroundColor, acento, etiqueta + ' accent');
        assert.equal(nodo(escenario, 'auto-vista-titulo').textContent, nombre);
      }
    }
  });

  /** Design E1: a catalog row with no label at all gets the neutral theme, never a throw. */
  test('CH-21c E1 a template without a label previews with the neutral theme', async () => {
    const escenario = await vistaPrevia('Sin etiqueta', undefined);
    assert.equal(nodo(escenario, 'auto-vista-asunto').textContent, 'Sin etiqueta (n)');
    assert.equal(nodo(escenario, 'auto-vista-titulo').style.backgroundColor, '#6b7280');
  });

  /** The recipient line follows the input, and says so when there is none. */
  test('CH-21c E1 the recipient line follows the input and explains the empty case', async () => {
    const escenario = await vistaPrevia('Alerta', 'stock-fisico');
    assert.equal(nodo(escenario, 'auto-vista-para').textContent, 'sin destinatario: la ejecución no envía correo');
    nodo(escenario, 'auto-destinatario').value = ' ops@example.com ';
    nodo(escenario, 'auto-destinatario').disparar('input');
    assert.equal(nodo(escenario, 'auto-vista-para').textContent, 'ops@example.com');
    nodo(escenario, 'auto-destinatario').value = '   ';
    nodo(escenario, 'auto-destinatario').disparar('input');
    assert.equal(nodo(escenario, 'auto-vista-para').textContent, 'sin destinatario: la ejecución no envía correo');
  });

  /** Spec "Script hazards stay out of the page"; design E3. */
  test('CH-21c E3 a hostile template name is shown verbatim as text and no hazard enters the page', async () => {
    const hostil = '<img src=x onerror=alert(1)>';
    const escenario = await vistaPrevia(hostil, 'stock-fisico');
    assert.ok(nodo(escenario, 'auto-vista-asunto').textContent.includes(hostil));
    assert.equal(nodo(escenario, 'auto-vista-titulo').textContent, hostil);
    assert.ok(!documento.includes('inner' + 'HTML'));
    assert.ok(!documento.includes('src' + 'doc'));
  });

  /** Spec "Preview is text-only and read-only"; design E4. */
  test('CH-21c E4 the preview holds no row content and its footer is the server footer', async () => {
    const escenario = await vistaPrevia('Alerta', 'stock-fisico');
    for (const id of ['auto-vista-asunto', 'auto-vista-para', 'auto-vista-titulo']) {
      assert.equal(nodo(escenario, id).hijos.length, 0, id + ' is a text node holder only');
    }
    const pie = 'Enviado automáticamente por ZeroDashboard.';
    assert.ok(documento.includes(pie));
    const correo = componerCorreo({ nombre: 'x', automatizacion: 'otra', columnas: [], filas: [], hayMas: false, fecha: new Date(0), zona: 'UTC' });
    assert.ok(correo.texto.includes(pie), 'the same string as the server text part');
    assert.match(documento, /role="group" aria-label="Vista previa del correo"/);
  });

  // ---- CH-24: the freshness section (spec `data-freshness`, DEC-142 to DEC-145) ------

  interface FilaTenantFrescura {
    id: string;
    nombre: string;
    ventanaDesactualizacionMinutos?: number | null;
    replicaActualizadaEn?: string | null;
  }

  /** Boots the console and selects the tenant, with a catalog whose tolerances are given. */
  async function conFrescura(
    tenant: Omit<FilaTenantFrescura, 'id' | 'nombre'>,
    tolerancias: number[] = [],
  ): Promise<Escenario> {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store', ...tenant }] as never);
    await elegirTenant(
      escenario,
      [],
      [],
      't-1',
      tolerancias.map((toleranciaFrescuraMinutos, i) => ({ id: `p-${i}`, nombre: `Plantilla ${i}`, toleranciaFrescuraMinutos })),
    );
    return escenario;
  }

  /** The text of every cell of the freshness table body, row by row. */
  function tablaFrescura(escenario: Escenario): string[][] {
    const cuerpo = (nodo(escenario, 'fresc-plantillas').hijos.find((hijo) => hijo.tagName === 'tbody') as Nodo | undefined);
    return (cuerpo?.hijos ?? []).map((fila) => fila.hijos.map((celda) => celda.textContent));
  }

  /** The same vectors as `src/frescura.test.ts`: window, tolerance, label shown. */
  const VECTORES_FRESCURA: Array<[number | null, number, string]> = [
    [null, 60, 'Sin declarar'],
    [0, 0, 'Al día'],
    [60, 60, 'Al día'],
    [61, 60, 'Desactualizada'],
    [180, 120, 'Desactualizada'],
    [30, 120, 'Al día'],
  ];

  test('CH-24 the section markup keeps its ids once, starts disabled and every button is type="button"', () => {
    verificarIds(marcado());
    const seccion = marcado().slice(marcado().indexOf('id="frescura"'));
    for (const id of ['fresc-guardar', 'fresc-marcar']) {
      assert.match(seccion, new RegExp('<button id="' + id + '"[^>]*type="button"[^>]*disabled'), id);
    }
    assert.match(seccion, /<input id="fresc-minutos"[^>]*type="text"/, 'a text control: a number control would hide invalid input');
    assert.ok(seccion.includes('Frescura de datos'));
  });

  test('CH-24 with no active tenant the section says so and offers no action', async () => {
    const escenario = await arrancar();
    assert.equal(nodo(escenario, 'fresc-ventana').textContent, 'Elegí un tenant para ver su frescura.');
    for (const id of ['fresc-minutos', 'fresc-guardar', 'fresc-marcar']) {
      assert.equal(nodo(escenario, id).disabled, true, id);
    }
    assert.equal(tablaFrescura(escenario).length, 0);
  });

  test('CH-24 each shared vector shows its label with an icon and a word, never a color alone', async () => {
    for (const [ventana, tolerancia, etiqueta] of VECTORES_FRESCURA) {
      const escenario = await conFrescura({ ventanaDesactualizacionMinutos: ventana }, [tolerancia]);
      assert.deepEqual(tablaFrescura(escenario), [['Plantilla 0', String(tolerancia), etiqueta]], `${ventana} contra ${tolerancia}`);
      const insignia = (nodo(escenario, 'fresc-plantillas').hijos[1].hijos[0].hijos[2]).hijos[0];
      assert.equal(insignia.hijos[0].tagName, 'svg', 'an icon');
      assert.equal(insignia.hijos[1].textContent, etiqueta, 'and the word');
    }
  });

  test('CH-24 an undeclared tenant reads "Sin declarar" for the window and the refresh', async () => {
    const escenario = await conFrescura({ ventanaDesactualizacionMinutos: null, replicaActualizadaEn: null }, [60]);
    assert.equal(nodo(escenario, 'fresc-ventana').textContent, 'Ventana de desactualización: Sin declarar.');
    assert.equal(nodo(escenario, 'fresc-actualizada').textContent, 'Última actualización de la réplica: Sin declarar.');
    assert.equal(nodo(escenario, 'fresc-minutos').value, '');
    assert.equal(nodo(escenario, 'fresc-guardar').disabled, false);
  });

  test('CH-24 the last refresh reads as relative time', async () => {
    const hace = (milisegundos: number): string => new Date(Date.now() - milisegundos).toISOString();
    const casos: Array<[number, string]> = [
      [5 * 1000, 'hace unos segundos'],
      [12 * 60 * 1000, 'hace 12 min'],
      [(3 * 60 + 10) * 60 * 1000, 'hace 3 h 10 min'],
      [2 * 60 * 60 * 1000, 'hace 2 h'],
      [3 * 24 * 60 * 60 * 1000, 'hace 3 d'],
      [-60 * 60 * 1000, 'hace unos segundos'],
    ];
    for (const [antes, esperado] of casos) {
      const escenario = await conFrescura({ ventanaDesactualizacionMinutos: 60, replicaActualizadaEn: hace(antes) });
      assert.equal(nodo(escenario, 'fresc-actualizada').textContent, `Última actualización de la réplica: ${esperado}.`, esperado);
    }
  });

  test('CH-24 saving a window sends exactly { ventanaMinutos } and redraws from the answer', async () => {
    const escenario = await conFrescura({ ventanaDesactualizacionMinutos: 30 }, [60]);
    nodo(escenario, 'fresc-minutos').value = ' 90 ';
    await enviar(escenario, { tenant: { id: 't-1', nombre: 'Food Store', ventanaDesactualizacionMinutos: 90, replicaActualizadaEn: null } }, 200, 'fresc-guardar', 'click');
    const peticion = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(peticion.url, '/tenants/t-1/frescura');
    assert.deepEqual(peticion.cuerpo, { ventanaMinutos: 90 });
    assert.equal(nodo(escenario, 'fresc-ventana').textContent, 'Ventana de desactualización: 90 min.');
    assert.deepEqual(tablaFrescura(escenario), [['Plantilla 0', '60', 'Desactualizada']]);
    assert.equal(nodo(escenario, 'fresc-aviso').textContent, 'Guardado.');
  });

  test('CH-24 an empty field clears the window; text that is not digits goes up as typed', async () => {
    const escenario = await conFrescura({ ventanaDesactualizacionMinutos: 30 });
    nodo(escenario, 'fresc-minutos').value = '';
    await enviar(escenario, { tenant: { id: 't-1', nombre: 'Food Store', ventanaDesactualizacionMinutos: null } }, 200, 'fresc-guardar', 'click');
    assert.deepEqual(ultimoCuerpo(escenario), { ventanaMinutos: null });
    assert.equal(nodo(escenario, 'fresc-ventana').textContent, 'Ventana de desactualización: Sin declarar.');

    // Never silently turned into "clear": the server refuses these and says why.
    for (const escrito of ['abc', '-5', '1.5', '1e3']) {
      nodo(escenario, 'fresc-minutos').value = escrito;
      await enviar(escenario, { error: 'solicitud-invalida', campos: ['/ventanaMinutos'] }, 400, 'fresc-guardar', 'click');
      assert.deepEqual(ultimoCuerpo(escenario), { ventanaMinutos: escrito }, escrito);
    }
  });

  test('CH-24 a 400 keeps the previous declaration on screen and explains the rule', async () => {
    const escenario = await conFrescura({ ventanaDesactualizacionMinutos: 45 }, [60]);
    nodo(escenario, 'fresc-minutos').value = '999999999';
    await enviar(escenario, { error: 'solicitud-invalida', campos: ['/ventanaMinutos'] }, 400, 'fresc-guardar', 'click');
    assert.equal(nodo(escenario, 'fresc-ventana').textContent, 'Ventana de desactualización: 45 min.');
    assert.match(nodo(escenario, 'fresc-aviso').textContent, /número entero de minutos, entre 0 y 525600/);
    assert.deepEqual(tablaFrescura(escenario), [['Plantilla 0', '60', 'Al día']]);
    assert.equal(nodo(escenario, 'fresc-guardar').disabled, false, 'the operator can retry');
  });

  test('CH-24 marking the replica refreshed sends exactly { actualizadaAhora: true }', async () => {
    const escenario = await conFrescura({ ventanaDesactualizacionMinutos: 60, replicaActualizadaEn: null });
    await enviar(escenario, { tenant: { id: 't-1', nombre: 'Food Store', ventanaDesactualizacionMinutos: 60, replicaActualizadaEn: new Date().toISOString() } }, 200, 'fresc-marcar', 'click');
    assert.deepEqual(ultimoCuerpo(escenario), { actualizadaAhora: true });
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].tenant, 't-1');
    assert.equal(nodo(escenario, 'fresc-actualizada').textContent, 'Última actualización de la réplica: hace unos segundos.');
  });

  test('CH-24 a tenant that is gone or deactivated shows the tenant message and reloads the list', async () => {
    const escenario = await conFrescura({ ventanaDesactualizacionMinutos: 60 });
    // Queue order is request order: the refused PUT first, then the reload of GET /tenants
    // the refusal triggers, which answers the list without that tenant.
    escenario.respuestas.push(
      { status: 409, cuerpo: { error: 'tenant-desactivado' } },
      { status: 200, cuerpo: { tenants: [] } },
    );
    nodo(escenario, 'fresc-guardar').disparar('click');
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      await new Promise((resolver) => setImmediate(resolver));
    }
    // The refusal banner is followed by the reload's own "ya no está activo" notice, as for any tenant.
    assert.match(nodo(escenario, 'banner').textContent, /ya no está activo/);
    assert.equal(nodo(escenario, 'fresc-ventana').textContent, 'Elegí un tenant para ver su frescura.');
  });

  test('CH-24 a hostile template name is shown as text and the script assigns no shared class or markup', async () => {
    const hostil = '<img src=x onerror=alert(1)>';
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store', ventanaDesactualizacionMinutos: 10 }] as never);
    await elegirTenant(escenario, [], [], 't-1', [{ id: 'p-1', nombre: hostil, toleranciaFrescuraMinutos: 5 }]);
    assert.deepEqual(tablaFrescura(escenario)[0].slice(0, 2), [hostil, '5']);
    assert.ok(!script.includes('inner' + 'HTML'));
    assert.ok(!/zd-[\w-]+/.test(script.slice(script.indexOf('--- Freshness (CH-24'))), 'the section assigns no shared class');
  });

  // ---- CH-25: the versions panel (spec `query-console`, DEC-146 to DEC-150) ----------

  const FILA_GUARDADA = { id: 'q-1', nombre: 'Stock', descripcion: null, creadaEn: '2026-10-01T10:00:00.000Z', actualizadaEn: '2026-10-03T10:00:00.000Z' };

  /** Descendants of `raiz` for which `condicion` holds, in document order. */
  function buscar(raiz: Nodo, condicion: (nodo: Nodo) => boolean): Nodo[] {
    return [...(condicion(raiz) ? [raiz] : []), ...raiz.hijos.flatMap((hijo) => buscar(hijo, condicion))];
  }
  const botonesCon = (raiz: Nodo, texto: string): Nodo[] => buscar(raiz, (n) => n.tagName === 'button' && n.textContent === texto);
  const asentarVarias = async (): Promise<void> => {
    for (let vuelta = 0; vuelta < 5; vuelta++) await new Promise((resolver) => setImmediate(resolver));
  };

  const version = (numero: number, esActual: boolean, nota: string | null = null) => ({
    version: numero,
    fecha: `2026-10-0${numero}T10:00:00.000Z`,
    nota,
    esActual,
  });
  /** Boots, selects the tenant with one saved query listed. */
  async function conConsulta(): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario, [FILA_GUARDADA]);
    return escenario;
  }

  /** Opens the panel of the one saved query, answering the history request with `versiones`. */
  async function abrirPanel(escenario: Escenario, versiones: unknown[], truncado = false): Promise<void> {
    escenario.respuestas.push({ status: 200, cuerpo: { versiones, truncado } });
    botonesCon(nodo(escenario, 'guardadas'), 'Versiones')[0].disparar('click');
    await asentarVarias();
  }

  const TRES_VERSIONES = [version(3, true, 'Agrega filtro'), version(2, false), version(1, false)];

  test('CH-25 the panel markup starts closed, keeps its ids once and every button is type="button"', () => {
    verificarIds(marcado());
    assert.match(marcado(), /<div id="versiones" hidden>/);
    const seccion = marcado().slice(marcado().indexOf('id="guardado"'), marcado().indexOf('id="automatizaciones"'));
    const botones = seccion.match(/<button[^>]*>/g) ?? [];
    assert.ok(botones.length >= 2, 'Guardar consulta and Cerrar versiones');
    assert.ok(botones.every((etiqueta) => etiqueta.includes('type="button"')), 'no button submits');
  });

  test('CH-25 each saved query offers a Versiones action next to Cargar', async () => {
    const escenario = await conConsulta();
    const lista = nodo(escenario, 'guardadas');
    assert.equal(botonesCon(lista, 'Cargar').length, 1);
    assert.equal(botonesCon(lista, 'Versiones').length, 1);
  });

  test('CH-25 opening shows loading at once, then the rows newest first with Vigente as icon and word', async () => {
    const escenario = await conConsulta();
    escenario.respuestas.push({ status: 200, cuerpo: { versiones: TRES_VERSIONES, truncado: false } });
    botonesCon(nodo(escenario, 'guardadas'), 'Versiones')[0].disparar('click');
    assert.equal(nodo(escenario, 'versiones').hidden, false);
    assert.equal(nodo(escenario, 'versiones-estado').textContent, 'Cargando versiones…');
    await asentarVarias();

    const peticion = escenario.peticiones[escenario.peticiones.length - 1];
    assert.deepEqual([peticion.url, peticion.tenant], ['/consultas-guardadas/q-1/versiones', 't-1']);
    assert.equal(nodo(escenario, 'versiones-titulo').textContent, 'Versiones de «Stock»');
    const filas = nodo(escenario, 'versiones-lista').hijos;
    assert.equal(filas.length, 3);
    assert.deepEqual(filas.map((f) => f.hijos[0].textContent), ['Versión 3', 'Versión 2', 'Versión 1']);
    assert.ok(filas[0].textContent.includes('Agrega filtro'), 'the note is shown');
    const insignia = buscar(filas[0], (n) => n.className === 'version-vigente');
    assert.equal(insignia.length, 1, 'only the newest is current');
    assert.equal(insignia[0].hijos[0].tagName, 'svg', 'an icon');
    assert.equal(insignia[0].hijos[1].textContent, 'Vigente', 'and the word');
    assert.equal(nodo(escenario, 'versiones-estado').textContent, '');
  });

  test('CH-25 a query with one version says so', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, [version(1, true)]);
    assert.equal(nodo(escenario, 'versiones-estado').textContent, 'Esta es la versión inicial.');
    assert.equal(buscar(nodo(escenario, 'versiones-lista'), (n) => n.tagName === 'button').length, 0);
  });

  test('CH-25 a capped history is announced', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, TRES_VERSIONES, true);
    assert.equal(nodo(escenario, 'versiones-estado').textContent, 'Se muestran solo las 3 versiones más recientes.');
  });

  test('CH-25 a failed history request shows the reason and no rows', async () => {
    const escenario = await conConsulta();
    escenario.respuestas.push({ status: 404, cuerpo: { error: 'consulta-guardada-no-encontrada' } });
    escenario.respuestas.push({ status: 200, cuerpo: { consultasGuardadas: [], truncado: false } });
    botonesCon(nodo(escenario, 'guardadas'), 'Versiones')[0].disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'versiones-estado').textContent, 'Esa consulta guardada ya no existe. Se actualizó la lista.');
    assert.equal(nodo(escenario, 'versiones-lista').hijos.length, 0);

    const otra = await conConsulta();
    otra.respuestas.push({ status: 500, cuerpo: { error: 'interno' } });
    botonesCon(nodo(otra, 'guardadas'), 'Versiones')[0].disparar('click');
    await asentarVarias();
    assert.equal(nodo(otra, 'versiones-estado').textContent, 'La aplicación respondió HTTP 500.');
  });

  test('CH-25 switching tenant closes the panel and clears every row of the previous tenant', async () => {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    await elegirTenant(escenario, [FILA_GUARDADA]);
    await abrirPanel(escenario, TRES_VERSIONES);
    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(nodo(escenario, 'versiones').hidden, true);
    assert.equal(nodo(escenario, 'versiones-lista').hijos.length, 0);
    assert.equal(nodo(escenario, 'versiones-titulo').textContent, '');
  });

  test('CH-25 Cerrar versiones hides the panel, and a response that arrives afterwards is dropped', async () => {
    const escenario = await conConsulta();
    escenario.respuestas.push({ status: 200, cuerpo: { versiones: TRES_VERSIONES, truncado: false } });
    botonesCon(nodo(escenario, 'guardadas'), 'Versiones')[0].disparar('click');
    nodo(escenario, 'versiones-cerrar').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'versiones').hidden, true);
    assert.equal(nodo(escenario, 'versiones-lista').hijos.length, 0, 'the late answer did not repaint a closed panel');
  });
});
