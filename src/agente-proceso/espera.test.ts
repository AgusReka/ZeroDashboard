import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { esperaReconexion } from './espera.js';

/** CH-19c2: the reconnect delay, exponential from 1 s, factor 2, capped at 60 s, equal jitter. */
describe('esperaReconexion (CH-19c2)', () => {
  test('aleatorio at 0 gives the lower half (1, 2, 4 ... s) and at 1 the cap (2, 4, 8 ... 60 s)', () => {
    const serie = (aleatorio: number) => [0, 1, 2, 3, 4, 5, 6, 40].map((n) => esperaReconexion(n, () => aleatorio));
    assert.deepEqual(serie(0), [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
    assert.deepEqual(serie(1), [2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000]);
  });

  test('every delay lies in [tope/2, tope], so between 1 s and 60 s', () => {
    for (let n = 0; n < 12; n++) {
      const tope = Math.min(60_000, 1_000 * 2 ** (n + 1));
      for (const a of [0, 0.25, 0.5, 0.999]) {
        const espera = esperaReconexion(n, () => a);
        assert.ok(espera >= tope / 2 && espera <= tope && espera >= 1_000 && espera <= 60_000, `${n} ${a} ${espera}`);
      }
    }
  });
});
