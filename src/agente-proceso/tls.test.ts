import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import tls from 'node:tls';
import { test } from 'node:test';
import { WebSocket } from 'ws';
import { LIMITES_AGENTE } from './limites.js';
import { opcionesSocket } from './politica-tls.js';

/**
 * CH-19c2, case X1 (DEC-123 A6): with `NODE_TLS_REJECT_UNAUTHORIZED=0` set, the options `ws`
 * hands to `tls.connect` still carry `rejectUnauthorized: true`. Node's `connect` spreads the
 * caller's options over its environment default, so the explicit value wins. No certificate
 * exists here (rule 7): the target is a closed loopback port, so no handshake ever starts.
 */
test('X1 the explicit rejectUnauthorized reaches tls.connect while NODE_TLS_REJECT_UNAUTHORIZED=0', async () => {
  const libre = createServer().listen(0, '127.0.0.1');
  await once(libre, 'listening');
  const puerto = (libre.address() as AddressInfo).port;
  await new Promise((listo) => libre.close(listo));

  const previo = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  const original = tls.connect;
  const vistas: tls.ConnectionOptions[] = [];
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  // `ws` reads `tls.connect` from the CommonJS export at dial time, so this wrapper sees its call.
  tls.connect = ((opciones: tls.ConnectionOptions) => (vistas.push({ ...opciones }), original(opciones))) as typeof tls.connect;
  try {
    const ws = new WebSocket(`wss://127.0.0.1:${puerto}/agente/control`, opcionesSocket('zda_' + 'c'.repeat(43), LIMITES_AGENTE.tramaControl));
    // `once(ws, 'close')` would reject on the refusal's `'error'`; `'close'` always follows it.
    await new Promise((listo) => ws.on('error', () => {}).on('close', listo));
  } finally {
    tls.connect = original;
    if (previo === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previo;
  }
  assert.equal(vistas.length, 1);
  assert.equal(vistas[0].rejectUnauthorized, true);
  assert.equal(vistas[0].host, '127.0.0.1');
  assert.equal(Number(vistas[0].port), puerto);
});
