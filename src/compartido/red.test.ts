import assert from 'node:assert/strict';
import net from 'node:net';
import { afterEach, describe, test } from 'node:test';
import { ajustarRedDelProceso, TIEMPO_POR_INTENTO_DE_CONEXION_MS } from './red.js';

describe('ajustarRedDelProceso', () => {
  const original = net.getDefaultAutoSelectFamilyAttemptTimeout();
  afterEach(() => net.setDefaultAutoSelectFamilyAttemptTimeout(original));

  test('sets the per-attempt timeout of the address autoselection to one second', () => {
    net.setDefaultAutoSelectFamilyAttemptTimeout(250);
    ajustarRedDelProceso();
    assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), TIEMPO_POR_INTENTO_DE_CONEXION_MS);
    assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 1000);
  });

  test('keeps the autoselection enabled', () => {
    net.setDefaultAutoSelectFamily(true);
    ajustarRedDelProceso();
    assert.equal(net.getDefaultAutoSelectFamily(), true);
  });
});
