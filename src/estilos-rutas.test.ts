import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  ARCHIVOS_ESTILOS,
  RUTAS_ESTILOS,
  cargarEstilos,
  registerEstilosRoutes,
} from './estilos-rutas.js';

/**
 * CH-21a tasks 1.2-1.3 (spec `shared-visual-system`, DEC-124): the fixed-list stylesheet
 * registrar, tests R1-R7 of `design.md`.
 *
 * The app under test registers **only** this registrar: no tenant hooks and no database
 * client. That is the claim being tested, like `contrato-rutas.test.ts` does for
 * `/contrato`: the five assets are identical for every tenant, so an app that carries
 * nothing else must still serve them in full. The exemption half (the tenant hooks in
 * front of these routes) is proven in `contexto-tenant.test.ts`.
 */

/** The vendored folder the production loader reads, resolved the same way it is. */
const DIRECTORIO_REAL = new URL('../public/ui/', import.meta.url);

function bytesEnDisco(archivo: string): Buffer {
  return readFileSync(new URL(archivo, DIRECTORIO_REAL));
}

/** A temp copy of the five files, optionally without one, as a directory `URL`. */
function copiaTemporal(omitir?: string): { dir: URL; ruta: string } {
  const ruta = mkdtempSync(join(tmpdir(), 'zd-estilos-'));
  for (const archivo of ARCHIVOS_ESTILOS) {
    if (archivo === omitir) continue;
    const destino = join(ruta, archivo);
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, bytesEnDisco(archivo));
  }
  // The trailing slash matters: `new URL(file, dir)` resolves against the directory only
  // when the base ends in `/`.
  return { dir: new URL(pathToFileURL(ruta).href + '/'), ruta };
}

describe('stylesheet registrar — the five vendored files (CH-21a, DEC-124)', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    registerEstilosRoutes(app, cargarEstilos());
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('R1 each route answers 200 text/css, no-cache, a strong ETag and the file bytes', async () => {
    assert.equal(RUTAS_ESTILOS.length, 5);
    for (const archivo of ARCHIVOS_ESTILOS) {
      const url = '/ui/' + archivo;
      const respuesta = await app.inject({ method: 'GET', url });

      assert.equal(respuesta.statusCode, 200, `${url}: ${respuesta.body}`);
      assert.equal(respuesta.headers['content-type'], 'text/css; charset=utf-8', url);
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

  test('R4 every @import in styles.css resolves to one of the other four routes', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/ui/styles.css' });
    const importados = [...respuesta.body.matchAll(/@import\s+url\("([^"]+)"\)/g)].map(
      (coincidencia) => new URL(coincidencia[1] as string, 'http://zd.invalid/ui/styles.css').pathname,
    );

    assert.deepEqual(
      [...importados].sort(),
      RUTAS_ESTILOS.filter((ruta) => ruta !== '/ui/styles.css').sort(),
    );
  });
});

describe('stylesheet registrar — route table (R3)', () => {
  test('R3 the registered /ui/ routes are exactly GET RUTAS_ESTILOS', async () => {
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
  });
});

describe('stylesheet registrar — boot-time load (R5, R6)', () => {
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

describe('stylesheet registrar — no database dependency (R7)', () => {
  test('R7 the registrar takes the app and the loaded sheets, and the module names no database client', () => {
    // DEC-124 rests on the DEC-24 argument: the handlers hold no database handle, so an
    // exempt route has nothing tenant-scoped within reach. The signature pins it.
    assert.equal(registerEstilosRoutes.length, 2);

    const fuente = readFileSync(new URL('./estilos-rutas.ts', import.meta.url), 'utf8');
    assert.ok(
      !fuente.toLowerCase().includes('prisma'),
      'src/estilos-rutas.ts must not mention the database client, comments included',
    );
  });
});
