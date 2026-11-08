import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, describe, test } from 'node:test';
import vm from 'node:vm';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  ARCHIVOS_ESTILOS,
  RUTAS_ESTILOS,
  cargarEstilos,
  registerEstilosRoutes,
} from './estilos-rutas.js';
import { ESTILOS_EXENTOS } from '../aislamiento/contexto-tenant.js';

/**
 * CH-21a tasks 1.2-1.3 (spec `shared-visual-system`, DEC-124): the fixed-list registrar,
 * tests R1-R7 of `design.md`. CH-47 (DEC-184, DEC-200) adds the vendored Chart.js row:
 * R5b and V1-V4 pin that file by version and hash.
 *
 * The app under test registers **only** this registrar: no tenant hooks and no database
 * client. That is the claim being tested, like `contrato-rutas.test.ts` does for
 * `/contrato`: the six assets are identical for every tenant, so an app that carries
 * nothing else must still serve them in full. The exemption half (the tenant hooks in
 * front of these routes) is proven in `contexto-tenant.test.ts`.
 */

const CSS = 'text/css; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';

/** The pinned release of the vendored script (CH-47). A new version edits these two. */
const CHART_VERSION = '4.6.1';
const CHART_SHA256 = '338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf';

/** The vendored folder the production loader reads, resolved the same way it is. */
const DIRECTORIO_REAL = new URL('../../public/ui/', import.meta.url);

function bytesEnDisco(archivo: string): Buffer {
  return readFileSync(new URL(archivo, DIRECTORIO_REAL));
}

/** A temp copy of the six files, optionally without one, as a directory `URL`. */
function copiaTemporal(omitir?: string): { dir: URL; ruta: string } {
  const ruta = mkdtempSync(join(tmpdir(), 'zd-estilos-'));
  for (const { archivo } of ARCHIVOS_ESTILOS) {
    if (archivo === omitir) continue;
    const destino = join(ruta, archivo);
    // Creates `tokens/`, `components/` and `vendor/` as the rows need them.
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, bytesEnDisco(archivo));
  }
  // The trailing slash matters: `new URL(file, dir)` resolves against the directory only
  // when the base ends in `/`.
  return { dir: new URL(pathToFileURL(ruta).href + '/'), ruta };
}

describe('asset registrar — the six listed files (CH-21a, DEC-124; CH-47, DEC-200)', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    registerEstilosRoutes(app, cargarEstilos());
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('R1 each route answers 200 with its row content type, no-cache, a strong ETag and the file bytes', async () => {
    assert.equal(RUTAS_ESTILOS.length, 6);
    for (const { archivo, tipo } of ARCHIVOS_ESTILOS) {
      const url = '/ui/' + archivo;
      const respuesta = await app.inject({ method: 'GET', url });

      assert.equal(respuesta.statusCode, 200, `${url}: ${respuesta.body}`);
      assert.equal(respuesta.headers['content-type'], tipo, url);
      assert.equal(respuesta.headers['cache-control'], 'no-cache', url);
      const etag = respuesta.headers.etag;
      assert.equal(typeof etag, 'string', `${url} carries no ETag`);
      assert.match(etag as string, /^"[A-Za-z0-9_-]+"$/, `${url} ETag must be strong and quoted`);
      // Compared as bytes, not as text: the comments carry non-ASCII characters, and a
      // decode/encode round trip would forgive a difference a browser would see.
      assert.ok(respuesta.rawPayload.equals(bytesEnDisco(archivo)), `${url} body differs from the file`);

      const otraVez = await app.inject({ method: 'GET', url });
      assert.equal(otraVez.headers.etag, etag, `${url} ETag changed between requests`);
    }
  });

  test('R1 the stylesheets are text/css and the vendored script is text/javascript, named explicitly', async () => {
    // Named here rather than read from the row, so a wrong type in the list cannot pass.
    const script = await app.inject({ method: 'GET', url: '/ui/vendor/chart.umd.js' });
    assert.equal(script.statusCode, 200, script.body);
    assert.equal(script.headers['content-type'], JS);

    for (const url of [
      '/ui/styles.css',
      '/ui/tokens/colors.css',
      '/ui/tokens/typography.css',
      '/ui/tokens/spacing.css',
      '/ui/components/components.css',
    ]) {
      const hoja = await app.inject({ method: 'GET', url });
      assert.equal(hoja.headers['content-type'], CSS, url);
    }
  });

  test('R2 a matching If-None-Match answers 304 with no body; another tag answers 200', async () => {
    for (const url of RUTAS_ESTILOS) {
      const primera = await app.inject({ method: 'GET', url });
      const etag = primera.headers.etag as string;

      const revalidada = await app.inject({ method: 'GET', url, headers: { 'if-none-match': etag } });
      assert.equal(revalidada.statusCode, 304, url);
      assert.equal(revalidada.rawPayload.length, 0, `${url} 304 must carry no body`);
      assert.equal(revalidada.headers['cache-control'], 'no-cache', url);

      const otra = await app.inject({ method: 'GET', url, headers: { 'if-none-match': '"otra-etiqueta"' } });
      assert.equal(otra.statusCode, 200, url);
      assert.ok(otra.rawPayload.equals(primera.rawPayload), `${url} must answer the full body`);
    }
  });

  test('R4 every @import in styles.css resolves to one of the other four stylesheet routes', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/ui/styles.css' });
    const importados = [...respuesta.body.matchAll(/@import\s+url\("([^"]+)"\)/g)].map(
      (coincidencia) => new URL(coincidencia[1] as string, 'http://zd.invalid/ui/styles.css').pathname,
    );

    // The CSS rows minus `styles.css`: the script row never enters the expected set.
    const esperados = ARCHIVOS_ESTILOS.filter(
      ({ archivo, tipo }) => tipo === CSS && archivo !== 'styles.css',
    ).map(({ archivo }) => '/ui/' + archivo);
    assert.equal(esperados.length, 4);
    assert.deepEqual([...importados].sort(), [...esperados].sort());
  });
});

