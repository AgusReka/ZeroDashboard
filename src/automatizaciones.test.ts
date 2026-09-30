import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  cierreConNotificacion,
  cierreDeResultado,
  cronValido,
  decidirNotificacion,
  estaVencida,
  type ResultadoCorrida,
} from './automatizaciones.js';
import type { EjecucionExitosa, EjecucionFallida } from './consulta-ejecucion.js';

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

// ---- 2.3 closing a run (X2; Threat Matrix "Driver or error text reaching Ejecucion") -

function exitosa(filas: number, corte: EjecucionExitosa['corte'] = null): EjecucionExitosa {
  return {
    resultado: 'ok',
    fase: 'ejecucion',
    columnas: ['id', 'email'],
    filas: Array.from({ length: filas }, (_, i) => [i, `cliente${i}@ejemplo.test`]),
    corte,
    paginacion: {
      limite: 500,
      desplazamiento: 0,
      hayMas: corte !== null,
      siguienteDesplazamiento: null,
      topeFilas: 500,
    },
    duracionMs: 12,
  };
}

function fallida(
  fase: EjecucionFallida['fase'],
  categoria: EjecucionFallida['categoria'],
  codigo: string | null,
): EjecucionFallida {
  return { resultado: 'fallo', fase, categoria, codigo, duracionMs: 7 };
}

describe('cierreDeResultado — every outcome closes with closed categories only', () => {
  test('2.3 ok: the row count and cut, never the rows themselves', () => {
    const cierre = cierreDeResultado(exitosa(3));
    assert.deepEqual(cierre, {
      estado: 'ok',
      filas: 3,
      corte: null,
      fase: 'ejecucion',
      error: null,
      codigoError: null,
    });
    assert.equal(JSON.stringify(cierre).includes('ejemplo.test'), false);
  });

  test('2.3 ok with the row ceiling reached records the cut', () => {
    assert.deepEqual(cierreDeResultado(exitosa(0, 'tope-de-filas')), {
      estado: 'ok',
      filas: 0,
      corte: 'tope-de-filas',
      fase: 'ejecucion',
      error: null,
      codigoError: null,
    });
  });

  test('2.3 gate refusal: preparacion, and the ungated entities named from the contract', () => {
    const cierre = cierreDeResultado({
      resultado: 'rechazo',
      categoria: 'vista-canonica-no-aprobada',
      entidades: [
        { entidad: 'pedido', estado: 'no-validado' },
        { entidad: 'insumo', estado: 'no-mapeada' },
      ],
    });
    assert.deepEqual(cierre, {
      estado: 'fallo',
      filas: null,
      corte: null,
      fase: 'preparacion',
      error: 'vista-canonica-no-aprobada',
      codigoError: 'pedido,insumo',
    });
  });

  test('2.3 gate refusal: a name outside the canonical contract never reaches the row', () => {
    const cierre = cierreDeResultado({
      resultado: 'rechazo',
      categoria: 'vista-canonica-no-aprobada',
      entidades: [
        { entidad: 'pedido', estado: 'invalida' },
        { entidad: "x'; DROP TABLE clientes; --", estado: 'invalida' },
      ],
    });
    assert.equal(cierre.codigoError, 'pedido');
  });

  test('2.3 the other pre-dial refusals close in preparacion with no code', () => {
    for (const categoria of [
      'valores-invalidos',
      'conexion-no-encontrada',
      'credencial-ilegible',
    ] as const) {
      assert.deepEqual(cierreDeResultado({ resultado: 'rechazo', categoria }), {
        estado: 'fallo',
        filas: null,
        corte: null,
        fase: 'preparacion',
        error: categoria,
        codigoError: null,
      });
    }
  });

  test('2.3 execution failure: its phase, closed category and publishable SQLSTATE', () => {
    const casos: EjecucionFallida[] = [
      fallida('conexion', 'credenciales-invalidas', '28P01'),
      fallida('conexion', 'host-inalcanzable', 'ECONNREFUSED'),
      fallida('permisos', 'rol-superusuario', null),
      fallida('ejecucion', 'error-sintaxis', '42601'),
      fallida('ejecucion', 'tiempo-agotado', '57014'),
      fallida('ejecucion', 'error-desconocido', null),
    ];
    for (const caso of casos) {
      assert.deepEqual(cierreDeResultado(caso), {
        estado: 'fallo',
        filas: null,
        corte: null,
        fase: caso.fase,
        error: caso.categoria,
        codigoError: caso.codigo,
      });
    }
  });

  test('2.3 execution failure: a code without a machine shape is dropped', () => {
    const cierre = cierreDeResultado(
      fallida('conexion', 'error-desconocido', 'password authentication failed for "admin"'),
    );
    assert.equal(cierre.codigoError, null);
  });

  test('2.3 execution failure: stray driver fields on the value are never copied', () => {
    const conRuido = {
      ...fallida('ejecucion', 'error-datos', '22012'),
      message: 'division by zero near password=s3cr3t',
      stack: 'Error: division by zero\n    at Client._handleErrorMessage',
    } as EjecucionFallida;
    const texto = JSON.stringify(cierreDeResultado(conRuido));
    assert.equal(texto.includes('s3cr3t'), false);
    assert.equal(texto.includes('division by zero'), false);
    assert.equal(texto.includes('_handleErrorMessage'), false);
  });

  test('2.3 unexpected throw: error-interno, no phase, nothing from the thrown value', () => {
    const lanzado = Object.assign(new Error('connect to postgres://admin:s3cr3t@db failed'), {
      code: '28P01',
    });
    const resultado: ResultadoCorrida = { resultado: 'excepcion', error: lanzado };
    const cierre = cierreDeResultado(resultado);
    assert.deepEqual(cierre, {
      estado: 'fallo',
      filas: null,
      corte: null,
      fase: null,
      error: 'error-interno',
      codigoError: null,
    });
    assert.equal(JSON.stringify(cierre).includes('s3cr3t'), false);
  });
});

