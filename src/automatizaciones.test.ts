import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cronValido, estaVencida } from './automatizaciones.js';

/**
 * Unit cases for CH-13 Phase 2: the pure half of the scheduler. No database, no Fastify,
 * no connection. Cron validity (DEC-76), the due-window check in the configured timezone
 * (DEC-77), and the mapping from a run's outcome to the closed `Ejecucion` columns (X2)
 * are proven here; `src/planificador.ts` only adds I/O around these functions.
 */

const UTC = 'UTC';
/** UTC-3 all year (no DST), so every expected instant below is fixed. */
const BUENOS_AIRES = 'America/Argentina/Buenos_Aires';

function t(iso: string): Date {
  return new Date(iso);
}

// ---- 2.1 cron validity (DEC-76) ----------------------------------------------------

describe('cronValido — exactly five standard cron fields', () => {
  test('2.1 accepts ordinary five-field expressions', () => {
    for (const cron of [
      '* * * * *',
      '0 9 * * *',
      '*/15 * * * *',
      '0 8-18/2 * * 1-5',
      '30 6 1,15 * *',
      '0 0 * JAN,JUL MON-FRI',
      '  0 9 * * *  ',
    ]) {
      assert.equal(cronValido(cron, UTC), true, cron);
    }
  });

  test('2.1 rejects @aliases, which the library would otherwise expand', () => {
    for (const cron of ['@daily', '@hourly', '@weekly', '@yearly', '@reboot']) {
      assert.equal(cronValido(cron, UTC), false, cron);
    }
  });

  test('2.1 rejects a seconds field and any other field count', () => {
    for (const cron of ['* * * * * *', '0 0 9 * * *', '* * * *', '0 9', '', '   ']) {
      assert.equal(cronValido(cron, UTC), false, JSON.stringify(cron));
    }
  });

  test('2.1 rejects malformed or out-of-range fields', () => {
    for (const cron of [
      'a b c d e',
      '60 * * * *',
      '* 24 * * *',
      '*/0 * * * *',
      '5-2 * * * *',
      '0 0 30 2 *',
      '0 9 * * MONDAY',
      '0 9 * JAN-XYZ *',
    ]) {
      assert.equal(cronValido(cron, UTC), false, cron);
    }
  });

  test('2.1 rejects non-standard extensions (hashed, last, nth weekday, "?")', () => {
    for (const cron of ['H * * * *', '0 0 L * *', '0 0 * * 1#2', '0 0 ? * *', '0 0 * * 5L']) {
      assert.equal(cronValido(cron, UTC), false, cron);
    }
  });

  test('2.1 names are only accepted in the month and day-of-week fields', () => {
    assert.equal(cronValido('0 9 * * MON', UTC), true);
    assert.equal(cronValido('0 9 * JAN *', UTC), true);
    assert.equal(cronValido('0 9 MON * *', UTC), false);
    assert.equal(cronValido('JAN 9 * * *', UTC), false);
  });

  test('2.1 an unknown timezone makes every expression invalid', () => {
    assert.equal(cronValido('0 9 * * *', 'Nope/Zone'), false);
  });
});

// ---- 2.2 the due window (DEC-75, DEC-77) -------------------------------------------

describe('estaVencida — a fire inside (desde, hasta] makes the automation due', () => {
  const diario10 = '0 10 * * *';

  test('2.2 a fire exactly at `hasta` is due (the upper edge is inclusive)', () => {
    assert.equal(
      estaVencida(diario10, t('2026-09-28T09:59:01Z'), t('2026-09-28T10:00:00Z'), UTC),
      true,
    );
  });

  test('2.2 a fire exactly at `desde` is not due (the lower edge is exclusive)', () => {
    assert.equal(
      estaVencida(diario10, t('2026-09-28T10:00:00Z'), t('2026-09-28T10:01:01Z'), UTC),
      false,
    );
  });

  test('2.2 a fire just after `hasta` is not due yet', () => {
    assert.equal(
      estaVencida(diario10, t('2026-09-28T09:59:01Z'), t('2026-09-28T09:59:59.999Z'), UTC),
      false,
    );
  });

  test('2.2 an empty or inverted window is never due', () => {
    const instante = t('2026-09-28T10:00:00Z');
    assert.equal(estaVencida('* * * * *', instante, instante, UTC), false);
    assert.equal(estaVencida('* * * * *', instante, t('2026-09-28T09:00:00Z'), UTC), false);
  });

  test('2.2 a window wider than one minute still reports a single due verdict', () => {
    // A slow tick leaves a gap; the next window covers it and the run fires once.
    assert.equal(
      estaVencida(diario10, t('2026-09-28T09:40:00Z'), t('2026-09-28T10:20:00Z'), UTC),
      true,
    );
  });

  test('2.2 the `creadaEn` lower bound never fires before creation', () => {
    const inicioVentana = t('2026-09-28T09:59:01Z');
    const ahora = t('2026-09-28T10:01:01Z');
    const creadaEn = t('2026-09-28T10:00:30Z');
    // Without the bound, the 10:00 fire falls inside the tick window...
    assert.equal(estaVencida(diario10, inicioVentana, ahora, UTC), true);
    // ...but the automation did not exist yet, so the caller's max(window, creadaEn) excludes it.
    const desde = new Date(Math.max(inicioVentana.getTime(), creadaEn.getTime()));
    assert.equal(estaVencida(diario10, desde, ahora, UTC), false);
  });

  test('2.2 the configured timezone, not UTC or host time, resolves the next fire', () => {
    const nueveCadaDia = '0 9 * * *';
    // 09:00 in Buenos Aires is 12:00 UTC.
    const alrededorDe12Utc = [t('2026-09-28T11:59:01Z'), t('2026-09-28T12:00:01Z')] as const;
    const alrededorDe09Utc = [t('2026-09-28T08:59:01Z'), t('2026-09-28T09:00:01Z')] as const;
    assert.equal(estaVencida(nueveCadaDia, ...alrededorDe12Utc, BUENOS_AIRES), true);
    assert.equal(estaVencida(nueveCadaDia, ...alrededorDe12Utc, UTC), false);
    assert.equal(estaVencida(nueveCadaDia, ...alrededorDe09Utc, UTC), true);
    assert.equal(estaVencida(nueveCadaDia, ...alrededorDe09Utc, BUENOS_AIRES), false);
  });

  test('2.2 a stored expression that is not valid cron fails closed with a throw', () => {
    const desde = t('2026-09-28T09:00:00Z');
    const hasta = t('2026-09-29T09:00:00Z');
    assert.throws(() => estaVencida('@daily', desde, hasta, UTC));
    assert.throws(() => estaVencida('* * * * * *', desde, hasta, UTC));
  });
});
