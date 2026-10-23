import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import { generarTokenAgente, hashTokenAgente } from './agente-token.js';

/**
 * CH-19b K1 (DEC-121). No database: the module is pure `node:crypto`. Every token below
 * is generated in the run, never a literal (rule 7).
 */
describe('agente-token — token format and hash (CH-19b K1)', () => {
  test('the token is zda_ followed by 32 random bytes in base64url', () => {
    assert.match(generarTokenAgente(), /^zda_[A-Za-z0-9_-]{43}$/);
  });

  test('two calls give different tokens', () => {
    assert.notEqual(generarTokenAgente(), generarTokenAgente());
  });

  test('the hash is the SHA-256 hex of the token, deterministic and not the token', () => {
    const token = generarTokenAgente();
    const hash = hashTokenAgente(token);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(hashTokenAgente(token), hash);
    assert.equal(hash, createHash('sha256').update(token).digest('hex'));
    assert.notEqual(hash, token);
  });
});