// ---- 3.1 notification precedence (DEC-83, DEC-84, DEC-86) ----------------------------

const PARA = 'compras@ejemplo.test';

describe('decidirNotificacion — the first condition that holds wins', () => {
  test('3.1 a run that did not succeed records null and never sends', () => {
    const noExitosas: ResultadoCorrida[] = [
      fallida('ejecucion', 'error-sintaxis', '42601'),
      fallida('conexion', 'host-inalcanzable', 'ECONNREFUSED'),
      { resultado: 'rechazo', categoria: 'valores-invalidos' },
      { resultado: 'rechazo', categoria: 'vista-canonica-no-aprobada', entidades: [] },
      { resultado: 'excepcion', error: new Error('boom') },
    ];
    for (const resultado of noExitosas) {
      assert.deepEqual(decidirNotificacion(resultado, PARA, true), {
        enviar: false,
        notificacion: null,
      });
    }
  });

  test('3.1 zero rows never sends, even with a recipient and SMTP configured', () => {
    assert.deepEqual(decidirNotificacion(exitosa(0), PARA, true), {
      enviar: false,
      notificacion: 'omitida-sin-filas',
    });
    assert.deepEqual(decidirNotificacion(exitosa(0), null, false), {
      enviar: false,
      notificacion: 'omitida-sin-filas',
    });
  });

  test('3.1 a missing recipient wins over unset SMTP', () => {
    assert.deepEqual(decidirNotificacion(exitosa(2), null, false), {
      enviar: false,
      notificacion: 'sin-destinatario',
    });
    assert.deepEqual(decidirNotificacion(exitosa(2), null, true), {
      enviar: false,
      notificacion: 'sin-destinatario',
    });
  });

  test('3.1 unset SMTP with a recipient records no-configurada', () => {
    assert.deepEqual(decidirNotificacion(exitosa(2), PARA, false), {
      enviar: false,
      notificacion: 'no-configurada',
    });
  });

  test('3.1 rows, a recipient and SMTP configured: send once, to that recipient', () => {
    assert.deepEqual(decidirNotificacion(exitosa(12), PARA, true), { enviar: true, para: PARA });
    assert.deepEqual(decidirNotificacion(exitosa(1, 'tope-de-filas'), 'otro@ejemplo.test', true), {
      enviar: true,
      para: 'otro@ejemplo.test',
    });
  });
});

// ---- 3.2 closing a run with its notification (R1, R3 under DEC-83 and DEC-86) ---------

