import { pathToFileURL } from 'node:url';
import type { Readable, Writable } from 'node:stream';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { hashearClave } from './crypto-auth.js';

/**
 * CH-29 (DEC-153): `npm run operador:alta -- <nombre>` creates a console operator or, when
 * the name exists, replaces its password and deletes every session of theirs. It is the
 * only writer of `Operador` and the way out of a lock-out.
 *
 * The password is read from standard input and nowhere else: never an argument (it would
 * land in the shell history and in the process list) and never an environment variable
 * (rule 7). With a terminal it is asked twice in raw mode, without echo; without one (a
 * pipe, as the smoke script uses) the first line is the password.
 *
 * Exit codes: 0 done, 1 invalid name or password (nothing written), 2 no database (no
 * URL, unreachable, or any database error). Only `DATABASE_URL` is read, not the whole
 * server configuration, so the command runs in a shell that has nothing else set.
 */

const LARGO_MAXIMO_NOMBRE = 64;
export const LARGO_MINIMO_CLAVE = 12;

export type ResultadoNombre = { ok: true; nombre: string } | { ok: false; motivo: string };

export function validarNombre(texto: string): ResultadoNombre {
  const nombre = texto.trim();
  if (nombre.length === 0 || nombre.length > LARGO_MAXIMO_NOMBRE) {
    return { ok: false, motivo: `El nombre debe tener entre 1 y ${LARGO_MAXIMO_NOMBRE} caracteres.` };
  }
  if (/\s/.test(nombre)) {
    return { ok: false, motivo: 'El nombre no puede tener espacios.' };
  }
  return { ok: true, nombre };
}

export function validarClave(clave: string): boolean {
  return clave.length >= LARGO_MINIMO_CLAVE;
}

type EntradaTerminal = Readable & { setRawMode?: (modo: boolean) => unknown };

interface OpcionesLectura {
  entrada: EntradaTerminal;
  /** Where the prompts go. Never receives a character of the password. */
  salida: Writable;
  esTerminal?: boolean;
}

/** Without a terminal: the first line, without its CR or LF. */
function leerPrimeraLinea(entrada: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    let acumulado = '';
    const terminar = (): void => {
      entrada.off('data', alRecibir);
      entrada.off('end', alTerminar);
      entrada.off('error', reject);
      entrada.pause();
      resolve(acumulado.split('\n')[0].replace(/\r$/, ''));
    };
    const alRecibir = (trozo: string): void => {
      acumulado += trozo;
      if (acumulado.includes('\n')) {
        terminar();
      }
    };
    const alTerminar = (): void => terminar();
    entrada.setEncoding('utf8');
    entrada.on('data', alRecibir);
    entrada.once('end', alTerminar);
    entrada.once('error', reject);
  });
}

/**
 * With a terminal: raw mode, no echo, asked twice. Backspace removes the last character,
 * Enter ends a line, Ctrl+C cancels. Raw mode is always restored, whatever the outcome.
 */
function leerEnTerminal(entrada: EntradaTerminal, salida: Writable): Promise<string> {
  return new Promise((resolve, reject) => {
    const preguntas = ['Clave: ', 'Repetí la clave: '];
    const lineas: string[] = [];
    let actual = '';
    const cerrar = (): void => {
      entrada.off('data', alRecibir);
      entrada.setRawMode?.(false);
      entrada.pause();
      salida.write('\n');
    };
    const alRecibir = (trozo: string): void => {
      for (const caracter of trozo) {
        if (caracter === '\u0003') {
          cerrar();
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (caracter === '\r' || caracter === '\n') {
          lineas.push(actual);
          actual = '';
          if (lineas.length === preguntas.length) {
            cerrar();
            if (lineas[0] !== lineas[1]) {
              reject(new Error('Las claves no coinciden.'));
            } else {
              resolve(lineas[0]);
            }
            return;
          }
          salida.write('\n' + preguntas[lineas.length]);
          continue;
        }
        if (caracter === '\u007f' || caracter === '\b') {
          actual = actual.slice(0, -1);
          continue;
        }
        actual += caracter;
      }
    };
    entrada.setRawMode?.(true);
    entrada.setEncoding('utf8');
    entrada.on('data', alRecibir);
    entrada.resume();
    salida.write(preguntas[0]);
  });
}

export function leerClave({ entrada, salida, esTerminal }: OpcionesLectura): Promise<string> {
  const conTerminal = esTerminal ?? (entrada as { isTTY?: boolean }).isTTY === true;
  return conTerminal ? leerEnTerminal(entrada, salida) : leerPrimeraLinea(entrada);
}

export type Desenlace = 'creado' | 'repuesto';

/**
 * Creates the operator or replaces its password, in one transaction: on a reset every
 * session of the operator is deleted with it, so a stolen or forgotten session dies with
 * the old password.
 */
export async function altaOReposicion(prisma: PrismaClient, nombre: string, claveHash: string): Promise<Desenlace> {
  return prisma.$transaction(async (tx) => {
    const existente = await tx.operador.findUnique({ where: { nombre }, select: { id: true } });
    if (existente === null) {
      await tx.operador.create({ data: { nombre, claveHash } });
      return 'creado';
    }
    await tx.operador.update({ where: { id: existente.id }, data: { claveHash } });
    await tx.sesionConsola.deleteMany({ where: { operadorId: existente.id } });
    return 'repuesto';
  });
}

export interface OpcionesEjecucion {
  argumentos: readonly string[];
  entrada: EntradaTerminal;
  /** The result line. */
  salida: Writable;
  /** Prompts and errors. */
  error: Writable;
  esTerminal?: boolean;
  crearPrisma?: (url: string) => PrismaClient;
  /** Defaults to `DATABASE_URL`; tests pass their own. */
  urlBase?: string;
}

const USO = 'Uso: npm run operador:alta -- <nombre>';

export async function ejecutar(op: OpcionesEjecucion): Promise<number> {
  if (op.argumentos.length !== 1) {
    op.error.write(`${USO}\n`);
    return 1;
  }
  const nombre = validarNombre(op.argumentos[0]);
  if (!nombre.ok) {
    op.error.write(`${nombre.motivo}\n`);
    return 1;
  }
  const url = op.urlBase ?? process.env.DATABASE_URL ?? '';
  if (url === '') {
    op.error.write('Falta DATABASE_URL: no hay base de datos a la que escribir.\n');
    return 2;
  }

  let clave: string;
  try {
    clave = await leerClave({ entrada: op.entrada, salida: op.error, esTerminal: op.esTerminal });
  } catch (error) {
    op.error.write(`${(error as Error).message}\n`);
    return 1;
  }
  if (!validarClave(clave)) {
    op.error.write(`La clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.\n`);
    return 1;
  }

  const claveHash = await hashearClave(clave);
  const crear = op.crearPrisma ?? ((u: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString: u }) }));
  const prisma = crear(url);
  try {
    const desenlace = await altaOReposicion(prisma, nombre.nombre, claveHash);
    op.salida.write(
      desenlace === 'creado'
        ? `Operador "${nombre.nombre}" creado.\n`
        : `Clave del operador "${nombre.nombre}" repuesta; sus sesiones se cerraron.\n`,
    );
    return 0;
  } catch {
    // Only a fixed message: a driver error can carry the connection string.
    op.error.write('No se pudo escribir en la base de datos (¿está accesible DATABASE_URL?).\n');
    return 2;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await ejecutar({
    argumentos: process.argv.slice(2),
    entrada: process.stdin,
    salida: process.stdout,
    error: process.stderr,
  });
}
