import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerInicioRoutes } from './inicio-rutas.js';

/**
 * UX review lote 4 (DEC-203): the start page and the two trailing-slash redirects. The
 * registrar is built on a bare app with nothing else registered, which is the structural
 * claim: no client, no session resolver, no hook. The guard-level checks (exact exempt rows,
 * other methods refused) live in `src/app/rutas.test.ts`.
 */
describe('DEC-203 start page', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    registerInicioRoutes(app);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('the registrar takes the app and nothing else', () => {
    assert.equal(registerInicioRoutes.length, 1);
    const fuente = readFileSync(new URL('./inicio-rutas.ts', import.meta.url), 'utf8');
    for (const nombre of ['prisma', 'Prisma', 'cookie', 'headers', 'request.']) {
      // Mentions in comments are fine; a use of the request is not.
      const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      assert.ok(!codigo.includes(nombre), `the code must not touch ${nombre}`);
    }
  });

  test('GET / is HTML, names both doors with the panel first, and carries no script or cookie', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/' });
    assert.equal(respuesta.statusCode, 200);
    assert.match(String(respuesta.headers['content-type']), /^text\/html; charset=utf-8/);
    assert.equal(respuesta.headers['set-cookie'], undefined);
    const cuerpo = respuesta.body;
    assert.match(cuerpo, /<a class="zd-btn zd-btn--primary[^"]*" href="\/panel">Ir a mi panel<\/a>/);
    assert.match(cuerpo, /<a class="zd-btn zd-btn--secondary[^"]*" href="\/consola">Ir a la consola<\/a>/);
    assert.ok(cuerpo.indexOf('Ir a mi panel') < cuerpo.indexOf('Ir a la consola'), 'the panel door comes first');
    assert.ok(!/<script/i.test(cuerpo), 'no script');
    assert.match(cuerpo, /href="\/ui\/styles\.css"/);
    assert.match(cuerpo, /data-surface="panel"/);
  });

  test('the page speaks to a business owner: no tenant, SQL or operator words', async () => {
    const cuerpo = (await app.inject({ method: 'GET', url: '/' })).body;
    const visible = cuerpo.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
    for (const palabra of ['tenant', 'SQL', 'operador', 'réplica']) {
      assert.ok(!visible.toLowerCase().includes(palabra.toLowerCase()), palabra);
    }
  });

  test('GET /consola/ and GET /panel/ answer 308 with a fixed Location, whatever the query string', async () => {
    for (const [url, destino] of [['/consola/', '/consola'], ['/panel/', '/panel'], ['/panel/?next=//evil.example', '/panel']] as const) {
      const respuesta = await app.inject({ method: 'GET', url });
      assert.equal(respuesta.statusCode, 308, url);
      assert.equal(respuesta.headers.location, destino, url);
      assert.equal(respuesta.headers['set-cookie'], undefined, url);
    }
  });

  test('only GET is served: POST / and POST /panel/ are 404 on a bare app', async () => {
    for (const [metodo, url] of [['POST', '/'], ['POST', '/panel/'], ['POST', '/consola/']] as const) {
      assert.equal((await app.inject({ method: metodo, url })).statusCode, 404, `${metodo} ${url}`);
    }
  });
});
