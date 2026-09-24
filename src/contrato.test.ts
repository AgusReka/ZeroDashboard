import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  AUTOMATIZACIONES,
  CONTRATO_CANONICO,
  type CampoCanonico,
  type EntidadCanonica,
} from './contrato.js';

/**
 * CH-08 tasks 1.1–1.5 (spec `canonical-contract`).
 *
 * The catalog is a static module rather than a table (DEC-21), so these are the only
 * guards it has: there is no schema, no migration and no constraint to lean on. They
 * are written against the exported constant directly — `GET /contrato` projects it
 * verbatim, so proving the constant here and the projection in `contrato-rutas.test.ts`
 * covers the endpoint without re-asserting the catalog through HTTP.
 *
 * The absence sweep at the end is deliberately a **test**, not a reading of the file:
 * spec requirement "Personal Fields Are Structurally Absent" asks for an automated
 * check, and DEC-23 makes the absence structural. A future field called `telefono`
 * has to break a build, not merely a review.
 */

/** The five entity names, in the order the proposal's catalog table lists them. */
const NOMBRES_ESPERADOS = [
  'producto',
  'pedido',
  'item_pedido',
  'insumo',
  'receta_componente',
];

function entidad(nombre: string): EntidadCanonica {
  const encontrada = CONTRATO_CANONICO.find((e) => e.nombre === nombre);
  assert.ok(encontrada !== undefined, `the catalog must define the entity ${nombre}`);
  return encontrada;
}

function campo(nombreEntidad: string, nombreCampo: string): CampoCanonico {
  const encontrado = entidad(nombreEntidad).campos.find((c) => c.nombre === nombreCampo);
  assert.ok(
    encontrado !== undefined,
    `${nombreEntidad} must define the field ${nombreCampo}`,
  );
  return encontrado;
}

// ---- 1.1 / 1.2 the entity list and its entity-level marks -------------------------

describe('contrato canónico — the entity list is closed', () => {
  test('1.1 the catalog contains exactly the five canonical entities, no more and no fewer', () => {
    const nombres = CONTRATO_CANONICO.map((e) => e.nombre);

    // Order is asserted too: the projection is served verbatim, and a stable order is
    // what lets CH-09's mapeo and CH-16's genericity test diff two catalogs at all.
    assert.deepEqual(nombres, NOMBRES_ESPERADOS);
    assert.equal(CONTRATO_CANONICO.length, 5);
  });

  test('1.2 producto, pedido and item_pedido are marked obligatorio at the entity level', () => {
    for (const nombre of ['producto', 'pedido', 'item_pedido']) {
      assert.equal(
        entidad(nombre).obligatoriedad,
        'obligatorio',
        `${nombre} must be required: the three automations cannot run without it`,
      );
    }
  });

  test('1.2 insumo and receta_componente are marked opcional at the entity level', () => {
    // Not a hedge: entity-level optionality is the mechanism CH-10/M4 reads to report
    // `stock-producible` inapplicable when a candidate platform models no insumos.
    for (const nombre of ['insumo', 'receta_componente']) {
      assert.equal(
        entidad(nombre).obligatoriedad,
        'opcional',
        `${nombre} must be optional: D-5 records its absence as expected and reportable`,
      );
    }
  });
});

// ---- 1.3 every field is marked, and names an automation that exists ---------------

