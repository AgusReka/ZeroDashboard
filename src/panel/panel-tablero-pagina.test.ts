import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { terminosProhibidosEn } from '../compartido/glosario-panel.js';
import { MARCADO_NAV, MARCADO_TABLERO, SCRIPT_TABLERO } from './panel-tablero-pagina.js';

/**
 * CH-48b task 6.3: the P-08 dashboard script, run against a fake DOM.
 *
 * No database and no server: the script is the served string, run through `new Function`
 * with a fake `document`, a `fetch` whose answers the test releases one by one, a `window`
 * with a hash, and a `Date` with a fixed clock. Every request the script makes is recorded,
 * with its init, so the tests can check what goes out as well as what is painted.
 */

class Nodo {
  tagName: string;
  children: Nodo[] = [];
  atributos: Record<string, string> = {};
  oyentes: Record<string, Array<() => void>> = {};
  hidden = false;
  className = '';
  disabled = false;
  id = '';
  value = '';
  type = '';
  open = false;
  private texto = '';

  constructor(tagName = 'div') {
    this.tagName = tagName;
  }

  get textContent(): string {
    return this.children.length > 0 ? this.children.map((h) => h.textContent).join('') : this.texto;
  }

  set textContent(valor: string) {
    this.children = [];
    this.texto = String(valor);
  }

  appendChild(hijo: Nodo): Nodo {
    this.children.push(hijo);
    return hijo;
  }

  setAttribute(clave: string, valor: string): void {
    this.atributos[clave] = String(valor);
  }

  removeAttribute(clave: string): void {
    delete this.atributos[clave];
  }

  addEventListener(tipo: string, oyente: () => void): void {
    (this.oyentes[tipo] ??= []).push(oyente);
  }

  disparar(tipo: string): void {
    for (const oyente of this.oyentes[tipo] ?? []) oyente();
  }

  /** Every node under this one, depth first, itself included. */
  todos(): Nodo[] {
    return [this, ...this.children.flatMap((h) => h.todos())];
  }
}

interface Pedido {
  url: string;
  init: unknown;
  responder: (status: number, cuerpo?: unknown) => void;
  fallar: () => void;
  hecho: boolean;
}

const AHORA = Date.parse('2026-11-10T15:00:00.000Z');
const ZONA = 'America/Argentina/Buenos_Aires';
const esperar = () => new Promise((r) => setImmediate(r));

