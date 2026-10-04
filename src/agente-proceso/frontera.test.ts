import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * CH-19c2, cases F1-F2: the agent shares only types with the engine (DEC-123 A2). F1 scans
 * each import; F2 asks `tsc` for the whole agent program, which also catches transitive imports.
 */
const RAIZ = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/');
const DIRECTORIO = new URL('./', import.meta.url);
const NO_TEST = /^[\w-]+(?<!\.test)\.ts$/;

/** Every specifier of `from '…'`, `import('…')`, `import '…'` and `require(…)` that breaks the rule. */
function prohibidos(texto: string): string[] {
  const malos: string[] = [];
  for (const linea of texto.split('\n')) {
    if (/\brequire\s*\(/.test(linea)) malos.push(linea.trim());
    for (const [, especificador] of linea.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)['"`]([^'"`]+)['"`]/g)) {
      const permitido =
        /^node:/.test(especificador) ||
        especificador === 'ws' ||
        /^\.\/[\w-]+\.js$/.test(especificador) ||
        (especificador === '../agente-protocolo.js' && /^import type\b/.test(linea));
      if (!permitido) malos.push(especificador);
    }
  }
  return malos;
}

describe('engine-code boundary (CH-19c2, F1-F2)', () => {
  test('F1 every agent file imports only node:*, ws, same-directory files and protocol types', () => {
    const archivos = readdirSync(DIRECTORIO).filter((nombre) => NO_TEST.test(nombre));
    assert.ok(archivos.includes('main.ts') && archivos.includes('agente.ts'));
    for (const nombre of archivos) assert.deepEqual(prohibidos(readFileSync(new URL(nombre, DIRECTORIO), 'utf8')), [], nombre);
    // The scan itself: a forbidden import is caught.
    assert.deepEqual(
      prohibidos(
        [
          "import pg from 'pg';",
          "import { canal } from '../canal-agente.js';",
          "import { LIMITES } from '../agente-protocolo.js';",
          "export { x } from '../agente-token.js';",
          "const f = await import('fastify');",
          "import '@prisma/client';",
          "const c = require('./config.js');",
          "import type { SesionFallida } from '../agente-protocolo.js';",
          "import { connect } from 'node:net';",
        ].join('\n'),
      ),
      ['pg', '../canal-agente.js', '../agente-protocolo.js', '../agente-token.js', 'fastify', '@prisma/client', "const c = require('./config.js');"],
    );
  });

  test('F2 the agent program holds only non-test agent files and agente-protocolo.ts under src/', () => {
    const salida = execFileSync(
      process.execPath,
      [`${RAIZ}node_modules/typescript/bin/tsc`, '-p', `${RAIZ}tsconfig.agente.json`, '--listFilesOnly'],
      { cwd: RAIZ, encoding: 'utf8' },
    );
    const fuentes = salida
      .split(/\r?\n/)
      .map((ruta) => ruta.replaceAll('\\', '/'))
      .filter((ruta) => ruta.toLowerCase().startsWith(`${RAIZ}src/`.toLowerCase()))
      .map((ruta) => ruta.slice(RAIZ.length));
    assert.ok(fuentes.includes('src/agente-proceso/main.ts') && fuentes.includes('src/agente-protocolo.ts'), fuentes.join(', '));
    const ajenos = fuentes.filter(
      (ruta) => ruta !== 'src/agente-protocolo.ts' && !/^src\/agente-proceso\/[\w-]+(?<!\.test)\.ts$/.test(ruta),
    );
    assert.deepEqual(ajenos, []);
  });
});
