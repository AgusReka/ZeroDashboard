import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  classifyExecutionError,
  corteDeEjecucion,
  limiteEfectivoDe,
  sanearSql,
} from './consulta-ejecucion.js';

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

describe('limiteEfectivoDe — the clamp, and only the clamp', () => {
  test('a requested page under the cap is served as requested', () => {
    assert.equal(limiteEfectivoDe(50, 200), 50);
  });

  test('a requested page equal to the cap is served as requested', () => {
    assert.equal(limiteEfectivoDe(200, 200), 200);
  });

  test('a requested page above the cap is clamped down to the cap', () => {
    assert.equal(limiteEfectivoDe(1000, 200), 200);
  });

  test('a cap configured lower than the default clamps a default-sized page', () => {
    // The point of DEC-19: moving MAX_FILAS_CONSULTA moves the ceiling, with no edit
    // to any source file.
    assert.equal(limiteEfectivoDe(50, 5), 5);
  });
});

describe('corteDeEjecucion — the cap verdict is not the pagination signal (DEC-18)', () => {
  test('no clamp and no further rows: nothing was cut', () => {
    assert.equal(corteDeEjecucion(50, 200, false), null);
  });

  /**
   * Design table row 1, and the case DEC-18 exists to keep distinct: the caller asked
   * for a page smaller than the ceiling and there are further pages. That is ordinary
   * pagination — `hayMas` invites the next page and the cap has said nothing.
   */
  test('no clamp but further rows exist: ordinary pagination, not a cut', () => {
    assert.equal(corteDeEjecucion(50, 200, true), null);
  });

  /**
   * Design table row 2. The caller asked for more than the ceiling allows *and* the
   * result set actually had more, so the ceiling is what ended the page.
   */
  test('clamped and further rows exist: the cap cut the result', () => {
    assert.equal(corteDeEjecucion(1000, 200, true), 'tope-de-filas');
  });

  /**
   * The clamp fired but the result set was short anyway, so the operator has the whole
   * answer. Saying "capped" here would be a lie about a complete result.
   */
  test('clamped but no further rows: the operator saw everything, so no cut', () => {
    assert.equal(corteDeEjecucion(1000, 200, false), null);
  });

  test('a page exactly at the cap with nothing beyond it is not a cut', () => {
    assert.equal(corteDeEjecucion(200, 200, false), null);
  });

  test('the verdict is independent of hayMas in both directions', () => {
    // `hayMas` and `corte` answer two different questions, so neither can be derived
    // from the other: `hayMas` is true in both rows below and the verdicts differ.
    assert.equal(corteDeEjecucion(50, 200, true), null);
    assert.equal(corteDeEjecucion(201, 200, true), 'tope-de-filas');
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
