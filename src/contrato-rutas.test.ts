import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { AUTOMATIZACIONES, CONTRATO_CANONICO } from './contrato.js';
import { registerContratoRoutes } from './contrato-rutas.js';

/**
 * CH-08 tasks 2.1–2.3 and 2.6 (spec `canonical-contract`, requirement "Read-Only
 * Endpoint Projects the Catalog").
 *
 * The app under test registers **only** this one registrar: no tenant hooks, no Prisma
 * client, no database. That is not a shortcut to make the suite fast — it is the claim
 * being tested. `GET /contrato` answers out of a static module (DEC-21), so an app that
 * carries nothing else must still be able to serve it in full. The exemption half of
 * the story (`registrarContextoTenant` in front of this route) is proven in
 * `contexto-tenant.test.ts`, where the hooks it exempts actually live.
 *
 * The catalog's own invariants are asserted in `contrato.test.ts` against the exported
 * constant. What is asserted here is the *projection*: that the endpoint hands back the
 * constant verbatim rather than a reshaped copy that could drift away from it.
 */

/** Every label the catalog is allowed to name, as it appears over the wire. */
const ETIQUETAS_VALIDAS: readonly string[] = Object.values(AUTOMATIZACIONES);

/** The JSON shape the endpoint promises: one named top-level key holding one envelope. */
interface CuerpoContrato {
  contrato: {
    entidades: {
      nombre: string;
      obligatoriedad: string;
      campos: { nombre: string; obligatoriedad: string; automatizaciones: string[] }[];
    }[];
  };
}

describe('GET /contrato — the read-only projection of the static catalog', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    registerContratoRoutes(app);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('2.1 answers 200 with { contrato: { entidades } } equal to CONTRATO_CANONICO', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/contrato' });

    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const cuerpo = respuesta.json() as CuerpoContrato;

    // Deep-equality against the module, not against a literal copied into the test: a
    // handler that reshaped, filtered or reordered the catalog would fail here, which
    // is the whole point of projecting the constant verbatim.
    assert.deepEqual(
      cuerpo.contrato.entidades,
      JSON.parse(JSON.stringify(CONTRATO_CANONICO)),
      'the endpoint must serve the catalog verbatim',
    );
  });

  test('2.2 lists the five entities, each marked, with every field marked and traced', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/contrato' });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { entidades } = (respuesta.json() as CuerpoContrato).contrato;

    assert.deepEqual(
      entidades.map((e) => e.nombre),
      ['producto', 'pedido', 'item_pedido', 'insumo', 'receta_componente'],
    );

    // Loop guards first: the per-field assertions below are inside two nested loops, and
    // a projection that served an empty array would otherwise pass them all silently.
    assert.equal(entidades.length, 5);
    let camposVistos = 0;

    for (const entidad of entidades) {
      assert.ok(
        entidad.obligatoriedad === 'obligatorio' || entidad.obligatoriedad === 'opcional',
        `${entidad.nombre} must be marked required or optional, got ${entidad.obligatoriedad}`,
      );
      assert.ok(entidad.campos.length > 0, `${entidad.nombre} must project its fields`);

      for (const campo of entidad.campos) {
        camposVistos += 1;
        assert.ok(
          campo.obligatoriedad === 'obligatorio' || campo.obligatoriedad === 'opcional',
          `${entidad.nombre}.${campo.nombre} must be marked, got ${campo.obligatoriedad}`,
        );
        assert.ok(
          campo.automatizaciones.length > 0,
          `${entidad.nombre}.${campo.nombre} must name at least one automation`,
        );
        for (const etiqueta of campo.automatizaciones) {
          assert.ok(
            ETIQUETAS_VALIDAS.includes(etiqueta),
            `${entidad.nombre}.${campo.nombre} names an unknown automation: ${etiqueta}`,
          );
        }
      }
    }

    // The catalog's 24 fields, counted through the wire rather than the module: a
    // projection that dropped a field would leave the loops above green.
    assert.equal(camposVistos, 24);
  });

  test('2.2 producto arrives with its marks and labels intact over the wire', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/contrato' });
    const { entidades } = (respuesta.json() as CuerpoContrato).contrato;
    const producto = entidades.find((e) => e.nombre === 'producto');

    assert.ok(producto !== undefined, 'producto must be projected');
    assert.equal(producto.obligatoriedad, 'obligatorio');

    const stock = producto.campos.find((c) => c.nombre === 'stockDisponible');
    assert.ok(stock !== undefined, 'producto.stockDisponible must be projected');
    assert.equal(stock.obligatoriedad, 'obligatorio');
    // Serialized as plain strings, not as some object wrapper: this is the exact shape
    // design.md's JSON example promises and the shape CH-09's mapeo will read.
    // stock-producible dropped from this field by DEC-36.
    assert.deepEqual(stock.automatizaciones, ['stock-fisico', 'reporte-diario']);

    const sku = producto.campos.find((c) => c.nombre === 'sku');
    assert.ok(sku !== undefined, 'producto.sku must be projected');
    assert.equal(sku.obligatoriedad, 'opcional');
    assert.deepEqual(sku.automatizaciones, ['stock-fisico', 'reporte-diario']);
  });

  test('2.3 no method other than GET is routed on /contrato', async () => {
    // Threat matrix, "Method widening": the endpoint is read-only, so a write verb must
    // find nothing at all rather than reach a handler that ignores its body. There is no
    // route to widen by accident — only `app.get` is registered.
    for (const metodo of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const respuesta = await app.inject({ method: metodo, url: '/contrato', payload: {} });
      assert.equal(
        respuesta.statusCode,
        404,
        `${metodo} /contrato must not be routed: ${respuesta.body}`,
      );
    }
  });

  test('2.3 a request body on the GET is ignored, never applied to the catalog', async () => {
    // "SHALL NOT accept a request body that mutates the catalog", read literally: the
    // route declares no body schema because there is nothing to validate, so a body
    // riding along must leave the answer identical to the plain request.
    const limpia = await app.inject({ method: 'GET', url: '/contrato' });
    const conCuerpo = await app.inject({
      method: 'GET',
      url: '/contrato',
      headers: { 'content-type': 'application/json' },
      payload: { entidades: [] },
    });

    assert.equal(conCuerpo.statusCode, 200, conCuerpo.body);
    assert.equal(conCuerpo.body, limpia.body);
  });

  test('2.6 the registrar takes the app alone and the module names no Prisma client', () => {
    // DEC-24's exemption rests on "the handler reads no database". That premise is
    // structural, and this is where it is pinned: a registrar with no client parameter
    // has no handle to reach for, whatever a future handler body tries to do.
    assert.equal(
      registerContratoRoutes.length,
      1,
      'registerContratoRoutes must take only the Fastify instance',
    );

    const fuente = readFileSync(new URL('./contrato-rutas.ts', import.meta.url), 'utf8');
    for (const prohibido of ['aislamiento-prisma', 'PrismaAislado', 'PrismaClient', 'prisma']) {
      assert.ok(
        !fuente.includes(prohibido),
        `src/contrato-rutas.ts must not mention ${prohibido}: the route holds no database handle`,
      );
    }
  });
});
