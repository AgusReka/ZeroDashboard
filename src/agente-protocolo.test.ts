import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AperturaSesion, CodigoErrorAgente } from './agente-protocolo.js';
import { classifyConnectionError } from './db-probe.js';

/**
 * CH-19a, cases P1 and P2. The protocol catalog is types only (DEC-120): the agent
 * shares the file, so it must carry no runtime value and no import. Two of the checks
 * below are type-level and are enforced by `npx tsc --noEmit`, not by the runner.
 */

/** Type-level: no field of the session-open message names a tenant (DEC-114). */
type ClavesConTenant = Extract<Lowercase<keyof AperturaSesion & string>, `${string}tenant${string}`>;
const aperturaSinTenant: [ClavesConTenant] extends [never] ? true : false = true;

/**
 * The seven replica-side codes, listed once. `satisfies` rejects a value outside the
 * type; `Faltantes` rejects a type member missing from the list, so the list is
 * exhaustive in both directions.
 */
const CODIGOS_AGENTE = [
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
] as const satisfies readonly CodigoErrorAgente[];
type Faltantes = Exclude<CodigoErrorAgente, (typeof CODIGOS_AGENTE)[number]>;
const listaExhaustiva: [Faltantes] extends [never] ? true : false = true;

describe('agent protocol catalog (CH-19a, P1-P2)', () => {
  test('P1 the module exposes no runtime value', async () => {
    const modulo = await import('./agente-protocolo.js');
    assert.deepEqual(Object.keys(modulo), []);
    assert.equal(aperturaSinTenant, true);
  });

  test('P2 every agent code keeps a category the engine already classifies', () => {
    assert.equal(listaExhaustiva, true);
    assert.equal(new Set(CODIGOS_AGENTE).size, 7);
    for (const code of CODIGOS_AGENTE) {
      const { categoria } = classifyConnectionError({ code });
      assert.notEqual(categoria, 'error-desconocido', code);
    }
  });
});
