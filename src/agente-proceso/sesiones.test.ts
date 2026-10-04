import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { describe, test } from 'node:test';
import type { CodigoErrorAgente } from '../agente-protocolo.js';
import { leerDestinos, type Destino } from './destinos.js';
import type { EventoLog } from './log.js';
import { crearSesiones } from './sesiones.js';

/** CH-19c2, cases T1-T3: the session table (cap 16, allowlist dispatch, DEC-123 A5). */
const id = (n: number) => `sesion_${n}`.padEnd(22, 'x');

/** Replicas that never connect, so no session gets as far as a data dial. */
function crear(abrirReplica?: (d: Destino) => Socket) {
  const log: EventoLog[] = [];
  const informados: [string, CodigoErrorAgente][] = [];
  const replicas: Socket[] = [];
  const marcados: Destino[] = [];
  const sesiones = crearSesiones({
    destinos: leerDestinos('replica.interna:5432'),
    log: (e) => log.push(e),
    programar: () => () => {},
    abrirReplica: abrirReplica ?? ((d) => (marcados.push(d), replicas[replicas.push(new Socket()) - 1])),
    abrirDatos: () => assert.fail('no data dial in these cases'),
    informar: (sesionId, codigo) => informados.push([sesionId, codigo]),
  });
  return { sesiones, log, informados, replicas, marcados };
}

describe('crearSesiones (CH-19c2, T1-T3)', () => {
  test('T1 the 17th session is refused with ECONNREFUSED before the allowlist is read', () => {
    const t = crear();
    for (let n = 0; n < 16; n++) t.sesiones.abrir({ sesionId: id(n), host: 'Replica.Interna.', puerto: 5432 });
    assert.equal(t.sesiones.cantidad(), 16);
    assert.deepEqual(new Set(t.marcados.map((d) => `${d.host} ${d.puerto}`)), new Set(['replica.interna 5432']));
    t.sesiones.abrir({ sesionId: id(16), host: 'replica.interna', puerto: 5432 });
    t.sesiones.abrir({ sesionId: id(17), host: 'no-listado', puerto: 1 });
    assert.deepEqual(t.informados, [[id(16), 'ECONNREFUSED'], [id(17), 'ECONNREFUSED']]);
    const refusal = [{ evento: 'tope-de-sesiones' }, { evento: 'destino-no-permitido' }];
    assert.deepEqual(t.log, [...refusal, ...refusal]);
    assert.equal(t.replicas.length, 16);
  });

  test('T2 unlisted or malformed targets get ECONNREFUSED; malformed ids are ignored', () => {
    const t = crear();
    const objetivos: [unknown, unknown][] = [
      ['10.0.0.5', 5432], ['replica.interna', 5433], ['replica.interna', '5432'], ['127.1', 5432],
      [null, 5432], ['replica.interna', 5432.5], [{}, []],
    ];
    objetivos.forEach(([host, puerto], n) => t.sesiones.abrir({ sesionId: id(n), host, puerto }));
    assert.deepEqual(t.informados, objetivos.map((_, n) => [id(n), 'ECONNREFUSED']));
    assert.deepEqual(t.log, objetivos.map(() => ({ evento: 'destino-no-permitido' })));
    const malos: unknown[] = ['x'.repeat(21), 'x'.repeat(21) + '/', '..' + 'x'.repeat(20), 'x'.repeat(21) + '.', 'x'.repeat(23), 42];
    for (const sesionId of malos) t.sesiones.abrir({ sesionId: sesionId as string, host: 'replica.interna', puerto: 5432 });
    assert.equal(t.informados.length, objetivos.length);
    assert.deepEqual(t.log.slice(objetivos.length), malos.map(() => ({ evento: 'mensaje-invalido' })));
    assert.deepEqual([t.replicas.length, t.sesiones.cantidad()], [0, 0]);
  });

  test('T3 a replayed active id is ignored, abrir never throws, and cerrarTodas resolves', async () => {
    const t = crear();
    t.sesiones.abrir({ sesionId: id(1), host: 'replica.interna', puerto: 5432 });
    t.sesiones.abrir({ sesionId: id(1), host: 'replica.interna', puerto: 5432 });
    assert.deepEqual([t.replicas.length, t.sesiones.cantidad(), t.informados], [1, 1, []]);
    await t.sesiones.cerrarTodas('inmediato');
    assert.deepEqual([t.replicas[0].destroyed, t.sesiones.cantidad()], [true, 0]);
    const rota = crear(() => {
      throw Object.assign(new Error('EMFILE 10.0.0.5'), { code: 'EMFILE' });
    });
    assert.doesNotThrow(() => rota.sesiones.abrir({ sesionId: id(2), host: 'replica.interna', puerto: 5432 }));
    assert.deepEqual(rota.informados, [[id(2), 'EHOSTUNREACH']]);
    await rota.sesiones.cerrarTodas('ordenado');
    assert.equal(rota.sesiones.cantidad(), 0);
  });
});