describe('contrato canónico — every field is marked and traces to an automation', () => {
  test('1.3 every field across every entity is marked obligatorio or opcional', () => {
    const marcas = new Set(['obligatorio', 'opcional']);
    let revisados = 0;

    for (const e of CONTRATO_CANONICO) {
      assert.ok(e.campos.length > 0, `${e.nombre} must define at least one field`);
      for (const c of e.campos) {
        assert.ok(
          marcas.has(c.obligatoriedad),
          `${e.nombre}.${c.nombre} carries an unknown mark: ${String(c.obligatoriedad)}`,
        );
        revisados += 1;
      }
    }

    // Guards the loop against iterating zero times: an empty catalog would otherwise
    // pass every assertion above without running one of them. 5 + 6 + 5 + 5 + 3, the
    // field counts of the proposal's catalog table.
    assert.equal(revisados, 24, 'the catalog must expose exactly 24 fields');
  });

  test('1.3 every field names at least one automation, and every label is an AUTOMATIZACIONES value', () => {
    const conocidas = new Set<string>(Object.values(AUTOMATIZACIONES));
    let revisados = 0;

    for (const e of CONTRATO_CANONICO) {
      for (const c of e.campos) {
        assert.ok(
          c.automatizaciones.length > 0,
          `${e.nombre}.${c.nombre} traces to no automation and must not be admitted`,
        );
        for (const etiqueta of c.automatizaciones) {
          assert.ok(
            conocidas.has(etiqueta),
            `${e.nombre}.${c.nombre} names an unknown automation: ${etiqueta}`,
          );
        }
        revisados += 1;
      }
    }

    assert.equal(revisados, 24);
  });

  test('1.3 the three named automations are the whole set, and each one is actually used', () => {
    assert.deepEqual(Object.values(AUTOMATIZACIONES), [
      'stock-fisico',
      'stock-producible',
      'reporte-diario',
    ]);

    const usadas = new Set<string>();
    for (const e of CONTRATO_CANONICO) {
      for (const c of e.campos) {
        for (const etiqueta of c.automatizaciones) {
          usadas.add(etiqueta);
        }
      }
    }

    // The converse of the check above: a label nobody references would be dead weight
    // CH-12 would have to reconcile for nothing.
    assert.deepEqual([...usadas].sort(), ['reporte-diario', 'stock-fisico', 'stock-producible']);
  });

  test('1.3 each entity only names the automations the proposal assigns to it', () => {
    const esperadas: Record<string, string[]> = {
      producto: ['reporte-diario', 'stock-fisico', 'stock-producible'],
      pedido: ['reporte-diario'],
      item_pedido: ['reporte-diario'],
      insumo: ['stock-producible'],
      receta_componente: ['stock-producible'],
    };

    for (const e of CONTRATO_CANONICO) {
      const usadas = new Set<string>();
      for (const c of e.campos) {
        for (const etiqueta of c.automatizaciones) {
          usadas.add(etiqueta);
        }
      }
      assert.deepEqual([...usadas].sort(), esperadas[e.nombre], `${e.nombre} automations`);
    }
  });
});

// ---- 1.4 the literal cases the spec's two field scenarios name --------------------

describe('contrato canónico — the field-level scenarios, literally', () => {
  test('1.4 producto.id, producto.nombre, producto.stockDisponible and producto.activo are obligatorio with ≥1 automation', () => {
    for (const nombre of ['id', 'nombre', 'stockDisponible', 'activo']) {
      const c = campo('producto', nombre);
      assert.equal(c.obligatoriedad, 'obligatorio', `producto.${nombre}`);
      assert.ok(c.automatizaciones.length >= 1, `producto.${nombre} names no automation`);
    }
  });

  test('1.4 producto.sku is opcional with ≥1 automation', () => {
    // The other half of the same requirement: field optionality is independent of the
    // entity's own mark, so a required entity still carries optional fields.
    // producto.activo moved to obligatorio (DEC-36).
    for (const nombre of ['sku']) {
      const c = campo('producto', nombre);
      assert.equal(c.obligatoriedad, 'opcional', `producto.${nombre}`);
      assert.ok(c.automatizaciones.length >= 1, `producto.${nombre} names no automation`);
    }
  });

  test('1.4 an optional entity still carries required fields', () => {
    // The mirror case, which is what makes the two dimensions provably independent
    // rather than one flag read twice.
    assert.equal(entidad('insumo').obligatoriedad, 'opcional');
    assert.equal(campo('insumo', 'nombre').obligatoriedad, 'obligatorio');
    assert.equal(campo('insumo', 'codigo').obligatoriedad, 'opcional');
  });
});

// ---- 1.5 the automated personal-field absence sweep -------------------------------