describe('cierreConNotificacion — only a failed send changes the query close', () => {
  test('3.2 enviada keeps the run ok in phase ejecucion', () => {
    assert.deepEqual(cierreConNotificacion(cierreDeResultado(exitosa(12)), { resultado: 'enviada' }), {
      estado: 'ok',
      filas: 12,
      corte: null,
      fase: 'ejecucion',
      error: null,
      codigoError: null,
      notificacion: 'enviada',
    });
  });

  test('3.2 every non-send outcome of an ok run keeps it ok in phase ejecucion', () => {
    for (const omision of ['omitida-sin-filas', 'sin-destinatario', 'no-configurada'] as const) {
      const cierre = cierreDeResultado(exitosa(omision === 'omitida-sin-filas' ? 0 : 4));
      assert.deepEqual(cierreConNotificacion(cierre, omision), { ...cierre, notificacion: omision });
      assert.equal(cierreConNotificacion(cierre, omision).fase, 'ejecucion');
    }
  });

  test('3.2 a failed send fails the run in phase notificacion and keeps filas and corte', () => {
    const cierre = cierreDeResultado(exitosa(12, 'tope-de-filas'));
    assert.deepEqual(
      cierreConNotificacion(cierre, { resultado: 'fallo', categoria: 'envio-rechazado', codigo: '550' }),
      {
        estado: 'fallo',
        filas: 12,
        corte: 'tope-de-filas',
        fase: 'notificacion',
        error: 'envio-rechazado',
        codigoError: '550',
        notificacion: 'fallo-envio',
      },
    );
    assert.deepEqual(
      cierreConNotificacion(cierreDeResultado(exitosa(3)), {
        resultado: 'fallo',
        categoria: 'tiempo-agotado',
        codigo: null,
      }),
      {
        estado: 'fallo',
        filas: 3,
        corte: null,
        fase: 'notificacion',
        error: 'tiempo-agotado',
        codigoError: null,
        notificacion: 'fallo-envio',
      },
    );
  });

  test('3.2 a throw in the notify step closes as error-interno, fallo-envio, no code', () => {
    const lanzado = new Error('connect smtp://user:s3cr3t@mail failed');
    const cierre = cierreConNotificacion(cierreDeResultado(exitosa(5)), {
      resultado: 'excepcion',
      error: lanzado,
    });
    assert.deepEqual(cierre, {
      estado: 'fallo',
      filas: 5,
      corte: null,
      fase: 'notificacion',
      error: 'error-interno',
      codigoError: null,
      notificacion: 'fallo-envio',
    });
    assert.equal(JSON.stringify(cierre).includes('s3cr3t'), false);
  });

  test('3.2 a query that did not succeed keeps its close and records null', () => {
    const fallo = cierreDeResultado(fallida('ejecucion', 'error-sintaxis', '42601'));
    assert.deepEqual(cierreConNotificacion(fallo, null), { ...fallo, notificacion: null });
    // Defensive: even a send verdict handed in by mistake cannot rewrite a failed query.
    assert.deepEqual(cierreConNotificacion(fallo, { resultado: 'enviada' }), {
      ...fallo,
      notificacion: null,
    });
  });
});

// ---- 3.3 a failed send's code and category are gated (Threat Matrix "SMTP text") -----

describe('cierreConNotificacion — only a three-digit SMTP code and a closed category', () => {
  function falloDeEnvio(codigo: string | null): ReturnType<typeof cierreConNotificacion> {
    return cierreConNotificacion(cierreDeResultado(exitosa(2)), {
      resultado: 'fallo',
      categoria: 'envio-rechazado',
      codigo,
    });
  }

  test('3.3 a three-digit SMTP reply code is kept', () => {
    for (const codigo of ['250', '421', '450', '535', '550', '599']) {
      assert.equal(falloDeEnvio(codigo).codigoError, codigo);
    }
  });

  test('3.3 a Node code, a SQLSTATE or free text becomes null', () => {
    for (const codigo of [
      'ECONNECTION',
      'ETIMEDOUT',
      '42601',
      '28P01',
      '150',
      '600',
      '55',
      '5500',
      '550\n',
      ' 550',
      '５５０',
      '550 5.1.1 <jefe@ejemplo.test>: Recipient address rejected',
      'AUTH PLAIN dXNlcjpzM2NyM3Q=',
    ]) {
      assert.equal(falloDeEnvio(codigo).codigoError, null, JSON.stringify(codigo));
    }
  });

  test('3.3 stray fields on the send verdict never reach the close', () => {
    const conRuido = {
      resultado: 'fallo',
      categoria: 'credenciales-invalidas',
      codigo: '535',
      message: 'Invalid login: 535 Authentication failed for user=admin pass=s3cr3t',
      response: '535 5.7.8 Username and Password not accepted',
    } as const;
    const cierre = cierreConNotificacion(cierreDeResultado(exitosa(2)), conRuido);
    assert.deepEqual(Object.keys(cierre).sort(), [
      'codigoError',
      'corte',
      'error',
      'estado',
      'fase',
      'filas',
      'notificacion',
    ]);
    const texto = JSON.stringify(cierre);
    assert.equal(texto.includes('s3cr3t'), false);
    assert.equal(texto.includes('Username'), false);
    assert.equal(cierre.error, 'credenciales-invalidas');
  });

  test('3.3 a category outside the closed set becomes error-desconocido', () => {
    const cierre = cierreConNotificacion(cierreDeResultado(exitosa(2)), {
      resultado: 'fallo',
      categoria: '550 mailbox jefe@ejemplo.test unavailable' as 'envio-rechazado',
      codigo: null,
    });
    assert.equal(cierre.error, 'error-desconocido');
  });
});