describe('asset registrar — route table and exemption rows (R3)', () => {
  test('R3 the registered /ui/ routes are exactly GET RUTAS_ESTILOS, and so are the exempt rows', async () => {
    const app = Fastify({ logger: false });
    const capturadas: string[] = [];
    app.addHook('onRoute', (opciones) => {
      const metodos = Array.isArray(opciones.method) ? opciones.method : [opciones.method];
      for (const metodo of metodos) {
        capturadas.push(`${metodo} ${opciones.url}`);
      }
    });
    registerEstilosRoutes(app, cargarEstilos());
    await app.ready();
    await app.close();

    const esperadas = RUTAS_ESTILOS.map((ruta) => 'GET ' + ruta);
    // Every route this registrar adds, any method: no automatic HEAD, no prefix, no extra.
    assert.deepEqual([...capturadas].sort(), [...esperadas].sort());

    // The exemption is built from the same list, so the two cannot diverge.
    assert.equal(ESTILOS_EXENTOS.size, esperadas.length);
    for (const fila of esperadas) {
      assert.ok(ESTILOS_EXENTOS.has(fila), `missing exempt row ${fila}`);
    }
    for (const fila of ESTILOS_EXENTOS) {
      assert.ok(esperadas.includes(fila), `extra exempt row ${fila}`);
    }
  });
});

describe('asset registrar — boot-time load (R5, R6)', () => {
  const temporales: string[] = [];

  after(() => {
    for (const ruta of temporales) {
      rmSync(ruta, { recursive: true, force: true });
    }
  });

  test('R5 a missing tokens/spacing.css makes cargarEstilos throw naming the file', () => {
    const { dir, ruta } = copiaTemporal('tokens/spacing.css');
    temporales.push(ruta);

    assert.throws(
      () => cargarEstilos(dir),
      (error: unknown) =>
        error instanceof Error && error.message.includes('public/ui/tokens/spacing.css'),
    );
  });

  test('R5b a missing vendor/chart.umd.js makes cargarEstilos throw naming the script', () => {
    const { dir, ruta } = copiaTemporal('vendor/chart.umd.js');
    temporales.push(ruta);

    assert.throws(
      () => cargarEstilos(dir),
      (error: unknown) =>
        error instanceof Error && error.message.includes('public/ui/vendor/chart.umd.js'),
    );
  });

  test('R6 a file edited after loading leaves the served bytes unchanged', async () => {
    const { dir, ruta } = copiaTemporal();
    temporales.push(ruta);
    const estilos = cargarEstilos(dir);

    const app = Fastify({ logger: false });
    registerEstilosRoutes(app, estilos);
    await app.ready();
    try {
      writeFileSync(join(ruta, 'components', 'components.css'), '/* edited after boot */\n');

      const respuesta = await app.inject({ method: 'GET', url: '/ui/components/components.css' });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.ok(
        respuesta.rawPayload.equals(bytesEnDisco('components/components.css')),
        'the route must serve the bytes loaded at boot, not re-read the file',
      );
    } finally {
      await app.close();
    }
  });
});