describe('contrato canónico — personal fields are structurally absent (DEC-23)', () => {
  /**
   * Spanish first, with the misspellings a real catalog would actually acquire, plus
   * the English names a copied schema would bring in. Each entry is deliberately
   * narrow: `codigoPostal` is a postal address, while `insumo.codigo` is not, so the
   * address pattern matches the compound and never the bare word.
   */
  const PATRONES_PERSONALES: ReadonlyArray<readonly [string, RegExp]> = [
    ['domicilio', /domicili/i],
    ['dirección', /direcci[oó]n|\bdirecc\b/i],
    ['address', /address|\bstreet\b/i],
    ['calle / piso / puerta', /\bcalle\b|\bpiso\b|\bdepto\b|\bdepartamento\b/i],
    ['código postal', /codigo ?postal|c[oó]digopostal|\bcp\b|zip ?code|postcode/i],
    ['localidad / provincia', /\blocalidad\b|\bprovincia\b|\bciudad\b|\bcity\b/i],
    ['teléfono', /tel[eé]fono|telef[oó]n|\btel\b|\btelef\b|telfono|tlfono/i],
    ['celular / móvil', /celular|\bm[oó]vil\b|\bmobile\b|\bphone\b|whatsapp/i],
    ['correo', /correo|\be-?mail\b|\bmail\b|\bemail\b/i],
    ['documento personal', /\bdni\b|\bcuil\b|\bcuit\b|pasaporte|passport/i],
  ];

  /** A customer/buyer entity would be the container those fields arrive in. */
  const PATRONES_PERSONA: ReadonlyArray<readonly [string, RegExp]> = [
    ['cliente', /cliente|client\b/i],
    ['comprador / buyer', /comprador|buyer/i],
    ['customer', /customer/i],
    ['usuario / persona', /usuario|persona|\buser\b/i],
    ['contacto / destinatario', /contacto|destinatario|contact\b/i],
  ];

  /** Every name the catalog exposes: entity names, field names, and any description. */
  function textosDelCatalogo(): Array<{ ubicacion: string; texto: string }> {
    const textos: Array<{ ubicacion: string; texto: string }> = [];
    for (const e of CONTRATO_CANONICO) {
      textos.push({ ubicacion: `entidad ${e.nombre}`, texto: e.nombre });
      for (const c of e.campos) {
        textos.push({ ubicacion: `${e.nombre}.${c.nombre}`, texto: c.nombre });
        // `CampoCanonico` carries no description today. The sweep reads one anyway so
        // that adding the field later cannot quietly open a hole in this check.
        const descripcion = (c as CampoCanonico & { descripcion?: unknown }).descripcion;
        if (typeof descripcion === 'string') {
          textos.push({ ubicacion: `${e.nombre}.${c.nombre} (descripción)`, texto: descripcion });
        }
      }
    }
    return textos;
  }

  test('1.5 no entity or field name is named or means domicilio, teléfono or correo', () => {
    const textos = textosDelCatalogo();
    // 5 entity names + 24 field names: proves the sweep below actually iterates.
    assert.equal(textos.length, 29, 'the sweep must cover every entity and field name');

    for (const { ubicacion, texto } of textos) {
      for (const [etiqueta, patron] of PATRONES_PERSONALES) {
        assert.ok(
          !patron.test(texto),
          `${ubicacion} ("${texto}") looks like a personal field (${etiqueta}); DEC-23 keeps it out of the catalog`,
        );
      }
    }
  });

  test('1.5 no entity is reasonably interpretable as a customer or buyer', () => {
    for (const e of CONTRATO_CANONICO) {
      for (const [etiqueta, patron] of PATRONES_PERSONA) {
        assert.ok(
          !patron.test(e.nombre),
          `entidad ${e.nombre} reads as a ${etiqueta} entity; none of the three automations needs a buyer identity`,
        );
      }
    }
  });

  test('1.5 the sweep would actually catch a personal field (the patterns are not inert)', () => {
    // Triangulation for the two negative sweeps above: without this, a typo that made
    // every pattern unmatchable would leave them passing forever.
    const sospechosos = [
      'domicilio',
      'direccion',
      'telefono',
      'telfono',
      'celular',
      'correoElectronico',
      'email',
      'codigoPostal',
    ];
    for (const texto of sospechosos) {
      assert.ok(
        PATRONES_PERSONALES.some(([, patron]) => patron.test(texto)),
        `the sweep must flag ${texto}`,
      );
    }

    for (const texto of ['cliente', 'comprador', 'customer', 'usuario']) {
      assert.ok(
        PATRONES_PERSONA.some(([, patron]) => patron.test(texto)),
        `the sweep must flag the entity ${texto}`,
      );
    }

    // And the mirror: a legitimate catalog name must not trip the patterns, or the
    // sweep would be unusable the first time a real field is added.
    for (const texto of ['codigo', 'total', 'moneda', 'cantidadPorUnidad', 'unidadMedida']) {
      assert.ok(
        !PATRONES_PERSONALES.some(([, patron]) => patron.test(texto)),
        `${texto} is a legitimate catalog name and must not be flagged`,
      );
    }
  });
});
