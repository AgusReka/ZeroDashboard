import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { verificarClave } from './crypto-auth.js';
import {
  alcanzable,
  borrarOperadores,
  crearCliente,
  crearSesion,
  databaseUrl,
  motivoSkip,
  nombreUnico,
} from './consola-auth-apoyo.js';
import { ejecutar, leerClave, validarClave, validarNombre } from './operador-alta.js';

/** A writable that keeps everything written to it, to assert what was (not) printed. */
function sumidero(): Writable & { texto: () => string } {
  const partes: string[] = [];
  const flujo = new Writable({
    write(trozo, _codificacion, listo) {
      partes.push(String(trozo));
      listo();
    },
  }) as Writable & { texto: () => string };
  flujo.texto = () => partes.join('');
  return flujo;
}

/** A fake terminal: a stream with `setRawMode`, fed after the reader starts listening. */
function terminal(teclas: string): PassThrough & { setRawMode: (m: boolean) => void; modos: boolean[] } {
  const flujo = new PassThrough() as PassThrough & { setRawMode: (m: boolean) => void; modos: boolean[] };
  flujo.modos = [];
  flujo.setRawMode = (modo: boolean) => {
    flujo.modos.push(modo);
  };
  setImmediate(() => flujo.write(teclas));
  return flujo;
}

function noTerminal(texto: string): PassThrough {
  const flujo = new PassThrough();
  flujo.end(texto);
  return flujo;
}

describe('CH-29 operador:alta — pure validation (DEC-153)', () => {
  test('a name is 1 to 64 characters after trimming, with no whitespace inside', () => {
    assert.deepEqual(validarNombre('  ana  '), { ok: true, nombre: 'ana' });
    assert.equal(validarNombre('a'.repeat(64)).ok, true);
    for (const malo of ['', '   ', 'a'.repeat(65), 'ana maria', 'ana\tm']) {
      assert.equal(validarNombre(malo).ok, false, JSON.stringify(malo));
    }
  });

  test('a password needs at least 12 characters', () => {
    assert.equal(validarClave('123456789012'), true);
    assert.equal(validarClave('12345678901'), false);
  });
});

describe('CH-29 operador:alta — reading the password', () => {
  test('without a terminal the first line is the password, CR and LF stripped', async () => {
    assert.equal(await leerClave({ entrada: noTerminal('clave-de-pipe-1\r\notra linea\n'), salida: sumidero() }), 'clave-de-pipe-1');
    assert.equal(await leerClave({ entrada: noTerminal('sin-salto-final'), salida: sumidero() }), 'sin-salto-final');
  });

  test('with a terminal it asks twice in raw mode, never echoes, and honours backspace', async () => {
    const salida = sumidero();
    const entrada = terminal('secreta-larga-X\x7f\rsecreta-larga-\r');
    const clave = await leerClave({ entrada, salida, esTerminal: true });
    assert.equal(clave, 'secreta-larga-');
    assert.ok(!salida.texto().includes('secreta'), 'the password must never be echoed');
    assert.deepEqual(entrada.modos, [true, false], 'raw mode on, then restored');
  });

  test('with a terminal a mismatch is refused', async () => {
    await assert.rejects(
      leerClave({ entrada: terminal('una-clave-larga\rotra-clave-larga\r'), salida: sumidero(), esTerminal: true }),
      /no coinciden/,
    );
  });

  test('Ctrl+C cancels and restores the terminal', async () => {
    const entrada = terminal('mitad\x03');
    await assert.rejects(leerClave({ entrada, salida: sumidero(), esTerminal: true }), /cancelad/);
    assert.deepEqual(entrada.modos, [true, false]);
  });
});

describe(
  'CH-29 operador:alta — create and reset on a live PostgreSQL target (DEC-153)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let prisma!: PrismaAislado;
    const nombre = nombreUnico('op-alta');
    const corto = nombreUnico('op-corto');

    before(() => {
      prisma = crearCliente();
    });

    after(async () => {
      await borrarOperadores(prisma, [nombre, corto]);
      await prisma.$disconnect();
    });

    async function correr(argumentos: string[], entradaTexto: string, url = databaseUrl) {
      const salida = sumidero();
      const error = sumidero();
      const codigo = await ejecutar({
        argumentos,
        entrada: noTerminal(entradaTexto),
        salida,
        error,
        esTerminal: false,
        crearPrisma: () => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }),
        urlBase: url,
      });
      return { codigo, salida: salida.texto(), error: error.texto() };
    }

    test('creates the operator, exits 0, and never prints the password or its hash', async () => {
      const r = await correr([nombre], 'primera-clave-larga\n');
      assert.equal(r.codigo, 0, r.error);
      assert.match(r.salida, /creado/);
      const fila = await prisma.operador.findUnique({ where: { nombre } });
      assert.ok(fila);
      assert.equal(await verificarClave('primera-clave-larga', fila.claveHash), true);
      for (const texto of [r.salida, r.error]) {
        assert.ok(!texto.includes('primera-clave-larga'));
        assert.ok(!texto.includes(fila.claveHash));
      }
    });

    test('run again with the same name resets the password and deletes every session', async () => {
      const fila = (await prisma.operador.findUnique({ where: { nombre } }))!;
      await crearSesion(prisma, fila.id, new Date(Date.now() + 60_000));
      const r = await correr([nombre], 'segunda-clave-larga\n');
      assert.equal(r.codigo, 0, r.error);
      assert.match(r.salida, /repuest/);
      const despues = (await prisma.operador.findUnique({ where: { nombre } }))!;
      assert.equal(despues.id, fila.id);
      assert.equal(await verificarClave('primera-clave-larga', despues.claveHash), false);
      assert.equal(await verificarClave('segunda-clave-larga', despues.claveHash), true);
      assert.equal(await prisma.sesionConsola.count({ where: { operadorId: fila.id } }), 0);
    });

    test('a short password exits 1 and writes nothing', async () => {
      const r = await correr([corto], '12345678901\n');
      assert.equal(r.codigo, 1);
      assert.equal(await prisma.operador.findUnique({ where: { nombre: corto } }), null);
    });

    test('a missing or invalid name exits 1 before reading anything', async () => {
      assert.equal((await correr([], 'clave-cualquiera-larga\n')).codigo, 1);
      assert.equal((await correr(['ana maria'], 'clave-cualquiera-larga\n')).codigo, 1);
      assert.equal((await correr(['a', 'b'], 'clave-cualquiera-larga\n')).codigo, 1);
    });

    test('an unreachable database exits 2', async () => {
      const r = await correr([nombreUnico('op-sin-base')], 'clave-cualquiera-larga\n', 'postgresql://nadie:nada@127.0.0.1:1/ninguna');
      assert.equal(r.codigo, 2);
    });

    test('a missing database URL exits 2', async () => {
      const r = await correr([nombreUnico('op-sin-url')], 'clave-cualquiera-larga\n', '');
      assert.equal(r.codigo, 2);
    });
  },
);
