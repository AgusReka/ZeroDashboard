import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerConsolaRoute } from './consola.js';

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
  hijos: Nodo[] = [];
  private texto = '';
  private valorPropio = '';
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
] as const;

interface Escenario {
  nodos: Map<string, Nodo>;
  encabezado: Nodo;
  cuerpoTabla: Nodo;
  /** Queued responses, consumed in order by the stubbed `fetch`. */
  respuestas: Array<{ status: number; cuerpo: unknown }>;
  peticiones: Array<{ url: string; cuerpo: unknown }>;
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
  };

  const almacenamiento = new Map<string, string>();
  const ventana = {
    localStorage: {
      getItem: (clave: string): string | null => almacenamiento.get(clave) ?? null,
      setItem: (clave: string, valor: string): void => void almacenamiento.set(clave, valor),
      removeItem: (clave: string): void => void almacenamiento.delete(clave),
    },
  };

  const fetchFalso = async (url: string, opciones?: { body?: string }): Promise<unknown> => {
    escenario.peticiones.push({
      url,
      cuerpo: opciones?.body === undefined ? null : JSON.parse(opciones.body),
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

  // ---- behavioural cases: the script is run, not grepped ----------------------------

  /** Boots the console with one tenant already selectable, then returns the scenario. */
  async function arrancar(): Promise<Escenario> {
    const nodos = new Map<string, Nodo>();
    for (const id of IDS) {
      const nodo = new Nodo(id === 'tenant' ? 'select' : 'div');
      nodo.id = id;
      nodos.set(id, nodo);
    }
    const escenario: Escenario = {
      nodos,
      encabezado: new Nodo('thead'),
      cuerpoTabla: new Nodo('tbody'),
      respuestas: [{ status: 200, cuerpo: { tenants: [{ id: 't-1', nombre: 'Food Store' }] } }],
      peticiones: [],
    };

    ejecutarConsola(script, escenario);
    // `cargarTenants()` is the script's last statement and is async; let it settle.
    await new Promise((resolver) => setImmediate(resolver));
    return escenario;
  }

  /** Selects the tenant and submits the form with `cuerpo` queued as the response. */
  async function ejecutarCon(
    escenario: Escenario,
    cuerpo: unknown,
    status = 200,
  ): Promise<void> {
    const selector = escenario.nodos.get('tenant') as Nodo;
    selector.value = 't-1';
    // Switching tenants reloads the saved-query list, which is one more request.
    escenario.respuestas.push({ status: 200, cuerpo: { consultasGuardadas: [], truncado: false } });
    selector.disparar('change');
    await new Promise((resolver) => setImmediate(resolver));

    escenario.respuestas.push({ status, cuerpo });
    (escenario.nodos.get('formulario') as Nodo).disparar('submit');
    await new Promise((resolver) => setImmediate(resolver));
    await new Promise((resolver) => setImmediate(resolver));
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
});