function montar(hash = '') {
  const fijos = new Map<string, Nodo>();
  for (const id of ['nav-panel', 'nav-tablero', 'nav-avisos', 'seccion-tablero', 'seccion-avisos', 'lista-tablero', 'tablero-frescura', 'boton-actualizar', 'tablero-aviso']) {
    const nodo = new Nodo();
    nodo.id = id;
    fijos.set(id, nodo);
  }
  // The static markup starts like this: no nav, no dashboard, «Avisos» showing.
  fijos.get('nav-panel')!.hidden = true;
  fijos.get('seccion-tablero')!.hidden = true;
  fijos.get('tablero-aviso')!.hidden = true;
  const documento = {
    getElementById: (id: string) => {
      if (!fijos.has(id)) fijos.set(id, new Nodo());
      return fijos.get(id)!;
    },
    createElement: (tag: string) => new Nodo(tag),
    createElementNS: (_ns: string, tag: string) => new Nodo(tag),
  };
  const pedidos: Pedido[] = [];
  const buscar = (url: string, init?: unknown) =>
    new Promise((resolve, reject) => {
      const pedido: Pedido = {
        url,
        init,
        hecho: false,
        responder: (status, cuerpo) => {
          pedido.hecho = true;
          resolve({ status, ok: status < 300, json: () => (cuerpo === undefined ? Promise.reject(new Error('vacío')) : Promise.resolve(cuerpo)) });
        },
        fallar: () => {
          pedido.hecho = true;
          reject(new TypeError('red'));
        },
      };
      pedidos.push(pedido);
    });
  const recargas: number[] = [];
  const oyentesVentana: Record<string, Array<() => void>> = {};
  const ventana = {
    location: { hash, reload: () => recargas.push(1) },
    addEventListener: (tipo: string, oyente: () => void) => (oyentesVentana[tipo] ??= []).push(oyente),
  };
  class Reloj extends Date {
    static override now(): number {
      return AHORA;
    }
  }
  new Function('document', 'fetch', 'window', 'Date', SCRIPT_TABLERO)(documento, buscar, ventana, Reloj);

  const el = (id: string) => documento.getElementById(id);
  const tarjetas = () => el('lista-tablero').children;
  const cuerpo = (i: number) => tarjetas()[i].children[1];
  const textos = (nodo: Nodo) => nodo.todos().filter((n) => n.children.length === 0).map((n) => n.textContent);
  const ultimo = (url: string) => [...pedidos].reverse().find((p) => p.url === url && !p.hecho);
  return {
    el,
    pedidos,
    recargas,
    tarjetas,
    cuerpo,
    textos,
    abiertos: () => pedidos.filter((p) => !p.hecho),
    /** Answers the oldest pending request for `url`. */
    responder: async (url: string, status: number, cuerpo?: unknown) => {
      const pedido = pedidos.find((p) => p.url === url && !p.hecho);
      assert.ok(pedido !== undefined, `no pending request for ${url}`);
      pedido.responder(status, cuerpo);
      await esperar();
    },
    fallar: async (url: string) => {
      const pedido = pedidos.find((p) => p.url === url && !p.hecho);
      assert.ok(pedido !== undefined, `no pending request for ${url}`);
      pedido.fallar();
      await esperar();
    },
    ultimo,
    cambiarHash: (nuevo: string) => {
      ventana.location.hash = nuevo;
      for (const oyente of oyentesVentana.hashchange ?? []) oyente();
    },
  };
}

const CONFIG = '/api/panel/tablero';
const ruta = (id: string, dias?: number) => `/api/panel/tablero/${id}/resultado${dias === undefined ? '' : `?dias=${dias}`}`;
const reporte = (id: string, visualizacion = 'tabla', periodo: { dias: number[]; predeterminado: number } | null = null) => ({
  id,
  titulo: `Reporte ${id}`,
  descripcion: null,
  visualizacion,
  periodo,
});
const configuracion = (reportes: unknown[], actualizadosEn: string | null = null) => ({
  reportes,
  datos: { actualizadosEn },
  zonaHoraria: ZONA,
});
const TABLA_OK = {
  estado: 'ok',
  columnas: [{ rol: 'columna', titulo: 'Producto' }, { rol: 'columna', titulo: 'Unidades' }],
  filas: [['Yerba', 12], ['Mate', 3]],
  corte: false,
  periodo: null,
};

/** Loads the page with `reportes` and answers the configuration. */
async function conTablero(reportes: unknown[], hash = '', actualizadosEn: string | null = null) {
  const pagina = montar(hash);
  await pagina.responder(CONFIG, 200, configuracion(reportes, actualizadosEn));
  return pagina;
}

