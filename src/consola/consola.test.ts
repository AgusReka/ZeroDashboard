import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { cronValido } from '../automatizaciones/automatizaciones.js';
import { jsonEnScript, registerConsolaRoute } from './consola.js';
import { CONTRATO_CANONICO } from '../contrato/contrato.js';
import { EJEMPLOS_MAPEO } from './mapeo-ejemplos.js';
import { asuntoCorreo, componerCorreo } from '../automatizaciones/correo.js';
import { RUTAS_ESTILOS } from '../compartido/estilos-rutas.js';
import { evaluarVistas, FORMATOS, VALORES_AUTOMATIZACION } from '../plantillas/plantillas.js';
import { ENTIDADES_CANONICAS } from '../mapeo/vistas-canonicas.js';

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

/** The stub event the fake nodes hand to a listener; CH-32a PR2 adds `key` for the pop-up's Escape. */
interface EventoFalso {
  preventDefault: () => void;
  key?: string;
}

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
  private oyentes = new Map<string, Array<(evento: EventoFalso) => void>>();

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

  addEventListener(tipo: string, fn: (evento: EventoFalso) => void): void {
    const lista = this.oyentes.get(tipo) ?? [];
    lista.push(fn);
    this.oyentes.set(tipo, lista);
  }

  /** Test-side only: fires what `addEventListener` registered, with a stub event (`extra` adds fields such as `key`). */
  disparar(tipo: string, extra: Partial<EventoFalso> = {}): void {
    const eventoFalso: EventoFalso = { preventDefault: () => {}, ...extra };
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
  // CH-29 (DEC-154): the operator's name and the logout button in the tenant bar.
  'operador',
  'salir',
  // CH-30a (DEC-164, DEC-165): the three screens and their navigation links.
  // CH-30b (DEC-165): the Tenants screen and its controls.
  'pantalla-tenants',
  'nav-tenants',
  'tenant-alta',
  'tenant-nombre',
  'tenant-aviso',
  'tenants-cuerpo',
  // CH-30b: the Conexiones screen, its side panel and its controls.
  'pantalla-conexiones',
  'nav-conexiones',
  'conexion-nueva',
  'conexiones-aviso',
  'conexiones-cuerpo',
  'conexion-alta',
  'cx-nombre',
  'cx-host',
  'cx-puerto',
  'cx-base',
  'cx-usuario',
  'cx-clave',
  'cx-resultado',
  // CH-30c: the Agentes screen, its secret notice and the panel's agent option.
  'pantalla-agentes',
  'nav-agentes',
  'agentes-aviso',
  'agente-estado',
  'agente-secreto',
  'agente-secreto-valor',
  'agente-copiar',
  'agente-guardado',
  'cx-via',
  // CH-30c: the Usuarios del panel screen and its secret notice.
  'pantalla-usuarios',
  'nav-usuarios',
  'usuarios-aviso',
  'usuario-alta',
  'usuario-correo',
  'usuario-nombre',
  'usuario-secreto',
  'usuario-secreto-valor',
  'usuario-copiar',
  'usuario-guardado',
  'usuarios-cuerpo',
  // CH-30d: the Plantillas and Contrato screens.
  'pantalla-plantillas',
  'nav-plantillas',
  'plantillas-aviso',
  'plantillas-cuerpo',
  'plantilla-panel',
  'plantilla-titulo',
  'plantilla-entidades',
  'plantilla-parametros',
  'plantilla-sql',
  'plantilla-cerrar',
  // CH-35 (DEC-177): the «Probar en el tenant activo» block of the template panel.
  'plantilla-prueba',
  'plantilla-prueba-titulo',
  'plantilla-prueba-conexion',
  'plantilla-prueba-valores',
  'plantilla-probar',
  'plantilla-prueba-aviso',
  'plantilla-prueba-tabla',
  // CH-38 (DEC-191): the header action, the drawer's client texts and actions, and the template pop-up.
  'plantilla-nueva',
  'plantilla-textos',
  'plantilla-mensaje',
  'plantilla-en-uso-aviso',
  'plantilla-editar',
  'plantilla-duplicar',
  'plantilla-dialogo',
  'plantilla-dialogo-titulo',
  'plantilla-form',
  'plantilla-f-nombre',
  'plantilla-f-sql',
  'plantilla-f-parametros',
  'plantilla-f-agregar-parametro',
  'plantilla-f-entidades',
  'plantilla-f-automatizacion',
  'plantilla-f-formato',
  'plantilla-f-tolerancia',
  'plantilla-f-titulo',
  'plantilla-f-descripcion',
  'plantilla-f-encabezado',
  'plantilla-f-linea',
  'plantilla-f-aviso-copia',
  'plantilla-f-conexion',
  'plantilla-f-valores',
  'plantilla-f-probar',
  'plantilla-f-resultado',
  'plantilla-f-tabla',
  'plantilla-dialogo-estado',
  'plantilla-confirmar',
  'plantilla-descartar',
  'plantilla-seguir',
  'plantilla-dialogo-duplicar',
  'plantilla-dialogo-guardar',
  'plantilla-dialogo-cancelar',
  'pantalla-contrato',
  'nav-contrato',
  'contrato-aviso',
  'contrato-cuerpo',
  // CH-30d: the Mapeo y validación screen.
  'pantalla-mapeo',
  'nav-mapeo',
  'mapeo-conexion',
  'mapeo-validar',
  'mapeo-aviso',
  // CH-34 (DEC-176): the collapsible «Cómo mapear» guide above the entities.
  'mapeo-guia',
  'mapeo-entidades',
  'mapeo-automatizaciones',
  'pantalla-consultas',
  'pantalla-automatizaciones',
  'pantalla-frescura',
  'nav-consultas',
  'nav-automatizaciones',
  'nav-frescura',
  // CH-30e1 (DEC-163): the Auditoría screen, its filters and its table.
  'pantalla-auditoria',
  'nav-auditoria',
  'aud-desde',
  'aud-hasta',
  'aud-resultado',
  'aud-filtrar',
  'auditoria-aviso',
  'auditoria-cuerpo',
  // CH-30e2 (DEC-178): the Tiempos de alta screen, its notice and its blocks.
  'pantalla-tiempos',
  'nav-tiempos',
  'tiempos-aviso',
  'tiempos-lista',
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
  'versiones-comparacion',
  'versiones-cerrar',
  // CH-25: saving the editor as a new version of the loaded query.
  'version-guardar',
  'version-cargada',
  'version-nota',
  'version-boton',
  // CH-32a (DEC-172): the connection picker and the "Consulta nueva" action.
  'conexion-aviso',
  'conexion-reintentar',
  'consulta-nueva',
  'consulta-nueva-confirmar',
  'consulta-nueva-descartar',
  'consulta-nueva-cancelar',
  // CH-32a PR2 (DEC-173): the query pop-up, its title, its cancel button and the version-only fields.
  'consulta-dialogo',
  'consulta-dialogo-titulo',
  'consulta-cancelar',
  'guardado-ayuda',
  'version-campos',
  // CH-32b (DEC-173): the «Nuevo tenant» and «Nuevo usuario» pop-ups, each with its opener, title, status line,
  // unsaved-changes strip and buttons.
  'tenant-nuevo',
  'tenant-dialogo',
  'auto-ajuste',
  'aj-titulo',
  'aj-resumen',
  'aj-valores',
  'aj-frecuencia',
  'aj-hora',
  'aj-horario-texto',
  'aj-cron',
  'aj-destinatario',
  'aj-aviso',
  'aj-confirmar',
  'aj-descartar',
  'aj-seguir',
  'aj-guardar',
  'aj-cancelar',
  'tenant-baja',
  'tb-titulo',
  'tb-texto',
  'tb-nombre',
  'tb-aviso',
  'tb-confirmar',
  'tb-dar-de-baja',
  'tb-cancelar',
  'tenant-dialogo-titulo',
  'tenant-dialogo-aviso',
  'tenant-confirmar',
  'tenant-descartar',
  'tenant-seguir',
  'tenant-crear-elegir',
  'tenant-cancelar',
  'usuario-nuevo',
  'usuario-dialogo',
  'usuario-dialogo-titulo',
  'usuario-dialogo-aviso',
  'usuario-confirmar',
  'usuario-descartar',
  'usuario-seguir',
  'usuario-cancelar',
  // CH-32b: the «Nueva conexión» pop-up, which replaces the side panel (its title, Cancelar and strip are new).
  'conexion-dialogo',
  'conexion-dialogo-titulo',
  'cx-cancelar',
  'conexion-confirmar',
  'conexion-descartar',
  'conexion-seguir',
  // CH-32b: the wizard pop-up (#auto-alta is its backdrop): title, step-2 Cancelar, status line and strip.
  'auto-dialogo-titulo',
  'auto-cancelar-2',
  'auto-dialogo-aviso',
  'auto-confirmar',
  'auto-descartar',
  'auto-seguir',
] as const;

/** The ids of the first PR2 version (strip and save side panel), replaced before merge: they must not come back. */
const IDS_RETIRADOS = ['consulta-franja', 'franja-sin-guardar', 'guardar-abrir', 'version-abrir', 'guardado-panel', 'guardado-titulo', 'guardado-cancelar', 'conexion-panel', 'titulo-conexion-nueva', 'cx-cerrar'];

