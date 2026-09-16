import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { classifyExecutionError, sanearSql } from './consulta-ejecucion.js';

function errorConCodigo(code: string): Error & { code: string } {
  const error = new Error('driver failure') as Error & { code: string };
  error.code = code;
  return error;
}

describe('classifyExecutionError — classification rows', () => {
  /**
   * Row 1 of the design's table ("the engine's own timer won the race") has no test
   * here on purpose, and its absence is the assertion: the backstop verdict is a fact
   * `ejecutarConsulta` observes by winning a race, never an error the driver produced,
   * so it must not be reachable through this function. The case below pins that — the
   * rejection value the backstop uses classifies as an unknown error, not as a
   * timeout. Row 1's real coverage is the live `pg_sleep` integration case.
   */
  test('row 1: the backstop rejection value is not classified as a timeout here', () => {
    const resultado = classifyExecutionError(Symbol('presupuesto-agotado'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('row 2: SQLSTATE 57014 is the server-side statement_timeout', () => {
    const resultado = classifyExecutionError(errorConCodigo('57014'));
    assert.deepEqual(resultado, { categoria: 'tiempo-agotado', codigo: '57014' });
  });

  test('row 3: SQLSTATE 25006 is a write refused by the read-only transaction', () => {
    const resultado = classifyExecutionError(errorConCodigo('25006'));
    assert.deepEqual(resultado, { categoria: 'no-es-lectura', codigo: '25006' });
  });

  /**
   * The second half of row 3. `0A000` is what the engine actually raises for a
   * data-modifying CTE once the pagination wrapper (decision 6) demotes it to a
   * subquery: parse analysis refuses it before the executor, so `PreventCommandIfReadOnly`
   * never gets to raise `25006`. Same meaning for the operator, different catch point,
   * therefore the same category — and the raw code is still reported so the two stay
   * distinguishable. Pinned live by `src/consultas.test.ts` case 6.1 and its companion.
   */
  test('row 3: SQLSTATE 0A000 is also "not a read", not the unknown fallback', () => {
    const resultado = classifyExecutionError(errorConCodigo('0A000'));
    assert.deepEqual(resultado, { categoria: 'no-es-lectura', codigo: '0A000' });
  });

  test('row 4: SQLSTATE 42501 is insufficient privilege, not a syntax error', () => {
    const resultado = classifyExecutionError(errorConCodigo('42501'));
    assert.deepEqual(resultado, { categoria: 'permiso-denegado', codigo: '42501' });
  });

  for (const codigo of ['42601', '42P01', '42703']) {
    test(`row 5: any other class 42 (${codigo}) is a syntax error`, () => {
      const resultado = classifyExecutionError(errorConCodigo(codigo));
      assert.deepEqual(resultado, { categoria: 'error-sintaxis', codigo });
    });
  }

  for (const codigo of ['22012', '22P02']) {
    test(`row 6: any class 22 (${codigo}) is a data exception`, () => {
      const resultado = classifyExecutionError(errorConCodigo(codigo));
      assert.deepEqual(resultado, { categoria: 'error-datos', codigo });
    });
  }

  test('row 7: an unrelated SQLSTATE falls back to the generic category', () => {
    const resultado = classifyExecutionError(errorConCodigo('53200'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: '53200' });
  });

  test('row 7: a non-Error throw is classified without a codigo', () => {
    const resultado = classifyExecutionError('boom');
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('row 7: null is classified without a codigo', () => {
    const resultado = classifyExecutionError(null);
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });
});

describe('classifyExecutionError — codigo allowlist', () => {
  test('an error with no code at all yields codigo: null', () => {
    const resultado = classifyExecutionError(new Error('connection terminated unexpectedly'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('a free-text code does not match the allowlist and yields codigo: null', () => {
    const resultado = classifyExecutionError(errorConCodigo('read only transaction'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('a numeric code is not read as a codigo', () => {
    const error = new Error('driver failure') as Error & { code: number };
    error.code = 25006;
    const resultado = classifyExecutionError(error);
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('a Node socket code reaching the execution phase keeps its shape', () => {
    const resultado = classifyExecutionError(errorConCodigo('ECONNRESET'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: 'ECONNRESET' });
  });
});

describe('sanearSql — plain trimming, never parsing', () => {
  test('a trailing semicolon is stripped', () => {
    assert.equal(sanearSql('SELECT 1;'), 'SELECT 1');
  });

  test('a trailing semicolon followed by whitespace is stripped', () => {
    assert.equal(sanearSql('  SELECT 1;  \n'), 'SELECT 1');
  });

  test('exactly one semicolon is stripped, so a doubled one stays invalid', () => {
    // Repairing `;;` would silently execute something the operator did not write.
    assert.equal(sanearSql('SELECT 1;;'), 'SELECT 1;');
  });

  test('a statement without a semicolon is only trimmed', () => {
    assert.equal(sanearSql('\t SELECT 1 \t'), 'SELECT 1');
  });

  test('whitespace-only input collapses to the empty string', () => {
    // The route rejects this as a request-shape failure (400), not an execution verdict.
    assert.equal(sanearSql('   \n\t '), '');
  });

  test('an interior semicolon is left untouched — no statement splitting happens here', () => {
    // Multi-statement text is refused by the wire protocol, not by string inspection.
    assert.equal(sanearSql('SELECT 1; SELECT 2'), 'SELECT 1; SELECT 2');
  });
});

describe('classifyExecutionError — credential safety', () => {
  test('a credential-bearing error yields a summary with neither password nor stack', () => {
    const password = 'sup3r-s3cret-p4ss';
    const error = new Error(`read-only transaction for user "lector" (${password})`) as Error & {
      code: string;
      connectionParameters: Record<string, unknown>;
    };
    error.code = '25006';
    error.stack = `Error: cannot execute DELETE\n    at Client._handleErrorMessage (pg/lib/client.js:1:1) [${password}]`;
    error.connectionParameters = {
      host: '10.0.0.7',
      port: 5432,
      database: 'foodstore',
      user: 'lector',
      password,
    };

    const resultado = classifyExecutionError(error);

    assert.deepEqual(resultado, { categoria: 'no-es-lectura', codigo: '25006' });
    assert.deepEqual(Object.keys(resultado).sort(), ['categoria', 'codigo']);

    const serializado = JSON.stringify(resultado);
    assert.ok(!serializado.includes(password), 'the password must not appear in the summary');
    assert.ok(!serializado.includes('connectionParameters'), 'connection parameters must not appear');
    assert.ok(!serializado.includes('_handleErrorMessage'), 'the stack must not appear');
    assert.ok(!serializado.includes('read-only transaction for user'), 'the message must not appear');
  });
});