describe('CH-48b P-08 dashboard script (fake DOM)', () => {
  describe('navigation', () => {
    test('with no reports there is no nav and «Avisos» shows, as before', async () => {
      const pagina = await conTablero([]);
      assert.equal(pagina.el('nav-panel').hidden, true);
      assert.equal(pagina.el('seccion-tablero').hidden, true);
      assert.equal(pagina.el('seccion-avisos').hidden, false);
      assert.deepEqual(pagina.pedidos.map((p) => p.url), [CONFIG]);
    });

    test('a failing configuration (5xx or network) shows «Avisos» only, with no notice', async () => {
      for (const forma of ['500', 'red']) {
        const pagina = montar();
        if (forma === 'red') await pagina.fallar(CONFIG);
        else await pagina.responder(CONFIG, 500, { error: 'error-interno' });
        assert.equal(pagina.el('nav-panel').hidden, true, forma);
        assert.equal(pagina.el('seccion-avisos').hidden, false, forma);
        assert.equal(pagina.el('tablero-aviso').hidden, true, forma);
        assert.equal(pagina.el('boton-actualizar').disabled, false, forma);
      }
    });

    test('a 401 on the configuration reloads the page', async () => {
      const pagina = montar();
      await pagina.responder(CONFIG, 401, { error: 'sesion-invalida' });
      assert.equal(pagina.recargas.length, 1);
    });

    test('with reports «Tablero» is the default, and the hash switches the view and aria-current', async () => {
      const pagina = await conTablero([reporte('r-1'), reporte('r-2')]);
      assert.equal(pagina.el('nav-panel').hidden, false);
      assert.equal(pagina.el('seccion-tablero').hidden, false);
      assert.equal(pagina.el('seccion-avisos').hidden, true);
      assert.equal(pagina.el('nav-tablero').atributos['aria-current'], 'page');
      assert.equal(pagina.el('nav-avisos').atributos['aria-current'], undefined);

      pagina.cambiarHash('#avisos');
      assert.equal(pagina.el('seccion-tablero').hidden, true);
      assert.equal(pagina.el('seccion-avisos').hidden, false);
      assert.equal(pagina.el('nav-avisos').atributos['aria-current'], 'page');
      assert.equal(pagina.el('nav-tablero').atributos['aria-current'], undefined);

      pagina.cambiarHash('#otra-cosa');
      assert.equal(pagina.el('seccion-tablero').hidden, false, 'any other hash means «Tablero»');
    });

    test('opening with #avisos starts on «Avisos»', async () => {
      const pagina = await conTablero([reporte('r-1')], '#avisos');
      assert.equal(pagina.el('seccion-avisos').hidden, false);
      assert.equal(pagina.el('seccion-tablero').hidden, true);
    });
  });

  describe('the run queue', () => {
    test('five reports: three requests at a time, in dashboard order; one ending lets the next start', async () => {
      const ids = ['r-1', 'r-2', 'r-3', 'r-4', 'r-5'];
      const pagina = await conTablero(ids.map((id) => reporte(id)));
      assert.deepEqual(pagina.abiertos().map((p) => p.url), [ruta('r-1'), ruta('r-2'), ruta('r-3')]);

      await pagina.responder(ruta('r-2'), 200, TABLA_OK);
      assert.deepEqual(pagina.abiertos().map((p) => p.url), [ruta('r-1'), ruta('r-3'), ruta('r-4')]);
    });

    test('a slow card does not block the others: the second paints while the first keeps its skeleton', async () => {
      const pagina = await conTablero([reporte('r-1'), reporte('r-2')]);
      await pagina.responder(ruta('r-2'), 200, TABLA_OK);
      assert.equal(pagina.cuerpo(0).atributos['aria-busy'], 'true');
      assert.ok(pagina.cuerpo(0).todos().some((n) => n.className.includes('zd-skeleton')));
      assert.ok(pagina.cuerpo(1).todos().some((n) => n.tagName === 'table'));
    });

    test('a stale answer is dropped: the card shows only the answer to its last request', async () => {
      const pagina = await conTablero([reporte('r-1', 'tabla', { dias: [30, 7], predeterminado: 30 })]);
      const select = pagina.tarjetas()[0].todos().find((n) => n.tagName === 'select')!;
      select.value = '7';
      select.disparar('change');
      await pagina.responder(ruta('r-1', 7), 200, { ...TABLA_OK, filas: [['Nuevo', 1]] });
      await pagina.responder(ruta('r-1', 30), 200, { ...TABLA_OK, filas: [['Viejo', 1]] });
      const textos = pagina.textos(pagina.cuerpo(0));
      assert.ok(textos.includes('Nuevo'));
      assert.ok(!textos.includes('Viejo'));
    });

    test('there is no timer: once every card answered, nothing else is requested', async () => {
      assert.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(SCRIPT_TABLERO));
      const pagina = await conTablero([reporte('r-1')]);
      await pagina.responder(ruta('r-1'), 200, TABLA_OK);
      const antes = pagina.pedidos.length;
      await esperar();
      await esperar();
      assert.equal(pagina.pedidos.length, antes);
    });
  });

  describe('card states', () => {
    const COPIA: Array<[string, string, string | null, boolean]> = [
      ['sin-datos', 'No hay datos para este período.', null, false],
      ['no-disponible', 'No podemos mostrar este reporte por ahora.', 'Si sigue así, avisale a quien te dio acceso.', false],
      ['tiempo-agotado', 'Tu tienda tardó demasiado en responder.', 'Volvé a intentar en unos minutos.', true],
      ['sin-conexion', 'No pudimos llegar a los datos de tu negocio.', 'Volvé a intentar en unos minutos.', true],
      ['error', 'No pudimos cargar este reporte.', 'Volvé a intentar en unos minutos.', true],
      ['algo-nuevo', 'No pudimos cargar este reporte.', 'Volvé a intentar en unos minutos.', true],
    ];

    for (const [estado, titulo, cuerpo, reintentar] of COPIA) {
      test(`«${estado}» shows its copy${reintentar ? ' and «Reintentar»' : ' and no action'}`, async () => {
        const pagina = await conTablero([reporte('r-1'), reporte('r-2')]);
        await pagina.responder(ruta('r-1'), 200, { estado });
        const textos = pagina.textos(pagina.cuerpo(0));
        assert.ok(textos.includes(titulo), titulo);
        if (cuerpo) assert.ok(textos.includes(cuerpo), cuerpo);
        assert.equal(textos.includes('Reintentar'), reintentar);
        const caja = pagina.cuerpo(0).children[0];
        assert.equal(caja.atributos.role, reintentar ? 'alert' : 'status');
        assert.equal(pagina.cuerpo(1).atributos['aria-busy'], 'true', 'the other card is unaffected');
        for (const texto of textos) assert.deepEqual(terminosProhibidosEn(texto), [], texto);
      });
    }

    test('«Reintentar» re-runs only its card', async () => {
      const pagina = await conTablero([reporte('r-1'), reporte('r-2')]);
      await pagina.responder(ruta('r-1'), 200, { estado: 'tiempo-agotado' });
      await pagina.responder(ruta('r-2'), 200, TABLA_OK);
      const antes = pagina.pedidos.length;
      const boton = pagina.cuerpo(0).todos().find((n) => n.tagName === 'button' && n.textContent === 'Reintentar')!;
      boton.disparar('click');
      await esperar();
      assert.deepEqual(pagina.pedidos.slice(antes).map((p) => p.url), [ruta('r-1')]);
      assert.equal(pagina.cuerpo(0).atributos['aria-busy'], 'true');
      await pagina.responder(ruta('r-1'), 200, TABLA_OK);
      assert.ok(pagina.textos(pagina.cuerpo(0)).includes('Yerba'));
    });

    test('a 429, a 5xx, a 404 and a network failure show the error state; a 401 reloads', async () => {
      const pagina = await conTablero([reporte('r-1'), reporte('r-2'), reporte('r-3')]);
      await pagina.responder(ruta('r-1'), 429, { error: 'demasiadas-solicitudes' });
      await pagina.fallar(ruta('r-2'));
      await pagina.responder(ruta('r-3'), 502);
      for (const i of [0, 1, 2]) {
        assert.ok(pagina.textos(pagina.cuerpo(i)).includes('No pudimos cargar este reporte.'), String(i));
      }
      pagina.cuerpo(0).todos().find((n) => n.textContent === 'Reintentar' && n.tagName === 'button')!.disparar('click');
      await esperar();
      await pagina.responder(ruta('r-1'), 404, { error: 'reporte-no-encontrado' });
      assert.ok(pagina.textos(pagina.cuerpo(0)).includes('No pudimos cargar este reporte.'));

      pagina.cuerpo(1).todos().find((n) => n.textContent === 'Reintentar' && n.tagName === 'button')!.disparar('click');
      await esperar();
      await pagina.responder(ruta('r-2'), 401, { error: 'sesion-expirada' });
      assert.equal(pagina.recargas.length, 1);
    });
  });

  describe('period', () => {
    test('the select lists the declared days in order, starts on the default, and a change re-runs one card with dias', async () => {
      const pagina = await conTablero([
        reporte('r-1', 'barras', { dias: [30, 7, 1], predeterminado: 30 }),
        reporte('r-2'),
      ]);
      assert.deepEqual(pagina.abiertos().map((p) => p.url), [ruta('r-1', 30), ruta('r-2')]);
      const tarjeta = pagina.tarjetas()[0];
      const select = tarjeta.todos().find((n) => n.tagName === 'select')!;
      const rotulo = tarjeta.todos().find((n) => n.tagName === 'label')!;
      assert.equal(rotulo.textContent, 'Período');
      assert.equal(rotulo.atributos.for, select.id);
      assert.deepEqual(select.children.map((o) => [o.value, o.textContent]), [['30', 'Últimos 30 días'], ['7', 'Últimos 7 días'], ['1', 'Último día']]);
      assert.equal(select.value, '30');
      await pagina.responder(ruta('r-1', 30), 200, TABLA_OK);
      await pagina.responder(ruta('r-2'), 200, TABLA_OK);

      const antes = pagina.pedidos.length;
      select.value = '7';
      select.disparar('change');
      await esperar();
      assert.deepEqual(pagina.pedidos.slice(antes).map((p) => p.url), [ruta('r-1', 7)]);
    });

    test('a report without a period has no select and sends no dias', async () => {
      const pagina = await conTablero([reporte('r-1')]);
      assert.ok(!pagina.tarjetas()[0].todos().some((n) => n.tagName === 'select'));
      assert.equal(pagina.pedidos[1].url, ruta('r-1'));
      assert.ok(!pagina.pedidos[1].url.includes('dias'));
    });
  });

  describe('«Actualizar»', () => {
    test('disabled while anything is pending; it re-reads the configuration and re-runs every card', async () => {
      const pagina = montar();
      const boton = pagina.el('boton-actualizar');
      assert.equal(boton.disabled, true, 'while the configuration loads');
      await pagina.responder(CONFIG, 200, configuracion([reporte('r-1'), reporte('r-2')]));
      assert.equal(boton.disabled, true);
      await pagina.responder(ruta('r-1'), 200, TABLA_OK);
      assert.equal(boton.disabled, true, 'one card still pending');
      await pagina.responder(ruta('r-2'), 200, { estado: 'sin-datos' });
      assert.equal(boton.disabled, false);

      const antes = pagina.pedidos.length;
      boton.disparar('click');
      await esperar();
      assert.equal(boton.disabled, true);
      assert.deepEqual(pagina.pedidos.slice(antes).map((p) => p.url), [CONFIG]);
      await pagina.responder(CONFIG, 200, configuracion([reporte('r-1'), reporte('r-2')]));
      assert.deepEqual(pagina.pedidos.slice(antes + 1).map((p) => p.url), [ruta('r-1'), ruta('r-2')]);
    });

    test('a failing refresh keeps the cards and shows a notice', async () => {
      const pagina = await conTablero([reporte('r-1')]);
      await pagina.responder(ruta('r-1'), 200, TABLA_OK);
      pagina.el('boton-actualizar').disparar('click');
      await pagina.fallar(CONFIG);
      assert.equal(pagina.el('tablero-aviso').hidden, false);
      assert.equal(pagina.tarjetas().length, 1);
      assert.equal(pagina.el('boton-actualizar').disabled, false);
    });
  });

  describe('bodies', () => {
    test('a number card shows the value in es-AR with the column title as label', async () => {
      const pagina = await conTablero([reporte('r-1', 'numero')]);
      await pagina.responder(ruta('r-1'), 200, {
        estado: 'ok', columnas: [{ rol: 'valor', titulo: 'Ventas del mes' }], filas: [[1520.5]], corte: false, periodo: null,
      });
      const caja = pagina.cuerpo(0).children[0];
      assert.equal(caja.className, 'panel-numero');
      assert.deepEqual(caja.children.map((n) => n.textContent), ['Ventas del mes', '1.520,5']);
    });

    test('a table has a caption, th scope=col, and zd-num only on all-number columns', async () => {
      const pagina = await conTablero([reporte('r-1')]);
      await pagina.responder(ruta('r-1'), 200, {
        ...TABLA_OK,
        columnas: [{ rol: 'columna', titulo: 'Producto' }, { rol: 'columna', titulo: 'Unidades' }, { rol: 'columna', titulo: 'Código' }, { rol: 'columna', titulo: 'Fecha' }],
        filas: [['Yerba', 1240, 'A1', '2026-11-03'], ['Mate', 3, 7, null]],
      });
      const tabla = pagina.cuerpo(0).todos().find((n) => n.tagName === 'table')!;
      const caption = tabla.children.find((n) => n.tagName === 'caption')!;
      assert.equal(caption.textContent, 'Reporte r-1');
      const encabezados = tabla.todos().filter((n) => n.tagName === 'th');
      assert.deepEqual(encabezados.map((n) => n.atributos.scope), ['col', 'col', 'col', 'col']);
      assert.deepEqual(encabezados.map((n) => n.className.includes('zd-num')), [false, true, false, false]);
      const celdas = tabla.todos().filter((n) => n.tagName === 'td');
      assert.deepEqual(celdas.map((n) => n.textContent), ['Yerba', '1.240', 'A1', '03/11', 'Mate', '3', '7', '—']);
      assert.deepEqual(celdas.map((n) => n.className.includes('zd-num')), [false, true, false, false, false, true, false, false]);
    });

    test('a bar or line card shows its table open in this slice, under «Ver los datos en una tabla»', async () => {
      for (const vista of ['barras', 'linea']) {
        const pagina = await conTablero([reporte('r-1', vista)]);
        await pagina.responder(ruta('r-1'), 200, { ...TABLA_OK, columnas: [{ rol: 'etiqueta', titulo: 'Día' }, { rol: 'valor', titulo: 'Ventas' }], filas: [['2026-11-03', 10], ['2026-11-04', 12], ['2026-11-05', 9]] });
        const detalles = pagina.cuerpo(0).children[0];
        assert.equal(detalles.tagName, 'details', vista);
        assert.equal(detalles.open, true, vista);
        assert.equal(detalles.children[0].textContent, 'Ver los datos en una tabla');
        assert.equal(detalles.todos().filter((n) => n.tagName === 'tr').length, 4, 'header and three rows');
        assert.ok(!pagina.cuerpo(0).todos().some((n) => n.tagName === 'canvas'));
      }
    });

    test('«Desde el dd/mm» with a period, and the cut line with the rows shown', async () => {
      const pagina = await conTablero([reporte('r-1', 'tabla', { dias: [7], predeterminado: 7 })]);
      await pagina.responder(ruta('r-1', 7), 200, { ...TABLA_OK, corte: true, periodo: { dias: 7, desde: '2026-11-03' } });
      const textos = pagina.textos(pagina.cuerpo(0));
      assert.ok(textos.includes('Desde el 03/11'));
      assert.ok(textos.includes('Mostramos solo los primeros 2 resultados.'));
    });

    test('an ok answer without rows or with a non-number value on a number card shows the error state', async () => {
      const pagina = await conTablero([reporte('r-1', 'numero'), reporte('r-2')]);
      await pagina.responder(ruta('r-1'), 200, { estado: 'ok', columnas: [{ rol: 'valor', titulo: 'X' }], filas: [['n/a']] });
      await pagina.responder(ruta('r-2'), 200, { estado: 'ok', columnas: [], filas: 'nada' });
      assert.ok(pagina.textos(pagina.cuerpo(0)).includes('No pudimos cargar este reporte.'));
      assert.ok(pagina.textos(pagina.cuerpo(1)).includes('No pudimos cargar este reporte.'));
    });
  });

  describe('freshness', () => {
    const casos: Array<[string | null, string]> = [
      ['2026-11-10T12:00:00.000Z', 'Datos de tu negocio actualizados hace 3 h · 10/11, 09:00'],
      ['2026-11-10T14:35:00.000Z', 'Datos de tu negocio actualizados hace 25 min · 10/11, 11:35'],
      ['2026-11-10T14:59:40.000Z', 'Datos de tu negocio actualizados hace menos de 1 min · 10/11, 11:59'],
      ['2026-11-07T15:00:00.000Z', 'Datos de tu negocio actualizados hace 3 días · 07/11, 12:00'],
      ['2026-11-08T16:00:00.000Z', 'Datos de tu negocio actualizados hace 47 h · 08/11, 13:00'],
      [null, 'Todavía no tenemos la fecha de actualización de tus datos.'],
    ];
    for (const [actualizadosEn, linea] of casos) {
      test(`${actualizadosEn ?? 'null'} reads «${linea}»`, async () => {
        const pagina = await conTablero([reporte('r-1')], '', actualizadosEn);
        assert.equal(pagina.el('tablero-frescura').textContent, linea);
        assert.equal(pagina.pedidos.length, 2, 'the line delays no run');
      });
    }
  });

  describe('safety', () => {
    test('markup in titles, descriptions and values stays text', async () => {
      const pagina = await conTablero([{ ...reporte('r-1'), titulo: '<b>Ventas</b>', descripcion: '<img src=x onerror=alert(1)>' }]);
      await pagina.responder(ruta('r-1'), 200, { ...TABLA_OK, columnas: [{ rol: 'columna', titulo: '<i>Col</i>' }], filas: [['<script>alert(1)</script>']] });
      const textos = pagina.textos(pagina.tarjetas()[0]);
      for (const texto of ['<b>Ventas</b>', '<img src=x onerror=alert(1)>', '<i>Col</i>', '<script>alert(1)</script>']) {
        assert.ok(textos.includes(texto), texto);
      }
      const etiquetas = new Set(pagina.tarjetas()[0].todos().map((n) => n.tagName));
      for (const prohibida of ['b', 'i', 'img', 'script']) assert.ok(!etiquetas.has(prohibida), prohibida);
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(SCRIPT_TABLERO));
    });

    test('no request carries a tenant identifier, a header or a body; the report id is encoded', async () => {
      const pagina = await conTablero([reporte('r 1/x', 'tabla', { dias: [7], predeterminado: 7 })]);
      assert.equal(pagina.pedidos[1].url, '/api/panel/tablero/r%201%2Fx/resultado?dias=7');
      for (const pedido of pagina.pedidos) {
        assert.deepEqual(pedido.init, { credentials: 'same-origin' }, pedido.url);
        assert.ok(!/tenant/i.test(pedido.url));
      }
      assert.ok(!/x-tenant-id|tenant/i.test(SCRIPT_TABLERO));
      assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(SCRIPT_TABLERO), 'nothing is stored on the client');
    });

    test('the script is safe to embed in the page template and its literals pass the glossary', () => {
      assert.ok(!SCRIPT_TABLERO.includes('`'));
      assert.ok(!SCRIPT_TABLERO.includes('${'));
      assert.ok(!SCRIPT_TABLERO.includes('</script'));
      assert.doesNotThrow(() => new Function(SCRIPT_TABLERO));
      for (const literal of SCRIPT_TABLERO.match(/'[^']*'/g) ?? []) {
        assert.deepEqual(terminosProhibidosEn(literal), [], literal);
      }
      const visible = (MARCADO_NAV + MARCADO_TABLERO).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ');
      assert.deepEqual(terminosProhibidosEn(visible), []);
    });
  });
});