describe('asset registrar — the vendored Chart.js is pinned (V1-V4, CH-47, DEC-184, DEC-200)', () => {
  test('V1 the file sha256 equals the pinned hash and its banner names Chart.js v4.6.1', () => {
    const bytes = bytesEnDisco('vendor/chart.umd.js');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), CHART_SHA256);

    // The banner is a `/*!` block: the version sits on the first line that names Chart.js.
    const cabecera = bytes.subarray(0, 200).toString('utf8');
    assert.ok(
      cabecera.split(/\r?\n/).some((linea) => linea.includes(`Chart.js v${CHART_VERSION}`)),
      `banner does not name Chart.js v${CHART_VERSION}: ${cabecera}`,
    );
  });

  test('V2 the file runs in a bare node:vm context and exposes Chart with version 4.6.1', () => {
    const codigo = bytesEnDisco('vendor/chart.umd.js').toString('utf8');
    const contexto = vm.createContext({});
    vm.runInContext(codigo, contexto, { filename: 'chart.umd.js' });

    const chart = (contexto as { Chart?: unknown }).Chart;
    assert.equal(typeof chart, 'function', 'the UMD build must define a global Chart function');
    assert.equal((chart as { version?: unknown }).version, CHART_VERSION);
  });

  test('V3 vendor/ holds exactly the script and its MIT license, and no route serves the license', async () => {
    const vendor = new URL('vendor/', DIRECTORIO_REAL);
    assert.deepEqual(readdirSync(vendor).sort(), ['LICENSE-chartjs.md', 'chart.umd.js']);

    const licencia = readFileSync(new URL('LICENSE-chartjs.md', vendor), 'utf8');
    assert.ok(licencia.startsWith('The MIT License'), licencia.slice(0, 80));
    assert.match(licencia, /Chart\.js Contributors/);

    assert.ok(!RUTAS_ESTILOS.some((ruta) => ruta.includes('LICENSE')), 'the license must not be listed');
    const app = Fastify({ logger: false });
    registerEstilosRoutes(app, cargarEstilos());
    await app.ready();
    try {
      const respuesta = await app.inject({ method: 'GET', url: '/ui/vendor/LICENSE-chartjs.md' });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
    } finally {
      await app.close();
    }
  });

  test('V4 .gitattributes leaves the script binary-safe: git check-attr text answers unset', (t) => {
    const raiz = fileURLToPath(new URL('../../', import.meta.url));
    let salida: string;
    try {
      // Fixed arguments and no shell: nothing here comes from input.
      salida = execFileSync('git', ['check-attr', 'text', '--', 'public/ui/vendor/chart.umd.js'], {
        cwd: raiz,
        encoding: 'utf8',
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // The production image carries no `git`; the attribute is a repository property.
        t.skip('git is not on the PATH, so the attribute cannot be read here');
        return;
      }
      throw error;
    }
    assert.equal(salida.trim(), 'public/ui/vendor/chart.umd.js: text: unset');
  });
});

describe('asset registrar — no database dependency (R7)', () => {
  test('R7 the registrar takes the app and the loaded files, and the module names no database client', () => {
    // DEC-124 rests on the DEC-24 argument: the handlers hold no database handle, so an
    // exempt route has nothing tenant-scoped within reach. The signature pins it.
    assert.equal(registerEstilosRoutes.length, 2);

    const fuente = readFileSync(new URL('./estilos-rutas.ts', import.meta.url), 'utf8');
    assert.ok(
      !fuente.toLowerCase().includes('prisma'),
      'src/compartido/estilos-rutas.ts must not mention the database client, comments included',
    );
  });
});