/** CH-21c: the wizard nodes the markup starts hidden, so the fake starts them hidden too. */
const IDS_OCULTOS_ALTA = ['auto-alta', 'auto-paso-2', 'auto-aviso'];
/** Every node the markup starts hidden: the wizard's, plus CH-25's versions panel and save-as-version block, and CH-32a's retry button, query pop-up, confirmation and its version-only nodes. */
const IDS_OCULTOS = [...IDS_OCULTOS_ALTA, 'versiones', 'version-guardar', 'conexion-reintentar', 'consulta-dialogo', 'consulta-nueva-confirmar', 'version-campos', 'version-boton', 'pantalla-automatizaciones', 'pantalla-frescura', 'pantalla-auditoria', 'pantalla-tiempos', 'pantalla-tenants', 'pantalla-conexiones', 'pantalla-agentes', 'agente-secreto', 'pantalla-usuarios', 'usuario-secreto', 'pantalla-plantillas', 'plantilla-panel', 'pantalla-contrato', 'pantalla-mapeo', 'tenant-dialogo', 'tenant-confirmar', 'tenant-baja', 'tb-confirmar', 'auto-ajuste', 'aj-confirmar', 'usuario-dialogo', 'usuario-confirmar', 'conexion-dialogo', 'conexion-confirmar', 'auto-confirmar', 'plantilla-dialogo', 'plantilla-confirmar', 'plantilla-dialogo-duplicar', 'plantilla-f-aviso-copia', 'plantilla-editar', 'plantilla-duplicar', 'plantilla-en-uso-aviso'];

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
  /** Queued responses, consumed in order by the stubbed `fetch`; `falla` makes that call fail like a network error. */
  respuestas: Array<{ status: number; cuerpo: unknown; falla?: boolean }>;
  /** `tenant` is the `X-Tenant-Id` header the request carried, `null` when none. */
  peticiones: Array<{ url: string; cuerpo: unknown; tenant: string | null }>;
  /** CH-29: how many times the script reloaded the page (`window.location.reload()`). */
  recargas: number;
  /** CH-30a: the page's `location.hash`, and the window listeners the script registered. */
  ubicacion: { hash: string };
  oyentesVentana: Map<string, Array<() => void>>;
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
    // CH-32a: the empty-list notice is a sentence with a link inside it.
    createTextNode(texto: string): Nodo {
      const nodo = new Nodo('#text');
      nodo.textContent = texto;
      return nodo;
    },
    // CH-24: the state badge's icon is an SVG; the fake treats it as any other node.
    createElementNS(_espacio: string, tagName: string): Nodo {
      return new Nodo(tagName);
    },
  };

  const almacenamiento = new Map<string, string>();
  const ventana = {
    // CH-29: a 401 and the logout both reload, so the server serves the login screen.
    location: {
      get hash(): string {
        return escenario.ubicacion.hash;
      },
      reload: (): void => {
        escenario.recargas += 1;
      },
    },
    addEventListener: (tipo: string, fn: () => void): void => {
      const lista = escenario.oyentesVentana.get(tipo) ?? [];
      lista.push(fn);
      escenario.oyentesVentana.set(tipo, lista);
    },
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
    if (siguiente.falla === true) {
      throw new Error(`network failure for ${url}`);
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
    // CH-29: the resolver stands in for the session lookup; here there is always an operator.
    registerConsolaRoute(app, async () => ({ id: 'op-1', nombre: 'Ana' }));
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
  async function arrancar(
    tenants = [{ id: 't-1', nombre: 'Food Store' }],
    respuestaTenants: { status: number; cuerpo: unknown } = { status: 200, cuerpo: { tenants } },
    hash = '',
  ): Promise<Escenario> {
    const nodos = new Map<string, Nodo>();
    for (const id of IDS) {
      // CH-21c: auto-conexion is a select from PR2b; auto-plantilla is the card picker's div from PR2c;
      // auto-frecuencia is a select from PR3; conexion is one from CH-32a (DEC-172).
      const nodo = new Nodo(['tenant', 'auto-conexion', 'auto-frecuencia', 'cx-via', 'mapeo-conexion', 'conexion', 'plantilla-prueba-conexion', 'plantilla-f-automatizacion', 'plantilla-f-formato', 'plantilla-f-conexion'].includes(id) ? 'select' : 'div');
      nodo.id = id;
      nodo.hidden = IDS_OCULTOS.includes(id);
      nodos.set(id, nodo);
    }
    const escenario: Escenario = {
      nodos,
      encabezado: new Nodo('thead'),
      cuerpoTabla: new Nodo('tbody'),
      respuestas: [respuestaTenants],
      peticiones: [],
      recargas: 0,
      ubicacion: { hash },
      oyentesVentana: new Map(),
    };

    ejecutarConsola(script, escenario);
    // `cargarTenants()` is the script's last statement and is async; let it settle.
    await new Promise((resolver) => setImmediate(resolver));
    return escenario;
  }

  /**
   * Selects the tenant. Switching reloads the saved-query list, the connection picker
   * (CH-32a) and the template catalog and automations list (CH-13), in that request order.
   */
  async function elegirTenant(
    escenario: Escenario,
    guardadas: unknown[] = [],
    automatizaciones: unknown[] = [],
    id = 't-1',
    plantillas: unknown[] = [{ id: 'p-1', nombre: 'Stock diario' }],
    conexiones: unknown[] = [],
  ): Promise<void> {
    const selector = escenario.nodos.get('tenant') as Nodo;
    selector.value = id;
    escenario.respuestas.push(...respuestasDeTenant(guardadas, conexiones, plantillas, automatizaciones));
    selector.disparar('change');
    await new Promise((resolver) => setImmediate(resolver));
  }

  /**
   * What the automations screen loads with, in request order: the template catalog, the tenant's connections
   * (CH-32b: their names for the Conexión column) and the list. Every scenario that loads the screen queues it.
   */
  function respuestasAutomatizaciones(
    plantillas: unknown[],
    automatizaciones: unknown[],
    conexiones: unknown[] = [],
  ): Array<{ status: number; cuerpo: unknown }> {
    return [
      { status: 200, cuerpo: { plantillas, truncado: false } },
      { status: 200, cuerpo: { conexiones, truncado: false } },
      { status: 200, cuerpo: { automatizaciones, truncado: false } },
    ];
  }

  /** What a tenant switch asks for, in request order: saved queries, the query picker's connections, then the automations screen (which reads the connections again for their names). */
  function respuestasDeTenant(
    guardadas: unknown[] = [],
    conexiones: unknown[] = [],
    plantillas: unknown[] = [{ id: 'p-1', nombre: 'Stock diario' }],
    automatizaciones: unknown[] = [],
  ): Array<{ status: number; cuerpo: unknown }> {
    return [
      { status: 200, cuerpo: { consultasGuardadas: guardadas, truncado: false } },
      { status: 200, cuerpo: { conexiones, truncado: false } },
      ...respuestasAutomatizaciones(plantillas, automatizaciones, conexiones),
    ];
  }

  /** CH-32a: selects the tenant with one connection listed and chosen, so the form can execute. */
  async function elegirTenantYConexion(escenario: Escenario): Promise<void> {
    await elegirTenant(escenario, [], [], 't-1', undefined, [{ id: 'c-1', nombre: 'food-store' }]);
    (escenario.nodos.get('conexion') as Nodo).value = 'c-1';
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

  /**
   * Selects the tenant, chooses a connection (CH-32a: executing with none sends nothing) and
   * submits the form with `cuerpo` queued as the response.
   */
  async function ejecutarCon(
    escenario: Escenario,
    cuerpo: unknown,
    status = 200,
  ): Promise<void> {
    await elegirTenantYConexion(escenario);
    await enviar(escenario, cuerpo, status);
  }

  /**
   * CH-32a PR2 (DEC-173): saving needs a passing «Probar» of exactly what the form holds, so a test that
   * saves runs one first, after its last edit. The connection stays as chosen, or becomes c-1.
   */
  async function probarOk(escenario: Escenario): Promise<void> {
    const conexion = escenario.nodos.get('conexion') as Nodo;
    if (conexion.value === '') conexion.value = 'c-1';
    await enviar(escenario, respuestaOk());
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
    await elegirTenantYConexion(escenario);
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
    await elegirTenantYConexion(escenario);
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
    // CH-32a PR2: saving needs an ok «Probar» of this very declaration first.
    await probarOk(escenario);

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
    await elegirTenantYConexion(escenario);
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
    // CH-32a PR2: the gate opens on an ok «Probar» of this declaration; the refusal is the save's own.
    await probarOk(escenario);
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
    await elegirTenant(escenario, [], [automatizacion()], 't-1', undefined, [{ id: 'c-1', nombre: 'food-store' }]);

    const [fila] = filasDe(escenario, 'auto-lista', 'automatizacion');
    // CH-32b: the connection by its name (not its id) and the schedule in words, then the expression.
    for (const texto of ['Stock diario', 'food-store', 'Todos los días a las 06:00 0 6 * * *', 'activa']) {
      assert.ok(fila.textContent.includes(texto), texto);
    }
    assert.ok(!fila.textContent.includes('c-1'), 'the connection id is not shown');
    // DEC-79, DEC-174: an active automation is adjusted or deactivated; never deleted or reactivated.
    assert.deepEqual(botones(fila).map((nodo) => nodo.textContent), ['Ver ejecuciones', 'Ajustar', 'Desactivar']);

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

  // ---- CH-33 (DEC-174): «Ajustar» opens a pop-up prefilled from the stored automation --------------

  const PLANTILLA_AJUSTABLE = {
    id: 'p-1',
    nombre: 'Stock diario',
    parametros: [{ nombre: 'umbral', tipo: 'numero' }, { nombre: 'activo', tipo: 'booleano' }, { nombre: 'desde', tipo: 'fecha' }],
  };

  const AJUSTABLE = {
    ...automatizacion({ cron: '0 6 * * 1-5' }),
    valores: { umbral: 5, activo: true, viejo: 'ya no se declara' },
    destinatario: 'a@empresa.com',
  };

  const ajusteAbierto = (escenario: Escenario): boolean => !nodo(escenario, 'auto-ajuste').hidden;
  const controlesAjuste = (escenario: Escenario): Nodo[] => nodo(escenario, 'aj-valores').porClase('parametro-valor');

  /** Selects the tenant with one active automation listed, then presses its «Ajustar» with both reads answered. */
  async function abrirAjuste(
    escenario: Escenario,
    guardada: Record<string, unknown> = AJUSTABLE,
    plantilla: Record<string, unknown> = PLANTILLA_AJUSTABLE,
  ): Promise<void> {
    await elegirTenant(escenario, [], [automatizacion()], 't-1', undefined, [{ id: 'c-1', nombre: 'food-store' }]);
    escenario.respuestas.push(
      { status: 200, cuerpo: { automatizacion: guardada } },
      { status: 200, cuerpo: { plantilla } },
    );
    const [fila] = filasDe(escenario, 'auto-lista', 'automatizacion');
    fila.porClase('ajustar')[0].disparar('click');
    await asentarVarias();
  }

  /** Presses «Guardar ajustes» with `respuesta` (and, on a 200, the reloaded list) queued. */
  async function guardarAjuste(escenario: Escenario, respuesta: { status: number; cuerpo: unknown }): Promise<void> {
    escenario.respuestas.push(respuesta, { status: 200, cuerpo: { automatizaciones: [automatizacion()], truncado: false } });
    nodo(escenario, 'aj-guardar').disparar('click');
    await asentarVarias();
  }

  const envioDeAjuste = (escenario: Escenario) => escenario.peticiones.find((p) => p.url === '/automatizaciones/a-1/ajustes');

  test('CH-33 «Ajustar» is offered on active rows only', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion(), automatizacion({ id: 'a-2', activo: false })]);
    const [activa, desactivada] = filasDe(escenario, 'auto-lista', 'automatizacion');
    assert.equal(activa.porClase('ajustar').length, 1);
    assert.equal(desactivada.porClase('ajustar').length, 0);
    assert.equal(ajusteAbierto(escenario), false, 'closed at load');
  });

  test('CH-33 «Ajustar» reads the automation and its template, and opens prefilled', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario);

    const lecturas = escenario.peticiones.slice(-2);
    assert.deepEqual(lecturas.map((p) => [p.url, p.tenant]), [['/automatizaciones/a-1', 't-1'], ['/plantillas/p-1', 't-1']]);
    assert.equal(ajusteAbierto(escenario), true);
    assert.match(nodo(escenario, 'aj-resumen').textContent, /Stock diario/);
    assert.match(nodo(escenario, 'aj-resumen').textContent, /food-store/);
    // One control per parameter the template declares now: the stored key it no longer declares is gone.
    assert.deepEqual(controlesAjuste(escenario).map((control) => control.value), ['5', 'true', '']);
    assert.equal(nodo(escenario, 'aj-frecuencia').value, 'lun-vie');
    assert.equal(nodo(escenario, 'aj-hora').value, '06:00');
    assert.equal(nodo(escenario, 'aj-cron').value, '0 6 * * 1-5');
    assert.equal(nodo(escenario, 'aj-cron').readOnly, true);
    assert.equal(nodo(escenario, 'aj-destinatario').value, 'a@empresa.com');
    assert.equal(nodo(escenario, 'aj-confirmar').hidden, true);
  });

  test('CH-33 a custom cron opens on Personalizado, editable, and a recipient-less row opens blank', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario, { ...AJUSTABLE, cron: '*/30 8-18 * * *', destinatario: null });
    assert.equal(nodo(escenario, 'aj-frecuencia').value, 'personalizado');
    assert.equal(nodo(escenario, 'aj-cron').value, '*/30 8-18 * * *');
    assert.equal(nodo(escenario, 'aj-cron').readOnly, false);
    assert.equal(nodo(escenario, 'aj-destinatario').value, '');
  });

  test('CH-33 only the schedule is sent when only the hour changed; a 200 closes, says the next run and reloads', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario);
    nodo(escenario, 'aj-hora').value = '07:30';
    nodo(escenario, 'aj-hora').disparar('input');
    await guardarAjuste(escenario, {
      status: 200,
      cuerpo: { automatizacion: { ...AJUSTABLE, cron: '30 7 * * 1-5' }, proximaEjecucion: '2026-10-15T07:30:00.000Z', zonaHoraria: 'UTC' },
    });

    const envio = envioDeAjuste(escenario);
    assert.ok(envio, 'the adjust was sent');
    assert.equal(envio.tenant, 't-1');
    assert.deepEqual(envio.cuerpo, { cron: '30 7 * * 1-5' });
    assert.equal(ajusteAbierto(escenario), false);
    const banner = nodo(escenario, 'banner');
    assert.equal(banner.className, 'banner exito');
    assert.equal(banner.textContent, 'Se guardaron los ajustes. Próxima ejecución programada: 15/10/2026 07:30, zona horaria UTC.');
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/automatizaciones', 'the list is reloaded');
  });

  test('CH-33 a changed value sends the whole map of declared values; an emptied recipient is sent as null', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario);
    controlesAjuste(escenario)[0].value = '7';
    controlesAjuste(escenario)[0].disparar('input');
    nodo(escenario, 'aj-destinatario').value = '  ';
    nodo(escenario, 'aj-destinatario').disparar('input');
    await guardarAjuste(escenario, { status: 200, cuerpo: { automatizacion: AJUSTABLE } });
    assert.deepEqual(envioDeAjuste(escenario)?.cuerpo, { valores: { umbral: 7, activo: true }, destinatario: null });
    // A 200 without the next run keeps the first sentence only.
    assert.equal(nodo(escenario, 'banner').textContent, 'Se guardaron los ajustes.');
  });

  test('CH-33 with nothing changed «Guardar ajustes» sends nothing and says so inside', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario);
    const antes = escenario.peticiones.length;
    nodo(escenario, 'aj-guardar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(ajusteAbierto(escenario), true);
    assert.equal(nodo(escenario, 'aj-aviso').textContent, 'No hay cambios para guardar.');
  });

  test('CH-33 a 400 is told inside the pop-up naming the field, and it stays open with what was typed', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario);
    nodo(escenario, 'aj-destinatario').value = 'a@b.com, c@d.com';
    await guardarAjuste(escenario, { status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/destinatario'] } });
    assert.equal(ajusteAbierto(escenario), true);
    assert.match(nodo(escenario, 'aj-aviso').textContent, /El correo del destinatario no es válido/);
    assert.equal(nodo(escenario, 'aj-destinatario').value, 'a@b.com, c@d.com');
  });

  test('CH-33 a 409 for an automation deactivated meanwhile is told inside and the list is reloaded', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario);
    nodo(escenario, 'aj-hora').value = '09:00';
    await guardarAjuste(escenario, { status: 409, cuerpo: { error: 'automatizacion-desactivada' } });
    assert.equal(ajusteAbierto(escenario), true);
    assert.match(nodo(escenario, 'aj-aviso').textContent, /ya estaba desactivada/);
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/automatizaciones');
  });

  test('CH-33 a failed read opens nothing and says why on the page', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    escenario.respuestas.push({ status: 404, cuerpo: { error: 'automatizacion-no-encontrada' } }, { status: 200, cuerpo: { automatizaciones: [], truncado: false } });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ajustar')[0].disparar('click');
    await asentarVarias();
    assert.equal(ajusteAbierto(escenario), false);
    assert.match(nodo(escenario, 'banner').textContent, /ya no existe/);
  });

  for (const [forma, cancelar] of [
    ['Cancelar', (e: Escenario) => nodo(e, 'aj-cancelar').disparar('click')],
    ['Escape', (e: Escenario) => nodo(e, 'auto-ajuste').disparar('keydown', { key: 'Escape' })],
  ] as Array<[string, (e: Escenario) => void]>) {
    test(`CH-33 ${forma} on the adjust pop-up closes it at once when unchanged, and asks first when changed`, async () => {
      const escenario = await arrancar();
      await abrirAjuste(escenario);
      const antes = escenario.peticiones.length;
      cancelar(escenario);
      assert.equal(ajusteAbierto(escenario), false);

      await abrirAjuste(escenario);
      const despuesDeAbrir = escenario.peticiones.length;
      nodo(escenario, 'aj-destinatario').value = 'otro@empresa.com';
      cancelar(escenario);
      assert.equal(ajusteAbierto(escenario), true);
      assert.equal(nodo(escenario, 'aj-confirmar').hidden, false, 'asking');
      nodo(escenario, 'aj-seguir').disparar('click');
      assert.equal(nodo(escenario, 'aj-destinatario').value, 'otro@empresa.com');
      cancelar(escenario);
      nodo(escenario, 'aj-descartar').disparar('click');
      assert.equal(ajusteAbierto(escenario), false);
      assert.equal(escenario.peticiones.length, despuesDeAbrir, 'nothing was sent');
      assert.ok(antes <= despuesDeAbrir);
    });
  }

  test('CH-33 a tenant switch closes the adjust pop-up without asking', async () => {
    const escenario = await arrancar();
    await abrirAjuste(escenario);
    nodo(escenario, 'aj-destinatario').value = 'otro@empresa.com';
    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(ajusteAbierto(escenario), false);
    assert.equal(nodo(escenario, 'aj-confirmar').hidden, true);
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
   * Spec "Invalid recipient shown legibly" and "Server 400 shown inside the pop-up" (CH-32b).
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
    // CH-32b: the page banner is behind the pop-up, so the sentence is written inside it.
    const banner = nodo(escenario, 'auto-dialogo-aviso').textContent;
    assert.equal(nodo(escenario, 'banner').hidden, true);
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
    assert.equal(nodo(escenario, 'auto-nueva').hidden, false, 'the opener is in the page header and stays');
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
  test('CH-21c W6 a tenant switch hides and wipes the wizard, and the load adds only the picker request (CH-32a)', async () => {
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
      // CH-32a: the Consultas connection picker is one request added to the former three; CH-32b: the list's
      // connection names are another, between the catalog and the list.
      [['/consultas-guardadas', 't-2'], ['/conexiones', 't-2'], ['/plantillas', 't-2'], ['/conexiones', 't-2'], ['/automatizaciones', 't-2']],
    );
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(nodo(escenario, 'auto-confirmar').hidden, true);
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
    // CH-32b: a connection and a template are chosen, so Cancelar asks before it throws them away.
    assert.equal(nodo(escenario, 'auto-alta').hidden, false);
    assert.equal(nodo(escenario, 'auto-confirmar').hidden, false);
    nodo(escenario, 'auto-descartar').disparar('click');
    assert.equal(escenario.peticiones.length, pedidas, 'Cancelar sends nothing');
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(nodo(escenario, 'auto-confirmar').hidden, true);
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
    nodo(escenario, 'auto-descartar').disparar('click');
    assert.equal(nodo(escenario, 'auto-alta').hidden, true, 'Cancelar (a template is chosen: after asking) still closes it');
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
      catalogo.map(() => ['label', 'input.', 'span.zd-template__name', 'span.zd-template__desc', 'span.motivo-plantilla', 'span.aviso-frescura']),
      'name and description only (no icon, tolerance or check mark), plus the reason slot of PR4 and the CH-26 freshness slot',
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
      assert.equal(nodo(escenario, 'auto-dialogo-aviso').textContent, 'La hora no es válida. Escribí HH:MM en 24 horas, por ejemplo 08:30.');
      assert.equal(nodo(escenario, 'banner').hidden, true, 'the page banner is behind the pop-up');
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
      // CH-32a: the first /conexiones is the Consultas picker, asked on the tenant switch; CH-32b: the second is
      // the automations list's names; the last is the wizard's own.
      ['/consultas-guardadas', '/conexiones', '/plantillas', '/conexiones', '/automatizaciones', '/conexiones'],
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

  /** The same vectors as `src/tenants/frescura.test.ts`: window, tolerance, label shown. */
  const VECTORES_FRESCURA: Array<[number | null, number, string]> = [
    [null, 60, 'Sin declarar'],
    [0, 0, 'Al día'],
    [60, 60, 'Al día'],
    [61, 60, 'Desactualizada'],
    [180, 120, 'Desactualizada'],
    [30, 120, 'Al día'],
  ];

  // ---- CH-26 (DEC-180): the freshness warning on the wizard's template cards -------------

  /** The visible freshness warning of each card, '' when hidden, in catalog order. */
  function avisosFrescura(escenario: Escenario): string[] {
    return tarjetas(escenario).map((tarjeta) => {
      const aviso = tarjeta.porClase('aviso-frescura')[0];
      return aviso.hidden ? '' : aviso.textContent;
    });
  }

  const COLA_FRESCURA = '. Se puede crear igual: sus avisos pueden salir con datos más viejos de lo que necesita.';

  test('CH-26 a window above the tolerance warns on the card, naming both values, and the card stays selectable', async () => {
    const escenario = await conFrescura({ ventanaDesactualizacionMinutos: 180 }, [60, 120]);
    await abrirAlta(escenario);
    assert.deepEqual(avisosFrescura(escenario), [
      'La réplica de este tenant se actualiza cada 3 h y esta plantilla tolera 1 h' + COLA_FRESCURA,
      'La réplica de este tenant se actualiza cada 3 h y esta plantilla tolera 2 h' + COLA_FRESCURA,
    ]);
    assert.deepEqual(tarjetas(escenario).map((tarjeta) => radioDe(tarjeta).disabled), [false, false]);
  });

  test('CH-26 only the templates the window exceeds warn; equal, undeclared or missing tolerance say nothing', async () => {
    const noventa = await conFrescura({ ventanaDesactualizacionMinutos: 90 }, [60, 120, 90]);
    await abrirAlta(noventa);
    assert.deepEqual(avisosFrescura(noventa), [
      'La réplica de este tenant se actualiza cada 90 min y esta plantilla tolera 1 h' + COLA_FRESCURA, '', '',
    ]);
    const sinDeclarar = await conFrescura({ ventanaDesactualizacionMinutos: null }, [60]);
    await abrirAlta(sinDeclarar);
    assert.deepEqual(avisosFrescura(sinDeclarar), ['']);
    const sinTolerancia = await arrancar([{ id: 't-1', nombre: 'Food Store', ventanaDesactualizacionMinutos: 600 }] as never);
    await elegirTenant(sinTolerancia);
    await abrirAlta(sinTolerancia);
    assert.deepEqual(avisosFrescura(sinTolerancia), ['']);
  });

  test('CH-26 creating a warned template repeats the warning in the notice and sends the usual body', async () => {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store', ventanaDesactualizacionMinutos: 120 }] as never);
    await elegirTenant(escenario, [], [], 't-1', [{ id: 'p-1', nombre: 'Stock diario', toleranciaFrescuraMinutos: 60 }]);
    await abrirAlta(escenario);
    await avanzar(escenario, [], 'c-2');
    fijarHorario(escenario, 'personalizado', '30 7 * * 1');
    const nueva = automatizacion({ id: 'a-2', conexionId: 'c-2', cron: '30 7 * * 1' });
    escenario.respuestas.push({ status: 201, cuerpo: { automatizacion: nueva } });
    await enviar(escenario, { automatizaciones: [nueva], truncado: false }, 200, 'auto-crear', 'click');
    const alta = escenario.peticiones[escenario.peticiones.length - 2];
    assert.deepEqual(alta.cuerpo, { plantillaId: 'p-1', conexionId: 'c-2', valores: {}, cron: '30 7 * * 1' });
    assert.ok(
      nodo(escenario, 'banner').textContent.endsWith(
        ' La réplica de este tenant se actualiza cada 2 h y esta plantilla tolera 1 h' + COLA_FRESCURA),
      nodo(escenario, 'banner').textContent,
    );
  });

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
  const detalle = (numero: number, esActual: boolean, extra: Record<string, unknown> = {}) => ({
    version: {
      ...version(numero, esActual),
      nombre: 'Stock',
      descripcion: null,
      sql: `SELECT ${numero}`,
      parametros: [{ nombre: 'umbral', tipo: 'numero' }],
      ...extra,
    },
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
    // CH-32a PR2 (DEC-173): the history is a wide side panel now, closed at load.
    assert.match(marcado(), /<aside id="versiones" class="zd-drawer zd-drawer--wide"[^>]*\bhidden\b/);
    // CH-32a PR2: Guardar consulta moved into the query pop-up, which is checked on its own; what is
    // left in the saved queries section is the history's Cerrar versiones.
    const seccion = marcado().slice(marcado().indexOf('id="guardado"'), marcado().indexOf('id="automatizaciones"'));
    const botones = seccion.match(/<button[^>]*>/g) ?? [];
    assert.ok(botones.length >= 1, 'Cerrar versiones');
    assert.ok(botones.every((etiqueta) => etiqueta.includes('type="button"')), 'no button submits');
  });

  test('CH-25 each saved query offers a Versiones action next to Abrir', async () => {
    const escenario = await conConsulta();
    const lista = nodo(escenario, 'guardadas');
    assert.equal(botonesCon(lista, 'Abrir').length, 1);
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
    assert.equal(botonesCon(filas[0], 'Restaurar').length, 0, 'the current version has no restore');
    for (const fila of filas.slice(1)) {
      assert.equal(botonesCon(fila, 'Comparar con la actual').length, 1);
      assert.equal(botonesCon(fila, 'Restaurar').length, 1);
    }
    assert.equal(nodo(escenario, 'versiones-estado').textContent, '');
  });

  test('CH-25 a query with one version says so and offers no action', async () => {
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

  test('CH-25 comparing reads the chosen and the current version and shows both as text, side by side', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, TRES_VERSIONES);
    const hostil = '<img src=x onerror=alert(1)>';
    escenario.respuestas.push(
      { status: 200, cuerpo: detalle(2, false, { sql: hostil, nombre: 'Stock viejo' }) },
      { status: 200, cuerpo: detalle(3, true) },
    );
    botonesCon(nodo(escenario, 'versiones-lista').hijos[1], 'Comparar con la actual')[0].disparar('click');
    await asentarVarias();

    const ultimas = escenario.peticiones.slice(-2).map((p) => p.url);
    assert.deepEqual(ultimas, ['/consultas-guardadas/q-1/versiones/2', '/consultas-guardadas/q-1/versiones/3']);
    const bloques = buscar(nodo(escenario, 'versiones-comparacion'), (n) => n.className === 'versiones-bloque');
    assert.equal(bloques.length, 2);
    assert.equal(bloques[0].hijos[0].textContent, 'Versión 2');
    assert.equal(bloques[1].hijos[0].textContent, 'Versión 3 (vigente)');
    const sentencias = bloques.map((b) => buscar(b, (n) => n.tagName === 'pre')[0].textContent);
    assert.deepEqual(sentencias, [hostil, 'SELECT 3'], 'the statement is text, never markup');
    assert.ok(bloques[0].textContent.includes('Nombre: Stock viejo'));
    assert.ok(bloques[1].textContent.includes('Parámetros: umbral (numero).'));
    assert.equal(nodo(escenario, 'versiones-estado').textContent, '');
  });

  test('CH-25 a refused comparison keeps the rows and says why', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, TRES_VERSIONES);
    escenario.respuestas.push({ status: 404, cuerpo: { error: 'version-no-encontrada' } });
    botonesCon(nodo(escenario, 'versiones-lista').hijos[2], 'Comparar con la actual')[0].disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'versiones-estado').textContent, 'Esa versión ya no existe. Se actualizó el historial.');
    assert.equal(nodo(escenario, 'versiones-lista').hijos.length, 3);
    assert.equal(nodo(escenario, 'versiones-comparacion').hijos.length, 0);
  });

  test('CH-25 Restaurar asks first: the button repeats action and object, Cancelar sends nothing', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, TRES_VERSIONES);
    const antes = escenario.peticiones.length;
    const fila = nodo(escenario, 'versiones-lista').hijos[1];

    botonesCon(fila, 'Restaurar')[0].disparar('click');
    assert.equal(botonesCon(fila, 'Restaurar versión 2').length, 1, 'the confirmation names the action and the version');
    assert.equal(botonesCon(fila, 'Cancelar').length, 1);
    assert.equal(botonesCon(fila, 'Restaurar').length, 0, 'the first button is gone, so nobody confirms by habit');
    assert.equal(escenario.peticiones.length, antes, 'asking sends nothing');

    botonesCon(fila, 'Cancelar')[0].disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes, 'cancelling sends nothing');
    assert.equal(botonesCon(fila, 'Comparar con la actual').length, 1, 'the original actions are back');
    assert.equal(botonesCon(fila, 'Restaurar').length, 1);
  });

  test('CH-25 confirming restores exactly once, with the note, then reloads the list and the panel', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, TRES_VERSIONES);
    const fila = nodo(escenario, 'versiones-lista').hijos[1];
    botonesCon(fila, 'Restaurar')[0].disparar('click');
    const campoNota = buscar(fila, (n) => n.tagName === 'input')[0];
    campoNota.value = '  volvemos a la 2  ';

    escenario.respuestas.push(
      { status: 200, cuerpo: { consultaGuardada: { id: 'q-1', nombre: 'Stock', version: 4 } } },
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
      { status: 200, cuerpo: { versiones: [version(4, true, 'volvemos a la 2'), ...TRES_VERSIONES.map((v) => ({ ...v, esActual: false }))], truncado: false } },
    );
    const antes = escenario.peticiones.length;
    botonesCon(fila, 'Restaurar versión 2')[0].disparar('click');
    await asentarVarias();

    const nuevas = escenario.peticiones.slice(antes);
    assert.deepEqual(nuevas.map((p) => p.url), [
      '/consultas-guardadas/q-1/versiones/2/restaurar',
      '/consultas-guardadas',
      '/consultas-guardadas/q-1/versiones',
    ]);
    assert.deepEqual(nuevas[0].cuerpo, { nota: 'volvemos a la 2' }, 'one restore, with the trimmed note');
    assert.equal(nuevas[0].tenant, 't-1');
    assert.equal(nodo(escenario, 'banner').textContent, 'Se creó la versión 4 con el contenido de la versión 2.');
    const filas = nodo(escenario, 'versiones-lista').hijos;
    assert.equal(filas.length, 4);
    assert.ok(filas[0].textContent.includes('Vigente'));
  });

  test('CH-25 without a note the restore body is empty', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, TRES_VERSIONES);
    const fila = nodo(escenario, 'versiones-lista').hijos[2];
    botonesCon(fila, 'Restaurar')[0].disparar('click');
    escenario.respuestas.push(
      { status: 200, cuerpo: { consultaGuardada: { id: 'q-1', nombre: 'Stock', version: 4 } } },
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
      { status: 200, cuerpo: { versiones: [version(4, true)], truncado: false } },
    );
    const antes = escenario.peticiones.length;
    botonesCon(fila, 'Restaurar versión 1')[0].disparar('click');
    await asentarVarias();
    assert.deepEqual(escenario.peticiones[antes].cuerpo, {});
  });

  test('CH-25 a refused restore keeps the rows and explains the refusal', async () => {
    const escenario = await conConsulta();
    await abrirPanel(escenario, TRES_VERSIONES);
    const fila = nodo(escenario, 'versiones-lista').hijos[1];
    botonesCon(fila, 'Restaurar')[0].disparar('click');
    escenario.respuestas.push({ status: 409, cuerpo: { error: 'version-vigente' } });
    botonesCon(fila, 'Restaurar versión 2')[0].disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'versiones-estado').textContent, 'Esa ya es la versión vigente: no hay nada que restaurar.');
    assert.equal(nodo(escenario, 'versiones-lista').hijos.length, 3);
  });

  test('CH-25 switching tenant closes the panel and clears every row of the previous tenant', async () => {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    await elegirTenant(escenario, [FILA_GUARDADA]);
    await abrirPanel(escenario, TRES_VERSIONES);
    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(nodo(escenario, 'versiones').hidden, true);
    assert.equal(nodo(escenario, 'versiones-lista').hijos.length, 0);
    assert.equal(nodo(escenario, 'versiones-titulo').textContent, '');
    assert.equal(nodo(escenario, 'versiones-comparacion').hijos.length, 0);
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

  // ---- CH-25: save the editor as a new version (spec `query-console`, DEC-148, DEC-150) ----

  const COMPLETA = {
    id: 'q-1',
    nombre: 'Stock',
    descripcion: 'Productos',
    sql: 'SELECT :a',
    parametros: [{ nombre: 'a', tipo: 'numero' }],
    version: 3,
    nota: null,
  };

  /** Boots, selects the tenant and loads the one saved query into the editor. */
  async function conConsultaCargada(extra: Record<string, unknown> = {}): Promise<Escenario> {
    const escenario = await conConsulta();
    escenario.respuestas.push({ status: 200, cuerpo: { consultaGuardada: { ...COMPLETA, ...extra } } });
    // CH-32a PR2: «Abrir» loads the query and opens the pop-up with it.
    botonesCon(nodo(escenario, 'guardadas'), 'Abrir')[0].disparar('click');
    await asentarVarias();
    return escenario;
  }

  /** Presses «Guardar como versión N+1» with `respuestas` queued, and lets it settle (after an ok `probarOk`). */
  async function guardarVersion(escenario: Escenario, ...respuestas: Array<{ status: number; cuerpo: unknown }>): Promise<void> {
    escenario.respuestas.push(...respuestas);
    nodo(escenario, 'version-boton').disparar('click');
    await asentarVarias();
  }

  test('CH-25 the save-as-version block starts hidden, takes a note of at most 500 characters and its button does not submit', () => {
    // CH-32a PR2 (DEC-173): the block lives in the query pop-up: the loaded-query line and the note
    // field in the block, the button that sends it among the pop-up's actions.
    const dialogo = marcado().match(/<div id="consulta-dialogo"[\s\S]*?<\/section>/)?.[0] ?? '';
    const bloque = dialogo.match(/<div id="version-guardar"[^>]*>[\s\S]*?<input id="version-nota"[^>]*>/)?.[0] ?? '';
    assert.match(bloque, /^<div id="version-guardar" hidden>\s*<p id="version-cargada" class="ayuda"><\/p>/);
    assert.match(bloque, /<input id="version-nota"[^>]*maxlength="500"/);
    assert.match(dialogo, /<button id="version-boton"[^>]*type="button"/);
  });

  test('CH-25 the help text no longer says a saved query cannot be edited, and still says it cannot be deleted', () => {
    const seccion = marcado().slice(marcado().indexOf('<section id="guardado">'), marcado().indexOf('<section id="automatizaciones">'));
    const ayuda = seccion.match(/<p class="ayuda">([^<]*)<\/p>/)?.[1] ?? '';
    assert.ok(ayuda.includes('versión nueva'), ayuda);
    assert.ok(ayuda.includes('No se puede borrar'), ayuda);
    assert.ok(!ayuda.includes('No se puede editar'), ayuda);
  });

  test('CH-25 with nothing loaded the action is not offered', async () => {
    const escenario = await conConsulta();
    assert.equal(nodo(escenario, 'version-guardar').hidden, true);
  });

  test('CH-25 loading a saved query offers the action and brings its name, description and statement to the editor', async () => {
    const escenario = await conConsultaCargada();
    assert.equal(nodo(escenario, 'version-guardar').hidden, false);
    // CH-32a PR2 (DEC-173): the strip states the loaded query and its version, as the spec asks.
    assert.equal(nodo(escenario, 'version-cargada').textContent, '«Stock» · Versión 3 · vigente');
    assert.equal(nodo(escenario, 'nombre').value, 'Stock');
    assert.equal(nodo(escenario, 'descripcion').value, 'Productos');
    assert.equal(nodo(escenario, 'sql').value, 'SELECT :a');
  });

  test('CH-25 a hostile name is shown as text in the loaded-query notice', async () => {
    const hostil = '<img src=x onerror=alert(1)>';
    const escenario = await conConsultaCargada({ nombre: hostil });
    assert.ok(nodo(escenario, 'version-cargada').textContent.includes(hostil));
    assert.equal(nodo(escenario, 'version-cargada').hijos.length, 0, 'a text node holder only');
  });

  test('CH-25 saving sends one PUT for the loaded id with the editor content and the note, then refreshes the list', async () => {
    const escenario = await conConsultaCargada();
    nodo(escenario, 'sql').value = 'SELECT :a + 1';
    nodo(escenario, 'version-nota').value = '  Agrega filtro  ';
    await probarOk(escenario);
    const antes = escenario.peticiones.length;
    await guardarVersion(
      escenario,
      { status: 200, cuerpo: { consultaGuardada: { id: 'q-1', nombre: 'Stock', version: 4 } } },
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
    );
    const nuevas = escenario.peticiones.slice(antes);
    assert.deepEqual(nuevas.map((p) => p.url), ['/consultas-guardadas/q-1', '/consultas-guardadas']);
    assert.deepEqual(nuevas[0].cuerpo, {
      nombre: 'Stock',
      descripcion: 'Productos',
      sql: 'SELECT :a + 1',
      parametros: [{ nombre: 'a', tipo: 'numero' }],
      nota: 'Agrega filtro',
    });
    assert.equal(nuevas[0].tenant, 't-1');
    assert.equal(nodo(escenario, 'banner').textContent, 'Se guardó la versión 4 de «Stock».');
    assert.equal(nodo(escenario, 'version-nota').value, '', 'the note is spent');
  });

  test('CH-25 without a note the body carries no nota key', async () => {
    const escenario = await conConsultaCargada();
    nodo(escenario, 'sql').value = 'SELECT 2';
    nodo(escenario, 'version-nota').value = '   ';
    await probarOk(escenario);
    await guardarVersion(
      escenario,
      { status: 200, cuerpo: { consultaGuardada: { id: 'q-1', nombre: 'Stock', version: 4 } } },
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
    );
    const envio = escenario.peticiones.find((p) => p.url === '/consultas-guardadas/q-1' && p.cuerpo !== null);
    assert.ok(envio !== undefined && !('nota' in (envio.cuerpo as object)));
  });

  test('CH-25 saving refreshes the open versions panel of the same query', async () => {
    const escenario = await conConsultaCargada();
    await abrirPanel(escenario, TRES_VERSIONES);
    nodo(escenario, 'sql').value = 'SELECT 9';
    await probarOk(escenario);
    const antes = escenario.peticiones.length;
    await guardarVersion(
      escenario,
      { status: 200, cuerpo: { consultaGuardada: { id: 'q-1', nombre: 'Stock', version: 4 } } },
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
      { status: 200, cuerpo: { versiones: [version(4, true), ...TRES_VERSIONES.map((v) => ({ ...v, esActual: false }))], truncado: false } },
    );
    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => p.url), [
      '/consultas-guardadas/q-1',
      '/consultas-guardadas',
      '/consultas-guardadas/q-1/versiones',
    ]);
    assert.equal(nodo(escenario, 'versiones-lista').hijos.length, 4);
  });

  test('CH-25 each refusal reads in plain words and keeps the editor as it was', async () => {
    const casos: Array<[number, unknown, RegExp]> = [
      [409, { error: 'sin-cambios' }, /^No hay cambios respecto de la versión vigente\.$/],
      [409, { error: 'conflicto-de-edicion' }, /Otra edición se guardó antes que esta\. Volvé a cargar la consulta/],
      [400, { error: 'solicitud-invalida', campos: ['/nota'] }, /^La nota tiene que ser un texto de hasta 500 caracteres\.$/],
      [400, { error: 'solicitud-invalida', campos: ['/sql'] }, /La solicitud es inválida\. Revise estos campos: \/sql\./],
      [500, { error: 'interno' }, /^La aplicación respondió HTTP 500\.$/],
    ];
    for (const [estado, cuerpo, esperado] of casos) {
      const escenario = await conConsultaCargada();
      nodo(escenario, 'sql').value = 'SELECT 7';
      await probarOk(escenario);
      await guardarVersion(escenario, { status: estado, cuerpo });
      // CH-32a PR2: the pop-up is open (Abrir), so the refusal is written inside it, not in the page banner.
      assert.match(nodo(escenario, 'estado').textContent, esperado, String(estado) + JSON.stringify(cuerpo));
      assert.equal(nodo(escenario, 'banner').hidden, true, 'the page banner is behind the pop-up');
      assert.equal(nodo(escenario, 'consulta-dialogo').hidden, false, 'and the pop-up stays open');
      assert.equal(nodo(escenario, 'sql').value, 'SELECT 7', 'the operator keeps what was typed');
      assert.equal(nodo(escenario, 'version-guardar').hidden, false, 'and can try again');
      assert.equal(nodo(escenario, 'version-boton').disabled, false);
    }
  });

  test('CH-25 when the query is gone the notice disappears and the list is refreshed', async () => {
    const escenario = await conConsultaCargada();
    await probarOk(escenario);
    await guardarVersion(
      escenario,
      { status: 404, cuerpo: { error: 'consulta-guardada-no-encontrada' } },
      { status: 200, cuerpo: { consultasGuardadas: [], truncado: false } },
    );
    // CH-32a PR2: told inside the pop-up, which stays open as a new, untested query.
    assert.equal(nodo(escenario, 'estado').textContent, 'Esa consulta guardada ya no existe. Se actualizó la lista.');
    assert.equal(nodo(escenario, 'consulta-dialogo').hidden, false);
    assert.equal(nodo(escenario, 'consulta-dialogo-titulo').textContent, 'Nueva consulta');
    assert.equal(nodo(escenario, 'version-guardar').hidden, true);
    assert.equal(nodo(escenario, 'guardar').disabled, true, 'a new query has to be tested again');
  });

  test('CH-25 switching tenant forgets the loaded query and hides the action', async () => {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    await elegirTenant(escenario, [FILA_GUARDADA]);
    escenario.respuestas.push({ status: 200, cuerpo: { consultaGuardada: COMPLETA } });
    botonesCon(nodo(escenario, 'guardadas'), 'Abrir')[0].disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'version-guardar').hidden, false);

    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(nodo(escenario, 'version-guardar').hidden, true);
    assert.equal(nodo(escenario, 'version-cargada').textContent, '');
    const antes = escenario.peticiones.length;
    nodo(escenario, 'version-boton').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes, 'a forgotten query can no longer be saved');
  });

  test('CH-25 restoring the loaded query reloads the editor with the restored content', async () => {
    const escenario = await conConsultaCargada();
    await abrirPanel(escenario, TRES_VERSIONES);
    const fila = nodo(escenario, 'versiones-lista').hijos[1];
    botonesCon(fila, 'Restaurar')[0].disparar('click');
    escenario.respuestas.push(
      { status: 200, cuerpo: { consultaGuardada: { id: 'q-1', nombre: 'Stock', version: 4 } } },
      { status: 200, cuerpo: { consultaGuardada: { ...COMPLETA, sql: 'SELECT 2', version: 4 } } },
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
      { status: 200, cuerpo: { versiones: [version(4, true)], truncado: false } },
    );
    const antes = escenario.peticiones.length;
    botonesCon(fila, 'Restaurar versión 2')[0].disparar('click');
    await asentarVarias();
    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => p.url), [
      '/consultas-guardadas/q-1/versiones/2/restaurar',
      '/consultas-guardadas/q-1',
      '/consultas-guardadas',
      '/consultas-guardadas/q-1/versiones',
    ]);
    assert.equal(nodo(escenario, 'sql').value, 'SELECT 2', 'the editor shows the restored statement');
    assert.equal(nodo(escenario, 'banner').textContent, 'Se creó la versión 4 con el contenido de la versión 2.', 'and the confirmation survives the reload');
  });

  // ---- CH-30a (DEC-164, DEC-165): the shell, one screen at a time by hash ------------------

  const PANTALLAS = ['tenants', 'plantillas', 'contrato', 'conexiones', 'agentes', 'mapeo', 'usuarios', 'tiempos', 'consultas', 'automatizaciones', 'frescura', 'auditoria'] as const;

  /** Changes the hash and fires the window's `hashchange` listeners, like a browser does. */
  function irA(escenario: Escenario, hash: string): void {
    escenario.ubicacion.hash = hash;
    for (const fn of escenario.oyentesVentana.get('hashchange') ?? []) {
      fn();
    }
  }

  /** Asserts that only `activa` is visible and only its link is current. */
  function soloVisible(escenario: Escenario, activa: (typeof PANTALLAS)[number]): void {
    for (const nombre of PANTALLAS) {
      assert.equal(nodo(escenario, `pantalla-${nombre}`).hidden, nombre !== activa, `pantalla-${nombre}`);
      assert.equal(
        nodo(escenario, `nav-${nombre}`).getAttribute('aria-current'),
        nombre === activa ? 'page' : null,
        `nav-${nombre}`,
      );
    }
  }

  test('CH-30a with no hash, Consultas is the one visible screen and its link is current', async () => {
    soloVisible(await arrancar(), 'consultas');
  });

  test('CH-30a the hash on load picks the screen', async () => {
    soloVisible(await arrancar(undefined, undefined, '#frescura'), 'frescura');
  });

  test('CH-30a a hashchange switches the screen, and an unknown hash falls back to Consultas', async () => {
    const escenario = await arrancar();
    irA(escenario, '#automatizaciones');
    soloVisible(escenario, 'automatizaciones');
    irA(escenario, '#frescura');
    soloVisible(escenario, 'frescura');
    irA(escenario, '#no-existe');
    soloVisible(escenario, 'consultas');
  });

  test('CH-30b no function is declared twice in the script: a later one would silently replace the first', () => {
    const nombres = [...script.matchAll(/^(?:async )?function (\w+)\(/gm)].map((m) => m[1]);
    const repetidos = nombres.filter((nombre, i) => nombres.indexOf(nombre) !== i);
    assert.deepEqual(repetidos, []);
  });

  test('CH-30a the markup is a shell: navigation links, three screens, Consultas visible first', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.match(marcado, /<div class="zd-shell">/);
    assert.match(marcado, /<nav class="zd-sidenav" aria-label="Secciones de la consola">/);
    for (const nombre of PANTALLAS) {
      assert.match(marcado, new RegExp(`<a id="nav-${nombre}" class="zd-sidenav__item" href="#${nombre}">`));
    }
    assert.match(marcado, /<section id="pantalla-consultas"(?![^>]*hidden)[^>]*>/);
    assert.match(marcado, /<section id="pantalla-automatizaciones"[^>]*hidden/);
    assert.match(marcado, /<section id="pantalla-frescura"[^>]*hidden/);
  });

  // CH-32a PR2 (DEC-173): the result moved into the query pop-up, above its actions row, where «Probar» now is.
  test('CH-30a the result sits inside the query pop-up, above its actions, before the saved queries, inside Consultas', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    const en = (texto: string): number => {
      const i = marcado.indexOf(texto);
      assert.ok(i !== -1, texto);
      return i;
    };
    const consultas = en('id="pantalla-consultas"');
    const ejecutar = en('id="ejecutar"');
    const resultados = en('id="resultados"');
    const anterior = en('id="anterior"');
    const guardado = en('id="guardado"');
    const automatizaciones = en('id="pantalla-automatizaciones"');
    const dialogo = en('id="consulta-dialogo"');
    assert.ok(consultas < dialogo && dialogo < resultados && resultados < anterior && anterior < ejecutar && ejecutar < guardado);
    assert.ok(guardado < automatizaciones, 'the saved queries stay inside Consultas');
  });

  test('CH-30a the alert banner sits above every screen', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="banner"') < marcado.indexOf('id="pantalla-consultas"'));
    assert.ok(marcado.indexOf('id="banner"') > marcado.indexOf('<main class="zd-page">'));
  });

  // ---- CH-30b (DEC-167, DEC-168): the Tenants screen -------------------------------------

  const TENANTS_PANTALLA = [
    { id: 't-1', nombre: 'Food Store', activo: true, creadoEn: '2026-09-01T12:00:00.000Z' },
    { id: 't-2', nombre: 'Almacén cerrado', activo: false, creadoEn: '2026-08-15T12:00:00.000Z' },
  ];

  /** Opens the Tenants screen with `tenants` queued as the listing, and lets it settle. */
  async function abrirTenants(escenario: Escenario, tenants: unknown[] = TENANTS_PANTALLA): Promise<void> {
    escenario.respuestas.push({ status: 200, cuerpo: { tenants } });
    irA(escenario, '#tenants');
    await asentarVarias();
  }

  /** The row of the Tenants table whose text includes `nombre`. */
  function filaTenant(escenario: Escenario, nombre: string): Nodo {
    const fila = nodo(escenario, 'tenants-cuerpo').hijos.find((h) => h.textContent.includes(nombre));
    assert.ok(fila, `no row for ${nombre}`);
    return fila;
  }

  test('CH-30b the Global group with Tenants comes before the daily-work screens', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="nav-tenants"') < marcado.indexOf('id="nav-consultas"'));
    assert.match(marcado, /<a id="nav-tenants" class="zd-sidenav__item" href="#tenants">/);
  });

  test('CH-30b showing Tenants lists active and deactivated tenants, with actions only for the active ones', async () => {
    const escenario = await arrancar();
    await abrirTenants(escenario);
    soloVisible(escenario, 'tenants');
    const pedido = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(pedido.url, '/tenants?incluirInactivos=true');
    assert.equal(pedido.tenant, null, 'a global call carries no tenant header');
    const activa = filaTenant(escenario, 'Food Store');
    assert.match(activa.textContent, /t-1/);
    assert.match(activa.textContent, /Activo/);
    assert.equal(botonesCon(activa, 'Elegir como activo').length, 1);
    assert.equal(botonesCon(activa, 'Dar de baja').length, 1);
    const baja = filaTenant(escenario, 'Almacén cerrado');
    assert.match(baja.textContent, /Dado de baja/);
    assert.equal(buscar(baja, (n) => n.tagName === 'button').length, 0);
  });

  test('CH-30b creating a tenant posts the name and reloads the list and the selector', async () => {
    const escenario = await arrancar();
    await abrirTenants(escenario);
    abrirDialogo(escenario, 'tenant-nuevo');
    nodo(escenario, 'tenant-nombre').value = '  Almacén Don Tito  ';
    escenario.respuestas.push(
      { status: 201, cuerpo: { tenant: { id: 't-3', nombre: 'Almacén Don Tito', activo: true } } },
      { status: 200, cuerpo: { tenants: [...TENANTS_PANTALLA, { id: 't-3', nombre: 'Almacén Don Tito', activo: true, creadoEn: '2026-10-13T12:00:00.000Z' }] } },
      { status: 200, cuerpo: { tenants: [{ id: 't-1', nombre: 'Food Store' }, { id: 't-3', nombre: 'Almacén Don Tito' }] } },
    );
    nodo(escenario, 'tenant-alta').disparar('submit');
    await asentarVarias();
    const urls = escenario.peticiones.slice(-3).map((p) => p.url);
    assert.deepEqual(urls, ['/tenants', '/tenants?incluirInactivos=true', '/tenants']);
    assert.deepEqual(escenario.peticiones[escenario.peticiones.length - 3].cuerpo, { nombre: 'Almacén Don Tito' });
    assert.equal(nodo(escenario, 'tenant-nombre').value, '');
    assert.equal(dialogoAbierto(escenario, 'tenant-dialogo'), false, 'the pop-up closes on a 201');
    assert.equal(nodo(escenario, 'tenant-aviso').textContent, 'Se creó el tenant «Almacén Don Tito».');
    assert.ok(filaTenant(escenario, 'Almacén Don Tito'));
  });

  test('CH-30b choosing a tenant makes it the active one', async () => {
    const escenario = await arrancar();
    await abrirTenants(escenario);
    escenario.respuestas.push(
      { status: 200, cuerpo: { consultasGuardadas: [], truncado: false } },
      { status: 200, cuerpo: { plantillas: [], truncado: false } },
      { status: 200, cuerpo: { automatizaciones: [], truncado: false } },
    );
    botonesCon(filaTenant(escenario, 'Food Store'), 'Elegir como activo')[0].disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'tenant').value, 't-1');
    assert.match(nodo(escenario, 'tenant-activo').textContent, /Food Store/);
  });

  // ---- CH-33 (DEC-175): the baja is confirmed in a pop-up by typing the tenant's name ----

  const bajaAbierta = (escenario: Escenario): boolean => !nodo(escenario, 'tenant-baja').hidden;

  /** Presses «Dar de baja» on the row of `nombre`: the pop-up opens synchronously. */
  function abrirBaja(escenario: Escenario, nombre = 'Food Store'): void {
    botonesCon(filaTenant(escenario, nombre), 'Dar de baja')[0].disparar('click');
  }

  function escribirNombreBaja(escenario: Escenario, valor: string): void {
    nodo(escenario, 'tb-nombre').value = valor;
    nodo(escenario, 'tb-nombre').disparar('input');
  }

  test('CH-33 Dar de baja opens a pop-up naming the tenant, with the action disabled and the focus on the field', async () => {
    const escenario = await arrancar();
    await abrirTenants(escenario);
    const enfocados: string[] = [];
    nodo(escenario, 'tb-nombre').focus = () => void enfocados.push('tb-nombre');
    const antes = escenario.peticiones.length;
    assert.equal(bajaAbierta(escenario), false, 'closed at load');
    abrirBaja(escenario);
    assert.equal(bajaAbierta(escenario), true);
    assert.deepEqual(enfocados, ['tb-nombre']);
    assert.match(nodo(escenario, 'tb-texto').textContent, /«Food Store»/);
    assert.match(nodo(escenario, 'tb-texto').textContent, /No se puede deshacer/);
    assert.equal(nodo(escenario, 'tb-dar-de-baja').textContent, 'Dar de baja Food Store');
    assert.equal(nodo(escenario, 'tb-dar-de-baja').disabled, true);
    assert.equal(nodo(escenario, 'tb-nombre').value, '');
    assert.equal(escenario.peticiones.length, antes, 'opening sends nothing');
  });

  test('CH-33 the action is enabled only by the exact name: no case folding, no trimming', async () => {
    const escenario = await arrancar();
    await abrirTenants(escenario);
    abrirBaja(escenario);
    for (const casi of ['food store', 'Food Store ', ' Food Store', 'Food']) {
      escribirNombreBaja(escenario, casi);
      assert.equal(nodo(escenario, 'tb-dar-de-baja').disabled, true, JSON.stringify(casi));
    }
    escribirNombreBaja(escenario, 'Food Store');
    assert.equal(nodo(escenario, 'tb-dar-de-baja').disabled, false);
    escribirNombreBaja(escenario, 'Food Stor');
    assert.equal(nodo(escenario, 'tb-dar-de-baja').disabled, true, 'erasing disables it again');
  });

  for (const [forma, cancelar] of [
    ['Cancelar', (e: Escenario) => nodo(e, 'tb-cancelar').disparar('click')],
    ['Escape', (e: Escenario) => nodo(e, 'tenant-baja').disparar('keydown', { key: 'Escape' })],
  ] as Array<[string, (e: Escenario) => void]>) {
    test(`CH-33 ${forma} closes the baja pop-up without asking and sends nothing, even with text typed`, async () => {
      const escenario = await arrancar();
      await abrirTenants(escenario);
      const antes = escenario.peticiones.length;
      abrirBaja(escenario);
      escribirNombreBaja(escenario, 'Food');
      cancelar(escenario);
      assert.equal(bajaAbierta(escenario), false);
      assert.equal(nodo(escenario, 'tb-confirmar').hidden, true, 'a confirmation never asks «Descartar cambios»');
      assert.equal(escenario.peticiones.length, antes);
      abrirBaja(escenario);
      assert.equal(nodo(escenario, 'tb-nombre').value, '', 'it reopens blank');
      assert.equal(nodo(escenario, 'tb-dar-de-baja').disabled, true);
    });
  }

  test('CH-33 deactivating the active tenant sends the typed name, returns the console to no tenant and says so', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirTenants(escenario);
    escenario.respuestas.push(
      { status: 200, cuerpo: { tenant: { id: 't-1', nombre: 'Food Store', activo: false } } },
      { status: 200, cuerpo: { tenants: [{ ...TENANTS_PANTALLA[0], activo: false }, TENANTS_PANTALLA[1]] } },
      { status: 200, cuerpo: { tenants: [] } },
    );
    abrirBaja(escenario);
    escribirNombreBaja(escenario, 'Food Store');
    nodo(escenario, 'tb-dar-de-baja').disparar('click');
    await asentarVarias();
    const baja = escenario.peticiones.find((p) => p.url === '/tenants/t-1/baja');
    assert.ok(baja, 'the baja was sent');
    assert.equal(baja.tenant, null);
    assert.deepEqual(baja.cuerpo, { nombre: 'Food Store' });
    assert.equal(bajaAbierta(escenario), false, 'the pop-up closes on a 200');
    assert.equal(nodo(escenario, 'tenant-activo').textContent, 'Ningún tenant seleccionado');
    assert.match(nodo(escenario, 'banner').textContent, /Diste de baja el tenant activo/);
    assert.match(filaTenant(escenario, 'Food Store').textContent, /Dado de baja/);
  });

  test('CH-33 a 409 confirmacion-no-coincide is told inside the pop-up, which stays open', async () => {
    const escenario = await arrancar();
    await abrirTenants(escenario);
    escenario.respuestas.push({ status: 409, cuerpo: { error: 'confirmacion-no-coincide' } });
    abrirBaja(escenario);
    escribirNombreBaja(escenario, 'Food Store');
    nodo(escenario, 'tb-dar-de-baja').disparar('click');
    await asentarVarias();
    assert.equal(bajaAbierta(escenario), true);
    assert.match(nodo(escenario, 'tb-aviso').textContent, /El nombre no coincide/);
  });

  test('CH-33 any other refusal is told inside the pop-up too', async () => {
    const escenario = await arrancar();
    await abrirTenants(escenario);
    escenario.respuestas.push({ status: 409, cuerpo: { error: 'tenant-desactivado' } });
    abrirBaja(escenario);
    escribirNombreBaja(escenario, 'Food Store');
    nodo(escenario, 'tb-dar-de-baja').disparar('click');
    await asentarVarias();
    assert.equal(bajaAbierta(escenario), true);
    assert.match(nodo(escenario, 'tb-aviso').textContent, /No se pudo dar de baja el tenant \(HTTP 409\)/);
  });

  // ---- CH-30b (DEC-167): the Conexiones screen -------------------------------------------

  const CONEXION_LISTADA = {
    id: 'c-1', nombre: 'Réplica principal', motor: 'postgres', host: 'db.cliente.test', puerto: 5432,
    baseDeDatos: 'tienda', usuarioDb: 'lector', soloLectura: true, agenteId: null, creadaEn: '2026-10-01T10:00:00.000Z',
  };

  /** Selects the tenant, then opens Conexiones with `conexiones` queued as its listing. */
  async function abrirConexiones(conexiones: unknown[] = [CONEXION_LISTADA]): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones, truncado: false } });
    irA(escenario, '#conexiones');
    await asentarVarias();
    return escenario;
  }

  /** Every text the page shows: every guarded node and everything the script built under it. */
  function textoDeLaPagina(escenario: Escenario): string {
    return [...escenario.nodos.values()].map((n) => n.textContent).join(' | ');
  }

  test('CH-30b Puesta en marcha with Conexiones sits between Tenants and the daily work', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="nav-tenants"') < marcado.indexOf('id="nav-conexiones"'));
    assert.ok(marcado.indexOf('id="nav-conexiones"') < marcado.indexOf('id="nav-consultas"'));
    assert.match(marcado, /<div id="conexion-dialogo" class="zd-dialog-backdrop" hidden>/);
    assert.match(marcado, /<input id="cx-clave"[^>]*type="password"/);
  });

  test('CH-30b with no tenant, Conexiones asks for one and sends nothing', async () => {
    const escenario = await arrancar();
    const antes = escenario.peticiones.length;
    irA(escenario, '#conexiones');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'conexiones-aviso').textContent, 'Elegí un tenant para ver sus conexiones.');
  });

  test('CH-30b Conexiones lists the tenant connections as text, each with Probar', async () => {
    const escenario = await abrirConexiones();
    const pedido = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(pedido.url, '/conexiones');
    assert.equal(pedido.tenant, 't-1');
    const fila = nodo(escenario, 'conexiones-cuerpo').hijos[0];
    for (const texto of ['Réplica principal', 'postgres', 'db.cliente.test:5432', 'tienda', 'lector']) {
      assert.ok(fila.textContent.includes(texto), texto);
    }
    assert.equal(botonesCon(fila, 'Probar').length, 1);
  });

  test('CH-30b Guardar y probar registers, empties the password, tests and reloads the list', async () => {
    const escenario = await abrirConexiones([]);
    escenario.respuestas.push({ status: 200, cuerpo: { agentes: [] } });
    nodo(escenario, 'conexion-nueva').disparar('click');
    await asentarVarias();
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), true);
    nodo(escenario, 'cx-nombre').value = 'Réplica nueva';
    nodo(escenario, 'cx-host').value = 'db.nueva.test';
    nodo(escenario, 'cx-puerto').value = '6543';
    nodo(escenario, 'cx-base').value = 'tienda';
    nodo(escenario, 'cx-usuario').value = 'lector';
    nodo(escenario, 'cx-clave').value = 'clave-secreta-del-cliente';
    escenario.respuestas.push(
      { status: 201, cuerpo: { conexion: { ...CONEXION_LISTADA, id: 'c-9', nombre: 'Réplica nueva' } } },
      { status: 200, cuerpo: { resultado: 'ok', categoria: null, codigo: null, host: 'db.nueva.test', puerto: 6543, duracionMs: 12 } },
      { status: 200, cuerpo: { conexiones: [{ ...CONEXION_LISTADA, id: 'c-9', nombre: 'Réplica nueva' }], truncado: false } },
    );
    nodo(escenario, 'conexion-alta').disparar('submit');
    await asentarVarias();
    const [alta, prueba, lista] = escenario.peticiones.slice(-3);
    assert.equal(alta.url, '/conexiones');
    assert.deepEqual(alta.cuerpo, {
      nombre: 'Réplica nueva', motor: 'postgres', host: 'db.nueva.test', puerto: 6543,
      baseDeDatos: 'tienda', usuarioDb: 'lector', credencial: 'clave-secreta-del-cliente',
    });
    assert.equal(prueba.url, '/conexiones/c-9/prueba');
    assert.equal(lista.url, '/conexiones');
    assert.equal(nodo(escenario, 'cx-clave').value, '');
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), false, 'the pop-up closes once saved and tested');
    assert.equal(nodo(escenario, 'conexiones-aviso').textContent, 'Guardada. Prueba: OK (12 ms).', 'the result goes to the screen notice');
    assert.ok(!textoDeLaPagina(escenario).includes('clave-secreta-del-cliente'));
  });

  test('CH-30b Probar shows a failure with its category and code next to the row', async () => {
    const escenario = await abrirConexiones();
    escenario.respuestas.push({
      status: 200,
      cuerpo: { resultado: 'fallo', categoria: 'credenciales-invalidas', codigo: '28P01', host: 'db.cliente.test', puerto: 5432, duracionMs: 30 },
    });
    const fila = nodo(escenario, 'conexiones-cuerpo').hijos[0];
    botonesCon(fila, 'Probar')[0].disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/conexiones/c-1/prueba');
    assert.match(fila.textContent, /credenciales-invalidas/);
    assert.match(fila.textContent, /28P01/);
  });

  // ---- CH-30c (DEC-121): the Agentes screen and secrets shown once ------------------------

  const AGENTE_ACTIVO = { id: 'a-1', creadoEn: '2026-10-01T10:00:00.000Z', tokenEmitidoEn: '2026-10-05T10:00:00.000Z', revocadoEn: null };
  const TOKEN = 'zd_ag_token-de-prueba-que-no-debe-quedar';

  /** Selects the tenant, then opens Agentes with `agentes` queued as its listing. */
  async function abrirAgentes(agentes: unknown[]): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { agentes } });
    irA(escenario, '#agentes');
    await asentarVarias();
    return escenario;
  }

  /** Creates the agent from an empty screen, leaving the token on screen. */
  async function crearAgente(escenario: Escenario): Promise<void> {
    escenario.respuestas.push(
      { status: 201, cuerpo: { agente: AGENTE_ACTIVO, token: TOKEN } },
      { status: 200, cuerpo: { agentes: [AGENTE_ACTIVO] } },
    );
    botonesCon(nodo(escenario, 'agente-estado'), 'Crear agente')[0].disparar('click');
    await asentarVarias();
  }

  test('CH-30c Agentes and Usuarios del panel come after Conexiones, before the daily work', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="nav-conexiones"') < marcado.indexOf('id="nav-agentes"'));
    assert.ok(marcado.indexOf('id="nav-agentes"') < marcado.indexOf('id="nav-consultas"'));
  });

  test('CH-30c with no tenant, Agentes asks for one and sends nothing', async () => {
    const escenario = await arrancar();
    const antes = escenario.peticiones.length;
    irA(escenario, '#agentes');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'agentes-aviso').textContent, 'Elegí un tenant para ver su agente.');
  });

  test('CH-30c creating the agent shows the token once, then the agent as active with Revocar', async () => {
    const escenario = await abrirAgentes([]);
    await crearAgente(escenario);
    const alta = escenario.peticiones.find((p) => p.url === '/agentes' && p.cuerpo !== null);
    assert.deepEqual(alta?.cuerpo, {});
    assert.equal(nodo(escenario, 'agente-secreto').hidden, false);
    assert.equal(nodo(escenario, 'agente-secreto-valor').textContent, TOKEN);
    assert.match(nodo(escenario, 'agente-estado').textContent, /Activo/);
    assert.equal(botonesCon(nodo(escenario, 'agente-estado'), 'Revocar').length, 1);
  });

  test('CH-30c Ya lo guardé removes the token from every node of the page', async () => {
    const escenario = await abrirAgentes([]);
    await crearAgente(escenario);
    nodo(escenario, 'agente-guardado').disparar('click');
    assert.equal(nodo(escenario, 'agente-secreto').hidden, true);
    assert.ok(!textoDeLaPagina(escenario).includes(TOKEN));
  });

  test('CH-30c leaving the screen removes the token too', async () => {
    const escenario = await abrirAgentes([]);
    await crearAgente(escenario);
    irA(escenario, '#consultas');
    assert.ok(!textoDeLaPagina(escenario).includes(TOKEN));
  });

  test('CH-30c Revocar asks inline, explaining the impact, before sending', async () => {
    const escenario = await abrirAgentes([AGENTE_ACTIVO]);
    const estado = nodo(escenario, 'agente-estado');
    const antes = escenario.peticiones.length;
    botonesCon(estado, 'Revocar')[0].disparar('click');
    assert.equal(escenario.peticiones.length, antes);
    assert.match(estado.textContent, /dejan de funcionar/);
    escenario.respuestas.push(
      { status: 200, cuerpo: { agente: { ...AGENTE_ACTIVO, revocadoEn: '2026-10-13T10:00:00.000Z' } } },
      { status: 200, cuerpo: { agentes: [{ ...AGENTE_ACTIVO, revocadoEn: '2026-10-13T10:00:00.000Z' }] } },
    );
    botonesCon(estado, 'Revocar el token')[0].disparar('click');
    await asentarVarias();
    assert.ok(escenario.peticiones.some((p) => p.url === '/agentes/a-1/revocar'));
    assert.match(estado.textContent, /Revocado/);
    assert.equal(botonesCon(estado, 'Emitir un token nuevo').length, 1);
  });

  test('CH-30c a new connection can go through the tenant active agent', async () => {
    const escenario = await abrirConexiones([]);
    escenario.respuestas.push({ status: 200, cuerpo: { agentes: [AGENTE_ACTIVO] } });
    nodo(escenario, 'conexion-nueva').disparar('click');
    await asentarVarias();
    const via = nodo(escenario, 'cx-via');
    assert.deepEqual(via.options.map((o) => o.value), ['', 'a-1']);
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), true);
    via.value = 'a-1';
    for (const [id, valor] of [['cx-nombre', 'Por agente'], ['cx-host', 'db.interna'], ['cx-puerto', '5432'], ['cx-base', 'tienda'], ['cx-usuario', 'lector'], ['cx-clave', 'otra-clave-secreta']]) {
      nodo(escenario, id).value = valor;
    }
    escenario.respuestas.push(
      { status: 201, cuerpo: { conexion: { ...CONEXION_LISTADA, id: 'c-8', agenteId: 'a-1' } } },
      { status: 200, cuerpo: { resultado: 'ok', categoria: null, codigo: null, host: 'db.interna', puerto: 5432, duracionMs: 9 } },
      { status: 200, cuerpo: { conexiones: [], truncado: false } },
    );
    nodo(escenario, 'conexion-alta').disparar('submit');
    await asentarVarias();
    const alta = escenario.peticiones.find((p) => p.url === '/conexiones' && p.cuerpo !== null);
    assert.equal((alta?.cuerpo as { agenteId?: string }).agenteId, 'a-1');
  });

  // ---- CH-30c (DEC-155 to DEC-158): the Usuarios del panel screen ------------------------

  const USUARIO_ACTIVO = { id: 'u-1', correo: 'ana@negocio.com', nombre: 'Ana', activo: true, creadoEn: '2026-10-02T10:00:00.000Z' };
  const USUARIO_INACTIVO = { id: 'u-2', correo: 'beto@negocio.com', nombre: null, activo: false, creadoEn: '2026-10-03T10:00:00.000Z' };
  const CLAVE = 'ClaveGeneradaDePrueba123';

  /** Selects the tenant, then opens Usuarios del panel with `usuarios` queued as its listing. */
  async function abrirUsuarios(usuarios: unknown[] = [USUARIO_ACTIVO, USUARIO_INACTIVO]): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { usuarios, truncado: false } });
    irA(escenario, '#usuarios');
    await asentarVarias();
    return escenario;
  }

  function filaUsuario(escenario: Escenario, correo: string): Nodo {
    const fila = nodo(escenario, 'usuarios-cuerpo').hijos.find((h) => h.textContent.includes(correo));
    assert.ok(fila, `no row for ${correo}`);
    return fila;
  }

  test('CH-30c Usuarios del panel sits after Agentes in Puesta en marcha', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="nav-agentes"') < marcado.indexOf('id="nav-usuarios"'));
    assert.ok(marcado.indexOf('id="nav-usuarios"') < marcado.indexOf('id="nav-consultas"'));
  });

  test('CH-30c with no tenant, Usuarios del panel asks for one and sends nothing', async () => {
    const escenario = await arrancar();
    const antes = escenario.peticiones.length;
    irA(escenario, '#usuarios');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'usuarios-aviso').textContent, 'Elegí un tenant para ver sus usuarios del panel.');
  });

  test('CH-30c the list shows each user with the actions of its state', async () => {
    const escenario = await abrirUsuarios();
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/usuarios');
    const activo = filaUsuario(escenario, 'ana@negocio.com');
    assert.match(activo.textContent, /Ana/);
    assert.match(activo.textContent, /Activo/);
    assert.equal(botonesCon(activo, 'Reponer clave').length, 1);
    assert.equal(botonesCon(activo, 'Desactivar').length, 1);
    const inactivo = filaUsuario(escenario, 'beto@negocio.com');
    assert.match(inactivo.textContent, /Desactivado/);
    assert.equal(botonesCon(inactivo, 'Reactivar').length, 1);
    assert.equal(botonesCon(inactivo, 'Reponer clave').length, 1);
  });

  test('CH-30c creating a user sends the email and name and shows the password once', async () => {
    const escenario = await abrirUsuarios([]);
    abrirDialogo(escenario, 'usuario-nuevo');
    nodo(escenario, 'usuario-correo').value = ' Ana@Negocio.com ';
    nodo(escenario, 'usuario-nombre').value = 'Ana';
    escenario.respuestas.push(
      { status: 201, cuerpo: { usuario: USUARIO_ACTIVO, clave: CLAVE } },
      { status: 200, cuerpo: { usuarios: [USUARIO_ACTIVO], truncado: false } },
    );
    nodo(escenario, 'usuario-alta').disparar('submit');
    await asentarVarias();
    const alta = escenario.peticiones.find((p) => p.url === '/usuarios' && p.cuerpo !== null);
    assert.deepEqual(alta?.cuerpo, { correo: 'Ana@Negocio.com', nombre: 'Ana' });
    assert.equal(nodo(escenario, 'usuario-secreto').hidden, false);
    assert.equal(nodo(escenario, 'usuario-secreto-valor').textContent, CLAVE);
    assert.equal(nodo(escenario, 'usuario-correo').value, '');
    assert.equal(dialogoAbierto(escenario, 'usuario-dialogo'), false, 'the pop-up closes on a 201');
    assert.ok(filaUsuario(escenario, 'ana@negocio.com'));
  });

  test('CH-30c an email in use says so and shows no password', async () => {
    const escenario = await abrirUsuarios([]);
    abrirDialogo(escenario, 'usuario-nuevo');
    nodo(escenario, 'usuario-correo').value = 'ana@negocio.com';
    escenario.respuestas.push({ status: 409, cuerpo: { error: 'correo-en-uso' } });
    nodo(escenario, 'usuario-alta').disparar('submit');
    await asentarVarias();
    assert.equal(nodo(escenario, 'usuario-dialogo-aviso').textContent, 'Ese correo ya está en uso.', 'inside the pop-up');
    assert.equal(dialogoAbierto(escenario, 'usuario-dialogo'), true, 'which stays open');
    assert.equal(nodo(escenario, 'usuario-correo').value, 'ana@negocio.com', 'with what was typed');
    assert.equal(nodo(escenario, 'usuario-secreto').hidden, true);
  });

  test('CH-30c Reponer clave shows the new password once, once confirmed', async () => {
    const escenario = await abrirUsuarios();
    escenario.respuestas.push(
      { status: 200, cuerpo: { usuario: USUARIO_ACTIVO, clave: CLAVE } },
      { status: 200, cuerpo: { usuarios: [USUARIO_ACTIVO, USUARIO_INACTIVO], truncado: false } },
    );
    const fila = filaUsuario(escenario, 'ana@negocio.com');
    botonesCon(fila, 'Reponer clave')[0].disparar('click');
    botonesCon(fila, 'Reponer clave de ana@negocio.com')[0].disparar('click');
    await asentarVarias();
    assert.ok(escenario.peticiones.some((p) => p.url === '/usuarios/u-1/clave'));
    assert.equal(nodo(escenario, 'usuario-secreto-valor').textContent, CLAVE);
  });

  test('CH-30c Desactivar asks inline first; Reactivar sends at once', async () => {
    const escenario = await abrirUsuarios();
    const fila = filaUsuario(escenario, 'ana@negocio.com');
    const antes = escenario.peticiones.length;
    botonesCon(fila, 'Desactivar')[0].disparar('click');
    assert.equal(escenario.peticiones.length, antes);
    escenario.respuestas.push(
      { status: 200, cuerpo: { usuario: { ...USUARIO_ACTIVO, activo: false } } },
      { status: 200, cuerpo: { usuarios: [{ ...USUARIO_ACTIVO, activo: false }, USUARIO_INACTIVO], truncado: false } },
    );
    botonesCon(fila, 'Desactivar ana@negocio.com')[0].disparar('click');
    await asentarVarias();
    assert.ok(escenario.peticiones.some((p) => p.url === '/usuarios/u-1/desactivar'));
    escenario.respuestas.push(
      { status: 200, cuerpo: { usuario: { ...USUARIO_INACTIVO, activo: true } } },
      { status: 200, cuerpo: { usuarios: [], truncado: false } },
    );
    botonesCon(filaUsuario(escenario, 'beto@negocio.com'), 'Reactivar')[0].disparar('click');
    await asentarVarias();
    assert.ok(escenario.peticiones.some((p) => p.url === '/usuarios/u-2/reactivar'));
  });

  test('CH-30c switching the tenant removes a shown password from every node', async () => {
    const escenario = await abrirUsuarios([]);
    abrirDialogo(escenario, 'usuario-nuevo');
    nodo(escenario, 'usuario-correo').value = 'ana@negocio.com';
    escenario.respuestas.push(
      { status: 201, cuerpo: { usuario: USUARIO_ACTIVO, clave: CLAVE } },
      { status: 200, cuerpo: { usuarios: [USUARIO_ACTIVO], truncado: false } },
    );
    nodo(escenario, 'usuario-alta').disparar('submit');
    await asentarVarias();
    assert.ok(textoDeLaPagina(escenario).includes(CLAVE));
    const selector = nodo(escenario, 'tenant');
    selector.value = '';
    selector.disparar('change');
    await asentarVarias();
    assert.ok(!textoDeLaPagina(escenario).includes(CLAVE));
  });

  // ---- CH-30d (DEC-61, M1): the Plantillas and Contrato screens, global and read-only ----

  const PLANTILLA_LISTADA = {
    id: 'p-9', nombre: 'Stock diario', automatizacion: 'stock-fisico', formato: 'correo-html', toleranciaFrescuraMinutos: 60,
  };

  test('CH-30d Plantillas and Contrato follow Tenants in the Global group', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    const en = (id: string): number => marcado.indexOf(`id="${id}"`);
    assert.ok(en('nav-tenants') < en('nav-plantillas'));
    assert.ok(en('nav-plantillas') < en('nav-contrato'));
    assert.ok(en('nav-contrato') < en('nav-conexiones'));
  });

  test('CH-30d Plantillas lists the catalog with no tenant header, and says when it was cut', async () => {
    const escenario = await arrancar();
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [PLANTILLA_LISTADA], truncado: true } });
    irA(escenario, '#plantillas');
    await asentarVarias();
    const pedido = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(pedido.url, '/plantillas');
    assert.equal(pedido.tenant, null);
    const fila = nodo(escenario, 'plantillas-cuerpo').hijos[0];
    for (const texto of ['Stock diario', 'stock-fisico', 'correo-html', '1 h']) {
      assert.ok(fila.textContent.includes(texto), texto);
    }
    assert.match(nodo(escenario, 'plantillas-aviso').textContent, /primeras/);
  });

  test('CH-30d Ver shows the entities, parameters and statement of a template, as text', async () => {
    const escenario = await arrancar();
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [PLANTILLA_LISTADA], truncado: false } });
    irA(escenario, '#plantillas');
    await asentarVarias();
    escenario.respuestas.push({
      status: 200,
      cuerpo: { plantilla: { ...PLANTILLA_LISTADA, sql: 'SELECT <b>x</b> FROM v_producto', parametros: [{ nombre: 'umbral', tipo: 'numero' }], entidades: ['producto', 'insumo'] } },
    });
    botonesCon(nodo(escenario, 'plantillas-cuerpo').hijos[0], 'Ver')[0].disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/plantillas/p-9');
    assert.equal(nodo(escenario, 'plantilla-panel').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-titulo').textContent, 'Stock diario');
    assert.equal(nodo(escenario, 'plantilla-entidades').textContent, 'Necesita: producto, insumo');
    assert.equal(nodo(escenario, 'plantilla-parametros').textContent, 'Parámetros: umbral (numero)');
    assert.equal(nodo(escenario, 'plantilla-sql').textContent, 'SELECT <b>x</b> FROM v_producto');
    nodo(escenario, 'plantilla-cerrar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-panel').hidden, true);
  });

  // ---- CH-35 (DEC-177): «Probar en el tenant activo» in the template panel ----------------

  const LISTA_CH35 = [PLANTILLA_LISTADA, { ...PLANTILLA_LISTADA, id: 'p-10', nombre: 'Otra plantilla' }];
  const CONEXIONES_CH35 = [{ id: 'c-1', nombre: 'food-store' }];

  /**
   * Opens the template at `fila` of the Plantillas list. `conexiones` null means no tenant is
   * selected, so the panel makes no connection request. The list loads on the first open only.
   */
  async function abrirParaProbar(
    escenario: Escenario,
    fila: number,
    parametros: unknown[],
    conexiones: unknown[] | null,
  ): Promise<void> {
    if (fila === 0) {
      escenario.respuestas.push({ status: 200, cuerpo: { plantillas: LISTA_CH35, truncado: false } });
      irA(escenario, '#plantillas');
      await asentarVarias();
    }
    escenario.respuestas.push({
      status: 200,
      cuerpo: { plantilla: { ...LISTA_CH35[fila], sql: 'SELECT 1', parametros, entidades: ['producto', 'insumo'] } },
    });
    if (conexiones !== null) {
      escenario.respuestas.push({ status: 200, cuerpo: { conexiones, truncado: false } });
    }
    botonesCon(nodo(escenario, 'plantillas-cuerpo').hijos[fila], 'Ver')[0].disparar('click');
    await asentarVarias();
  }

  /** The rows of the test block's table, each cell as text. */
  function filasDePrueba(escenario: Escenario): string[][] {
    return buscar(nodo(escenario, 'plantilla-prueba-tabla'), (n) => n.tagName === 'tr').map((tr) => tr.hijos.map((celda) => celda.textContent));
  }

  /** Boots with a tenant and one connection, opens a template with one numero parameter and chooses the connection. */
  async function plantillaListaParaProbar(): Promise<Escenario> {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otro' }]);
    await elegirTenant(escenario);
    await abrirParaProbar(escenario, 0, [{ nombre: 'umbral', tipo: 'numero' }], CONEXIONES_CH35);
    nodo(escenario, 'plantilla-prueba-conexion').value = 'c-1';
    return escenario;
  }

  async function probar(escenario: Escenario, respuesta: { status: number; cuerpo: unknown; falla?: boolean }): Promise<void> {
    escenario.respuestas.push(respuesta);
    nodo(escenario, 'plantilla-probar').disparar('click');
    await asentarVarias();
  }

  test('CH-35 the test block sits inside the template panel, after the statement and before Cerrar', () => {
    const html = marcado();
    const panel = html.indexOf('id="plantilla-panel"');
    const bloque = html.indexOf('id="plantilla-prueba"');
    assert.ok(panel < html.indexOf('id="plantilla-sql"'));
    assert.ok(html.indexOf('id="plantilla-sql"') < bloque);
    assert.ok(bloque < html.indexOf('id="plantilla-cerrar"'));
    assert.ok(html.indexOf('id="plantilla-cerrar"') < html.indexOf('</aside>', panel));
    assert.match(html, /<button id="plantilla-probar"[^>]*type="button"/);
  });

  test('CH-35 opening a template fills the connection list and adds one input per parameter', async () => {
    const escenario = await plantillaListaParaProbar();
    const selector = nodo(escenario, 'plantilla-prueba-conexion');
    assert.deepEqual(selector.options.map((o) => [o.value, o.textContent]), [['', 'Elegí una conexión'], ['c-1', 'food-store (c-1…)']]);
    const entradas = buscar(nodo(escenario, 'plantilla-prueba-valores'), (n) => n.tagName === 'input');
    assert.equal(entradas.length, 1);
    assert.equal(nodo(escenario, 'plantilla-prueba-valores').textContent, 'umbral');
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/conexiones');
  });

  test('CH-35 Probar sends one POST to the template test route with the tenant, the connection and the values', async () => {
    const escenario = await plantillaListaParaProbar();
    buscar(nodo(escenario, 'plantilla-prueba-valores'), (n) => n.tagName === 'input')[0].value = '5';
    const antes = escenario.peticiones.length;
    await probar(escenario, {
      status: 200,
      cuerpo: respuestaOk({ columnas: ['id', 'nota'], filas: [[1, '<b>x</b>'], [2, null]], paginacion: { limite: 50, desplazamiento: 0, hayMas: false, siguienteDesplazamiento: null, topeFilas: 200 } }),
    });
    assert.equal(escenario.peticiones.length, antes + 1);
    assert.deepEqual(escenario.peticiones[antes], { url: '/plantillas/p-9/prueba', tenant: 't-1', cuerpo: { conexionId: 'c-1', valores: { umbral: 5 } } });
    assert.deepEqual(filasDePrueba(escenario), [['id', 'nota'], ['1', '<b>x</b>'], ['2', 'NULL']]);
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, '2 filas.');
    assert.equal(nodo(escenario, 'plantilla-probar').disabled, false);
  });

  test('CH-35 hayMas adds the line saying the test shows only the first page', async () => {
    const escenario = await plantillaListaParaProbar();
    await probar(escenario, { status: 200, cuerpo: respuestaOk({ filas: [[1]], paginacion: { limite: 50, desplazamiento: 0, hayMas: true, siguienteDesplazamiento: 50, topeFilas: 200 } }) });
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, '1 fila. Hay más filas; la prueba muestra solo la primera página.');
  });

  test('CH-35 a 409 vista-canonica-no-aprobada names the entities, points to Mapeo and shows no table', async () => {
    const escenario = await plantillaListaParaProbar();
    await probar(escenario, { status: 409, cuerpo: { error: 'vista-canonica-no-aprobada', entidades: ['producto', 'insumo'] } });
    assert.equal(
      nodo(escenario, 'plantilla-prueba-aviso').textContent,
      'Las vistas de estas entidades no están aprobadas en esta conexión: producto, insumo. Mapealas y validalas en Mapeo y validación.',
    );
    assert.equal(nodo(escenario, 'plantilla-prueba-tabla').hijos.length, 0);
  });

  test('CH-35 the other answers are written as legible text and leave no table', async () => {
    const escenario = await plantillaListaParaProbar();
    const aviso = (): string => nodo(escenario, 'plantilla-prueba-aviso').textContent;
    await probar(escenario, { status: 200, cuerpo: { resultado: 'fallo', fase: 'x', categoria: 'y', codigo: '42P01' } });
    assert.equal(aviso(), 'La ejecución falló y la consola no pudo identificar el motivo. (SQLSTATE 42P01)');
    await probar(escenario, { status: 409, cuerpo: { error: 'credencial-ilegible' } });
    assert.match(aviso(), /^La credencial guardada para esta conexión no se pudo descifrar\./);
    await probar(escenario, { status: 404, cuerpo: { error: 'conexion-no-encontrada' } });
    assert.equal(aviso(), 'La plantilla o la conexión ya no existen.');
    await probar(escenario, { status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/valores/umbral'], problemas: [{ parametro: 'umbral', motivo: 'valor-faltante', campo: '/valores/umbral' }] } });
    assert.equal(aviso(), 'Revisá estos parámetros: «umbral» no tiene valor.');
    await probar(escenario, { status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/conexionId'] } });
    assert.equal(aviso(), 'Revisá estos parámetros: /conexionId.');
    await probar(escenario, { status: 500, cuerpo: { error: 'x' } });
    assert.equal(aviso(), 'La aplicación respondió HTTP 500.');
    await probar(escenario, { status: 200, cuerpo: null });
    assert.equal(aviso(), 'La aplicación respondió algo que la consola no pudo interpretar (HTTP 200).');
    await probar(escenario, { status: 200, cuerpo: {}, falla: true });
    assert.equal(aviso(), 'No se pudo contactar con la aplicación.');
    assert.equal(nodo(escenario, 'plantilla-prueba-tabla').hijos.length, 0);
    assert.equal(nodo(escenario, 'plantilla-probar').disabled, false);
  });

  test('CH-35 with no active tenant the block says so and sends nothing', async () => {
    const escenario = await arrancar();
    await abrirParaProbar(escenario, 0, [], null);
    const antes = escenario.peticiones.length;
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, 'Elegí un tenant para probar la plantilla.');
    nodo(escenario, 'plantilla-probar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, 'Elegí un tenant para probar la plantilla.');
    assert.deepEqual(nodo(escenario, 'plantilla-prueba-conexion').options, []);
  });

  test('CH-35 with no connection chosen the block says so and sends nothing', async () => {
    const escenario = await plantillaListaParaProbar();
    nodo(escenario, 'plantilla-prueba-conexion').value = '';
    const antes = escenario.peticiones.length;
    nodo(escenario, 'plantilla-probar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, 'Elegí una conexión para probar la plantilla.');
  });

  test('CH-35 a tenant with no connections says to register one', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirParaProbar(escenario, 0, [], []);
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, 'Registrá una conexión de este tenant para probar la plantilla.');
    assert.deepEqual(nodo(escenario, 'plantilla-prueba-conexion').options.map((o) => o.value), ['']);
  });

  test('CH-35 opening another template clears the previous result and its inputs', async () => {
    const escenario = await plantillaListaParaProbar();
    await probar(escenario, { status: 200, cuerpo: respuestaOk() });
    assert.ok(filasDePrueba(escenario).length > 0);
    await abrirParaProbar(escenario, 1, [], CONEXIONES_CH35);
    assert.equal(nodo(escenario, 'plantilla-titulo').textContent, 'Otra plantilla');
    assert.equal(nodo(escenario, 'plantilla-prueba-tabla').hijos.length, 0);
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, '');
    assert.equal(nodo(escenario, 'plantilla-prueba-valores').hijos.length, 0);
  });

  test('CH-35 closing the panel clears the result', async () => {
    const escenario = await plantillaListaParaProbar();
    await probar(escenario, { status: 200, cuerpo: respuestaOk() });
    nodo(escenario, 'plantilla-cerrar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-prueba-tabla').hijos.length, 0);
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, '');
  });

  test('CH-35 switching the tenant clears the result and re-reads the connections of the new one', async () => {
    const escenario = await plantillaListaParaProbar();
    await probar(escenario, { status: 200, cuerpo: respuestaOk() });
    // The open panel asks for the new tenant's connections first, then the usual switch requests.
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [{ id: 'c-2', nombre: 'otra' }], truncado: false } });
    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(nodo(escenario, 'plantilla-prueba-tabla').hijos.length, 0);
    assert.equal(nodo(escenario, 'plantilla-prueba-aviso').textContent, '');
    assert.deepEqual(nodo(escenario, 'plantilla-prueba-conexion').options.map((o) => o.value), ['', 'c-2']);
  });

  test('CH-35 a hostile connection name is shown as text', async () => {
    const hostil = '<img src=x onerror=alert(1)>';
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirParaProbar(escenario, 0, [], [{ id: 'c-1', nombre: hostil }]);
    assert.equal(nodo(escenario, 'plantilla-prueba-conexion').options[1].textContent, hostil + ' (c-1…)');
  });

  // ---- CH-38 (DEC-173, DEC-191): create, edit and duplicate a template --------------------------

  /** A template as `GET /plantillas/:id` answers it, in use unless the case says otherwise. */
  const PLANTILLA_CH38 = {
    ...PLANTILLA_LISTADA,
    sql: 'SELECT n FROM v_producto WHERE n < :umbral',
    parametros: [{ nombre: 'umbral', tipo: 'numero' }],
    entidades: ['producto', 'insumo'],
    titulo: 'Stock bajo',
    descripcion: 'Te avisamos cuando queda poco stock.',
    enUso: true,
  };
  const OK_CH38 = (): { status: number; cuerpo: unknown } => ({
    status: 200,
    cuerpo: respuestaOk({ columnas: ['n'], filas: [[1]], paginacion: { limite: 50, desplazamiento: 0, hayMas: false, siguienteDesplazamiento: null, topeFilas: 200 } }),
  });

  /** Opens the drawer of `plantilla` from the Plantillas list (with a tenant, its test block also reads the connections). */
  async function abrirDrawerCH38(escenario: Escenario, plantilla: Record<string, unknown>, conTenant = true): Promise<void> {
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [PLANTILLA_LISTADA], truncado: false } });
    irA(escenario, '#plantillas');
    await asentarVarias();
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla } });
    if (conTenant) escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    botonesCon(nodo(escenario, 'plantillas-cuerpo').hijos[0], 'Ver')[0].disparar('click');
    await asentarVarias();
  }

  /** Boots with a tenant and opens «Nueva plantilla». */
  async function abrirNuevaCH38(conexiones: unknown[] = CONEXIONES_CH35): Promise<Escenario> {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otro' }]);
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [PLANTILLA_LISTADA], truncado: false } });
    irA(escenario, '#plantillas');
    await asentarVarias();
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones, truncado: false } });
    nodo(escenario, 'plantilla-nueva').disparar('click');
    await asentarVarias();
    return escenario;
  }

  function escribirCH38(escenario: Escenario, id: string, valor: string): void {
    const control = nodo(escenario, id);
    control.value = valor;
    control.disparar(control.tagName === 'select' ? 'change' : 'input');
  }

  function casillaCH38(escenario: Escenario, entidad: string): Nodo {
    const rotulo = buscar(nodo(escenario, 'plantilla-f-entidades'), (n) => n.tagName === 'label' && n.textContent === entidad)[0];
    return rotulo.hijos[0];
  }

  function marcarCH38(escenario: Escenario, entidades: string[]): void {
    for (const entidad of entidades) {
      const casilla = casillaCH38(escenario, entidad);
      casilla.checked = true;
      casilla.disparar('change');
    }
  }

  /** Fills a passing template over `v_producto` with one numero parameter, and chooses the connection. */
  function llenarCH38(escenario: Escenario): void {
    escribirCH38(escenario, 'plantilla-f-nombre', 'Stock bajo');
    escribirCH38(escenario, 'plantilla-f-sql', 'SELECT n FROM v_producto WHERE n < :umbral');
    nodo(escenario, 'plantilla-f-agregar-parametro').disparar('click');
    const campos = buscar(nodo(escenario, 'plantilla-f-parametros'), (n) => n.tagName === 'input');
    campos[0].value = 'umbral';
    campos[0].disparar('input');
    const tipo = buscar(nodo(escenario, 'plantilla-f-parametros'), (n) => n.tagName === 'select')[0];
    tipo.value = 'numero';
    tipo.disparar('change');
    marcarCH38(escenario, ['producto']);
    escribirCH38(escenario, 'plantilla-f-titulo', 'Stock bajo');
    escribirCH38(escenario, 'plantilla-f-descripcion', 'Te avisamos cuando queda poco stock.');
    escribirCH38(escenario, 'plantilla-f-conexion', 'c-1');
  }

  async function probarCH38(escenario: Escenario, respuesta: { status: number; cuerpo: unknown; falla?: boolean } = OK_CH38()): Promise<void> {
    escenario.respuestas.push(respuesta);
    nodo(escenario, 'plantilla-f-probar').disparar('click');
    await asentarVarias();
  }

  /** The writes the catalog saw: every request but the reads. */
  const escriturasCH38 = (escenario: Escenario) => escenario.peticiones.filter((p) => p.cuerpo !== null && p.url !== '/plantillas/prueba' && !p.url.endsWith('/prueba'));

  test('CH-38 the three lists of the pop-up are the code lists, in order (ENTIDADES_CANONICAS, VALORES_AUTOMATIZACION, FORMATOS)', () => {
    const literal = script.match(/var ENTIDADES_PLANTILLA = (\[[^\]]*\]);/)?.[1] ?? '';
    assert.deepEqual(JSON.parse(literal.replaceAll("'", '"')), [...ENTIDADES_CANONICAS]);
    const opciones = (id: string): string[] => {
      const select = marcado().match(new RegExp('<select id="' + id + '"[\\s\\S]*?</select>'))?.[0] ?? '';
      return [...select.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    };
    assert.deepEqual(opciones('plantilla-f-automatizacion'), [...VALORES_AUTOMATIZACION]);
    assert.deepEqual(opciones('plantilla-f-formato'), [...FORMATOS]);
  });

  test('CH-38 the pop-up and the header action are in the markup, hidden and typed as they must be', () => {
    const html = marcado();
    assert.match(html, /<div id="plantilla-dialogo" class="zd-dialog-backdrop" hidden>/);
    assert.match(html, /<button id="plantilla-nueva"[^>]*type="button"/);
    assert.ok(html.indexOf('id="plantilla-nueva"') < html.indexOf('id="plantillas-aviso"'), 'the primary action is in the header');
    const dialogo = html.slice(html.indexOf('id="plantilla-dialogo"'), html.indexOf('</section>', html.indexOf('id="plantilla-dialogo"')));
    for (const boton of dialogo.match(/<button[^>]*>/g) ?? []) {
      assert.match(boton, /type="(button|submit)"/, boton);
    }
    assert.match(dialogo, /<button id="plantilla-dialogo-guardar"[^>]*type="submit" form="plantilla-form"[^>]*disabled/);
    assert.match(dialogo, /<textarea id="plantilla-f-descripcion"[^>]*maxlength="200"/);
    assert.match(dialogo, /<input id="plantilla-f-titulo"[^>]*maxlength="80"/);
    assert.match(dialogo, /<input id="plantilla-f-encabezado"[^>]*maxlength="200"/);
    assert.match(dialogo, /<textarea id="plantilla-f-linea"[^>]*maxlength="300"/);
    assert.match(dialogo, /<input id="plantilla-f-tolerancia"[^>]*type="number" min="0"/);
    assert.match(dialogo, /<p id="plantilla-f-resultado"[^>]*role="status"/);
    assert.match(dialogo, /<p id="plantilla-dialogo-estado"[^>]*role="status"/);
  });

  test('CH-38 «Nueva plantilla» opens a blank pop-up with Guardar closed and says why', async () => {
    const escenario = await abrirNuevaCH38();
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-dialogo-titulo').textContent, 'Nueva plantilla');
    assert.equal(nodo(escenario, 'plantilla-f-nombre').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-sql').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-aviso-copia').hidden, true);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
    assert.equal(nodo(escenario, 'plantilla-dialogo-estado').textContent, 'Probá la plantilla antes de guardarla.');
    // The entity boxes follow the contract order, none checked; the connections of the tenant are listed.
    const rotulos = buscar(nodo(escenario, 'plantilla-f-entidades'), (n) => n.tagName === 'label').map((n) => n.textContent);
    assert.deepEqual(rotulos, [...ENTIDADES_CANONICAS]);
    assert.ok(buscar(nodo(escenario, 'plantilla-f-entidades'), (n) => n.tagName === 'input').every((n) => !n.checked));
    assert.deepEqual(nodo(escenario, 'plantilla-f-conexion').options.map((o) => o.value), ['', 'c-1']);
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/conexiones');
  });

  test('CH-38 a passing test opens Guardar, which sends one POST /plantillas with both texts and no tenant header', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    // The test block asks for one value per declared parameter.
    const valor = buscar(nodo(escenario, 'plantilla-f-valores'), (n) => n.tagName === 'input')[0];
    valor.value = '5';
    const antes = escenario.peticiones.length;
    await probarCH38(escenario);
    assert.deepEqual(escenario.peticiones[antes], {
      url: '/plantillas/prueba',
      tenant: 't-1',
      cuerpo: {
        nombre: 'Stock bajo',
        sql: 'SELECT n FROM v_producto WHERE n < :umbral',
        parametros: [{ nombre: 'umbral', tipo: 'numero' }],
        entidades: ['producto'],
        automatizacion: 'stock-fisico',
        formato: 'correo-html',
        toleranciaFrescuraMinutos: 60,
        titulo: 'Stock bajo',
        descripcion: 'Te avisamos cuando queda poco stock.',
        encabezadoMensaje: '',
        lineaMensaje: '',
        conexionId: 'c-1',
        valores: { umbral: 5 },
      },
    });
    assert.equal(nodo(escenario, 'plantilla-f-resultado').textContent, '1 fila.');
    assert.deepEqual(buscar(nodo(escenario, 'plantilla-f-tabla'), (n) => n.tagName === 'tr').map((tr) => tr.hijos.map((c) => c.textContent)), [['n'], ['1']]);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false);
    assert.equal(nodo(escenario, 'plantilla-dialogo-estado').textContent, '');
    assert.equal(escriturasCH38(escenario).length, 0, 'testing writes nothing');

    // Pressing «Guardar»: the POST, then the list is reloaded and the saved template opens in the panel.
    escenario.respuestas.push({ status: 201, cuerpo: { plantilla: { ...PLANTILLA_CH38, id: 'p-20', nombre: 'Stock bajo', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [PLANTILLA_LISTADA, { ...PLANTILLA_LISTADA, id: 'p-20', nombre: 'Stock bajo' }], truncado: false } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { ...PLANTILLA_CH38, id: 'p-20', nombre: 'Stock bajo', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    const inicio = escenario.peticiones.length;
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    const [alta, lista, detalle] = escenario.peticiones.slice(inicio);
    assert.equal(alta.url, '/plantillas');
    assert.equal(alta.tenant, null, 'the catalog is global: no tenant header');
    assert.deepEqual(alta.cuerpo, {
      nombre: 'Stock bajo',
      sql: 'SELECT n FROM v_producto WHERE n < :umbral',
      parametros: [{ nombre: 'umbral', tipo: 'numero' }],
      entidades: ['producto'],
      automatizacion: 'stock-fisico',
      formato: 'correo-html',
      toleranciaFrescuraMinutos: 60,
      titulo: 'Stock bajo',
      descripcion: 'Te avisamos cuando queda poco stock.',
      encabezadoMensaje: '',
      lineaMensaje: '',
      columnasPrueba: ['n'],
    });
    assert.equal(lista.url, '/plantillas');
    assert.equal(detalle.url, '/plantillas/p-20');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true, 'the pop-up closes');
    assert.equal(nodo(escenario, 'plantilla-panel').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-editar').hidden, false, 'a new template is free: it can be edited');
  });

  test('CH-38 a second press while saving sends nothing more', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario);
    escenario.respuestas.push({ status: 201, cuerpo: { plantilla: { ...PLANTILLA_CH38, id: 'p-20', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [], truncado: false } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { ...PLANTILLA_CH38, id: 'p-20', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [], truncado: false } });
    nodo(escenario, 'plantilla-form').disparar('submit');
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    assert.equal(escenario.peticiones.filter((p) => p.url === '/plantillas' && p.cuerpo !== null).length, 1);
  });

  test('CH-38 editing the SQL after a test closes Guardar and says the template changed; the title does not', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false);
    escribirCH38(escenario, 'plantilla-f-titulo', 'Otro título');
    escribirCH38(escenario, 'plantilla-f-nombre', 'Otro nombre');
    escribirCH38(escenario, 'plantilla-f-tolerancia', '120');
    escribirCH38(escenario, 'plantilla-f-descripcion', 'Otra descripción.');
    escribirCH38(escenario, 'plantilla-f-automatizacion', 'reporte-diario');
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false, 'texts, name, tag and tolerance keep the test');
    escribirCH38(escenario, 'plantilla-f-sql', 'SELECT n FROM v_producto WHERE n < :umbral AND n > 0');
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
    assert.match(nodo(escenario, 'plantilla-dialogo-estado').textContent, /^Cambió la plantilla desde la última prueba\./);
  });

  test('CH-38 the declaration, the entities and the connection are part of the fingerprint', async () => {
    const escenario = await abrirNuevaCH38([{ id: 'c-1', nombre: 'uno' }, { id: 'c-2', nombre: 'dos' }]);
    llenarCH38(escenario);
    await probarCH38(escenario);
    const abierto = (): boolean => !nodo(escenario, 'plantilla-dialogo-guardar').disabled;
    assert.equal(abierto(), true);
    marcarCH38(escenario, ['insumo']);
    assert.equal(abierto(), false, 'an entity');
    const insumo = casillaCH38(escenario, 'insumo');
    insumo.checked = false;
    insumo.disparar('change');
    assert.equal(abierto(), true, 'back to the tested content, the test holds again');
    escribirCH38(escenario, 'plantilla-f-conexion', 'c-2');
    assert.equal(abierto(), false, 'the connection');
    escribirCH38(escenario, 'plantilla-f-conexion', 'c-1');
    const tipo = buscar(nodo(escenario, 'plantilla-f-parametros'), (n) => n.tagName === 'select')[0];
    tipo.value = 'texto';
    tipo.disparar('change');
    assert.equal(abierto(), false, 'the declaration');
  });

  test('CH-38 a failed test keeps Guardar closed and says the last test failed', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario, { status: 200, cuerpo: { resultado: 'fallo', fase: 'x', categoria: 'y', codigo: '42P01' } });
    assert.equal(nodo(escenario, 'plantilla-f-resultado').textContent, 'La ejecución falló y la consola no pudo identificar el motivo. (SQLSTATE 42P01)');
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
    assert.match(nodo(escenario, 'plantilla-dialogo-estado').textContent, /^La última prueba falló\./);
    await probarCH38(escenario, { status: 409, cuerpo: { error: 'vista-canonica-no-aprobada', entidades: ['producto'] } });
    assert.match(nodo(escenario, 'plantilla-f-resultado').textContent, /producto.*Mapeo y validación/);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
  });

  test('CH-38 a 400 of the test names the offending fields and the parameter problems', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario, {
      status: 400,
      cuerpo: { error: 'solicitud-invalida', campos: ['/sql'], problemas: [{ parametro: 'umbral', motivo: 'sin-usar' }] },
    });
    const texto = nodo(escenario, 'plantilla-f-resultado').textContent;
    assert.ok(texto.startsWith('Revisá estos campos: sentencia SQL.'), texto);
    assert.ok(texto.includes('«umbral»'), texto);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
  });

  test('CH-38 the test block asks one value per declared parameter and keeps what was typed', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    const entradas = (): Nodo[] => buscar(nodo(escenario, 'plantilla-f-valores'), (n) => n.tagName === 'input');
    assert.equal(entradas().length, 1);
    entradas()[0].value = '7';
    nodo(escenario, 'plantilla-f-agregar-parametro').disparar('click');
    assert.equal(entradas().length, 1, 'a row with no name asks for no value');
    assert.equal(entradas()[0].value, '7', 'the typed value survives a rebuild');
    const segundo = buscar(nodo(escenario, 'plantilla-f-parametros'), (n) => n.tagName === 'input')[1];
    segundo.value = 'corte';
    segundo.disparar('input');
    assert.equal(entradas().length, 2);
    assert.equal(nodo(escenario, 'plantilla-f-valores').textContent, 'umbralcorte');
  });

  test('CH-38 with no active tenant the test block says so, sends nothing and Guardar stays closed', async () => {
    const escenario = await arrancar();
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [], truncado: false } });
    irA(escenario, '#plantillas');
    await asentarVarias();
    const antes = escenario.peticiones.length;
    nodo(escenario, 'plantilla-nueva').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-f-resultado').textContent, 'Elegí un tenant para probar la plantilla.');
    nodo(escenario, 'plantilla-f-probar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
    assert.equal(nodo(escenario, 'plantilla-dialogo-estado').textContent, 'Elegí un tenant para probar la plantilla.');
  });

  test('CH-38 Probar with no connection chosen says so and sends nothing', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    escribirCH38(escenario, 'plantilla-f-conexion', '');
    const antes = escenario.peticiones.length;
    nodo(escenario, 'plantilla-f-probar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'plantilla-f-resultado').textContent, 'Elegí una conexión para probar la plantilla.');
  });

  test('CH-38 Cancelar asks before dropping what was typed, and closes at once on a clean form', async () => {
    const escenario = await abrirNuevaCH38();
    nodo(escenario, 'plantilla-dialogo-cancelar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true, 'nothing typed: it closes');

    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [], truncado: false } });
    nodo(escenario, 'plantilla-nueva').disparar('click');
    await asentarVarias();
    escribirCH38(escenario, 'plantilla-f-nombre', 'Algo');
    nodo(escenario, 'plantilla-dialogo-cancelar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-confirmar').hidden, false);
    nodo(escenario, 'plantilla-seguir').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-confirmar').hidden, true);
    nodo(escenario, 'plantilla-dialogo').disparar('keydown', { key: 'Escape' });
    assert.equal(nodo(escenario, 'plantilla-confirmar').hidden, false, 'Escape asks too');
    nodo(escenario, 'plantilla-descartar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true);
    assert.equal(escriturasCH38(escenario).length, 0);
  });

  test('CH-38 switching the tenant closes the pop-up and forgets the test', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario);
    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true);
    assert.equal(nodo(escenario, 'plantilla-f-tabla').hijos.length, 0);
    assert.equal(nodo(escenario, 'plantilla-f-resultado').textContent, '');
  });

  test('CH-38 the drawer shows the client texts and only «Duplicar y editar» for a template in use', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, PLANTILLA_CH38);
    assert.equal(nodo(escenario, 'plantilla-textos').textContent, 'Título para el cliente: Stock bajo\nDescripción para el cliente: Te avisamos cuando queda poco stock.');
    assert.equal(nodo(escenario, 'plantilla-duplicar').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-editar').hidden, true);
    assert.equal(nodo(escenario, 'plantilla-en-uso-aviso').hidden, false);
    assert.match(marcado(), /id="plantilla-en-uso-aviso"[^>]*>Tiene automatizaciones activas: se duplica en lugar de editarse\.</);
  });

  test('CH-38 the drawer shows only «Editar» for a free template, and says when it has no client texts', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, { ...PLANTILLA_CH38, enUso: false, titulo: null, descripcion: null });
    assert.equal(nodo(escenario, 'plantilla-editar').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-duplicar').hidden, true);
    assert.equal(nodo(escenario, 'plantilla-en-uso-aviso').hidden, true);
    assert.equal(nodo(escenario, 'plantilla-textos').textContent, 'Sin textos para el cliente: no aparece en el panel');
  });

  test('CH-38 the client texts are written as text', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    const hostil = '<img src=x onerror=alert(1)>';
    await abrirDrawerCH38(escenario, { ...PLANTILLA_CH38, titulo: hostil });
    assert.ok(nodo(escenario, 'plantilla-textos').textContent.includes(hostil));
    assert.equal(nodo(escenario, 'plantilla-textos').hijos.length, 0);
  });

  test('CH-38 «Duplicar y editar» opens a copy with the original data and no client texts, and writes nothing', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, PLANTILLA_CH38);
    const antes = escenario.peticiones.length;
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    nodo(escenario, 'plantilla-duplicar').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-dialogo-titulo').textContent, 'Duplicar plantilla');
    assert.equal(nodo(escenario, 'plantilla-f-nombre').value, 'Stock diario (copia)');
    assert.equal(nodo(escenario, 'plantilla-f-sql').value, PLANTILLA_CH38.sql);
    assert.equal(nodo(escenario, 'plantilla-f-automatizacion').value, 'stock-fisico');
    assert.equal(nodo(escenario, 'plantilla-f-formato').value, 'correo-html');
    assert.equal(nodo(escenario, 'plantilla-f-tolerancia').value, '60');
    assert.equal(nodo(escenario, 'plantilla-f-titulo').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-descripcion').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-aviso-copia').hidden, false);
    assert.deepEqual(buscar(nodo(escenario, 'plantilla-f-entidades'), (n) => n.tagName === 'input').map((n) => n.checked), [true, false, false, true, false]);
    const filaParametro = buscar(nodo(escenario, 'plantilla-f-parametros'), (n) => n.tagName === 'input').map((n) => n.value);
    assert.deepEqual(filaParametro, ['umbral']);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => p.url), ['/conexiones'], 'only the connections are read');
    // Cancelar on the untouched copy closes without asking.
    nodo(escenario, 'plantilla-dialogo-cancelar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true);
  });

  test('CH-38 the copy notice goes once the copy has its own title and description', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, PLANTILLA_CH38);
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [], truncado: false } });
    nodo(escenario, 'plantilla-duplicar').disparar('click');
    await asentarVarias();
    escribirCH38(escenario, 'plantilla-f-titulo', 'Mi título');
    assert.equal(nodo(escenario, 'plantilla-f-aviso-copia').hidden, false);
    escribirCH38(escenario, 'plantilla-f-descripcion', 'Mi descripción');
    assert.equal(nodo(escenario, 'plantilla-f-aviso-copia').hidden, true);
  });

  test('CH-38 «Editar» loads the template with its texts and Guardar sends a PUT with both of them', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, { ...PLANTILLA_CH38, enUso: false });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    nodo(escenario, 'plantilla-editar').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-dialogo-titulo').textContent, 'Editar plantilla');
    assert.equal(nodo(escenario, 'plantilla-f-nombre').value, 'Stock diario');
    assert.equal(nodo(escenario, 'plantilla-f-titulo').value, 'Stock bajo');
    assert.equal(nodo(escenario, 'plantilla-f-descripcion').value, 'Te avisamos cuando queda poco stock.');
    assert.equal(nodo(escenario, 'plantilla-f-aviso-copia').hidden, true);

    escribirCH38(escenario, 'plantilla-f-conexion', 'c-1');
    await probarCH38(escenario);
    escribirCH38(escenario, 'plantilla-f-descripcion', '');
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { ...PLANTILLA_CH38, enUso: false, descripcion: null } } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [PLANTILLA_LISTADA], truncado: false } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { ...PLANTILLA_CH38, enUso: false, descripcion: null } } });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [], truncado: false } });
    const inicio = escenario.peticiones.length;
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    assert.equal(escenario.peticiones[inicio].url, '/plantillas/p-9');
    assert.equal(escenario.peticiones[inicio].tenant, null);
    const cuerpo = escenario.peticiones[inicio].cuerpo as Record<string, unknown>;
    assert.equal(cuerpo.titulo, 'Stock bajo');
    assert.equal(cuerpo.descripcion, '', 'a blank text is sent, the route stores no text');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true);
  });

  test('CH-38 a 409 plantilla-en-uso keeps the pop-up open and offers «Duplicar y editar», which turns it into a copy', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, { ...PLANTILLA_CH38, enUso: false });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    nodo(escenario, 'plantilla-editar').disparar('click');
    await asentarVarias();
    escribirCH38(escenario, 'plantilla-f-conexion', 'c-1');
    await probarCH38(escenario);
    escenario.respuestas.push({ status: 409, cuerpo: { error: 'plantilla-en-uso' } });
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    assert.match(nodo(escenario, 'plantilla-dialogo-estado').textContent, /^Esta plantilla ahora tiene automatizaciones activas/);
    assert.equal(nodo(escenario, 'plantilla-dialogo-duplicar').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false, 'the test still holds');

    nodo(escenario, 'plantilla-dialogo-duplicar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo-titulo').textContent, 'Duplicar plantilla');
    assert.equal(nodo(escenario, 'plantilla-f-nombre').value, 'Stock diario (copia)');
    assert.equal(nodo(escenario, 'plantilla-f-titulo').value, '', 'a copy starts without client texts (DEC-191)');
    assert.equal(nodo(escenario, 'plantilla-f-descripcion').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-aviso-copia').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-dialogo-duplicar').hidden, true);
    assert.equal(nodo(escenario, 'plantilla-dialogo-estado').textContent, '');

    // Saving the copy is a POST, not the PUT that was refused.
    escenario.respuestas.push({ status: 201, cuerpo: { plantilla: { ...PLANTILLA_CH38, id: 'p-30', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [], truncado: false } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { ...PLANTILLA_CH38, id: 'p-30', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [], truncado: false } });
    const inicio = escenario.peticiones.length;
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    assert.equal(escenario.peticiones[inicio].url, '/plantillas');
    assert.equal((escenario.peticiones[inicio].cuerpo as { nombre: string }).nombre, 'Stock diario (copia)');
  });

  test('CH-38 a 400 with a forbidden term names the description field and the term, and the pop-up stays open', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario);
    escenario.respuestas.push({ status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/descripcion'], terminos: ['consulta'] } });
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    const texto = nodo(escenario, 'plantilla-dialogo-estado').textContent;
    assert.ok(texto.startsWith('Revisá estos campos: descripción para el cliente.'), texto);
    assert.ok(texto.includes('«consulta»'), texto);
    // Editing the form retires the refusal.
    escribirCH38(escenario, 'plantilla-f-descripcion', 'Sin términos.');
    assert.equal(nodo(escenario, 'plantilla-dialogo-estado').textContent, '');
  });

  test('CH-38 the other refusals of a save are legible and keep the pop-up open', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario);
    const guardar = async (respuesta: { status: number; cuerpo: unknown; falla?: boolean }): Promise<string> => {
      escenario.respuestas.push(respuesta);
      nodo(escenario, 'plantilla-form').disparar('submit');
      await asentarVarias();
      assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
      return nodo(escenario, 'plantilla-dialogo-estado').textContent;
    };
    assert.equal(await guardar({ status: 500, cuerpo: { error: 'x' } }), 'No se pudo guardar la plantilla (HTTP 500).');
    assert.equal(await guardar({ status: 200, cuerpo: {}, falla: true }), 'No se pudo contactar con la aplicación.');
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false, 'a refusal does not close the save');
  });

  // ---- CH-39b (DEC-188, DEC-192): the message texts in the pop-up, the drawer and the runs view ----

  /** A passing test whose columns are the ones the message line names. */
  const OK_CH39 = (): { status: number; cuerpo: unknown } => ({
    status: 200,
    cuerpo: respuestaOk({ columnas: ['producto', 'cantidad'], filas: [['Harina', 3]], paginacion: { limite: 50, desplazamiento: 0, hayMas: false, siguienteDesplazamiento: null, topeFilas: 200 } }),
  });
  const ENCABEZADO_CH39 = 'Stock bajo';
  const LINEA_CH39 = '{producto}: quedan {cantidad}';
  const PLANTILLA_CH39 = { ...PLANTILLA_CH38, encabezadoMensaje: ENCABEZADO_CH39, lineaMensaje: LINEA_CH39 };

  /** Fills both message texts of the open pop-up. */
  function escribirMensajeCH39(escenario: Escenario): void {
    escribirCH38(escenario, 'plantilla-f-encabezado', ENCABEZADO_CH39);
    escribirCH38(escenario, 'plantilla-f-linea', LINEA_CH39);
  }

  /** Opens «Editar» on a free template, with the connection chosen and the test passed. */
  async function editarProbadaCH39(plantilla: Record<string, unknown>): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, { ...plantilla, enUso: false });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    nodo(escenario, 'plantilla-editar').disparar('click');
    await asentarVarias();
    escribirCH38(escenario, 'plantilla-f-conexion', 'c-1');
    await probarCH38(escenario, OK_CH39());
    return escenario;
  }

  test('CH-39b the pop-up holds the two message fields with their caps, and the hint says how they work', () => {
    const dialogo = marcado().slice(marcado().indexOf('id="plantilla-dialogo"'), marcado().indexOf('</section>', marcado().indexOf('id="plantilla-dialogo"')));
    assert.match(dialogo, /<label for="plantilla-f-encabezado" class="zd-label">Encabezado del mensaje<\/label>/);
    assert.match(dialogo, /<input id="plantilla-f-encabezado"[^>]*maxlength="200"/);
    assert.match(dialogo, /<label for="plantilla-f-linea" class="zd-label">Línea por fila<\/label>/);
    assert.match(dialogo, /<textarea id="plantilla-f-linea"[^>]*maxlength="300"/);
    assert.match(dialogo, /Hasta 200 caracteres\. Va una sola vez, arriba de las líneas, y no admite columnas\./);
    assert.match(dialogo, /Hasta 300 caracteres\. \{columna\} se reemplaza por el valor de esa columna en cada fila\. Los dos textos van juntos; sin ellos, el correo muestra la tabla\./);
    assert.match(marcado(), /<p id="plantilla-mensaje"><\/p>/);
  });

  /** Spec "Saving with message texts". */
  test('CH-39b Guardar sends both message texts and the columns of the last test; the test request sends no columnasPrueba', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    escribirMensajeCH39(escenario);
    const antes = escenario.peticiones.length;
    await probarCH38(escenario, OK_CH39());
    const prueba = escenario.peticiones[antes].cuerpo as Record<string, unknown>;
    assert.equal(escenario.peticiones[antes].url, '/plantillas/prueba');
    assert.equal(prueba.encabezadoMensaje, ENCABEZADO_CH39);
    assert.equal(prueba.lineaMensaje, LINEA_CH39);
    assert.ok(!('columnasPrueba' in prueba), 'the test is what produces the columns');

    escenario.respuestas.push({ status: 201, cuerpo: { plantilla: { ...PLANTILLA_CH39, id: 'p-21', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantillas: [PLANTILLA_LISTADA], truncado: false } });
    escenario.respuestas.push({ status: 200, cuerpo: { plantilla: { ...PLANTILLA_CH39, id: 'p-21', enUso: false } } });
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    const inicio = escenario.peticiones.length;
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    assert.equal(escenario.peticiones[inicio].url, '/plantillas');
    assert.deepEqual(escenario.peticiones[inicio].cuerpo, {
      nombre: 'Stock bajo',
      sql: 'SELECT n FROM v_producto WHERE n < :umbral',
      parametros: [{ nombre: 'umbral', tipo: 'numero' }],
      entidades: ['producto'],
      automatizacion: 'stock-fisico',
      formato: 'correo-html',
      toleranciaFrescuraMinutos: 60,
      titulo: 'Stock bajo',
      descripcion: 'Te avisamos cuando queda poco stock.',
      encabezadoMensaje: ENCABEZADO_CH39,
      lineaMensaje: LINEA_CH39,
      columnasPrueba: ['producto', 'cantidad'],
    });
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true);
  });

  /** Spec "Editing the line keeps saving enabled". */
  test('CH-39b editing either message text after a passing test keeps Guardar enabled and asks for no new test', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    await probarCH38(escenario, OK_CH39());
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false);
    const pedidas = escenario.peticiones.length;
    escribirCH38(escenario, 'plantilla-f-linea', '{producto}');
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false);
    escribirCH38(escenario, 'plantilla-f-encabezado', 'Otro encabezado');
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, false);
    assert.equal(nodo(escenario, 'plantilla-dialogo-estado').textContent, '');
    assert.equal(escenario.peticiones.length, pedidas, 'editing a text sends nothing');
  });

  /** Spec "An unknown column". */
  test('CH-39b a 400 with marcadores on the line names the field, lists the columns missing from the last test and stays open', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    escribirMensajeCH39(escenario);
    await probarCH38(escenario, OK_CH39());
    escenario.respuestas.push({ status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/lineaMensaje'], marcadores: ['stock', 'insumo'] } });
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    assert.equal(
      nodo(escenario, 'plantilla-dialogo-estado').textContent,
      'Revisá estos campos: línea por fila. No están entre las columnas de la última prueba: stock, insumo.',
    );
    // Editing the form retires the refusal.
    escribirCH38(escenario, 'plantilla-f-linea', '{producto}');
    assert.equal(nodo(escenario, 'plantilla-dialogo-estado').textContent, '');
  });

  test('CH-39b a 400 with marcadores on the header says the header takes no columns; a pairing refusal names its field', async () => {
    const escenario = await abrirNuevaCH38();
    llenarCH38(escenario);
    escribirMensajeCH39(escenario);
    await probarCH38(escenario, { status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/encabezadoMensaje'], marcadores: ['producto'] } });
    assert.equal(nodo(escenario, 'plantilla-f-resultado').textContent, 'Revisá estos campos: encabezado del mensaje. El encabezado no admite columnas: producto.');
    assert.equal(nodo(escenario, 'plantilla-dialogo-guardar').disabled, true);
    await probarCH38(escenario, { status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/lineaMensaje'] } });
    assert.equal(nodo(escenario, 'plantilla-f-resultado').textContent, 'Revisá estos campos: línea por fila.');
  });

  /** Spec "Duplicating keeps the message texts". */
  test('CH-39b «Duplicar y editar» copies both message texts and leaves the client texts empty', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, PLANTILLA_CH39);
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: CONEXIONES_CH35, truncado: false } });
    nodo(escenario, 'plantilla-duplicar').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-f-encabezado').value, ENCABEZADO_CH39);
    assert.equal(nodo(escenario, 'plantilla-f-linea').value, LINEA_CH39);
    assert.equal(nodo(escenario, 'plantilla-f-titulo').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-descripcion').value, '');
    // The copy is untouched, so Cancelar closes without asking.
    nodo(escenario, 'plantilla-dialogo-cancelar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true);
  });

  test('CH-39b «Editar» fills both message texts, and a template without them fills blanks', async () => {
    const escenario = await editarProbadaCH39(PLANTILLA_CH39);
    assert.equal(nodo(escenario, 'plantilla-f-encabezado').value, ENCABEZADO_CH39);
    assert.equal(nodo(escenario, 'plantilla-f-linea').value, LINEA_CH39);

    const sin = await editarProbadaCH39({ ...PLANTILLA_CH38, encabezadoMensaje: null, lineaMensaje: null });
    assert.equal(nodo(sin, 'plantilla-f-encabezado').value, '');
    assert.equal(nodo(sin, 'plantilla-f-linea').value, '');
  });

  test('CH-39b a 409 plantilla-en-uso turns the pop-up into a copy that keeps the message texts and drops the client texts', async () => {
    const escenario = await editarProbadaCH39(PLANTILLA_CH39);
    escenario.respuestas.push({ status: 409, cuerpo: { error: 'plantilla-en-uso' } });
    nodo(escenario, 'plantilla-form').disparar('submit');
    await asentarVarias();
    nodo(escenario, 'plantilla-dialogo-duplicar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo-titulo').textContent, 'Duplicar plantilla');
    assert.equal(nodo(escenario, 'plantilla-f-titulo').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-descripcion').value, '');
    assert.equal(nodo(escenario, 'plantilla-f-encabezado').value, ENCABEZADO_CH39);
    assert.equal(nodo(escenario, 'plantilla-f-linea').value, LINEA_CH39);
  });

  test('CH-39b Cancelar and Escape count a change to either message text as something to discard', async () => {
    const escenario = await abrirNuevaCH38();
    escribirCH38(escenario, 'plantilla-f-linea', '{producto}');
    nodo(escenario, 'plantilla-dialogo-cancelar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, false);
    assert.equal(nodo(escenario, 'plantilla-confirmar').hidden, false);
    nodo(escenario, 'plantilla-descartar').disparar('click');
    assert.equal(nodo(escenario, 'plantilla-dialogo').hidden, true);

    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [], truncado: false } });
    nodo(escenario, 'plantilla-nueva').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'plantilla-f-linea').value, '', 'a new pop-up starts without the previous text');
    escribirCH38(escenario, 'plantilla-f-encabezado', 'Algo');
    nodo(escenario, 'plantilla-dialogo').disparar('keydown', { key: 'Escape' });
    assert.equal(nodo(escenario, 'plantilla-confirmar').hidden, false);
  });

  /** Spec "Viewing a template" and "A template without message texts". */
  test('CH-39b the drawer shows the message texts as text, or says the email shows the table', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await abrirDrawerCH38(escenario, PLANTILLA_CH39);
    assert.equal(nodo(escenario, 'plantilla-mensaje').textContent, 'Encabezado del mensaje: Stock bajo\nLínea por fila: {producto}: quedan {cantidad}');

    await abrirDrawerCH38(escenario, { ...PLANTILLA_CH38, encabezadoMensaje: null, lineaMensaje: null });
    assert.equal(nodo(escenario, 'plantilla-mensaje').textContent, 'Sin texto propio: el correo muestra la tabla.');
    await abrirDrawerCH38(escenario, PLANTILLA_CH38);
    assert.equal(nodo(escenario, 'plantilla-mensaje').textContent, 'Sin texto propio: el correo muestra la tabla.', 'absent keys read as no text');

    const hostil = '<img src=x onerror=alert(1)>';
    await abrirDrawerCH38(escenario, { ...PLANTILLA_CH39, encabezadoMensaje: hostil });
    assert.ok(nodo(escenario, 'plantilla-mensaje').textContent.includes(hostil));
    assert.equal(nodo(escenario, 'plantilla-mensaje').hijos.length, 0);
  });

  /** Spec "A run that fell back". */
  test('CH-39b the runs view says when the email was sent with the table, and shows nothing for a null or absent list', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()]);
    const base = { corte: null, codigoError: null, error: null, fase: 'ejecucion', iniciadaEn: 'i', finalizadaEn: 'f', duracionMs: 1, filas: 3, intentos: 1, notificacion: 'enviada', estado: 'ok' };
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        ejecuciones: [
          { ...base, id: 'e-1', mensajeRespaldo: ['stock'] },
          { ...base, id: 'e-2', mensajeRespaldo: ['stock', 'insumo'] },
          { ...base, id: 'e-3', mensajeRespaldo: null },
          { ...base, id: 'e-4' },
          { ...base, id: 'e-5', notificacion: 'fallo-envio', mensajeRespaldo: ['stock'] },
          { ...base, id: 'e-6', notificacion: null, mensajeRespaldo: ['stock'] },
        ],
        truncado: false,
      },
    });
    filasDe(escenario, 'auto-lista', 'automatizacion')[0].porClase('ver-ejecuciones')[0].disparar('click');
    await asentarVarias();
    const corridas = filasDe(escenario, 'auto-ejecuciones', 'ejecucion').map((fila) => fila.hijos.map((c) => c.textContent));
    assert.deepEqual(corridas.map((celdas) => celdas.length), [8, 8, 8, 8, 8, 8], 'no column was added');
    assert.deepEqual(corridas.map((celdas) => celdas[5]), [
      'Enviada. Se envió la tabla: falta la columna stock',
      'Enviada. Se envió la tabla: faltan las columnas stock, insumo',
      'Enviada',
      'Enviada',
      'Falló el envío. Iba a enviarse la tabla: falta la columna stock',
      'Se envió la tabla: falta la columna stock',
    ]);
    assert.ok(!corridas.flat().some((texto) => texto.includes('null') || texto === 'undefined'));
  });

  // ---- CH-30e1 (DEC-163, screen C-12): the Auditoría screen -----------------------------------

  const REGISTRO_AUDITORIA = {
    id: 'r-1',
    creadoEn: new Date(2026, 9, 14, 9, 5, 7).toISOString(),
    tenantNombre: 'Food Store',
    operadorId: 'op-1',
    operadorNombre: 'Ana',
    origen: 'consulta',
    conexionId: 'c-1',
    consultaGuardadaId: 'q-1',
    consultaVersion: 3,
    consultaNombre: 'Stock',
    plantillaId: null,
    sql: 'SELECT 1',
    resultado: 'fallo',
    fase: 'ejecucion',
    categoria: 'tiempo-agotado',
    codigo: null,
    filas: null,
    duracionMs: 1234,
  };
  const CONEXIONES_AUDITORIA = [{ id: 'c-1', nombre: 'Réplica principal' }];

  /** What opening the screen asks for, in request order: the connection names, then the audit listing. */
  function respuestasAuditoria(
    registros: unknown[],
    extra: Record<string, unknown> = {},
    conexiones: unknown[] = CONEXIONES_AUDITORIA,
  ): Array<{ status: number; cuerpo: unknown }> {
    return [
      { status: 200, cuerpo: { conexiones, truncado: false } },
      { status: 200, cuerpo: { registros, truncado: false, ...extra } },
    ];
  }

  /** Selects the tenant, then opens Auditoría with `registros` queued as its listing. */
  async function abrirAuditoria(registros: unknown[] = [REGISTRO_AUDITORIA], extra: Record<string, unknown> = {}): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push(...respuestasAuditoria(registros, extra));
    irA(escenario, '#auditoria');
    await asentarVarias();
    return escenario;
  }

  /** The text of each cell of the first row of the audit table. */
  function celdasAuditoria(escenario: Escenario, fila = 0): string[] {
    return nodo(escenario, 'auditoria-cuerpo').hijos[fila].hijos.map((celda) => celda.textContent);
  }

  test('CH-30e1 Auditoría comes after Frescura de datos in the daily work, and starts hidden', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="nav-frescura"') < marcado.indexOf('id="nav-auditoria"'));
    assert.ok(marcado.indexOf('id="nav-auditoria"') < marcado.indexOf('</nav>'));
    assert.ok(marcado.indexOf('id="pantalla-frescura"') < marcado.indexOf('id="pantalla-auditoria"'));
    assert.match(marcado, /<section id="pantalla-auditoria"[^>]*hidden/);
  });

  test('CH-30e1 the hash shows only Auditoría and marks its link current', async () => {
    soloVisible(await arrancar(undefined, undefined, '#auditoria'), 'auditoria');
  });

  test('CH-30e1 with no tenant, Auditoría asks for one and sends nothing', async () => {
    const escenario = await arrancar();
    const antes = escenario.peticiones.length;
    irA(escenario, '#auditoria');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'auditoria-aviso').textContent, 'Elegí un tenant para ver su auditoría.');
    assert.equal(nodo(escenario, 'auditoria-cuerpo').hijos.length, 0);
  });

  test('CH-30e1 showing Auditoría reads the connections and the audit with the tenant header, and shows a failed run', async () => {
    const escenario = await abrirAuditoria();
    assert.deepEqual(
      escenario.peticiones.slice(-2).map((p) => [p.url, p.tenant]),
      [['/conexiones', 't-1'], ['/auditoria', 't-1']],
    );
    const fecha = new Date(REGISTRO_AUDITORIA.creadoEn);
    const dos = (n: number): string => String(n).padStart(2, '0');
    const [cuando, operador, origen, conexion, consulta, sql, filasVistas, duracion, resultado] = celdasAuditoria(escenario);
    assert.equal(cuando, `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`);
    assert.equal(operador, 'Ana');
    assert.equal(origen, 'Consulta');
    assert.equal(conexion, 'Réplica principal');
    assert.equal(consulta, 'Stock v3');
    assert.equal(sql, 'SELECT 1SELECT 1');
    assert.equal(filasVistas, '');
    assert.equal(duracion, '1,2 s');
    assert.match(resultado, /^Falló: .*tiempo máximo/);
    assert.equal(nodo(escenario, 'auditoria-aviso').textContent, '');
  });

  test('CH-30e1 a template row, an ad hoc row and an unknown connection id', async () => {
    const escenario = await abrirAuditoria([
      { ...REGISTRO_AUDITORIA, consultaGuardadaId: null, consultaVersion: null, consultaNombre: null, plantillaId: 'p-9', origen: 'plantilla-prueba', resultado: 'ok', fase: null, categoria: null, filas: 12, duracionMs: 40 },
      { ...REGISTRO_AUDITORIA, consultaGuardadaId: null, consultaVersion: null, consultaNombre: null, origen: 'validacion-mapeo', conexionId: '0123456789abcdef', resultado: 'ok', filas: null, duracionMs: 999 },
      { ...REGISTRO_AUDITORIA, origen: 'conexion-prueba', plantillaId: null, consultaNombre: null, consultaVersion: null, resultado: 'ok', duracionMs: null },
      { ...REGISTRO_AUDITORIA, origen: 'otro-origen' },
    ]);
    const plantilla = celdasAuditoria(escenario, 0);
    assert.equal(plantilla[2], 'Prueba de plantilla');
    assert.equal(plantilla[4], 'Plantilla p-9');
    assert.equal(plantilla[6], '12');
    assert.equal(plantilla[7], '40 ms');
    assert.equal(plantilla[8], 'OK');
    const adhoc = celdasAuditoria(escenario, 1);
    assert.equal(adhoc[2], 'Validación de mapeo');
    assert.equal(adhoc[3], '01234567');
    assert.equal(adhoc[4], 'Ad hoc');
    assert.equal(adhoc[7], '999 ms');
    assert.equal(celdasAuditoria(escenario, 2)[2], 'Prueba de conexión');
    assert.equal(celdasAuditoria(escenario, 2)[7], '');
    assert.equal(celdasAuditoria(escenario, 3)[2], 'otro-origen');
  });

  test('CH-30e1 the filters go in the URL as the local day bounds and the result', async () => {
    const escenario = await abrirAuditoria();
    nodo(escenario, 'aud-desde').value = '2026-10-14';
    nodo(escenario, 'aud-hasta').value = '2026-10-14';
    nodo(escenario, 'aud-resultado').value = 'ok';
    escenario.respuestas.push(...respuestasAuditoria([]));
    nodo(escenario, 'aud-filtrar').disparar('click');
    await asentarVarias();
    const pedido = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(pedido.tenant, 't-1');
    const url = new URL(pedido.url, 'http://consola.test');
    assert.equal(url.pathname, '/auditoria');
    assert.equal(url.searchParams.get('desde'), new Date(2026, 9, 14).toISOString());
    assert.equal(url.searchParams.get('hasta'), new Date(2026, 9, 14, 23, 59, 59, 999).toISOString());
    assert.equal(url.searchParams.get('resultado'), 'ok');
    assert.equal(nodo(escenario, 'auditoria-aviso').textContent, 'No hay ejecuciones registradas con estos filtros.');
    assert.equal(nodo(escenario, 'auditoria-cuerpo').hijos.length, 0);
  });

  test('CH-30e1 inverted dates say so and send nothing', async () => {
    const escenario = await abrirAuditoria();
    nodo(escenario, 'aud-desde').value = '2026-10-15';
    nodo(escenario, 'aud-hasta').value = '2026-10-14';
    const antes = escenario.peticiones.length;
    nodo(escenario, 'aud-filtrar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'auditoria-aviso').textContent, 'La fecha «Desde» es posterior a «Hasta».');
  });

  test('CH-30e1 a cut listing says it shows the 200 most recent, and a 400 points to the dates', async () => {
    const escenario = await abrirAuditoria([REGISTRO_AUDITORIA], { truncado: true });
    assert.equal(nodo(escenario, 'auditoria-aviso').textContent, 'Se muestran las 200 ejecuciones más recientes. Acotá las fechas para ver las anteriores.');
    escenario.respuestas.push(
      { status: 200, cuerpo: { conexiones: [], truncado: false } },
      { status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/desde'] } },
    );
    nodo(escenario, 'aud-filtrar').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'auditoria-aviso').textContent, 'Revisá las fechas del filtro.');
  });

  test('CH-30e1 a failure to read the connections leaves the short id, and a network failure says so', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push(
      { status: 500, cuerpo: { error: 'interno' } },
      { status: 200, cuerpo: { registros: [REGISTRO_AUDITORIA], truncado: false } },
    );
    irA(escenario, '#auditoria');
    await asentarVarias();
    assert.equal(celdasAuditoria(escenario)[3], 'c-1');
    escenario.respuestas.push(
      { status: 200, cuerpo: { conexiones: [], truncado: false } },
      { status: 200, cuerpo: {}, falla: true },
    );
    nodo(escenario, 'aud-filtrar').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'auditoria-aviso').textContent, 'No se pudo contactar con la aplicación.');
  });

  test('CH-30e1 the statement shows as text, cut to 80 characters in the summary and whole inside', async () => {
    const largo = '<b>SELECT</b> ' + 'x'.repeat(100);
    const escenario = await abrirAuditoria([{ ...REGISTRO_AUDITORIA, sql: largo }]);
    const detalle = buscar(nodo(escenario, 'auditoria-cuerpo'), (n) => n.tagName === 'details')[0];
    const [resumen, completo] = detalle.hijos;
    assert.equal(resumen.tagName, 'summary');
    assert.equal(resumen.textContent, largo.slice(0, 80) + '…');
    assert.equal(completo.tagName, 'code');
    assert.equal(completo.textContent, largo);
    assert.ok(!script.slice(script.indexOf('CH-30e1 (DEC-163')).includes('inner' + 'HTML'));
  });

  test('CH-30e1 switching the tenant while Auditoría is shown reloads it for the new tenant', async () => {
    const escenario = await abrirAuditoria();
    // The screen's two reads fall between the switch's third and fourth requests: the automations load awaits its first answer.
    const cambio = respuestasDeTenant();
    escenario.respuestas.push(...cambio.slice(0, 3), ...respuestasAuditoria([{ ...REGISTRO_AUDITORIA, operadorNombre: 'Beto' }]), ...cambio.slice(3));
    nodo(escenario, 'tenant').value = 't-2';
    nodo(escenario, 'tenant').disparar('change');
    await asentarVarias();
    const pedidos = escenario.peticiones.filter((p) => p.url === '/auditoria');
    assert.equal(pedidos.length, 2);
    assert.equal(pedidos[1].tenant, 't-2');
    assert.equal(celdasAuditoria(escenario)[1], 'Beto');
  });

  // ---- CH-30e2 (DEC-178, screen C-07): the Tiempos de alta screen ---------------------------------

  /** A connection registered and mapped, never validated: four stages reached, four pending. Local instants. */
  const CONEXION_TIEMPOS = {
    conexionId: 'c-1',
    conexionNombre: 'food-store',
    altaInicio: new Date(2026, 9, 1, 9, 0).toISOString(),
    conexionRegistrada: new Date(2026, 9, 1, 11, 5).toISOString(),
    mapeoInicio: new Date(2026, 9, 2, 10, 0).toISOString(),
    mapeoFin: new Date(2026, 9, 4, 13, 30).toISOString(),
    validacionUltima: null,
    validacionEstado: null,
    automatizacionCreada: null,
    primeraEjecucion: null,
    primeraEjecucionEstado: null,
    primeraEjecucionFase: null,
    primeraEjecucionOk: null,
  };

  /** Selects the tenant, then opens Tiempos de alta with `conexiones` queued as its answer. */
  async function abrirTiempos(conexiones: unknown[] = [CONEXION_TIEMPOS], extra: Record<string, unknown> = {}): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones, truncado: false, ...extra } });
    irA(escenario, '#tiempos');
    await asentarVarias();
    return escenario;
  }

  /** Each stage of a block as [label, value] text pairs. */
  function etapasTiempos(escenario: Escenario, bloque = 0): string[][] {
    const lista = nodo(escenario, 'tiempos-lista').hijos[bloque].hijos[1];
    const pares: string[][] = [];
    for (let i = 0; i < lista.hijos.length; i += 2) {
      pares.push([lista.hijos[i].textContent, lista.hijos[i + 1].textContent]);
    }
    return pares;
  }

  test('CH-30e2 Tiempos de alta closes the onboarding group, after Usuarios del panel, and starts hidden', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="nav-usuarios"') < marcado.indexOf('id="nav-tiempos"'));
    assert.ok(marcado.indexOf('id="nav-tiempos"') < marcado.indexOf('Trabajo diario</span>'));
    assert.match(marcado, /<section id="pantalla-tiempos"[^>]*hidden/);
  });

  test('CH-30e2 the hash shows only Tiempos de alta and marks its link current', async () => {
    soloVisible(await arrancar(undefined, undefined, '#tiempos'), 'tiempos');
  });

  test('CH-30e2 with no tenant, Tiempos de alta asks for one and sends nothing', async () => {
    const escenario = await arrancar();
    const antes = escenario.peticiones.length;
    irA(escenario, '#tiempos');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.equal(nodo(escenario, 'tiempos-aviso').textContent, 'Elegí un tenant para ver sus tiempos de alta.');
    assert.equal(nodo(escenario, 'tiempos-lista').hijos.length, 0);
  });

  test('CH-30e2 showing the screen reads the marks with the tenant header; reached stages show a date, the rest Pendiente', async () => {
    const escenario = await abrirTiempos();
    const ultimo = escenario.peticiones[escenario.peticiones.length - 1];
    assert.deepEqual([ultimo.url, ultimo.tenant], ['/tiempos-alta', 't-1']);
    const bloque = nodo(escenario, 'tiempos-lista').hijos[0];
    assert.equal(bloque.hijos[0].textContent, 'food-store');
    assert.deepEqual(etapasTiempos(escenario), [
      ['Alta del tenant', '01/10/2026 09:00'],
      ['Conexión registrada', '01/10/2026 11:05 · +2 h 5 min'],
      ['Inicio del mapeo', '02/10/2026 10:00 · +22 h 55 min'],
      ['Última edición del mapeo', '04/10/2026 13:30 · +2 d 3 h'],
      ['Última validación', '—Pendiente'],
      ['Primera automatización', '—Pendiente'],
      ['Primera ejecución', '—Pendiente'],
      ['Primera ejecución OK', '—Pendiente'],
    ]);
    assert.equal(bloque.porClase('etapa-pendiente').length, 4);
    assert.equal(nodo(escenario, 'tiempos-aviso').textContent, '');
  });

  test('CH-30e2 validation state, a failed first run with its phase, and no elapsed time before an earlier mark', async () => {
    const escenario = await abrirTiempos([{
      ...CONEXION_TIEMPOS,
      validacionUltima: new Date(2026, 9, 3, 12, 0).toISOString(),
      validacionEstado: 'invalida',
      automatizacionCreada: new Date(2026, 9, 5, 9, 0).toISOString(),
      primeraEjecucion: new Date(2026, 9, 5, 9, 0, 30).toISOString(),
      primeraEjecucionEstado: 'fallo',
      primeraEjecucionFase: 'preparacion',
      primeraEjecucionOk: new Date(2026, 9, 5, 10, 0).toISOString(),
    }]);
    const etapas = etapasTiempos(escenario);
    // The validation is earlier than the mapping's last edit (clock mix): no elapsed time.
    assert.equal(etapas[4][1], '03/10/2026 12:00 · Inválida');
    assert.equal(etapas[6][1], '05/10/2026 09:00 · Falló en preparación · +menos de 1 min');
    assert.equal(etapas[7][1], '05/10/2026 10:00 · +59 min');
  });

  test('CH-30e2 no connections, a cut list and an HTTP failure are each legible', async () => {
    const vacio = await abrirTiempos([]);
    assert.equal(nodo(vacio, 'tiempos-aviso').textContent, 'Este tenant todavía no tiene conexiones.');
    const cortado = await abrirTiempos([CONEXION_TIEMPOS], { truncado: true });
    assert.equal(nodo(cortado, 'tiempos-aviso').textContent, 'Se muestran las primeras 200 conexiones.');
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 500, cuerpo: { error: 'interno' } });
    irA(escenario, '#tiempos');
    await asentarVarias();
    assert.equal(nodo(escenario, 'tiempos-aviso').textContent, 'No se pudo leer los tiempos de alta (HTTP 500).');
  });

  test('CH-30e2 a connection name with markup shows as text', async () => {
    const escenario = await abrirTiempos([{ ...CONEXION_TIEMPOS, conexionNombre: '<b>food</b>' }]);
    const titulo = nodo(escenario, 'tiempos-lista').hijos[0].hijos[0];
    assert.equal(titulo.textContent, '<b>food</b>');
    assert.equal(titulo.hijos.length, 0);
    assert.ok(!script.slice(script.indexOf('CH-30e2 (DEC-178')).includes('inner' + 'HTML'));
  });

  test('CH-30e2 switching the tenant while Tiempos de alta is shown reloads it for the new tenant', async () => {
    const escenario = await abrirTiempos();
    const cambio = respuestasDeTenant();
    escenario.respuestas.push(...cambio.slice(0, 3), { status: 200, cuerpo: { conexiones: [{ ...CONEXION_TIEMPOS, conexionNombre: 'otra' }], truncado: false } }, ...cambio.slice(3));
    nodo(escenario, 'tenant').value = 't-2';
    nodo(escenario, 'tenant').disparar('change');
    await asentarVarias();
    const pedidos = escenario.peticiones.filter((p) => p.url === '/tiempos-alta');
    assert.equal(pedidos.length, 2);
    assert.equal(pedidos[1].tenant, 't-2');
    assert.equal(nodo(escenario, 'tiempos-lista').hijos[0].hijos[0].textContent, 'otra');
  });

  test('CH-30d Contrato shows each entity with its fields, type, obligatoriness and automations', async () => {
    const escenario = await arrancar();
    escenario.respuestas.push({
      status: 200,
      cuerpo: {
        contrato: {
          entidades: [
            { nombre: 'producto', obligatoriedad: 'obligatorio', campos: [
              { nombre: 'id', obligatoriedad: 'obligatorio', tipo: 'identificador', automatizaciones: ['stock-fisico', 'reporte-diario'] },
              { nombre: 'sku', obligatoriedad: 'opcional', tipo: 'texto', automatizaciones: ['stock-fisico'] },
            ] },
            { nombre: 'insumo', obligatoriedad: 'opcional', campos: [
              { nombre: 'id', obligatoriedad: 'obligatorio', tipo: 'identificador', automatizaciones: ['stock-producible'] },
            ] },
          ],
        },
      },
    });
    irA(escenario, '#contrato');
    await asentarVarias();
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/contrato');
    const filas = nodo(escenario, 'contrato-cuerpo').hijos.map((f) => f.textContent);
    assert.equal(filas.length, 5, 'two entity headers and three fields');
    assert.match(filas[0], /producto/);
    assert.match(filas[0], /obligatoria/);
    assert.match(filas[1], /id.*identificador.*Sí.*stock-fisico, reporte-diario/);
    assert.match(filas[2], /sku.*texto.*No/);
    assert.match(filas[3], /insumo.*opcional/);
  });

  // ---- CH-30d (DEC-169, M2–M4): the Mapeo y validación screen -----------------------------

  const ENTIDADES_CONTRATO = ['producto', 'pedido', 'item_pedido', 'insumo', 'receta_componente'];
  const SQL_PRODUCTO = 'SELECT id, nombre, stock AS "stockDisponible", <b>activo</b> FROM tienda.productos';

  /** A stored report: producto invalid (a type mismatch with a cast hint), the rest unmapped. */
  function informeDePrueba(): Record<string, unknown> {
    return {
      entidades: ENTIDADES_CONTRATO.map((entidad, i) => i === 0
        ? {
            entidad, obligatoriedad: 'obligatorio', estado: 'invalida', validadaEn: '2026-10-12T10:00:00.000Z',
            diagnostico: {
              version: 1, sondeo: { resultado: 'ok' }, columnasSobrantes: [],
              campos: [{ campo: 'stockDisponible', tipoEsperado: 'numero', columna: 'stockDisponible', veredicto: 'tipo-incorrecto', oid: 25, tipoPostgres: 'text', tipoObservado: 'texto', pista: { accion: 'castear-en-la-vista', sugerencia: '::numeric' } }],
            },
          }
        : { entidad, obligatoriedad: i < 3 ? 'obligatorio' : 'opcional', estado: 'no-mapeada', validadaEn: null, diagnostico: null }),
      automatizaciones: [
        { automatizacion: 'stock-fisico', estado: 'bloqueada', motivos: [{ entidad: 'producto', campo: 'stockDisponible', motivo: 'tipo-incorrecto' }] },
        { automatizacion: 'stock-producible', estado: 'inaplicable', motivos: [{ entidad: 'insumo', campo: null, motivo: 'entidad-no-mapeada' }] },
        { automatizacion: 'reporte-diario', estado: 'bloqueada', motivos: [{ entidad: 'pedido', campo: null, motivo: 'entidad-no-mapeada' }] },
      ],
    };
  }

  /** Selects the tenant, opens Mapeo, and chooses connection c-1 with the stored report. */
  async function abrirMapeo(): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [CONEXION_LISTADA], truncado: false } });
    irA(escenario, '#mapeo');
    await asentarVarias();
    escenario.respuestas.push(
      { status: 200, cuerpo: { validacionMapeo: informeDePrueba() } },
      { status: 200, cuerpo: { vistasCanonicas: [{ id: 'v-1', entidad: 'producto', creadaEn: '2026-10-01T10:00:00.000Z', actualizadaEn: '2026-10-01T10:00:00.000Z' }] } },
      { status: 200, cuerpo: { vistaCanonica: { id: 'v-1', entidad: 'producto', sql: SQL_PRODUCTO } } },
    );
    const selector = nodo(escenario, 'mapeo-conexion');
    selector.value = 'c-1';
    selector.disparar('change');
    await asentarVarias();
    return escenario;
  }

  function bloqueEntidad(escenario: Escenario, entidad: string): Nodo {
    const bloque = nodo(escenario, 'mapeo-entidades').hijos.find((h) => h.hijos.some((n) => n.tagName === 'h3' && n.textContent.startsWith(entidad + ' ')));
    assert.ok(bloque, `no block for ${entidad}`);
    return bloque;
  }

  const editorDe = (bloque: Nodo): Nodo => buscar(bloque, (n) => n.tagName === 'textarea')[0];

  test('CH-30d Mapeo y validación sits between Agentes and Usuarios del panel', () => {
    const marcado = documento.slice(0, documento.indexOf('<script>'));
    assert.ok(marcado.indexOf('id="nav-agentes"') < marcado.indexOf('id="nav-mapeo"'));
    assert.ok(marcado.indexOf('id="nav-mapeo"') < marcado.indexOf('id="nav-usuarios"'));
  });

  test('CH-30d with no tenant Mapeo asks for one, and with no connection it asks for one too', async () => {
    const sinTenant = await arrancar();
    const antes = sinTenant.peticiones.length;
    irA(sinTenant, '#mapeo');
    await asentarVarias();
    assert.equal(sinTenant.peticiones.length, antes);
    assert.equal(nodo(sinTenant, 'mapeo-aviso').textContent, 'Elegí un tenant para mapear sus conexiones.');

    const escenario = await arrancar();
    await elegirTenant(escenario);
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [CONEXION_LISTADA], truncado: false } });
    irA(escenario, '#mapeo');
    await asentarVarias();
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/conexiones');
    assert.deepEqual(nodo(escenario, 'mapeo-conexion').options.map((o) => o.value), ['', 'c-1']);
    assert.equal(nodo(escenario, 'mapeo-aviso').textContent, 'Elegí una conexión para ver su mapeo.');
  });

  test('CH-30d choosing a connection shows the five entities with their state and stored SQL as text', async () => {
    const escenario = await abrirMapeo();
    const urls = escenario.peticiones.slice(-3).map((p) => p.url);
    assert.deepEqual(urls, ['/conexiones/c-1/validacion-mapeo', '/conexiones/c-1/vistas-canonicas', '/conexiones/c-1/vistas-canonicas/producto']);
    assert.equal(nodo(escenario, 'mapeo-entidades').hijos.length, 5);
    const producto = bloqueEntidad(escenario, 'producto');
    assert.match(producto.textContent, /obligatoria/);
    assert.match(producto.textContent, /Inválida/);
    assert.equal(editorDe(producto).value, SQL_PRODUCTO, 'the statement is the editor value, never markup');
    assert.match(bloqueEntidad(escenario, 'pedido').textContent, /Sin mapear/);
    assert.match(bloqueEntidad(escenario, 'insumo').textContent, /opcional/);
  });

  test('CH-30d an invalid field shows its verdict, column, observed type and the cast hint', async () => {
    const escenario = await abrirMapeo();
    const texto = bloqueEntidad(escenario, 'producto').textContent;
    for (const parte of ['stockDisponible', 'tipo-incorrecto', 'texto', '::numeric']) {
      assert.ok(texto.includes(parte), parte);
    }
  });

  test('CH-30d the automations show their state and every reason', async () => {
    const escenario = await abrirMapeo();
    const filas = nodo(escenario, 'mapeo-automatizaciones').hijos.map((f) => f.textContent);
    assert.equal(filas.length, 3);
    assert.match(filas[0], /stock-fisico.*bloqueada.*producto\.stockDisponible: tipo-incorrecto/);
    assert.match(filas[1], /stock-producible.*inaplicable.*insumo: entidad-no-mapeada/);
  });

  test('CH-30d Guardar sends the entity SQL and shows it as not validated', async () => {
    const escenario = await abrirMapeo();
    const producto = bloqueEntidad(escenario, 'producto');
    editorDe(producto).value = 'SELECT 1 AS id';
    escenario.respuestas.push({ status: 200, cuerpo: { vistaCanonica: { id: 'v-1', entidad: 'producto', sql: 'SELECT 1 AS id' } } });
    botonesCon(producto, 'Guardar')[0].disparar('click');
    await asentarVarias();
    const ultima = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(ultima.url, '/conexiones/c-1/vistas-canonicas/producto');
    assert.deepEqual(ultima.cuerpo, { sql: 'SELECT 1 AS id' });
    assert.match(producto.textContent, /Sin validar/);
  });

  test('CH-30d a session failure while validating is shown apart and keeps the last report', async () => {
    const escenario = await abrirMapeo();
    escenario.respuestas.push({ status: 200, cuerpo: { resultado: 'fallo', fase: 'conexion', categoria: 'credenciales-invalidas', codigo: '28P01', duracionMs: 20 } });
    nodo(escenario, 'mapeo-validar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/conexiones/c-1/validacion-mapeo');
    assert.match(nodo(escenario, 'mapeo-aviso').textContent, /credenciales-invalidas/);
    assert.match(bloqueEntidad(escenario, 'producto').textContent, /Inválida/);
    assert.equal(editorDe(bloqueEntidad(escenario, 'producto')).value, SQL_PRODUCTO);
  });

  test('CH-30d a successful validation repaints the states and keeps what is in the editors', async () => {
    const escenario = await abrirMapeo();
    editorDe(bloqueEntidad(escenario, 'producto')).value = 'SELECT 2 AS id';
    const valido = informeDePrueba();
    (valido.entidades as Array<Record<string, unknown>>)[0] = { entidad: 'producto', obligatoriedad: 'obligatorio', estado: 'valida', validadaEn: '2026-10-13T10:00:00.000Z', diagnostico: null };
    escenario.respuestas.push({ status: 200, cuerpo: { resultado: 'ok', validacionMapeo: valido } });
    nodo(escenario, 'mapeo-validar').disparar('click');
    await asentarVarias();
    assert.match(bloqueEntidad(escenario, 'producto').textContent, /Válida/);
    assert.equal(editorDe(bloqueEntidad(escenario, 'producto')).value, 'SELECT 2 AS id');
  });

  // ---- CH-34 (DEC-176): the «Cómo mapear» guide and an example SELECT per entity -----------

  test('CH-34 the guide is static markup, closed, above the entities', () => {
    const html = marcado();
    assert.ok(html.indexOf('id="mapeo-aviso"') < html.indexOf('id="mapeo-guia"'));
    assert.ok(html.indexOf('id="mapeo-guia"') < html.indexOf('id="mapeo-entidades"'));
    const guia = html.match(/<details id="mapeo-guia"[^>]*>[\s\S]*?<\/details>/)?.[0] ?? '';
    assert.ok(guia.length > 0, 'the guide is a details element');
    assert.ok(!/\bopen\b/.test(guia.match(/^<details[^>]*>/)?.[0] ?? ''), 'closed by default');
    assert.match(guia, /<summary>Cómo mapear<\/summary>/);
    assert.equal((guia.match(/<li>/g) ?? []).length, 5, 'five steps');
    assert.match(guia, /entidades opcionales pueden quedar sin mapear/);
  });

  test('CH-34 «Usar de punto de partida» copies the example into the empty insumo editor and sends nothing', async () => {
    const escenario = await abrirMapeo();
    const insumo = bloqueEntidad(escenario, 'insumo');
    assert.equal(editorDe(insumo).value, '');
    const antes = escenario.peticiones.length;
    botonesCon(insumo, 'Usar de punto de partida')[0].disparar('click');
    await asentarVarias();
    assert.equal(editorDe(insumo).value, EJEMPLOS_MAPEO.insumo);
    assert.equal(escenario.peticiones.length, antes, 'no request');
    assert.match(insumo.textContent, /Sin mapear/, 'the state is untouched');
    assert.match(nodo(escenario, 'mapeo-aviso').textContent, /Se copió el ejemplo de insumo/);
  });

  test('CH-34 the example never overwrites SQL: producto stays as it was and the notice says so', async () => {
    const escenario = await abrirMapeo();
    const producto = bloqueEntidad(escenario, 'producto');
    const antes = escenario.peticiones.length;
    botonesCon(producto, 'Usar de punto de partida')[0].disparar('click');
    await asentarVarias();
    assert.equal(editorDe(producto).value, SQL_PRODUCTO);
    assert.equal(escenario.peticiones.length, antes, 'no request');
    assert.match(producto.textContent, /Inválida/, 'the state is untouched');
    assert.match(nodo(escenario, 'mapeo-aviso').textContent, /El editor de producto ya tiene SQL/);
    // Whitespace alone counts as empty.
    editorDe(producto).value = ' \n\t ';
    botonesCon(producto, 'Usar de punto de partida')[0].disparar('click');
    assert.equal(editorDe(producto).value, EJEMPLOS_MAPEO.producto);
  });

  test('CH-34 every entity block renders its example as text under a details element', async () => {
    const escenario = await abrirMapeo();
    for (const entidad of ENTIDADES_CONTRATO) {
      const bloque = bloqueEntidad(escenario, entidad);
      const detalle = buscar(bloque, (n) => n.tagName === 'details');
      assert.equal(detalle.length, 1, entidad + ' has one example');
      assert.match(detalle[0].hijos[0].textContent, /Ejemplo sobre la réplica de demo \(food_store\)/);
      const pre = buscar(detalle[0], (n) => n.tagName === 'pre');
      assert.equal(pre.length, 1);
      assert.equal(pre[0].textContent, EJEMPLOS_MAPEO[entidad], 'verbatim, as textContent');
      assert.equal(pre[0].hijos.length, 0, 'a text node holder only');
    }
  });

  test('CH-34 jsonEnScript never emits "</" or a raw line separator, and round-trips the value', () => {
    const valor = { a: '</script><!-- <b>', b: 'x\u2028y\u2029z', c: "'q' \"d\"\n" };
    const salida = jsonEnScript(valor);
    assert.ok(!salida.includes('</') && !salida.includes('<'), 'no "<" at all');
    assert.ok(!salida.includes('\u2028') && !salida.includes('\u2029'));
    assert.deepEqual(JSON.parse(salida), valor);
    assert.ok(!jsonEnScript(EJEMPLOS_MAPEO).includes('</'));
    assert.equal(script.split('</' + 'script').length - 1, 0, 'no closing tag inside the script');
    assert.equal(documento.split('</' + 'script').length - 1, 1, 'the document has only its own closing tag');
  });

  // ---- CH-20 (DEC-161): the run names the loaded saved query while its text is unchanged ----

  /** The body of the last `POST /consultas/ejecutar` the console sent. */
  function ultimaEjecucion(escenario: Escenario): Record<string, unknown> {
    const ejecuciones = escenario.peticiones.filter((p) => p.url === '/consultas/ejecutar');
    assert.ok(ejecuciones.length > 0, 'the console sent no execution');
    return ejecuciones[ejecuciones.length - 1].cuerpo as Record<string, unknown>;
  }

  test('CH-20 running the loaded query unchanged sends its id and version', async () => {
    const escenario = await conConsultaCargada({ sql: 'SELECT 1', parametros: [] });
    nodo(escenario, 'conexion').value = 'c-1';
    await enviar(escenario, respuestaOk());
    const cuerpo = ultimaEjecucion(escenario);
    assert.equal(cuerpo.consultaGuardadaId, 'q-1');
    assert.equal(cuerpo.version, 3);
  });

  test('CH-20 after saving a new version, running the saved text sends the new version', async () => {
    const escenario = await conConsultaCargada({ sql: 'SELECT 1', parametros: [] });
    nodo(escenario, 'conexion').value = 'c-1';
    nodo(escenario, 'sql').value = 'SELECT 2';
    await probarOk(escenario);
    await guardarVersion(
      escenario,
      { status: 200, cuerpo: { consultaGuardada: { ...COMPLETA, sql: 'SELECT 2', parametros: [], version: 4 } } },
      { status: 200, cuerpo: { versiones: [], truncado: false } },
    );
    await enviar(escenario, respuestaOk());
    const cuerpo = ultimaEjecucion(escenario);
    assert.equal(cuerpo.consultaGuardadaId, 'q-1');
    assert.equal(cuerpo.version, 4);
  });

  test('CH-20 running after an edit sends neither field', async () => {
    const escenario = await conConsultaCargada({ sql: 'SELECT 1', parametros: [] });
    nodo(escenario, 'conexion').value = 'c-1';
    nodo(escenario, 'sql').value = 'SELECT 1 + 1';
    await enviar(escenario, respuestaOk());
    const cuerpo = ultimaEjecucion(escenario);
    assert.ok(!('consultaGuardadaId' in cuerpo));
    assert.ok(!('version' in cuerpo));
  });

  test('CH-20 running with no query loaded sends neither field', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    nodo(escenario, 'conexion').value = 'c-1';
    nodo(escenario, 'sql').value = 'SELECT 1';
    await enviar(escenario, respuestaOk());
    const cuerpo = ultimaEjecucion(escenario);
    assert.ok(!('consultaGuardadaId' in cuerpo));
    assert.ok(!('version' in cuerpo));
  });

  // ---- CH-32a (DEC-172): the connection picker, saving without duplicates, "Consulta nueva" ----

  const CX_TIENDA = { id: 'c-1', nombre: 'food-store' };
  const CX_REPLICA = { id: 'c-2', nombre: 'replica-b' };

  /** The picker's options as [value, text] pairs. */
  const opcionesConsulta = (escenario: Escenario): string[][] =>
    nodo(escenario, 'conexion').options.map((opcion) => [opcion.value, opcion.textContent]);

  /**
   * Selects the tenant with `respuestaConexiones` as the answer to the picker's request (a
   * pending `Promise` as `cuerpo` keeps it in flight); the other loads answer empty.
   */
  async function elegirTenantCon(
    escenario: Escenario,
    respuestaConexiones: { status: number; cuerpo: unknown },
    id = 't-1',
  ): Promise<void> {
    const selector = nodo(escenario, 'tenant');
    selector.value = id;
    escenario.respuestas.push(
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
      respuestaConexiones,
      ...respuestasAutomatizaciones([], []),
    );
    selector.disparar('change');
    await asentarVarias();
  }

  /** Boots and selects the tenant with the two connections (and one saved query) listed. */
  async function conConexiones(conexiones: unknown[] = [CX_TIENDA, CX_REPLICA]): Promise<Escenario> {
    const escenario = await arrancar();
    await elegirTenant(escenario, [FILA_GUARDADA], [], 't-1', undefined, conexiones);
    return escenario;
  }

  test('CH-32a the picker is a select labeled Conexión with a status notice and a hidden Reintentar', () => {
    verificarIds(marcado());
    assert.match(marcado(), /<label for="conexion" class="zd-label">Conexión<\/label>\s*<select id="conexion" class="zd-select"[^>]*\brequired\b/);
    assert.ok(!marcado().includes('<input id="conexion"'), 'the free-text input is gone');
    assert.match(marcado(), /<p id="conexion-aviso" class="ayuda" role="status"><\/p>/);
    assert.match(marcado(), /<button id="conexion-reintentar"[^>]*type="button"[^>]*\bhidden\b/);
  });

  test('CH-32a the picker lists each connection by name and short id, with the id as the value, as text', async () => {
    const hostil = { id: 'c-3', nombre: '<img src=x onerror=alert(1)>' };
    const escenario = await conConexiones([CX_TIENDA, CX_REPLICA, hostil]);
    assert.deepEqual(opcionesConsulta(escenario), [
      ['', 'Elegí una conexión'],
      ['c-1', 'food-store (c-1…)'],
      ['c-2', 'replica-b (c-2…)'],
      ['c-3', '<img src=x onerror=alert(1)> (c-3…)'],
    ]);
    assert.ok(nodo(escenario, 'conexion').options.every((opcion) => opcion.hijos.length === 0), 'text only');
    assert.equal(nodo(escenario, 'conexion').value, '', 'nothing is chosen for the operator');
    assert.equal(nodo(escenario, 'conexion').disabled, false);
    assert.equal(nodo(escenario, 'conexion-aviso').textContent, '');
    assert.equal(nodo(escenario, 'conexion-reintentar').hidden, true);
    const pedida = escenario.peticiones.filter((p) => p.url === '/conexiones');
    // The picker's own request, and the automations list's (CH-32b), both scoped to the active tenant.
    assert.deepEqual(pedida.map((p) => p.tenant), ['t-1', 't-1']);
  });

  test('CH-32a while the list is on its way the picker says so and is disabled', async () => {
    const escenario = await arrancar();
    let responder!: (cuerpo: unknown) => void;
    await elegirTenantCon(escenario, { status: 200, cuerpo: new Promise((resolver) => { responder = resolver; }) });
    assert.deepEqual(opcionesConsulta(escenario), [['', 'Cargando conexiones…']]);
    assert.equal(nodo(escenario, 'conexion').disabled, true);

    responder({ conexiones: [CX_TIENDA], truncado: false });
    await asentarVarias();
    assert.deepEqual(opcionesConsulta(escenario), [['', 'Elegí una conexión'], ['c-1', 'food-store (c-1…)']]);
    assert.equal(nodo(escenario, 'conexion').disabled, false);
  });

  test('CH-32a an empty list says so and points to Conexiones', async () => {
    const escenario = await conConexiones([]);
    assert.deepEqual(opcionesConsulta(escenario), [['', 'No hay conexiones registradas']]);
    const aviso = nodo(escenario, 'conexion-aviso');
    assert.equal(aviso.textContent, 'Este tenant no tiene conexiones. Registrá una en Conexiones para poder ejecutar.');
    const enlaces = buscar(aviso, (n) => n.tagName === 'a');
    assert.equal(enlaces.length, 1);
    assert.equal(enlaces[0].getAttribute('href'), '#conexiones');
    assert.equal(enlaces[0].textContent, 'Conexiones');
    assert.equal(nodo(escenario, 'conexion-reintentar').hidden, true, 'not an error');
  });

  test('CH-32a a capped list says how many are shown', async () => {
    const escenario = await arrancar();
    await elegirTenantCon(escenario, { status: 200, cuerpo: { conexiones: [CX_TIENDA, CX_REPLICA], truncado: true } });
    assert.equal(nodo(escenario, 'conexion-aviso').textContent, 'Se muestran las primeras 2 conexiones, en orden alfabético.');
    assert.equal(opcionesConsulta(escenario).length, 3);
  });

  test('CH-32a a failed list says so, offers Reintentar, and pressing it asks again', async () => {
    const escenario = await arrancar();
    await elegirTenantCon(escenario, { status: 500, cuerpo: { error: 'interno' } });
    assert.equal(nodo(escenario, 'conexion-aviso').textContent, 'No se pudieron cargar las conexiones.');
    assert.equal(nodo(escenario, 'conexion-reintentar').hidden, false);
    assert.equal(nodo(escenario, 'conexion').disabled, false);
    assert.equal(opcionesConsulta(escenario).length, 1, 'only a placeholder, nothing to choose');

    const antes = escenario.peticiones.length;
    await enviar(escenario, { conexiones: [CX_TIENDA], truncado: false }, 200, 'conexion-reintentar', 'click');
    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => [p.url, p.tenant]), [['/conexiones', 't-1']]);
    assert.deepEqual(opcionesConsulta(escenario), [['', 'Elegí una conexión'], ['c-1', 'food-store (c-1…)']]);
    assert.equal(nodo(escenario, 'conexion-aviso').textContent, '');
    assert.equal(nodo(escenario, 'conexion-reintentar').hidden, true);
  });

  test('CH-32a with no tenant the picker says so and nothing is sent', async () => {
    const escenario = await arrancar();
    assert.deepEqual(opcionesConsulta(escenario), [['', 'Elegí un tenant para ver sus conexiones']]);
    irA(escenario, '#frescura');
    irA(escenario, '#consultas');
    await asentarVarias();
    assert.deepEqual(escenario.peticiones.map((p) => p.url), ['/tenants'], 'only the tenant list was asked for');

    // Going back to no tenant empties the previous tenant's connections and sends nothing.
    await elegirTenant(escenario, [], [], 't-1', undefined, [CX_TIENDA]);
    const antes = escenario.peticiones.length;
    nodo(escenario, 'tenant').value = '';
    nodo(escenario, 'tenant').disparar('change');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes);
    assert.deepEqual(opcionesConsulta(escenario), [['', 'Elegí un tenant para ver sus conexiones']]);
  });

  test('CH-32a showing Consultas asks for the connections again and keeps the choice while it is listed', async () => {
    const escenario = await conConexiones();
    nodo(escenario, 'conexion').value = 'c-2';
    irA(escenario, '#frescura');
    const antes = escenario.peticiones.length;
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [CX_TIENDA, CX_REPLICA], truncado: false } });
    irA(escenario, '#consultas');
    await asentarVarias();
    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => p.url), ['/conexiones']);
    assert.equal(nodo(escenario, 'conexion').value, 'c-2', 'the choice survives the reload');

    // A connection that is gone from the list cannot stay chosen.
    irA(escenario, '#frescura');
    escenario.respuestas.push({ status: 200, cuerpo: { conexiones: [CX_TIENDA], truncado: false } });
    irA(escenario, '#consultas');
    await asentarVarias();
    assert.equal(nodo(escenario, 'conexion').value, '');
  });

  test('CH-32a executing with no connection chosen says so, focuses the picker and sends nothing', async () => {
    const escenario = await conConexiones();
    let enfocado = 0;
    nodo(escenario, 'conexion').focus = (): void => { enfocado += 1; };
    const antes = escenario.peticiones.length;
    nodo(escenario, 'formulario').disparar('submit');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes, 'no execution request');
    assert.equal(nodo(escenario, 'conexion-aviso').textContent, 'Elegí una conexión para ejecutar.');
    assert.equal(enfocado, 1);
    assert.equal(nodo(escenario, 'ejecutar').disabled, false, 'the button is not left disabled');

    // Choosing one and running again sends it and drops the notice.
    nodo(escenario, 'conexion').value = 'c-1';
    await enviar(escenario, respuestaOk());
    assert.equal(ultimaEjecucion(escenario).conexionId, 'c-1');
    assert.equal(nodo(escenario, 'conexion-aviso').textContent, '');
  });

  test('CH-32a the chosen id goes as conexionId', async () => {
    const escenario = await conConexiones();
    nodo(escenario, 'conexion').value = 'c-2';
    await enviar(escenario, respuestaOk());
    assert.equal(ultimaEjecucion(escenario).conexionId, 'c-2');
  });

  test('CH-32a loading a saved query keeps the chosen connection and asks for nothing else', async () => {
    const escenario = await conConexiones();
    nodo(escenario, 'conexion').value = 'c-2';
    escenario.respuestas.push({ status: 200, cuerpo: { consultaGuardada: COMPLETA } });
    const antes = escenario.peticiones.length;
    botonesCon(nodo(escenario, 'guardadas'), 'Abrir')[0].disparar('click');
    await asentarVarias();
    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => p.url), ['/consultas-guardadas/q-1']);
    assert.equal(nodo(escenario, 'conexion').value, 'c-2');
    assert.equal(nodo(escenario, 'sql').value, 'SELECT :a');
  });

  test('CH-32a a list answered after a tenant switch is dropped', async () => {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra tienda' }]);
    let responderA!: (cuerpo: unknown) => void;
    await elegirTenantCon(escenario, { status: 200, cuerpo: new Promise((resolver) => { responderA = resolver; }) }, 't-1');
    await elegirTenantCon(escenario, { status: 200, cuerpo: { conexiones: [{ id: 'c-B', nombre: 'replica-B' }], truncado: false } }, 't-2');
    responderA({ conexiones: [{ id: 'c-A', nombre: 'replica-A' }], truncado: true });
    await asentarVarias();
    assert.deepEqual(opcionesConsulta(escenario), [['', 'Elegí una conexión'], ['c-B', 'replica-B (c-B…)']]);
    assert.equal(nodo(escenario, 'conexion-aviso').textContent, '', "A's capped notice is dropped too");
  });

  // ---- CH-32a (DEC-172): a loaded query is saved only as a new version ----

  test('CH-32a with no query loaded Guardar consulta is shown and creates the query', async () => {
    const escenario = await conConsulta();
    assert.equal(nodo(escenario, 'guardar').hidden, false);
    nodo(escenario, 'nombre').value = 'Ventas';
    await probarOk(escenario);
    escenario.respuestas.push({ status: 201, cuerpo: { consultaGuardada: FILA_GUARDADA } });
    const antes = escenario.peticiones.length;
    await enviar(escenario, { consultasGuardadas: [FILA_GUARDADA], truncado: false }, 200, 'guardar', 'click');
    const nuevas = escenario.peticiones.slice(antes);
    assert.deepEqual(nuevas.map((p) => p.url), ['/consultas-guardadas', '/consultas-guardadas']);
    assert.equal((nuevas[0].cuerpo as Record<string, unknown>).nombre, 'Ventas');
  });

  test('CH-32a after loading a query Guardar consulta is hidden and the new-version block is shown', async () => {
    const escenario = await conConsultaCargada();
    assert.equal(nodo(escenario, 'guardar').hidden, true);
    assert.equal(nodo(escenario, 'version-guardar').hidden, false);
  });

  test('CH-32a the create control is shown again whenever the loaded query is forgotten', async () => {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    await elegirTenant(escenario, [FILA_GUARDADA]);
    escenario.respuestas.push({ status: 200, cuerpo: { consultaGuardada: COMPLETA } });
    botonesCon(nodo(escenario, 'guardadas'), 'Abrir')[0].disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'guardar').hidden, true);
    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(nodo(escenario, 'guardar').hidden, false, 'a tenant switch forgets the loaded query');

    const otra = await conConsultaCargada();
    await probarOk(otra);
    await guardarVersion(
      otra,
      { status: 404, cuerpo: { error: 'consulta-guardada-no-encontrada' } },
      { status: 200, cuerpo: { consultasGuardadas: [], truncado: false } },
    );
    assert.equal(nodo(otra, 'guardar').hidden, false, 'a query that is gone is forgotten too');
  });

  test('CH-32a Guardar consulta with a query loaded sends nothing, even if triggered', async () => {
    const escenario = await conConsultaCargada();
    nodo(escenario, 'nombre').value = 'Copia';
    // Even with the gate open (an ok «Probar» and a name), the create control does nothing here.
    await probarOk(escenario);
    const antes = escenario.peticiones.length;
    nodo(escenario, 'guardar').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes, 'no create request');
    assert.equal(nodo(escenario, 'nombre').value, 'Copia', 'and the editor is left as it was');
    assert.equal(nodo(escenario, 'banner').hidden, true);
  });

  test('CH-32a the saved-queries help explains versions and «Nueva consulta», and says they cannot be deleted', () => {
    const seccion = marcado().slice(marcado().indexOf('<section id="guardado">'), marcado().indexOf('<section id="automatizaciones">'));
    const ayuda = seccion.match(/<p class="ayuda">([^<]*)<\/p>/)?.[1] ?? '';
    assert.equal(
      ayuda,
      'Abrí una consulta para probarla o guardar una versión nueva de ella. Para crear otra, usá «Nueva consulta». No se puede borrar.',
    );
  });

  // ---- CH-32a PR2 (DEC-172, DEC-173): the query pop-up ----

  /** The screen's markup from its header to the start of the next screen. */
  const pantallaConsultas = (): string =>
    marcado().slice(marcado().indexOf('<section id="pantalla-consultas"'), marcado().indexOf('<section id="pantalla-automatizaciones"'));

  /** The pop-up's markup, from its backdrop to the saved queries that follow it (it keeps the result above them, CH-30a). */
  const markupDialogo = (): string =>
    marcado().slice(marcado().indexOf('<div id="consulta-dialogo"'), marcado().indexOf('<section id="guardado">'));

  /** Replaces the node's `focus` with a spy and returns the list of ids that took the focus. */
  function espiarFoco(escenario: Escenario, ...ids: string[]): string[] {
    const enfocados: string[] = [];
    for (const id of ids) nodo(escenario, id).focus = () => void enfocados.push(id);
    return enfocados;
  }

  /** Presses the header's «Nueva consulta». */
  const abrirNueva = (escenario: Escenario): void => nodo(escenario, 'consulta-nueva').disparar('click');

  /** Presses «Abrir» on the one saved query, answering with `COMPLETA` plus `extra`, and lets it settle. */
  async function abrirGuardada(escenario: Escenario, extra: Record<string, unknown> = {}): Promise<void> {
    escenario.respuestas.push({ status: 200, cuerpo: { consultaGuardada: { ...COMPLETA, ...extra } } });
    botonesCon(nodo(escenario, 'guardadas'), 'Abrir')[0].disparar('click');
    await asentarVarias();
  }

  /** Types `valor` into a field and fires the event a browser fires for it. */
  function escribir(escenario: Escenario, id: string, valor: string, evento = 'input'): void {
    nodo(escenario, id).value = valor;
    nodo(escenario, id).disparar(evento);
  }

  /** Whether the pop-up whose backdrop is `idFondo` (the query one by default) is open. */
  const dialogoAbierto = (escenario: Escenario, idFondo = 'consulta-dialogo'): boolean => !nodo(escenario, idFondo).hidden;
  const tituloDialogo = (escenario: Escenario): string => nodo(escenario, 'consulta-dialogo-titulo').textContent;

  /** The two ways to ask the pop-up to close: its «Cancelar» and the Escape key pressed inside it. */
  const formasDeCancelar = (idCancelar: string, idFondo: string): Array<[string, (escenario: Escenario) => void]> => [
    ['Cancelar', (escenario) => nodo(escenario, idCancelar).disparar('click')],
    ['Escape', (escenario) => nodo(escenario, idFondo).disparar('keydown', { key: 'Escape' })],
  ];
  const FORMAS_DE_CANCELAR = formasDeCancelar('consulta-cancelar', 'consulta-dialogo');

  /** CH-32b: presses the page header's opener `idAbridor` (a pop-up opens synchronously). */
  const abrirDialogo = (escenario: Escenario, idAbridor: string): void => nodo(escenario, idAbridor).disparar('click');

  test('CH-32a PR2 the page header holds the primary «Nueva consulta» and none of the first version\'s ids is left', () => {
    verificarIds(marcado());
    const pantalla = pantallaConsultas();
    const cabecera = pantalla.slice(0, pantalla.indexOf('</header>'));
    assert.match(cabecera, /<div class="zd-pagehead__actions">\s*<button id="consulta-nueva" class="zd-btn zd-btn--primary" type="button">Nueva consulta<\/button>\s*<\/div>/);
    for (const id of IDS_RETIRADOS) {
      assert.ok(!documento.includes(id), id + ' was never merged and must not come back, in the markup or the script');
    }
  });

  test('CH-32a PR2 the pop-up is a hidden modal dialog: title, fields in order, the result inside and the actions at the foot', () => {
    const d = markupDialogo();
    assert.match(d, /^<div id="consulta-dialogo" class="zd-dialog-backdrop" hidden>\s*<div class="zd-dialog" role="dialog" aria-modal="true" aria-labelledby="consulta-dialogo-titulo">\s*<h2 id="consulta-dialogo-titulo" class="zd-dialog__title">Nueva consulta<\/h2>/);
    assert.ok(pantallaConsultas().includes(d.slice(0, 40)), 'inside the Consultas screen, so it goes with it');

    const orden = [
      'nombre', 'descripcion', 'formulario', 'conexion', 'conexion-aviso', 'conexion-reintentar', 'sql', 'parametros',
      'agregar-parametro', 'limite', 'version-campos', 'version-nota', 'estado', 'resultados', 'anterior', 'siguiente',
      'ejecutar', 'guardar', 'version-boton', 'consulta-cancelar',
    ].map((id) => d.indexOf('id="' + id + '"'));
    assert.ok(orden.every((posicion) => posicion !== -1), 'every piece is inside the pop-up');
    assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'in that order, top to bottom');
    // The name and description sit outside #formulario, so browser validation never blocks «Probar» for want of a name.
    const formulario = d.match(/<form id="formulario">[\s\S]*?<\/form>/)?.[0] ?? '';
    for (const id of ['conexion', 'sql', 'parametros', 'agregar-parametro', 'limite']) assert.ok(formulario.includes('id="' + id + '"'), id + ' is in the form');
    for (const id of ['nombre', 'descripcion', 'version-campos', 'ejecutar', 'guardar']) assert.ok(!formulario.includes('id="' + id + '"'), id + ' is not');

    const acciones = d.slice(d.indexOf('<div class="zd-dialog__actions">'));
    assert.match(acciones, /<button id="ejecutar"[^>]*type="submit"[^>]*form="formulario"[^>]*>Probar<\/button>/);
    assert.match(acciones, /<button id="guardar"[^>]*zd-btn--primary[^>]*type="button"[^>]*\bdisabled\b[^>]*>Guardar consulta<\/button>/);
    assert.match(acciones, /<button id="version-boton"[^>]*type="button"[^>]*\bhidden\b[^>]*>Guardar como versión nueva<\/button>/);
    assert.match(acciones, /<button id="consulta-cancelar"[^>]*zd-btn--ghost[^>]*type="button">Cancelar<\/button>/);
    assert.match(acciones, /<span id="consulta-nueva-confirmar" hidden>[\s\S]*Hay cambios sin guardar\.[\s\S]*<button id="consulta-nueva-descartar"[^>]*type="button">Descartar cambios<\/button>[\s\S]*<button id="consulta-nueva-cancelar"[^>]*type="button">Seguir editando<\/button>/);
    const botonesDialogo = d.match(/<button[^>]*>/g) ?? [];
    assert.ok(botonesDialogo.every((etiqueta) => etiqueta.includes('type="button"') || etiqueta.includes('id="ejecutar"')), 'only «Probar» submits');
    assert.match(d, /<div id="version-guardar" hidden>\s*<p id="version-cargada" class="ayuda"><\/p>\s*<div id="version-campos" hidden>/);
  });

  test('CH-32a PR2 the pop-up is made wide by one rule of the console\'s own style, with no new shared class', () => {
    assert.match(documento, /#consulta-dialogo \.zd-dialog \{ width: min\(1100px, 100%\)/);
    assert.equal(documento.split('<style').length - 1, 1, 'still one style element');
    assert.ok(!/zd-dialog--/.test(documento), 'no invented modifier of the shared dialog');
  });

  test('CH-32a PR2 the saved queries keep only their list and the history; the fields moved into the pop-up', () => {
    const pantalla = pantallaConsultas();
    const inicio = pantalla.indexOf('<section id="guardado">');
    const guardado = pantalla.slice(inicio, pantalla.indexOf('</section>', inicio));
    for (const id of ['nombre', 'descripcion', 'version-nota', 'guardar', 'version-boton', 'conexion', 'sql']) {
      assert.ok(!guardado.includes('id="' + id + '"'), id + ' is no longer there');
    }
    assert.match(guardado, /<h2 class="zd-h2">Consultas guardadas<\/h2>/);
    assert.ok(guardado.includes('id="guardadas"'));
    // The history is a wide side panel that keeps its ids and its Cerrar versiones button.
    const panel = guardado.match(/<aside id="versiones"[\s\S]*?<\/aside>/)?.[0] ?? '';
    assert.match(panel, /^<aside id="versiones" class="zd-drawer zd-drawer--wide" aria-labelledby="versiones-titulo" hidden>/);
    assert.match(panel, /<div class="zd-drawer__head"><h2 id="versiones-titulo" class="zd-h2"><\/h2><\/div>/);
    for (const id of ['versiones-estado', 'versiones-lista', 'versiones-comparacion']) assert.ok(panel.includes('id="' + id + '"'), id);
    assert.match(panel, /<div class="zd-drawer__foot">\s*<button id="versiones-cerrar"[^>]*type="button">Cerrar versiones<\/button>/);
  });

  test('CH-32a PR2 «Nueva consulta» opens the pop-up empty and titled, with only Guardar consulta, the name focused and nothing sent', async () => {
    const escenario = await conConsulta();
    nodo(escenario, 'sql').value = 'SELECT algo';
    nodo(escenario, 'nombre').value = 'resto';
    nodo(escenario, 'descripcion').value = 'resto';
    declarar(escenario, 'x', 'texto');
    const enfocados = espiarFoco(escenario, 'nombre');
    const antes = escenario.peticiones.length;
    assert.equal(dialogoAbierto(escenario), false, 'closed at load');

    abrirNueva(escenario);
    assert.equal(dialogoAbierto(escenario), true);
    assert.equal(tituloDialogo(escenario), 'Nueva consulta');
    for (const id of ['nombre', 'descripcion', 'sql']) assert.equal(nodo(escenario, id).value, '', id);
    assert.equal(filas(escenario).length, 0);
    assert.equal(nodo(escenario, 'guardar').hidden, false);
    assert.equal(nodo(escenario, 'guardar').disabled, true, 'nothing tested yet');
    for (const id of ['version-boton', 'version-campos', 'version-guardar', 'consulta-nueva-confirmar']) assert.equal(nodo(escenario, id).hidden, true, id);
    assert.deepEqual(enfocados, ['nombre']);
    assert.equal(escenario.peticiones.length, antes, 'opening sends nothing');
  });

  test('CH-32a PR2 «Nueva consulta» with no tenant says so on the page and does not open', async () => {
    const escenario = await arrancar();
    abrirNueva(escenario);
    await asentarVarias();
    assert.equal(dialogoAbierto(escenario), false);
    assert.equal(nodo(escenario, 'banner').textContent, 'Elegí un tenant en la barra superior antes de operar. No se envió ninguna solicitud.');
    assert.deepEqual(escenario.peticiones.map((p) => p.url), ['/tenants']);
  });

  test('CH-32a PR2 «Abrir» loads the query and opens the pop-up titled with its name and version, keeping the chosen connection', async () => {
    const escenario = await conConexiones();
    nodo(escenario, 'conexion').value = 'c-2';
    const enfocados = espiarFoco(escenario, 'nombre');
    const antes = escenario.peticiones.length;
    await abrirGuardada(escenario);

    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => p.url), ['/consultas-guardadas/q-1'], 'one request, the load');
    assert.equal(dialogoAbierto(escenario), true);
    assert.equal(tituloDialogo(escenario), 'Stock · versión 3');
    assert.equal(nodo(escenario, 'nombre').value, 'Stock');
    assert.equal(nodo(escenario, 'descripcion').value, 'Productos');
    assert.equal(nodo(escenario, 'sql').value, 'SELECT :a');
    assert.equal(filas(escenario).length, 1);
    assert.equal(nodo(escenario, 'conexion').value, 'c-2', 'the last connection is kept (DEC-11)');
    assert.equal(nodo(escenario, 'guardar').hidden, true, 'a loaded query cannot be saved as a copy');
    assert.equal(nodo(escenario, 'version-boton').hidden, false);
    assert.equal(nodo(escenario, 'version-boton').textContent, 'Guardar como versión 4');
    assert.equal(nodo(escenario, 'version-boton').disabled, true, 'nothing tested yet');
    assert.equal(nodo(escenario, 'version-campos').hidden, false);
    assert.equal(nodo(escenario, 'version-guardar').hidden, false);
    assert.equal(nodo(escenario, 'version-cargada').textContent, '«Stock» · Versión 3 · vigente');
    assert.deepEqual(enfocados, ['nombre']);
  });

  test('CH-32a PR2 «Abrir» on a query that is gone does not open the pop-up and says so on the page', async () => {
    const escenario = await conConsulta();
    escenario.respuestas.push(
      { status: 404, cuerpo: { error: 'consulta-guardada-no-encontrada' } },
      { status: 200, cuerpo: { consultasGuardadas: [], truncado: false } },
    );
    botonesCon(nodo(escenario, 'guardadas'), 'Abrir')[0].disparar('click');
    await asentarVarias();
    assert.equal(dialogoAbierto(escenario), false);
    assert.equal(nodo(escenario, 'banner').textContent, 'Esa consulta guardada ya no existe. Se actualizó la lista.');
  });

  test('CH-32a PR2 a hostile name is shown as text in the title, the notice and the fields', async () => {
    const hostil = '<img src=x onerror=alert(1)>';
    const escenario = await conConsulta();
    await abrirGuardada(escenario, { nombre: hostil, descripcion: hostil });
    assert.equal(tituloDialogo(escenario), hostil + ' · versión 3');
    assert.equal(nodo(escenario, 'consulta-dialogo-titulo').hijos.length, 0, 'a text node holder only');
    assert.equal(nodo(escenario, 'nombre').value, hostil);
    assert.equal(nodo(escenario, 'descripcion').value, hostil);
    assert.equal(nodo(escenario, 'version-cargada').hijos.length, 0);
    assert.ok(!/zd-(dialog|drawer|btn|badge)/.test(script), 'the script assigns none of the shared overlay or button classes');
  });

  test('CH-32a PR2 «Probar» runs the statement and shows the result, paginated, inside the open pop-up', async () => {
    const escenario = await conConexiones();
    abrirNueva(escenario);
    escribir(escenario, 'sql', 'SELECT id FROM producto');
    escribir(escenario, 'conexion', 'c-1', 'change');
    await enviar(escenario, respuestaOk());
    const cuerpo = ultimaEjecucion(escenario);
    assert.equal(cuerpo.conexionId, 'c-1');
    assert.equal(cuerpo.sql, 'SELECT id FROM producto');
    assert.equal(dialogoAbierto(escenario), true);
    assert.equal(nodo(escenario, 'estado').hidden, false);
    assert.match(nodo(escenario, 'estado').textContent, /Filas 1 a 2\./);
    assert.equal(escenario.encabezado.hijos[0].hijos.length, 1, 'one column');
    assert.equal(escenario.cuerpoTabla.hijos.length, 2, 'two rows');
    assert.equal(nodo(escenario, 'siguiente').disabled, false, 'the pager works inside the pop-up');
  });

  test('CH-32a PR2 the save control opens only after an ok «Probar» and a name', async () => {
    const escenario = await conConexiones();
    abrirNueva(escenario);
    escribir(escenario, 'sql', 'SELECT 1 AS id');
    escribir(escenario, 'conexion', 'c-1', 'change');
    escribir(escenario, 'nombre', 'Ventas');
    assert.equal(nodo(escenario, 'guardar').disabled, true, 'disabled before a test');

    await enviar(escenario, respuestaOk());
    assert.equal(nodo(escenario, 'guardar').disabled, false, 'enabled after an ok test with a name');

    escribir(escenario, 'nombre', '   ');
    assert.equal(nodo(escenario, 'guardar').disabled, true, 'a blank name closes it');
    escribir(escenario, 'nombre', 'Ventas');
    assert.equal(nodo(escenario, 'guardar').disabled, false);
  });

  test('CH-32a the line next to the save control says why it is closed, and is empty once it may save', async () => {
    const ayuda = (e: Escenario) => nodo(e, 'guardado-ayuda').textContent;
    const escenario = await conConexiones();
    abrirNueva(escenario);
    assert.match(documento, /<button id="guardar"[^>]*aria-describedby="guardado-ayuda"/);
    assert.match(documento, /<button id="version-boton"[^>]*aria-describedby="guardado-ayuda"/);
    assert.equal(ayuda(escenario), 'Probá la consulta para poder guardarla.', 'before any test');

    escribir(escenario, 'sql', 'SELECT 1 AS id');
    escribir(escenario, 'conexion', 'c-1', 'change');
    await enviar(escenario, respuestaOk());
    assert.equal(ayuda(escenario), 'Escribí un nombre para poder guardarla.', 'tested, no name yet');

    escribir(escenario, 'nombre', 'Ventas');
    assert.equal(nodo(escenario, 'guardar').disabled, false);
    assert.equal(ayuda(escenario), '', 'nothing to say once it may save');

    escribir(escenario, 'sql', 'SELECT 2 AS id');
    assert.equal(ayuda(escenario), 'Cambiaste la consulta después de probarla. Probala de nuevo para poder guardarla.');

    await enviar(escenario, { error: 'interno' }, 500);
    assert.equal(ayuda(escenario), 'La última prueba falló. Corregí la consulta y probala de nuevo para poder guardarla.');

    await enviar(escenario, respuestaOk());
    assert.equal(ayuda(escenario), '', 'a passing test of the current content clears it');

    abrirNueva(escenario);
    assert.equal(ayuda(escenario), 'Probá la consulta para poder guardarla.', 'reopening forgets the last test');
  });

  test('CH-32a PR2 editing the SQL, the connection or the parameters closes the gate until «Probar» succeeds again', async () => {
    const ediciones: Array<[string, (escenario: Escenario) => void]> = [
      ['the SQL', (e) => escribir(e, 'sql', 'SELECT 2 AS id')],
      ['the connection', (e) => escribir(e, 'conexion', 'c-2', 'change')],
      ['a new parameter', (e) => void declarar(e, 'otro', 'texto')],
      ['a parameter name', (e) => { en(filas(e)[0], 'parametro-nombre').value = 'renombrado'; en(filas(e)[0], 'parametro-nombre').disparar('input'); }],
      ['a parameter type', (e) => { en(filas(e)[0], 'parametro-tipo').value = 'numero'; en(filas(e)[0], 'parametro-tipo').disparar('change'); }],
      ['removing a parameter', (e) => botonesCon(filas(e)[0], 'Quitar')[0].disparar('click')],
    ];
    for (const [que, editar] of ediciones) {
      const escenario = await conConexiones();
      abrirNueva(escenario);
      escribir(escenario, 'sql', 'SELECT 1 AS id');
      escribir(escenario, 'conexion', 'c-1', 'change');
      escribir(escenario, 'nombre', 'Ventas');
      declarar(escenario, 'n', 'texto');
      await enviar(escenario, respuestaOk());
      assert.equal(nodo(escenario, 'guardar').disabled, false, que + ': open after the test');

      editar(escenario);
      assert.equal(nodo(escenario, 'guardar').disabled, true, que + ': closed after editing');
      const antes = escenario.peticiones.length;
      nodo(escenario, 'guardar').disparar('click');
      await asentarVarias();
      assert.equal(escenario.peticiones.length, antes, que + ': and triggering it sends nothing');

      await enviar(escenario, respuestaOk());
      assert.equal(nodo(escenario, 'guardar').disabled, false, que + ': open again after a new ok test');
    }
  });

  test('CH-32a PR2 putting back exactly what was tested opens the gate again, and a parameter value never closes it', async () => {
    const escenario = await conConexiones();
    abrirNueva(escenario);
    escribir(escenario, 'sql', 'SELECT :n');
    escribir(escenario, 'conexion', 'c-1', 'change');
    escribir(escenario, 'nombre', 'Ventas');
    const fila = declarar(escenario, 'n', 'numero', '1');
    await enviar(escenario, respuestaOk());
    escribir(escenario, 'sql', 'SELECT :n + 1');
    assert.equal(nodo(escenario, 'guardar').disabled, true);
    escribir(escenario, 'sql', 'SELECT :n');
    assert.equal(nodo(escenario, 'guardar').disabled, false, 'the same content as the last passing test');

    en(fila, 'parametro-valor').value = '99';
    en(fila, 'parametro-valor').disparar('input');
    assert.equal(nodo(escenario, 'guardar').disabled, false, 'values are never saved, so they are not part of what was tested');
  });

  test('CH-32a PR2 a failed «Probar», of any kind, closes the gate and tells it inside the pop-up', async () => {
    const fallos: Array<[number, unknown, RegExp]> = [
      [200, { resultado: 'fallo', fase: 'ejecucion', categoria: 'otra' }, /./],
      [400, { error: 'solicitud-invalida', campos: ['/sql'] }, /La solicitud es inválida\. Revise estos campos: \/sql\./],
      [404, { error: 'no-encontrada' }, /No existe una conexión registrada con ese identificador\./],
      [500, { error: 'interno' }, /La aplicación respondió HTTP 500\./],
    ];
    for (const [status, cuerpo, esperado] of fallos) {
      const escenario = await conConexiones();
      abrirNueva(escenario);
      escribir(escenario, 'sql', 'SELECT 1 AS id');
      escribir(escenario, 'conexion', 'c-1', 'change');
      escribir(escenario, 'nombre', 'Ventas');
      await enviar(escenario, respuestaOk());
      assert.equal(nodo(escenario, 'guardar').disabled, false);

      await enviar(escenario, cuerpo, status);
      assert.equal(nodo(escenario, 'guardar').disabled, true, String(status));
      assert.match(nodo(escenario, 'estado').textContent, esperado, String(status));
      assert.equal(nodo(escenario, 'estado').hidden, false);
      assert.equal(nodo(escenario, 'banner').hidden, true, 'the page banner is behind the pop-up');
      assert.equal(dialogoAbierto(escenario), true);
    }

    // The network failing is a failed test too.
    const sinRed = await conConexiones();
    abrirNueva(sinRed);
    escribir(sinRed, 'conexion', 'c-1', 'change');
    escribir(sinRed, 'nombre', 'Ventas');
    await enviar(sinRed, respuestaOk());
    assert.equal(nodo(sinRed, 'guardar').disabled, false);
    nodo(sinRed, 'formulario').disparar('submit');
    await asentarVarias();
    assert.equal(nodo(sinRed, 'guardar').disabled, true);
    assert.match(nodo(sinRed, 'estado').textContent, /No se pudo contactar con la aplicación/);
  });

  test('CH-32a PR2 saving sends nothing while the gate is closed, even if the control is triggered', async () => {
    const nueva = await conConexiones();
    abrirNueva(nueva);
    escribir(nueva, 'sql', 'SELECT 1 AS id');
    escribir(nueva, 'conexion', 'c-1', 'change');
    escribir(nueva, 'nombre', 'Ventas');
    const antesNueva = nueva.peticiones.length;
    nodo(nueva, 'guardar').disparar('click');
    await asentarVarias();
    assert.equal(nueva.peticiones.length, antesNueva, 'no test yet');

    await enviar(nueva, respuestaOk());
    escribir(nueva, 'nombre', '');
    const tras = nueva.peticiones.length;
    nodo(nueva, 'guardar').disparar('click');
    await asentarVarias();
    assert.equal(nueva.peticiones.length, tras, 'no name');

    const cargada = await conConexiones();
    await abrirGuardada(cargada);
    const antesCargada = cargada.peticiones.length;
    nodo(cargada, 'version-boton').disparar('click');
    await asentarVarias();
    assert.equal(cargada.peticiones.length, antesCargada, 'a loaded query is not saved untested either');
  });

  test('CH-32a PR2 a 201 saves the new query with every field, closes the pop-up and confirms on the page', async () => {
    const escenario = await conConexiones();
    abrirNueva(escenario);
    escribir(escenario, 'nombre', '  Ventas ');
    escribir(escenario, 'descripcion', 'Ventas del mes');
    escribir(escenario, 'sql', 'SELECT :d');
    escribir(escenario, 'conexion', 'c-1', 'change');
    declarar(escenario, 'd', 'fecha', '2026-01-01');
    await enviar(escenario, respuestaOk());

    escenario.respuestas.push({ status: 201, cuerpo: { consultaGuardada: FILA_GUARDADA } });
    const antes = escenario.peticiones.length;
    await enviar(escenario, { consultasGuardadas: [FILA_GUARDADA], truncado: false }, 200, 'guardar', 'click');
    const nuevas = escenario.peticiones.slice(antes);
    assert.deepEqual(nuevas.map((p) => p.url), ['/consultas-guardadas', '/consultas-guardadas']);
    assert.deepEqual(nuevas[0].cuerpo, {
      nombre: 'Ventas',
      descripcion: 'Ventas del mes',
      sql: 'SELECT :d',
      parametros: [{ nombre: 'd', tipo: 'fecha' }],
    });
    assert.equal(dialogoAbierto(escenario), false, 'closed on success');
    assert.equal(nodo(escenario, 'banner').hidden, false);
    assert.equal(nodo(escenario, 'banner').textContent, 'Se guardó la consulta y ya aparece en la lista.');
  });

  test('CH-32a PR2 a 200 saves the version, closes the pop-up and confirms on the page', async () => {
    const escenario = await conConexiones();
    await abrirGuardada(escenario);
    escribir(escenario, 'descripcion', 'Descripción nueva');
    escribir(escenario, 'sql', 'SELECT :a + 1');
    escribir(escenario, 'version-nota', 'Cambio');
    escribir(escenario, 'conexion', 'c-1', 'change');
    await enviar(escenario, respuestaOk());
    assert.equal(nodo(escenario, 'version-boton').disabled, false);

    const antes = escenario.peticiones.length;
    await guardarVersion(
      escenario,
      { status: 200, cuerpo: { consultaGuardada: { id: 'q-1', nombre: 'Stock', version: 4 } } },
      { status: 200, cuerpo: { consultasGuardadas: [FILA_GUARDADA], truncado: false } },
    );
    const nuevas = escenario.peticiones.slice(antes);
    assert.deepEqual(nuevas.map((p) => p.url), ['/consultas-guardadas/q-1', '/consultas-guardadas']);
    assert.deepEqual(nuevas[0].cuerpo, {
      nombre: 'Stock',
      descripcion: 'Descripción nueva',
      sql: 'SELECT :a + 1',
      parametros: [{ nombre: 'a', tipo: 'numero' }],
      nota: 'Cambio',
    });
    assert.equal(dialogoAbierto(escenario), false);
    assert.equal(nodo(escenario, 'banner').textContent, 'Se guardó la versión 4 de «Stock».');
  });

  test('CH-32a PR2 a refused save keeps the pop-up open with the message inside and what was typed', async () => {
    const nueva = await conConexiones();
    abrirNueva(nueva);
    escribir(nueva, 'nombre', 'Ventas');
    escribir(nueva, 'sql', 'SELECT 1 AS id');
    escribir(nueva, 'conexion', 'c-1', 'change');
    await enviar(nueva, respuestaOk());
    await enviar(nueva, { error: 'solicitud-invalida', campos: ['/nombre'] }, 400, 'guardar', 'click');
    assert.equal(dialogoAbierto(nueva), true);
    assert.match(nodo(nueva, 'estado').textContent, /La solicitud es inválida\. Revise estos campos: \/nombre\./);
    assert.equal(nodo(nueva, 'banner').hidden, true);
    assert.equal(nodo(nueva, 'nombre').value, 'Ventas');
    await enviar(nueva, { error: 'interno' }, 500, 'guardar', 'click');
    assert.match(nodo(nueva, 'estado').textContent, /^La aplicación respondió HTTP 500\.$/);
    assert.equal(nodo(nueva, 'guardar').disabled, false, 'and it can try again');

    const cargada = await conConexiones();
    await abrirGuardada(cargada);
    escribir(cargada, 'version-nota', 'Cambio');
    await probarOk(cargada);
    await guardarVersion(cargada, { status: 409, cuerpo: { error: 'sin-cambios' } });
    assert.equal(dialogoAbierto(cargada), true);
    assert.equal(nodo(cargada, 'estado').textContent, 'No hay cambios respecto de la versión vigente.');
    assert.equal(nodo(cargada, 'banner').hidden, true);
    assert.equal(nodo(cargada, 'version-nota').value, 'Cambio');
  });

  test('CH-32a PR2 Cancelar and Escape close the pop-up at once when nothing changed, and send nothing', async () => {
    for (const [forma, cancelar] of FORMAS_DE_CANCELAR) {
      const nueva = await conConsulta();
      abrirNueva(nueva);
      // The initial SELECT 1, blanks and an empty editor are not edits worth asking about.
      for (const sql of ['', 'SELECT 1', '  SELECT 1\n  ', '   ']) {
        abrirNueva(nueva);
        nodo(nueva, 'sql').value = sql;
        const antes = nueva.peticiones.length;
        cancelar(nueva);
        assert.equal(dialogoAbierto(nueva), false, forma + ' ' + JSON.stringify(sql));
        assert.equal(nodo(nueva, 'consulta-nueva-confirmar').hidden, true);
        assert.equal(nueva.peticiones.length, antes);
      }

      const cargada = await conConsultaCargada();
      const antesCargada = cargada.peticiones.length;
      cancelar(cargada);
      assert.equal(dialogoAbierto(cargada), false, forma + ' on an unchanged loaded query');
      assert.equal(cargada.peticiones.length, antesCargada);
      assert.equal(nodo(cargada, 'version-guardar').hidden, false, 'the query stays loaded');
    }
  });

  test('CH-32a PR2 with changes, Cancelar and Escape ask «Descartar cambios»; Seguir editando keeps them and Descartar cambios closes', async () => {
    const edicionesNueva: Array<[string, (escenario: Escenario) => void]> = [
      ['the SQL', (e) => { nodo(e, 'sql').value = 'SELECT * FROM producto'; }],
      ['the name', (e) => { nodo(e, 'nombre').value = 'Borrador'; }],
      ['the description', (e) => { nodo(e, 'descripcion').value = 'Pendiente'; }],
      // The parameters are a field of the form too (DEC-173): a new row is a change.
      ['a parameter', (e) => { nodo(e, 'agregar-parametro').disparar('click'); }],
    ];
    const edicionesCargada: Array<[string, (escenario: Escenario) => void]> = [
      ['the SQL', (e) => { nodo(e, 'sql').value = 'SELECT :a + 1'; }],
      ['the name', (e) => { nodo(e, 'nombre').value = 'Stock bajo'; }],
      ['the description', (e) => { nodo(e, 'descripcion').value = ''; }],
      ['a parameter', (e) => { nodo(e, 'agregar-parametro').disparar('click'); }],
    ];
    for (const [forma, cancelar] of FORMAS_DE_CANCELAR) {
      for (const [cargada, ediciones] of [[false, edicionesNueva], [true, edicionesCargada]] as const) {
        for (const [que, editar] of ediciones) {
          const etiqueta = `${forma}, ${cargada ? 'loaded' : 'new'}, ${que}`;
          const escenario = await conConsulta();
          if (cargada) await abrirGuardada(escenario); else abrirNueva(escenario);
          editar(escenario);
          const sql = nodo(escenario, 'sql').value;
          const nombre = nodo(escenario, 'nombre').value;
          const descripcion = nodo(escenario, 'descripcion').value;
          const antes = escenario.peticiones.length;

          cancelar(escenario);
          assert.equal(dialogoAbierto(escenario), true, etiqueta + ': stays open until confirmed');
          assert.equal(nodo(escenario, 'consulta-nueva-confirmar').hidden, false, etiqueta + ': asks');

          nodo(escenario, 'consulta-nueva-cancelar').disparar('click');
          assert.equal(nodo(escenario, 'consulta-nueva-confirmar').hidden, true, etiqueta);
          assert.equal(dialogoAbierto(escenario), true, etiqueta + ': Seguir editando keeps it open');
          assert.deepEqual([nodo(escenario, 'sql').value, nodo(escenario, 'nombre').value, nodo(escenario, 'descripcion').value], [sql, nombre, descripcion], etiqueta + ': and the edits');

          cancelar(escenario);
          assert.equal(nodo(escenario, 'consulta-nueva-confirmar').hidden, false, etiqueta);
          nodo(escenario, 'consulta-nueva-descartar').disparar('click');
          assert.equal(dialogoAbierto(escenario), false, etiqueta + ': Descartar cambios closes');
          assert.equal(nodo(escenario, 'consulta-nueva-confirmar').hidden, true, etiqueta);
          await asentarVarias();
          assert.equal(escenario.peticiones.length, antes, etiqueta + ': the whole round trip sent nothing');
        }
      }
    }
  });

  test('CH-32a PR2 a key other than Escape does nothing, and «Nueva consulta» never asks: it starts from empty', async () => {
    const escenario = await conConsultaCargada();
    nodo(escenario, 'sql').value = 'SELECT :a + 1';
    nodo(escenario, 'consulta-dialogo').disparar('keydown', { key: 'Enter' });
    nodo(escenario, 'consulta-dialogo').disparar('keydown');
    assert.equal(dialogoAbierto(escenario), true);
    assert.equal(nodo(escenario, 'consulta-nueva-confirmar').hidden, true);

    // Discarding closes the pop-up but leaves the fields; the next «Nueva consulta» empties them without asking.
    nodo(escenario, 'consulta-cancelar').disparar('click');
    nodo(escenario, 'consulta-nueva-descartar').disparar('click');
    assert.equal(dialogoAbierto(escenario), false);
    abrirNueva(escenario);
    assert.equal(dialogoAbierto(escenario), true);
    assert.equal(nodo(escenario, 'consulta-nueva-confirmar').hidden, true);
    assert.equal(nodo(escenario, 'sql').value, '');
    assert.equal(tituloDialogo(escenario), 'Nueva consulta');
  });

  test('CH-32a PR2 opening the pop-up again starts untested and clears the previous result', async () => {
    const escenario = await conConexiones();
    abrirNueva(escenario);
    escribir(escenario, 'sql', 'SELECT 1 AS id');
    escribir(escenario, 'conexion', 'c-1', 'change');
    escribir(escenario, 'nombre', 'Ventas');
    await enviar(escenario, respuestaOk());
    assert.equal(nodo(escenario, 'guardar').disabled, false);
    assert.equal(escenario.cuerpoTabla.hijos.length, 2);

    nodo(escenario, 'consulta-nueva-descartar').disparar('click');
    abrirNueva(escenario);
    escribir(escenario, 'sql', 'SELECT 1 AS id');
    escribir(escenario, 'nombre', 'Ventas');
    assert.equal(nodo(escenario, 'guardar').disabled, true, 'the old test does not carry over');
    assert.equal(escenario.cuerpoTabla.hijos.length, 0, 'nor the old rows');
    assert.equal(nodo(escenario, 'estado').hidden, true);

    // The same holds when another saved query is opened.
    await enviar(escenario, respuestaOk());
    assert.equal(nodo(escenario, 'guardar').disabled, false);
    nodo(escenario, 'consulta-nueva-descartar').disparar('click');
    await abrirGuardada(escenario);
    assert.equal(nodo(escenario, 'version-boton').disabled, true);
    assert.equal(escenario.cuerpoTabla.hijos.length, 0);
  });

  test('CH-32a PR2 a tenant switch closes the pop-up and its confirmation, new or loaded', async () => {
    const nueva = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    await elegirTenant(nueva, [FILA_GUARDADA]);
    abrirNueva(nueva);
    nodo(nueva, 'sql').value = 'SELECT * FROM producto';
    nodo(nueva, 'consulta-cancelar').disparar('click');
    assert.equal(nodo(nueva, 'consulta-nueva-confirmar').hidden, false);
    await elegirTenant(nueva, [], [], 't-2');
    assert.equal(dialogoAbierto(nueva), false);
    assert.equal(nodo(nueva, 'consulta-nueva-confirmar').hidden, true);

    const cargada = await conConsultaCargada();
    assert.equal(dialogoAbierto(cargada), true);
    await elegirTenant(cargada);
    assert.equal(dialogoAbierto(cargada), false);
    assert.equal(nodo(cargada, 'version-guardar').hidden, true, 'and the loaded query is forgotten');
    assert.equal(nodo(cargada, 'guardar').hidden, false);
  });

  test('CH-32a PR2 a tenant-level refusal closes the pop-up so the message on the page can be seen', async () => {
    const escenario = await conConexiones();
    abrirNueva(escenario);
    escribir(escenario, 'conexion', 'c-1', 'change');
    await enviar(escenario, { error: 'tenant-no-indicado' }, 400);
    assert.equal(dialogoAbierto(escenario), false);
    assert.equal(nodo(escenario, 'banner').hidden, false);
    assert.equal(nodo(escenario, 'banner').textContent, 'La consola no envió un tenant activo. Elegí uno en la barra superior.');
  });

  test('CH-32a PR2 «Nueva consulta» on a query still loaded forgets it, closes its history and runs ad hoc', async () => {
    const escenario = await conConsultaCargada();
    nodo(escenario, 'consulta-cancelar').disparar('click');
    await abrirPanel(escenario, TRES_VERSIONES);
    assert.equal(nodo(escenario, 'versiones').hidden, false);
    const antes = escenario.peticiones.length;

    abrirNueva(escenario);
    await asentarVarias();
    assert.equal(escenario.peticiones.length, antes, 'no request');
    assert.equal(nodo(escenario, 'versiones').hidden, true, 'the history of the forgotten query is closed');
    assert.equal(nodo(escenario, 'version-guardar').hidden, true);
    assert.equal(nodo(escenario, 'guardar').hidden, false, 'Guardar consulta is back');
    nodo(escenario, 'conexion').value = 'c-1';
    nodo(escenario, 'sql').value = 'SELECT :a';
    await enviar(escenario, respuestaOk());
    assert.ok(!('consultaGuardadaId' in ultimaEjecucion(escenario)), 'the forgotten query is no longer named');
  });

  // ---- CH-32b (DEC-173): every create form opens in a pop-up ----------------------------------

  /** One of the pop-ups of CH-32b; the tests of the behaviour they share run over each one. */
  interface PopUp {
    nombre: string;
    fondo: string;
    titulo: string;
    abridor: string;
    /** The id of what the pop-up holds (the form, or the wizard's first step): it must sit inside the backdrop. */
    contenido: string;
    primerCampo: string;
    cancelar: string;
    confirmar: string;
    descartar: string;
    seguir: string;
    /** Types something into the pop-up's fields and returns the id of one of them and what it now holds. */
    escribir: (escenario: Escenario) => [string, string];
    /** The answers to queue for what opening it asks of the server (nothing for a plain form). */
    respuestasAlAbrir: Array<{ status: number; cuerpo: unknown }>;
  }

  const POPUPS: PopUp[] = [
    {
      nombre: 'Nuevo tenant', fondo: 'tenant-dialogo', titulo: 'tenant-dialogo-titulo', abridor: 'tenant-nuevo', contenido: 'tenant-alta', primerCampo: 'tenant-nombre',
      cancelar: 'tenant-cancelar', confirmar: 'tenant-confirmar', descartar: 'tenant-descartar', seguir: 'tenant-seguir',
      escribir: (e) => { nodo(e, 'tenant-nombre').value = 'Almacén Don Tito'; return ['tenant-nombre', 'Almacén Don Tito']; },
      respuestasAlAbrir: [],
    },
    {
      nombre: 'Nuevo usuario', fondo: 'usuario-dialogo', titulo: 'usuario-dialogo-titulo', abridor: 'usuario-nuevo', contenido: 'usuario-alta', primerCampo: 'usuario-correo',
      cancelar: 'usuario-cancelar', confirmar: 'usuario-confirmar', descartar: 'usuario-descartar', seguir: 'usuario-seguir',
      escribir: (e) => { nodo(e, 'usuario-nombre').value = 'Ana'; return ['usuario-nombre', 'Ana']; },
      respuestasAlAbrir: [],
    },
    {
      nombre: 'Nueva conexión', fondo: 'conexion-dialogo', titulo: 'conexion-dialogo-titulo', abridor: 'conexion-nueva', contenido: 'conexion-alta', primerCampo: 'cx-nombre',
      cancelar: 'cx-cancelar', confirmar: 'conexion-confirmar', descartar: 'conexion-descartar', seguir: 'conexion-seguir',
      escribir: (e) => { nodo(e, 'cx-host').value = 'db.nueva.test'; return ['cx-host', 'db.nueva.test']; },
      respuestasAlAbrir: [{ status: 200, cuerpo: { agentes: [] } }],
    },
    {
      nombre: 'Nueva automatización', fondo: 'auto-alta', titulo: 'auto-dialogo-titulo', abridor: 'auto-nueva', contenido: 'auto-paso-1', primerCampo: 'auto-conexion',
      cancelar: 'auto-cancelar', confirmar: 'auto-confirmar', descartar: 'auto-descartar', seguir: 'auto-seguir',
      escribir: (e) => { nodo(e, 'auto-destinatario').value = 'ops@example.com'; return ['auto-destinatario', 'ops@example.com']; },
      respuestasAlAbrir: [{ status: 200, cuerpo: { conexiones: [], truncado: false } }],
    },
  ];

  /** A console with tenant t-1 active and t-2 selectable, ready to open any pop-up. */
  async function conTenantDos(): Promise<Escenario> {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    await elegirTenant(escenario);
    return escenario;
  }

  /** Opens the pop-up, queueing what opening it asks for, and lets that settle. */
  async function abrirPopUp(escenario: Escenario, popup: PopUp): Promise<void> {
    escenario.respuestas.push(...popup.respuestasAlAbrir);
    abrirDialogo(escenario, popup.abridor);
    await asentarVarias();
  }

  for (const popup of POPUPS) {
    test(`CH-32b ${popup.nombre} is a hidden modal dialog opened from the page header, with its fields inside and the unsaved-changes strip`, () => {
      const m = marcado();
      assert.match(m, new RegExp(`<div class="zd-pagehead__actions">\\s*<button id="${popup.abridor}" class="zd-btn zd-btn--primary" type="button">`));
      const fondo = m.indexOf(`<div id="${popup.fondo}"`);
      assert.ok(fondo !== -1, 'the backdrop exists');
      assert.match(m.slice(fondo), new RegExp(
        `^<div id="${popup.fondo}" class="zd-dialog-backdrop" hidden>\\s*<div class="zd-dialog[^"]*" role="dialog" aria-modal="true" aria-labelledby="${popup.titulo}">\\s*<h2 id="${popup.titulo}" class="zd-dialog__title">`));
      const contenido = m.indexOf(`id="${popup.contenido}"`);
      const franja = m.indexOf(`<span id="${popup.confirmar}" hidden>`, fondo);
      assert.ok(fondo < contenido && contenido < franja, 'the fields come before the strip');
      assert.match(m.slice(franja, franja + 600), new RegExp(
        `^<span id="${popup.confirmar}" hidden>\\s*Hay cambios sin guardar\\.\\s*<button id="${popup.descartar}"[^>]*type="button">Descartar cambios</button>\\s*<button id="${popup.seguir}"[^>]*type="button">Seguir editando</button>`));
      assert.match(m.slice(fondo, fondo + 20000), new RegExp(`<button id="${popup.cancelar}" class="zd-btn zd-btn--ghost" type="button">Cancelar</button>`));
    });

    test(`CH-32b ${popup.nombre} opens with the focus on its first field and a closed question`, async () => {
      const escenario = await conTenantDos();
      const enfocados = espiarFoco(escenario, popup.primerCampo);
      assert.equal(dialogoAbierto(escenario, popup.fondo), false, 'closed at load');
      await abrirPopUp(escenario, popup);
      assert.equal(dialogoAbierto(escenario, popup.fondo), true);
      assert.deepEqual(enfocados, [popup.primerCampo]);
      assert.equal(nodo(escenario, popup.confirmar).hidden, true);
    });

    for (const [forma, cancelar] of formasDeCancelar(popup.cancelar, popup.fondo)) {
      test(`CH-32b ${popup.nombre}: ${forma} with nothing typed closes it and sends nothing`, async () => {
        const escenario = await conTenantDos();
        await abrirPopUp(escenario, popup);
        const antes = escenario.peticiones.length;
        cancelar(escenario);
        assert.equal(dialogoAbierto(escenario, popup.fondo), false);
        assert.equal(escenario.peticiones.length, antes);
      });

      test(`CH-32b ${popup.nombre}: ${forma} with something typed asks first; Seguir editando keeps it, Descartar cambios closes it`, async () => {
        const escenario = await conTenantDos();
        await abrirPopUp(escenario, popup);
        const [campo, valor] = popup.escribir(escenario);
        const antes = escenario.peticiones.length;
        cancelar(escenario);
        assert.equal(dialogoAbierto(escenario, popup.fondo), true, 'still open');
        assert.equal(nodo(escenario, popup.confirmar).hidden, false, 'asking');
        nodo(escenario, popup.seguir).disparar('click');
        assert.equal(nodo(escenario, popup.confirmar).hidden, true);
        assert.equal(dialogoAbierto(escenario, popup.fondo), true);
        assert.equal(nodo(escenario, campo).value, valor, 'what was typed is kept');
        cancelar(escenario);
        nodo(escenario, popup.descartar).disparar('click');
        assert.equal(dialogoAbierto(escenario, popup.fondo), false);
        assert.equal(nodo(escenario, popup.confirmar).hidden, true);
        assert.equal(escenario.peticiones.length, antes, 'nothing was sent');
      });
    }

    test(`CH-32b ${popup.nombre}: a tenant switch closes it without asking, and it reopens blank`, async () => {
      const escenario = await conTenantDos();
      await abrirPopUp(escenario, popup);
      const [campo] = popup.escribir(escenario);
      nodo(escenario, popup.cancelar).disparar('click');
      assert.equal(nodo(escenario, popup.confirmar).hidden, false);
      await elegirTenant(escenario, [], [], 't-2');
      assert.equal(dialogoAbierto(escenario, popup.fondo), false);
      assert.equal(nodo(escenario, popup.confirmar).hidden, true);
      await abrirPopUp(escenario, popup);
      assert.equal(nodo(escenario, campo).value, '', 'nothing typed for the tenant just left');
    });
  }

  test('CH-32b the script has one pop-up factory, and the query pop-up is built on it', () => {
    assert.equal(script.match(/function crearDialogo\(/g)?.length, 1);
    assert.ok(script.includes('dialogoDeConsulta = crearDialogo('));
    assert.ok(!script.includes('function pedirCerrarConsulta'), 'the query pop-up has no logic of its own');
  });

  // ---- CH-32b: «Nuevo tenant» ------------------------------------------------------------------

  /** Tenant t-1 active, the Tenants screen open on `TENANTS_PANTALLA`, and the pop-up open. */
  async function conPopUpDeTenant(): Promise<Escenario> {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    await elegirTenant(escenario);
    await abrirTenants(escenario);
    abrirDialogo(escenario, 'tenant-nuevo');
    return escenario;
  }

  const TENANT_NUEVO = { id: 't-3', nombre: 'Almacén Don Tito', activo: true, creadoEn: '2026-10-13T12:00:00.000Z' };

  test('CH-32b «Nuevo tenant» holds the name and three buttons: Crear tenant submits, Crear y elegir and Cancelar do not', () => {
    const m = marcado();
    const dialogo = m.slice(m.indexOf('<div id="tenant-dialogo"'), m.indexOf('<section id="pantalla-conexiones"'));
    assert.match(dialogo, /<h2 id="tenant-dialogo-titulo" class="zd-dialog__title">Nuevo tenant<\/h2>/);
    assert.match(dialogo, /<label for="tenant-nombre" class="zd-label">Nombre<\/label>/);
    assert.match(dialogo, /<button class="zd-btn zd-btn--primary" type="submit" form="tenant-alta">Crear tenant<\/button>/);
    assert.match(dialogo, /<button id="tenant-crear-elegir" class="zd-btn zd-btn--secondary" type="button">Crear y elegir<\/button>/);
    assert.equal((dialogo.match(/type="submit"/g) ?? []).length, 1, 'only one submits');
    assert.match(dialogo, /<p id="tenant-dialogo-aviso" class="ayuda" role="status"><\/p>/);
    assert.ok(!/<form id="tenant-alta"[^>]*class="controles"/.test(m), 'no inline form above the list any more');
  });

  test('CH-32b «Crear tenant» creates it, closes the pop-up, reloads and leaves the active tenant as it was', async () => {
    const escenario = await conPopUpDeTenant();
    nodo(escenario, 'tenant-nombre').value = '  Almacén Don Tito  ';
    escenario.respuestas.push(
      { status: 201, cuerpo: { tenant: TENANT_NUEVO } },
      { status: 200, cuerpo: { tenants: [...TENANTS_PANTALLA, TENANT_NUEVO] } },
      { status: 200, cuerpo: { tenants: [{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }, { id: 't-3', nombre: 'Almacén Don Tito' }] } },
    );
    const antes = escenario.peticiones.length;
    nodo(escenario, 'tenant-alta').disparar('submit');
    await asentarVarias();
    assert.deepEqual(escenario.peticiones.slice(antes).map((p) => p.url), ['/tenants', '/tenants?incluirInactivos=true', '/tenants']);
    assert.deepEqual(escenario.peticiones[antes].cuerpo, { nombre: 'Almacén Don Tito' });
    assert.equal(dialogoAbierto(escenario, 'tenant-dialogo'), false);
    assert.equal(nodo(escenario, 'tenant-aviso').textContent, 'Se creó el tenant «Almacén Don Tito».');
    assert.equal(nodo(escenario, 'tenant').value, 't-1', 'the active tenant did not change');
    assert.ok(nodo(escenario, 'tenant').options.some((o) => o.value === 't-3'), 'the selector lists it');
  });

  test('CH-32b «Crear y elegir» creates it and makes it the active tenant, selector and bar', async () => {
    const escenario = await conPopUpDeTenant();
    nodo(escenario, 'tenant-nombre').value = 'Almacén Don Tito';
    escenario.respuestas.push(
      { status: 201, cuerpo: { tenant: TENANT_NUEVO } },
      { status: 200, cuerpo: { tenants: [...TENANTS_PANTALLA, TENANT_NUEVO] } },
      { status: 200, cuerpo: { tenants: [{ id: 't-1', nombre: 'Food Store' }, { id: 't-3', nombre: 'Almacén Don Tito' }] } },
      ...respuestasDeTenant(),
    );
    nodo(escenario, 'tenant-crear-elegir').disparar('click');
    await asentarVarias();
    assert.equal(escenario.peticiones.filter((p) => p.url === '/tenants' && p.cuerpo !== null).length, 1, 'one creation');
    assert.equal(dialogoAbierto(escenario, 'tenant-dialogo'), false);
    assert.equal(nodo(escenario, 'tenant').value, 't-3');
    assert.match(nodo(escenario, 'tenant-activo').textContent, /Almacén Don Tito/);
    assert.equal(nodo(escenario, 'tenant-aviso').textContent, 'Se creó el tenant «Almacén Don Tito» y quedó como activo.');
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].tenant, 't-3', 'the screens reload for the new tenant');
  });

  test('CH-32b «Crear y elegir» on a 201 with no id only reports the creation', async () => {
    const escenario = await conPopUpDeTenant();
    nodo(escenario, 'tenant-nombre').value = 'Almacén Don Tito';
    escenario.respuestas.push(
      { status: 201, cuerpo: {} },
      { status: 200, cuerpo: { tenants: TENANTS_PANTALLA } },
      { status: 200, cuerpo: { tenants: [{ id: 't-1', nombre: 'Food Store' }] } },
    );
    nodo(escenario, 'tenant-crear-elegir').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'tenant').value, 't-1');
    assert.equal(nodo(escenario, 'tenant-aviso').textContent, 'Se creó el tenant «Almacén Don Tito».');
  });

  test('CH-32b an empty name is refused inside the pop-up by both buttons, and nothing is sent', async () => {
    const escenario = await conPopUpDeTenant();
    nodo(escenario, 'tenant-nombre').value = '   ';
    const antes = escenario.peticiones.length;
    nodo(escenario, 'tenant-alta').disparar('submit');
    assert.equal(nodo(escenario, 'tenant-dialogo-aviso').textContent, 'Escribí el nombre del tenant.');
    nodo(escenario, 'tenant-dialogo-aviso').textContent = '';
    nodo(escenario, 'tenant-crear-elegir').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'tenant-dialogo-aviso').textContent, 'Escribí el nombre del tenant.');
    assert.equal(dialogoAbierto(escenario, 'tenant-dialogo'), true);
    assert.equal(escenario.peticiones.length, antes);
  });

  test('CH-32b a refused or unreachable creation is told inside the pop-up, which stays open with the name', async () => {
    const escenario = await conPopUpDeTenant();
    nodo(escenario, 'tenant-nombre').value = 'Almacén Don Tito';
    escenario.respuestas.push({ status: 500, cuerpo: {} });
    nodo(escenario, 'tenant-alta').disparar('submit');
    await asentarVarias();
    assert.equal(nodo(escenario, 'tenant-dialogo-aviso').textContent, 'No se pudo crear el tenant (HTTP 500).');
    assert.equal(dialogoAbierto(escenario, 'tenant-dialogo'), true);
    assert.equal(nodo(escenario, 'tenant-nombre').value, 'Almacén Don Tito');
    nodo(escenario, 'tenant-crear-elegir').disparar('click');
    await asentarVarias();
    assert.equal(nodo(escenario, 'tenant-dialogo-aviso').textContent, 'No se pudo contactar con la aplicación.', 'no answer queued: the network failed');
    assert.equal(dialogoAbierto(escenario, 'tenant-dialogo'), true);
  });

  // ---- CH-32b: «Nuevo usuario» and «Reponer clave» -----------------------------------------------

  test('CH-32b «Nuevo usuario» with no tenant says so on the page and does not open', async () => {
    const escenario = await arrancar();
    abrirDialogo(escenario, 'usuario-nuevo');
    assert.equal(dialogoAbierto(escenario, 'usuario-dialogo'), false);
    assert.equal(nodo(escenario, 'banner').textContent, 'Elegí un tenant en la barra superior antes de operar. No se envió ninguna solicitud.');
  });

  test('CH-32b «Nuevo usuario» holds the email and the optional name, and «Crear usuario» submits', () => {
    const m = marcado();
    const dialogo = m.slice(m.indexOf('<div id="usuario-dialogo"'), m.indexOf('<div id="usuario-secreto"'));
    assert.match(dialogo, /<h2 id="usuario-dialogo-titulo" class="zd-dialog__title">Nuevo usuario<\/h2>/);
    assert.match(dialogo, /<input id="usuario-correo"[^>]*type="email"[^>]*required>/);
    assert.match(dialogo, /<label for="usuario-nombre" class="zd-label">Nombre \(opcional\)<\/label>/);
    assert.match(dialogo, /<button class="zd-btn zd-btn--primary" type="submit" form="usuario-alta">Crear usuario<\/button>/);
    assert.match(dialogo, /<p id="usuario-dialogo-aviso" class="ayuda" role="status"><\/p>/);
  });

  test('CH-32b a created user closes the pop-up and the password shows once on the page, not inside the pop-up', async () => {
    const escenario = await abrirUsuarios([]);
    abrirDialogo(escenario, 'usuario-nuevo');
    nodo(escenario, 'usuario-correo').value = 'ana@negocio.com';
    escenario.respuestas.push(
      { status: 201, cuerpo: { usuario: USUARIO_ACTIVO, clave: CLAVE } },
      { status: 200, cuerpo: { usuarios: [USUARIO_ACTIVO], truncado: false } },
    );
    nodo(escenario, 'usuario-alta').disparar('submit');
    await asentarVarias();
    assert.equal(dialogoAbierto(escenario, 'usuario-dialogo'), false);
    assert.equal(nodo(escenario, 'usuario-secreto-valor').textContent, CLAVE);
    assert.ok(!nodo(escenario, 'usuario-dialogo-aviso').textContent.includes(CLAVE));
  });

  test('CH-32b a rejected user says which fields inside the pop-up, which stays open', async () => {
    const escenario = await abrirUsuarios([]);
    abrirDialogo(escenario, 'usuario-nuevo');
    nodo(escenario, 'usuario-correo').value = 'no-es-un-correo';
    escenario.respuestas.push({ status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/correo'] } });
    nodo(escenario, 'usuario-alta').disparar('submit');
    await asentarVarias();
    assert.equal(nodo(escenario, 'usuario-dialogo-aviso').textContent, 'Revisá estos campos: /correo.');
    assert.equal(dialogoAbierto(escenario, 'usuario-dialogo'), true);
  });

  test('CH-32b Reponer clave asks first, in the row, saying the sessions will close; Cancelar restores the actions and sends nothing', async () => {
    for (const correo of ['ana@negocio.com', 'beto@negocio.com']) {
      const escenario = await abrirUsuarios();
      const antes = escenario.peticiones.length;
      const fila = filaUsuario(escenario, correo);
      botonesCon(fila, 'Reponer clave')[0].disparar('click');
      assert.equal(escenario.peticiones.length, antes, 'the first click sends nothing');
      assert.equal(botonesCon(fila, 'Reponer clave de ' + correo).length, 1);
      assert.equal(botonesCon(fila, 'Reponer clave').length, 0);
      assert.ok(fila.textContent.includes('Se cierran sus sesiones abiertas.'), correo);
      botonesCon(fila, 'Cancelar')[0].disparar('click');
      assert.equal(botonesCon(fila, 'Reponer clave').length, 1, 'the actions are back');
      assert.equal(botonesCon(fila, 'Reponer clave de ' + correo).length, 0);
      assert.ok(!fila.textContent.includes('Se cierran sus sesiones abiertas.'));
      assert.equal(escenario.peticiones.length, antes);
    }
  });

  test('CH-32b confirming «Reponer clave de {correo}» posts to the clave route and shows the password once, for an inactive user too', async () => {
    const escenario = await abrirUsuarios();
    escenario.respuestas.push(
      { status: 200, cuerpo: { usuario: USUARIO_INACTIVO, clave: CLAVE } },
      { status: 200, cuerpo: { usuarios: [USUARIO_ACTIVO, USUARIO_INACTIVO], truncado: false } },
    );
    const fila = filaUsuario(escenario, 'beto@negocio.com');
    botonesCon(fila, 'Reponer clave')[0].disparar('click');
    botonesCon(fila, 'Reponer clave de beto@negocio.com')[0].disparar('click');
    await asentarVarias();
    assert.ok(escenario.peticiones.some((p) => p.url === '/usuarios/u-2/clave'));
    assert.equal(nodo(escenario, 'usuario-secreto-valor').textContent, CLAVE);
  });

  // ---- CH-32b: «Nueva conexión» ----------------------------------------------------------------

  /** Tenant t-1 active, Conexiones open with `conexiones` listed, and the pop-up open and typed in. */
  async function conPopUpDeConexion(conexiones: unknown[] = []): Promise<Escenario> {
    const escenario = await abrirConexiones(conexiones);
    escenario.respuestas.push({ status: 200, cuerpo: { agentes: [] } });
    abrirDialogo(escenario, 'conexion-nueva');
    await asentarVarias();
    for (const [id, valor] of [['cx-nombre', 'Réplica nueva'], ['cx-host', 'db.nueva.test'], ['cx-base', 'tienda'], ['cx-usuario', 'lector'], ['cx-clave', 'clave-secreta-del-cliente']]) {
      nodo(escenario, id).value = valor;
    }
    return escenario;
  }

  const PRUEBA_OK = { status: 200, cuerpo: { resultado: 'ok', categoria: null, codigo: null, host: 'db.nueva.test', puerto: 5432, duracionMs: 12 } };
  const CX_GUARDADA = { status: 201, cuerpo: { conexion: { ...CONEXION_LISTADA, id: 'c-9', nombre: 'Réplica nueva' } } };

  test('CH-32b «Nueva conexión» is a pop-up with the same fields as the panel had, and the panel and its ids are gone', () => {
    const m = marcado();
    const dialogo = m.slice(m.indexOf('<div id="conexion-dialogo"'), m.indexOf('<section id="pantalla-agentes"'));
    assert.match(dialogo, /<h2 id="conexion-dialogo-titulo" class="zd-dialog__title">Nueva conexión<\/h2>/);
    const orden = ['cx-nombre', 'cx-host', 'cx-puerto', 'cx-base', 'cx-usuario', 'cx-via', 'cx-clave', 'cx-resultado'].map((id) => dialogo.indexOf('id="' + id + '"'));
    assert.ok(orden.every((i) => i !== -1) && [...orden].sort((a, b) => a - b).join() === orden.join(), 'fields in the order they had');
    assert.match(dialogo, /<option value="">Directa<\/option>/);
    assert.match(dialogo, /<button class="zd-btn zd-btn--primary" type="submit" form="conexion-alta">Guardar y probar<\/button>/);
    assert.match(dialogo, /<input id="cx-puerto"[^>]*value="5432"/);
    assert.ok(!m.includes('<aside id="conexion-panel"') && !/zd-drawer"[^>]*aria-labelledby="titulo-conexion-nueva"/.test(m));
  });

  test('CH-32b «Nueva conexión» opens blank and reached directly, and asks for the tenant\'s agent', async () => {
    const escenario = await abrirConexiones([]);
    escenario.respuestas.push({ status: 200, cuerpo: { agentes: [AGENTE_ACTIVO] } });
    abrirDialogo(escenario, 'conexion-nueva');
    await asentarVarias();
    assert.equal(escenario.peticiones[escenario.peticiones.length - 1].url, '/agentes');
    assert.deepEqual(nodo(escenario, 'cx-via').options.map((o) => o.value), ['', 'a-1']);
    assert.equal(nodo(escenario, 'cx-via').value, '');
    assert.equal(nodo(escenario, 'cx-puerto').value, '5432');
    nodo(escenario, 'cx-via').value = 'a-1';
    nodo(escenario, 'cx-puerto').value = '6543';
    nodo(escenario, 'cx-nombre').value = 'resto';
    nodo(escenario, 'cx-cancelar').disparar('click');
    nodo(escenario, 'conexion-descartar').disparar('click');
    escenario.respuestas.push({ status: 200, cuerpo: { agentes: [AGENTE_ACTIVO] } });
    abrirDialogo(escenario, 'conexion-nueva');
    await asentarVarias();
    assert.deepEqual(nodo(escenario, 'cx-via').options.map((o) => o.value), ['', 'a-1'], 'the option is not added twice');
    assert.equal(nodo(escenario, 'cx-via').value, '');
    assert.equal(nodo(escenario, 'cx-puerto').value, '5432');
    assert.equal(nodo(escenario, 'cx-nombre').value, '');
  });

  test('CH-32b «Nueva conexión» with no tenant says so on the page and does not open', async () => {
    const escenario = await arrancar();
    abrirDialogo(escenario, 'conexion-nueva');
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), false);
    assert.equal(nodo(escenario, 'banner').textContent, 'Elegí un tenant en la barra superior antes de operar. No se envió ninguna solicitud.');
  });

  test('CH-32b the port, the way it reaches the replica and the password each count as changes', async () => {
    const cambios: Array<[string, (e: Escenario) => void]> = [
      ['the port', (e) => { nodo(e, 'cx-puerto').value = '6543'; }],
      ['the way it reaches the replica', (e) => { nodo(e, 'cx-via').value = 'a-1'; }],
      ['the password', (e) => { nodo(e, 'cx-clave').value = 'x'; }],
      ['the database', (e) => { nodo(e, 'cx-base').value = 'tienda'; }],
    ];
    for (const [que, cambiar] of cambios) {
      const escenario = await conTenantDos();
      escenario.respuestas.push({ status: 200, cuerpo: { agentes: [] } });
      abrirDialogo(escenario, 'conexion-nueva');
      await asentarVarias();
      nodo(escenario, 'cx-cancelar').disparar('click');
      assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), false, 'untouched: closes at once');
      escenario.respuestas.push({ status: 200, cuerpo: { agentes: [] } });
      abrirDialogo(escenario, 'conexion-nueva');
      await asentarVarias();
      cambiar(escenario);
      nodo(escenario, 'cx-cancelar').disparar('click');
      assert.equal(nodo(escenario, 'conexion-confirmar').hidden, false, que);
    }
  });

  test('CH-32b discarding a typed password empties the field, so it does not stay in the page', async () => {
    const escenario = await conPopUpDeConexion();
    nodo(escenario, 'cx-cancelar').disparar('click');
    nodo(escenario, 'conexion-descartar').disparar('click');
    assert.equal(nodo(escenario, 'cx-clave').value, '');
    assert.ok(!textoDeLaPagina(escenario).includes('clave-secreta-del-cliente'));
  });

  test('CH-32b a saved connection whose test fails still closes the pop-up and says so in the screen notice', async () => {
    const escenario = await conPopUpDeConexion();
    escenario.respuestas.push(
      CX_GUARDADA,
      { status: 200, cuerpo: { resultado: 'fallo', categoria: 'red', codigo: 'ECONNREFUSED', host: 'db.nueva.test', puerto: 5432, duracionMs: 30 } },
      { status: 200, cuerpo: { conexiones: [{ ...CONEXION_LISTADA, id: 'c-9', nombre: 'Réplica nueva' }], truncado: false } },
    );
    nodo(escenario, 'conexion-alta').disparar('submit');
    await asentarVarias();
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), false);
    assert.equal(nodo(escenario, 'conexiones-aviso').textContent, 'Guardada. La prueba falló: red (ECONNREFUSED).');
    assert.ok(nodo(escenario, 'conexiones-cuerpo').hijos.some((h) => h.textContent.includes('Réplica nueva')), 'and the list shows it');
  });

  test('CH-32b a saved connection whose test could not run closes the pop-up and says the test did not run', async () => {
    const escenario = await conPopUpDeConexion();
    escenario.respuestas.push(
      CX_GUARDADA,
      { status: 500, cuerpo: {} },
      { status: 200, cuerpo: { conexiones: [], truncado: false } },
    );
    nodo(escenario, 'conexion-alta').disparar('submit');
    await asentarVarias();
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), false);
    assert.equal(nodo(escenario, 'conexiones-aviso').textContent, 'Guardada. La prueba no se pudo hacer (HTTP 500).');
  });

  test('CH-32b a rejected registration keeps the pop-up open with the fields named and the password empty', async () => {
    const escenario = await conPopUpDeConexion();
    const avisoAntes = nodo(escenario, 'conexiones-aviso').textContent;
    escenario.respuestas.push({ status: 400, cuerpo: { error: 'solicitud-invalida', campos: ['/host'] } });
    nodo(escenario, 'conexion-alta').disparar('submit');
    await asentarVarias();
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), true);
    assert.equal(nodo(escenario, 'cx-resultado').textContent, 'Revisá estos campos: /host. Volvé a escribir la contraseña.');
    assert.equal(nodo(escenario, 'cx-clave').value, '');
    assert.equal(nodo(escenario, 'cx-host').value, 'db.nueva.test', 'the rest is kept');
    assert.equal(nodo(escenario, 'conexiones-aviso').textContent, avisoAntes, 'nothing new on the page');
    assert.ok(!textoDeLaPagina(escenario).includes('clave-secreta-del-cliente'));
  });

  test('CH-32b any other refusal is told inside the pop-up too, and a second press while saving sends nothing more', async () => {
    const escenario = await conPopUpDeConexion();
    escenario.respuestas.push({ status: 500, cuerpo: {} });
    nodo(escenario, 'conexion-alta').disparar('submit');
    nodo(escenario, 'conexion-alta').disparar('submit');
    await asentarVarias();
    assert.equal(escenario.peticiones.filter((p) => p.url === '/conexiones' && p.cuerpo !== null).length, 1, 'one registration');
    assert.equal(nodo(escenario, 'cx-resultado').textContent, 'No se pudo registrar la conexión (HTTP 500).');
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), true);
  });

  test('CH-32b a tenant switch while the test runs leaves no notice of the old tenant on the page', async () => {
    const escenario = await conPopUpDeConexion();
    escenario.respuestas.push(CX_GUARDADA);
    nodo(escenario, 'conexion-alta').disparar('submit');
    await asentarVarias();
    await elegirTenant(escenario, [], [], 't-2');
    assert.equal(dialogoAbierto(escenario, 'conexion-dialogo'), false);
    assert.ok(!nodo(escenario, 'conexiones-aviso').textContent.startsWith('Guardada'));
  });

  // ---- CH-32b: the wizard in a pop-up ------------------------------------------------------------

  test('CH-32b the wizard is a wide pop-up on #auto-alta, opened from the header; the stepper and both steps are inside it', () => {
    const m = marcado();
    const dialogo = m.slice(m.indexOf('<div id="auto-alta"'), m.indexOf('<div class="zd-table-wrap zd-table-scroll"><table id="auto-lista"'));
    assert.match(dialogo, /^<div id="auto-alta" class="zd-dialog-backdrop" hidden>/);
    assert.match(dialogo, /<div class="zd-dialog zd-form" role="dialog"/);
    for (const id of ['auto-marca-1', 'auto-marca-2', 'auto-paso-1', 'auto-paso-2', 'auto-dialogo-aviso']) assert.ok(dialogo.includes('id="' + id + '"'), id);
    assert.ok(!dialogo.includes('id="auto-nueva"'), 'the opener is not inside it');
    assert.ok(!/<div id="auto-alta"[^>]*zd-card/.test(m), 'it is no longer an inline card');
    assert.match(documento, /#auto-alta \.zd-dialog \{ width: min\(900px, 100%\)/);
    assert.ok(!documento.includes('#auto-alta { margin-top'), 'the inline card\'s rule is gone');
    assert.match(dialogo, /<p id="auto-dialogo-aviso" class="ayuda" role="status"><\/p>/);
    const paso2 = dialogo.slice(dialogo.indexOf('<div id="auto-paso-2"'));
    assert.match(paso2, /<button id="auto-volver"[^>]*>Volver<\/button>\s*<button id="auto-crear"[^>]*>Crear automatización<\/button>\s*<button id="auto-cancelar-2" class="zd-btn zd-btn--ghost" type="button">Cancelar<\/button>/);
  });

  test('CH-32b on step 2, Cancelar and Escape ask the same question, and discarding closes and resets the wizard', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    await avanzar(escenario);
    assert.deepEqual(pasoVisible(escenario), [2, 2]);
    nodo(escenario, 'auto-cancelar-2').disparar('click');
    assert.equal(nodo(escenario, 'auto-confirmar').hidden, false);
    nodo(escenario, 'auto-seguir').disparar('click');
    assert.deepEqual(pasoVisible(escenario), [2, 2], 'Seguir editando stays on step 2');
    nodo(escenario, 'auto-alta').disparar('keydown', { key: 'Escape' });
    assert.equal(nodo(escenario, 'auto-confirmar').hidden, false);
    const antes = escenario.peticiones.length;
    nodo(escenario, 'auto-descartar').disparar('click');
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(escenario.peticiones.length, antes, 'nothing sent');
    await abrirAlta(escenario);
    assert.deepEqual(pasoVisible(escenario), [1, 1]);
    assert.equal(nodo(escenario, 'auto-conexion').value, '');
  });

  test('CH-32b a connection, a template, a parameter value or a recipient each count as changes; the schedule alone does not', async () => {
    const cambios: Array<[string, (e: Escenario) => Promise<void>]> = [
      ['a connection', async (e) => { await elegirConexion(e, 'c-1'); }],
      ['a template', async (e) => { await elegirPlantillaAlta(e); }],
      ['a parameter value', async (e) => {
        await avanzar(e, [{ nombre: 'n', tipo: 'numero' }]);
        nodo(e, 'auto-valores').porClase('parametro-valor')[0].value = '5';
        nodo(e, 'auto-conexion').value = '';
        nodo(e, 'auto-valores').porClase('parametro-valor')[0].value = '5';
      }],
      ['a recipient', async (e) => { nodo(e, 'auto-destinatario').value = 'ops@example.com'; }],
    ];
    for (const [que, cambiar] of cambios) {
      const escenario = await arrancar();
      await elegirTenant(escenario, [], []);
      await abrirAlta(escenario);
      await cambiar(escenario);
      nodo(escenario, 'auto-cancelar').disparar('click');
      assert.equal(nodo(escenario, 'auto-confirmar').hidden, false, que);
    }
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    fijarHorario(escenario, 'lun-vie', '09:15');
    fijarHorario(escenario, 'personalizado', '5 4 * * 1');
    nodo(escenario, 'auto-cancelar').disparar('click');
    assert.equal(nodo(escenario, 'auto-alta').hidden, true, 'the schedule alone is not worth asking about');
  });

  test('CH-32b any other refusal of the create is told inside the pop-up too, which stays on step 2 with its values', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    await avanzar(escenario);
    nodo(escenario, 'auto-destinatario').value = 'ops@example.com';
    await enviar(escenario, { error: 'plantilla-no-encontrada' }, 404, 'auto-crear', 'click');
    assert.equal(nodo(escenario, 'banner').hidden, true, 'not in the banner behind the pop-up');
    assert.notEqual(nodo(escenario, 'auto-dialogo-aviso').textContent, '');
    assert.equal(nodo(escenario, 'auto-alta').hidden, false);
    assert.deepEqual(pasoVisible(escenario), [2, 2]);
    assert.equal(nodo(escenario, 'auto-destinatario').value, 'ops@example.com');
    assert.equal(nodo(escenario, 'auto-crear').disabled, false);
    // Trying again starts from a clean line.
    await enviar(escenario, { automatizacion: automatizacion() }, 201, 'auto-crear', 'click');
  });

  test('CH-32b a created automation closes the pop-up, resets it and leaves the confirmation on the page', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], []);
    await abrirAlta(escenario);
    await avanzar(escenario);
    nodo(escenario, 'auto-destinatario').value = 'ops@example.com';
    escenario.respuestas.push({ status: 201, cuerpo: { automatizacion: automatizacion(), proximaEjecucion: '2026-10-15T09:00:00.000Z', zonaHoraria: 'America/Argentina/Buenos_Aires' } });
    await enviar(escenario, { automatizaciones: [automatizacion()], truncado: false }, 200, 'auto-crear', 'click');
    assert.equal(nodo(escenario, 'auto-alta').hidden, true);
    assert.equal(nodo(escenario, 'auto-confirmar').hidden, true);
    assert.equal(nodo(escenario, 'auto-destinatario').value, '', 'reset');
    assert.equal(nodo(escenario, 'auto-dialogo-aviso').textContent, '');
    assert.match(nodo(escenario, 'banner').textContent, /^Se creó la automatización y ya aparece en la lista\./);
    assert.equal(nodo(escenario, 'banner').hidden, false);
  });

  // ---- CH-32b: the automations list in words ---------------------------------------------------

  /** The cells of the first row of the automations table, as `[Plantilla, Conexión, Horario, ...]` nodes. */
  const celdasDeFila = (escenario: Escenario): Nodo[] => filasDe(escenario, 'auto-lista', 'automatizacion')[0].hijos;

  test('CH-32b loading the screen asks for the catalog, then the connections, then the list', async () => {
    const escenario = await arrancar();
    const antes = escenario.peticiones.length;
    await elegirTenant(escenario, [], [automatizacion()]);
    assert.deepEqual(
      escenario.peticiones.slice(antes).map((p) => [p.url, p.tenant]),
      [['/consultas-guardadas', 't-1'], ['/conexiones', 't-1'], ['/plantillas', 't-1'], ['/conexiones', 't-1'], ['/automatizaciones', 't-1']],
    );
  });

  test('CH-32b each preset reads in words followed by its cron in monospace, and the connection by its name', async () => {
    const casos: Array<[string, string]> = [
      ['0 6 * * *', 'Todos los días a las 06:00'],
      ['0 6 * * 1-5', 'De lunes a viernes a las 06:00'],
      ['30 18 * * 1-6', 'De lunes a sábado a las 18:30'],
      ['5 9 * * *', 'Todos los días a las 09:05'],
      ['00 06 * * 1-5', 'De lunes a viernes a las 06:00'],
    ];
    for (const [cron, palabras] of casos) {
      const escenario = await arrancar();
      await elegirTenant(escenario, [], [automatizacion({ cron })], 't-1', undefined, [{ id: 'c-1', nombre: 'food-store' }]);
      const [, conexion, horario] = celdasDeFila(escenario);
      assert.equal(conexion.textContent, 'food-store');
      assert.equal(horario.textContent, palabras + ' ' + cron, cron);
      const codigos = buscar(horario, (n) => n.tagName === 'code');
      assert.equal(codigos.length, 1);
      assert.equal(codigos[0].textContent, cron);
      assert.equal(codigos[0].className, '', 'no class of the shared sheet: the console\'s script assigns none');
    }
  });

  test('CH-32b a custom or malformed schedule shows the cron alone, in monospace', async () => {
    const crones = [
      '*/30 8-18 * * *', '0 6 * * 1-4', '0 6 * * 7', '60 6 * * *', '0 24 * * *', '0 6 1 * *', '0 6 * 1 *', '0 6 * * * ', '0  6 * * *',
      '+1 6 * * *', '0 006 * * *', 'a 6 * * *', '0 6 * *', '0 6 * * * *', '',
    ];
    for (const cron of crones) {
      const escenario = await arrancar();
      await elegirTenant(escenario, [], [automatizacion({ cron })]);
      const [, , horario] = celdasDeFila(escenario);
      assert.equal(horario.textContent, cron, JSON.stringify(cron));
      assert.equal(buscar(horario, (n) => n.tagName === 'code').length, 1, JSON.stringify(cron));
    }
  });

  test('CH-32b a connection that is not among the tenant\'s shows its first 8 characters and an ellipsis, never the whole id', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion({ conexionId: '0a1b2c3d-4e5f-6789-abcd-ef0123456789' })], 't-1', undefined, [{ id: 'c-1', nombre: 'food-store' }]);
    const [, conexion] = celdasDeFila(escenario);
    assert.equal(conexion.textContent, '0a1b2c3d…');
    assert.ok(!textoDeLaPagina(escenario).includes('0a1b2c3d-4e5f'));
  });

  test('CH-32b a hostile connection name is shown as text', async () => {
    const hostil = '<img src=x onerror=alert(1)>';
    const escenario = await arrancar();
    await elegirTenant(escenario, [], [automatizacion()], 't-1', undefined, [{ id: 'c-1', nombre: hostil }]);
    const [, conexion] = celdasDeFila(escenario);
    assert.equal(conexion.textContent, hostil);
    assert.equal(conexion.hijos.length, 0, 'a text node holder only');
  });

  test('CH-32b the connections answering badly or not at all leaves the list drawn with short ids and nothing reported', async () => {
    const fallos: Array<[string, { status: number; cuerpo: unknown; falla?: boolean }]> = [
      ['a 500', { status: 500, cuerpo: { error: 'interno' } }],
      ['a 403', { status: 403, cuerpo: { error: 'prohibido' } }],
      ['a body without the list', { status: 200, cuerpo: { otra: 1 } }],
      ['a body that is not an object', { status: 200, cuerpo: 'texto' }],
      ['a network failure', { status: 0, cuerpo: null, falla: true }],
    ];
    for (const [que, respuesta] of fallos) {
      const escenario = await arrancar();
      nodo(escenario, 'tenant').value = 't-1';
      escenario.respuestas.push(
        { status: 200, cuerpo: { consultasGuardadas: [], truncado: false } },
        { status: 200, cuerpo: { conexiones: [], truncado: false } },
        { status: 200, cuerpo: { plantillas: [{ id: 'p-1', nombre: 'Stock diario' }], truncado: false } },
        respuesta,
        { status: 200, cuerpo: { automatizaciones: [automatizacion()], truncado: false } },
      );
      nodo(escenario, 'tenant').disparar('change');
      await asentarVarias();
      const filasLista = filasDe(escenario, 'auto-lista', 'automatizacion');
      assert.equal(filasLista.length, 1, que);
      assert.equal(filasLista[0].hijos[1].textContent, 'c-1…', que);
      assert.equal(nodo(escenario, 'banner').hidden, true, que + ': nothing is reported');
    }
  });

  test('CH-32b the names of the tenant just left never reach the list of the new one', async () => {
    const escenario = await arrancar([{ id: 't-1', nombre: 'Food Store' }, { id: 't-2', nombre: 'Otra' }]);
    let responder!: (cuerpo: unknown) => void;
    nodo(escenario, 'tenant').value = 't-1';
    escenario.respuestas.push(
      { status: 200, cuerpo: { consultasGuardadas: [], truncado: false } },
      { status: 200, cuerpo: { conexiones: [], truncado: false } },
      { status: 200, cuerpo: { plantillas: [], truncado: false } },
      { status: 200, cuerpo: new Promise((resolver) => { responder = resolver; }) },
    );
    nodo(escenario, 'tenant').disparar('change');
    await asentarVarias();
    await elegirTenant(escenario, [], [automatizacion()], 't-2');
    // The old tenant's chain asks for its list once its names are in; give it an answer so it ends quietly.
    escenario.respuestas.push({ status: 200, cuerpo: { automatizaciones: [automatizacion()], truncado: false } });
    responder({ conexiones: [{ id: 'c-1', nombre: 'Nombre del tenant anterior' }], truncado: false });
    await asentarVarias();
    const [, conexion] = celdasDeFila(escenario);
    assert.equal(conexion.textContent, 'c-1…');
    assert.ok(!textoDeLaPagina(escenario).includes('Nombre del tenant anterior'));
  });

  // ---- CH-29 (DEC-154): a lost session sends the page back to the login screen ---------

  test('CH-29 a 401 on the tenant list reloads the page instead of showing an error', async () => {
    const escenario = await arrancar([], { status: 401, cuerpo: { error: 'sesion-invalida' } });
    assert.equal(escenario.recargas, 1);
    assert.equal(nodo(escenario, 'banner').textContent, '', 'no message: the reload is the answer');
  });

  test('CH-29 a 401 on a scoped call reloads the page instead of rendering a failure', async () => {
    const escenario = await arrancar();
    await elegirTenantYConexion(escenario);
    await enviar(escenario, { error: 'sesion-expirada' }, 401);
    assert.equal(escenario.recargas, 1);
    assert.equal(nodo(escenario, 'banner').hidden, true);
  });

  test('CH-29 Salir posts to /consola/salir without a tenant header and reloads', async () => {
    const escenario = await arrancar();
    await elegirTenant(escenario);
    await enviar(escenario, { ok: true }, 200, 'salir', 'click');
    const ultima = escenario.peticiones[escenario.peticiones.length - 1];
    assert.equal(ultima.url, '/consola/salir');
    assert.equal(ultima.tenant, null);
    assert.equal(escenario.recargas, 1);
  });

  test('CH-29 Salir reloads even when the logout call fails', async () => {
    const escenario = await arrancar();
    await enviar(escenario, { error: 'sesion-invalida' }, 401, 'salir', 'click');
    assert.equal(escenario.recargas, 1);
  });
});

// ---- CH-29 (DEC-152, DEC-154): GET /consola serves the login screen or the console --------

describe('CH-29 the console page by session', () => {
  async function servir(operador: { id: string; nombre: string } | null, cookie?: string) {
    const vistas: Array<string | undefined> = [];
    const app = Fastify({ logger: false });
    registerConsolaRoute(app, async (cabecera) => {
      vistas.push(cabecera);
      return operador;
    });
    await app.ready();
    const respuesta = await app.inject({ method: 'GET', url: '/consola', headers: cookie ? { cookie } : {} });
    await app.close();
    return { respuesta, vistas };
  }

  function sinPeligros(documento: string): void {
    assert.equal(documento.split('</' + 'script>').length - 1, 1, 'exactly one closing script tag');
    assert.ok(!documento.includes('`'), 'no backtick');
    for (const prohibido of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'srcdoc']) {
      assert.ok(!documento.includes(prohibido), prohibido);
    }
    assert.ok(documento.includes('<link rel="stylesheet" href="/ui/styles.css">'));
  }

  test('without a session it serves the login screen, never the editor', async () => {
    const { respuesta, vistas } = await servir(null, 'zd_consola_session=x');
    assert.equal(respuesta.statusCode, 200);
    assert.match(String(respuesta.headers['content-type']), /text\/html/);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    assert.deepEqual(vistas, ['zd_consola_session=x'], 'the resolver receives the request cookie header');
    const documento = respuesta.body;
    assert.ok(!documento.includes('<textarea id="sql"'), 'no SQL editor without a session');
    assert.ok(documento.includes('id="form-ingreso"'));
    assert.ok(documento.includes('/consola/ingresar'));
    assert.ok(documento.includes('autocomplete="current-password"'));
    sinPeligros(documento);
  });

  test('with a session it serves the console with the operator in the header', async () => {
    const { respuesta } = await servir({ id: 'op-1', nombre: 'Ana' });
    assert.equal(respuesta.statusCode, 200);
    assert.equal(respuesta.headers['cache-control'], 'no-store');
    assert.ok(respuesta.body.includes('<textarea id="sql"'));
    assert.match(respuesta.body, /id="operador"[^>]*>[^<]*<strong>Ana<\/strong>/);
    sinPeligros(respuesta.body);
  });

  test('a name with markup is shown as text, escaped by the server', async () => {
    const { respuesta } = await servir({ id: 'op-1', nombre: '<b>ana</b>' });
    assert.ok(respuesta.body.includes('&lt;b&gt;ana&lt;/b&gt;'));
    assert.ok(!respuesta.body.includes('<b>ana</b>'));
  });

  /** Runs the login document's script against fake nodes and one queued `fetch` answer. */
  async function ingresarCon(status: number, cuerpo: unknown) {
    const { respuesta } = await servir(null);
    const documento = respuesta.body;
    const script = documento.slice(documento.indexOf('<script>') + '<script>'.length, documento.indexOf('</' + 'script>'));
    const nodos = new Map<string, Nodo>();
    for (const id of ['form-ingreso', 'nombre', 'clave', 'aviso-ingreso', 'texto-aviso', 'boton-ingresar', 'etiqueta-ingresar', 'icono-cargando']) {
      const n = new Nodo(id === 'form-ingreso' ? 'form' : 'div');
      n.id = id;
      nodos.set(id, n);
    }
    (nodos.get('nombre') as Nodo).value = 'ana';
    (nodos.get('clave') as Nodo).value = 'clave-larga-1';
    (nodos.get('aviso-ingreso') as Nodo).hidden = true;
    const peticiones: Array<{ url: string; cuerpo: unknown }> = [];
    let recargas = 0;
    const documentoFalso = { getElementById: (id: string) => nodos.get(id) ?? null };
    const ventana = { location: { reload: () => { recargas += 1; } } };
    const fetchFalso = async (url: string, opciones?: { body?: string }) => {
      peticiones.push({ url, cuerpo: opciones?.body === undefined ? null : JSON.parse(opciones.body) });
      return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
    };
    // eslint-disable-next-line no-new-func -- the point is to run the served script.
    new Function('document', 'window', 'fetch', script)(documentoFalso, ventana, fetchFalso);
    (nodos.get('form-ingreso') as Nodo).disparar('submit');
    await new Promise((resolver) => setImmediate(resolver));
    await new Promise((resolver) => setImmediate(resolver));
    return { nodos, peticiones, recargas: () => recargas };
  }

  test('the login screen posts the name and password and reloads on 200', async () => {
    const r = await ingresarCon(200, { operador: { id: 'op-1', nombre: 'ana' } });
    assert.deepEqual(r.peticiones, [{ url: '/consola/ingresar', cuerpo: { nombre: 'ana', clave: 'clave-larga-1' } }]);
    assert.equal(r.recargas(), 1);
  });

  test('a wrong password says so, keeps the name, and does not reload', async () => {
    const r = await ingresarCon(401, { error: 'nombre-o-clave-incorrectos' });
    assert.equal(r.recargas(), 0);
    assert.equal((r.nodos.get('aviso-ingreso') as Nodo).hidden, false);
    assert.equal((r.nodos.get('texto-aviso') as Nodo).textContent, 'Nombre o clave incorrectos.');
    assert.equal((r.nodos.get('nombre') as Nodo).value, 'ana');
    assert.equal((r.nodos.get('boton-ingresar') as Nodo).disabled, false);
  });

  test('any other failure says the console could not be reached', async () => {
    const r = await ingresarCon(500, { error: 'interno' });
    assert.equal(r.recargas(), 0);
    assert.match((r.nodos.get('texto-aviso') as Nodo).textContent, /No se pudo contactar/);
  });
});
