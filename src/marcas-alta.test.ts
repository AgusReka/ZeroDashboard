import assert from 'node:assert/strict';
import net from 'node:net';
import { readdir, readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/**
 * CH-15 (G1, DEC-87 to DEC-92): `scripts/marcas-alta.sql` derives the onboarding timing
 * marks from existing columns, one row per `Conexion`. This suite runs that file exactly
 * as it is checked in, never a copy or a rebuilt string.
 *
 * The static cases need no server. The live suite loads a fixture with fixed 2020
 * timestamps and reads it back through the script. The read runs as a throwaway role,
 * `ch15_lector`, which can SELECT only the columns the script reads (DEC-92, rule 5). It
 * runs inside `BEGIN READ ONLY`, as a named query. A named query forces the extended
 * protocol (node-pg `requiresPreparation`), so a second statement in the text is refused
 * at Parse and never runs.
 *
 * The target is the same local PostgreSQL the other live suites use (defaults match
 * `.env.example`); the whole live suite skips when it is unreachable:
 *
 *   TEST_DB_HOST=localhost  TEST_DB_PORT=5432  TEST_DB_USER=zerodashboard
 *   TEST_DB_PASSWORD=change-me  TEST_DB_NAME=zerodashboard
 *
 * `TEST_DB_USER` must be able to create roles, and the migrations must be applied.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

const RUTA_SCRIPT = new URL('../scripts/marcas-alta.sql', import.meta.url);

const ROL_LECTOR = 'ch15_lector';
const CLAVE_LECTOR = 'ch15-clave-lector';

/** Exactly the columns the script reads. Never `credencial`, `host` or `sql`. */
const COLUMNAS_LEIDAS: Record<string, string[]> = {
  Tenant: ['id', 'activo', 'creadoEn'],
  Conexion: ['id', 'tenantId', 'creadaEn'],
  VistaCanonica: ['id', 'conexionId', 'entidad', 'creadaEn', 'actualizadaEn', 'validadaEn', 'estadoValidacion'],
  Automatizacion: ['id', 'conexionId', 'creadaEn'],
  Ejecucion: ['id', 'automatizacionId', 'iniciadaEn', 'estado', 'fase'],
};

/** Drops the reader role. Safe to run before creation and after teardown. */
const SQL_LIMPIEZA = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL_LECTOR}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL_LECTOR}');
    EXECUTE format('DROP ROLE %I', '${ROL_LECTOR}');
  END IF;
END
$limpieza$;`;

interface FilaMarcas {
  tenant_id: string;
  tenant_activo: boolean;
  conexion_id: string;
  alta_inicio: Date;
  conexion_registrada: Date;
  mapeo_inicio: Date | null;
  mapeo_fin: Date | null;
  validacion_ultima: Date | null;
  validacion_estado: string | null;
  automatizacion_creada: Date | null;
  primera_ejecucion: Date | null;
  primera_ejecucion_estado: string | null;
  primera_ejecucion_fase: string | null;
  primera_ejecucion_ok: Date | null;
}

/** A fixed 2020 UTC instant, e.g. `t('01-03T10:00')`. */
function t(momento: string): Date {
  return new Date(`2020-${momento}:00.000Z`);
}

/** A mark as an ISO string, or null, so assertions compare values, not objects. */
function iso(valor: Date | null): string | null {
  return valor === null ? null : valor.toISOString();
}

/** One TCP handshake, no driver: decides whether this suite has a server to talk to. */
function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip: string | false = alcanzable
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
    "bring up a migrated database and set TEST_DB_* (see this file's header)";

// ---- no server needed ------------------------------------------------------------------

describe('marcas del alta — static guarantees', () => {
  test('no application module in src/ references the script (no route exposure)', async () => {
    const directorio = new URL('./', import.meta.url);
    const referencias: string[] = [];
    for (const nombre of await readdir(directorio)) {
      if (!nombre.endsWith('.ts') || nombre.endsWith('.test.ts')) continue;
      const fuente = await readFile(new URL(nombre, directorio), 'utf8');
      if (fuente.includes('marcas-alta')) referencias.push(nombre);
    }
    assert.deepEqual(referencias, []);
  });

  test('the file has no parameter placeholder and no psql meta-command', async () => {
    const texto = await readFile(RUTA_SCRIPT, 'utf8');
    assert.doesNotMatch(texto, /\$\d/);
    assert.equal(texto.includes('\\'), false);
  });

  test('the file is one read-only statement ending with a semicolon', async () => {
    const texto = await readFile(RUTA_SCRIPT, 'utf8');
    const cuerpo = texto.replace(/--[^\n]*/g, '').trim();
    assert.match(cuerpo, /^(WITH|SELECT)\b/i);
    assert.equal(cuerpo.endsWith(';'), true);
    assert.equal(cuerpo.split(';').length, 2, 'exactly one statement terminator');
    assert.doesNotMatch(
      cuerpo,
      /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COPY|CALL|DO|SET|LOCK|VACUUM|INTO)\b/i,
    );
  });

  test('the reader role is never granted credencial, host or sql', () => {
    const concedidas = Object.values(COLUMNAS_LEIDAS).flat();
    for (const prohibida of ['credencial', 'host', 'sql']) {
      assert.equal(concedidas.includes(prohibida), false, prohibida);
    }
  });
});

// ---- live PostgreSQL -------------------------------------------------------------------

describe('marcas del alta — script run against a live PostgreSQL', { skip: motivoSkip }, () => {
  const MARCA = `CH-15 marcas ${Date.now()}`;
  let admin!: pg.Client;
  let lector!: pg.Client;
  let prisma!: PrismaClient;
  let sql!: string;
  const tenants: string[] = [];
  const ids = { a1: '', a2: '', b1: '', tenantA: '', tenantB: '' };
  /** The script's rows for this fixture's connections only, keyed by `conexion_id`. */
  const filas = new Map<string, FilaMarcas[]>();

  /** The one fixture row for a connection; fails if the script repeated or dropped it. */
  function fila(conexionId: string): FilaMarcas {
    const encontradas = filas.get(conexionId) ?? [];
    assert.equal(encontradas.length, 1, `one row for ${conexionId}`);
    return encontradas[0];
  }

  before(async () => {
    sql = await readFile(RUTA_SCRIPT, 'utf8');

    admin = new pg.Client({ ...objetivo });
    await admin.connect();
    await admin.query(SQL_LIMPIEZA);
    await admin.query(`CREATE ROLE ${ROL_LECTOR} LOGIN PASSWORD '${CLAVE_LECTOR}'`);
    for (const [tabla, columnas] of Object.entries(COLUMNAS_LEIDAS)) {
      const lista = columnas.map((c) => `"${c}"`).join(', ');
      await admin.query(`GRANT SELECT (${lista}) ON "${tabla}" TO ${ROL_LECTOR}`);
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const plantilla = await prisma.plantilla.create({
      data: {
        nombre: `${MARCA} plantilla`,
        sql: 'SELECT * FROM v_producto',
        entidades: ['producto'],
        automatizacion: 'stock-fisico',
        formato: 'correo-html',
        toleranciaFrescuraMinutos: 30,
      },
    });

    const conexion = (tenantId: string, nombre: string, creadaEn: Date) =>
      prisma.conexion.create({
        data: {
          tenantId, nombre, motor: 'postgresql', host: 'no-se-marca', puerto: 5432,
          baseDeDatos: 'no-se-marca', usuarioDb: 'no-se-marca', credencial: 'no-se-marca',
          creadaEn, actualizadaEn: creadaEn,
        },
      });
    const automatizacion = (tenantId: string, conexionId: string, creadaEn: Date) =>
      prisma.automatizacion.create({
        data: { tenantId, conexionId, plantillaId: plantilla.id, cron: '0 * * * *', creadaEn },
      });

    // Tenant A: A1 goes through every stage, A2 is only registered.
    const tenantA = await prisma.tenant.create({ data: { nombre: `${MARCA} A`, creadoEn: t('01-01T09:00') } });
    tenants.push(tenantA.id);
    const a1 = await conexion(tenantA.id, 'A1', t('01-01T10:00'));
    const a2 = await conexion(tenantA.id, 'A2', t('01-02T10:00'));
    const producto = await prisma.vistaCanonica.create({
      data: {
        tenantId: tenantA.id, conexionId: a1.id, entidad: 'producto', sql: 'SELECT 1',
        creadaEn: t('01-03T10:00'), actualizadaEn: t('01-04T10:00'),
        estadoValidacion: 'valida', validadaEn: t('01-05T10:00'),
      },
    });
    // Re-validation overwrites the row the way the validate route does, keeping
    // `actualizadaEn`: the second result is `invalida`.
    await prisma.vistaCanonica.updateMany({
      where: { id: producto.id },
      data: { estadoValidacion: 'invalida', validadaEn: t('01-07T10:00'), actualizadaEn: t('01-04T10:00') },
    });
    // Validated before its own last edit: a clock mix the script reports as stored.
    await prisma.vistaCanonica.create({
      data: {
        tenantId: tenantA.id, conexionId: a1.id, entidad: 'insumo', sql: 'SELECT 1',
        creadaEn: t('01-03T12:00'), actualizadaEn: t('01-08T10:00'),
        estadoValidacion: 'invalida', validadaEn: t('01-06T11:00'),
      },
    });
    const auto1 = await automatizacion(tenantA.id, a1.id, t('01-09T10:00'));
    const auto2 = await automatizacion(tenantA.id, a1.id, t('01-10T10:00'));
    const corridas: [string, string, string | null, Date][] = [
      [auto1.id, 'fallo', 'preparacion', t('01-09T11:00')],
      [auto2.id, 'fallo', 'ejecucion', t('01-09T12:00')],
      [auto1.id, 'ok', 'ejecucion', t('01-09T13:00')],
      [auto2.id, 'ok', 'ejecucion', t('01-10T12:00')],
    ];
    for (const [automatizacionId, estado, fase, iniciadaEn] of corridas) {
      await prisma.ejecucion.create({
        data: { tenantId: tenantA.id, automatizacionId, estado, fase, iniciadaEn, finalizadaEn: iniciadaEn },
      });
    }

    // Tenant B: deactivated; its mapping was re-registered, its automation never ran.
    const tenantB = await prisma.tenant.create({
      data: { nombre: `${MARCA} B`, activo: false, creadoEn: t('02-01T09:00') },
    });
    tenants.push(tenantB.id);
    const b1 = await conexion(tenantB.id, 'B1', t('02-01T10:00'));
    const vistaB = await prisma.vistaCanonica.create({
      data: {
        tenantId: tenantB.id, conexionId: b1.id, entidad: 'producto', sql: 'SELECT 1',
        creadaEn: t('02-02T10:00'), actualizadaEn: t('02-02T10:00'),
        estadoValidacion: 'valida', validadaEn: t('02-03T10:00'),
      },
    });
    await prisma.vistaCanonica.update({
      where: { id: vistaB.id },
      data: {
        sql: 'SELECT 2', estadoValidacion: 'no-validado', validadaEn: null,
        actualizadaEn: t('02-04T10:00'),
      },
    });
    await automatizacion(tenantB.id, b1.id, t('02-05T10:00'));

    Object.assign(ids, { a1: a1.id, a2: a2.id, b1: b1.id, tenantA: tenantA.id, tenantB: tenantB.id });

    lector = new pg.Client({ ...objetivo, user: ROL_LECTOR, password: CLAVE_LECTOR });
    await lector.connect();
    // `timestamp(3)` has no zone and holds UTC; node-pg would read it as local time.
    lector.setTypeParser(1114, (valor: string) => new Date(`${valor.replace(' ', 'T')}Z`));

    await lector.query('BEGIN READ ONLY');
    try {
      const soloLectura = await lector.query('SHOW transaction_read_only');
      assert.equal(soloLectura.rows[0].transaction_read_only, 'on');
      const resultado = await lector.query<FilaMarcas>({ name: 'marcas-alta', text: sql });
      for (const f of resultado.rows) {
        if (!tenants.includes(f.tenant_id)) continue;
        filas.set(f.conexion_id, [...(filas.get(f.conexion_id) ?? []), f]);
      }
    } finally {
      await lector.query('ROLLBACK');
    }
  });

  after(async () => {
    // Every foreign key is RESTRICT, so dependents go first, per fixture tenant.
    if (prisma !== undefined) {
      const where = { tenantId: { in: tenants } };
      await prisma.ejecucion.deleteMany({ where });
      await prisma.automatizacion.deleteMany({ where });
      await prisma.vistaCanonica.deleteMany({ where });
      await prisma.conexion.deleteMany({ where });
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: MARCA } } });
      await prisma.$disconnect();
    }
    await lector?.end();
    if (admin !== undefined) {
      await admin.query(SQL_LIMPIEZA);
      await admin.end();
    }
  });

  test('explicit fixture timestamps survive @updatedAt on create', async () => {
    const a1 = await prisma.conexion.findUniqueOrThrow({ where: { id: ids.a1 } });
    assert.equal(a1.actualizadaEn.toISOString(), '2020-01-01T10:00:00.000Z');
  });

  test('a second statement after the script is refused at Parse, not run', async () => {
    await lector.query('BEGIN READ ONLY');
    try {
      await assert.rejects(
        lector.query({ name: 'marcas-alta-doble', text: `${sql}\nDELETE FROM "Tenant" WHERE false;` }),
        (error: { code?: string }) => error.code === '42601',
      );
    } finally {
      await lector.query('ROLLBACK');
    }
  });

  test('the reader role cannot read a column outside the grant', async () => {
    for (const texto of ['SELECT credencial FROM "Conexion"', 'SELECT host FROM "Conexion"', 'SELECT sql FROM "VistaCanonica"']) {
      await assert.rejects(lector.query(texto), (error: { code?: string }) => error.code === '42501', texto);
    }
  });

  test('one row per connection; both connections of a tenant carry its start mark', () => {
    assert.deepEqual([...filas.keys()].sort(), [ids.a1, ids.a2, ids.b1].sort());
    for (const id of [ids.a1, ids.a2]) {
      assert.equal(fila(id).tenant_id, ids.tenantA);
      assert.equal(iso(fila(id).alta_inicio), '2020-01-01T09:00:00.000Z');
    }
    assert.equal(iso(fila(ids.a1).conexion_registrada), '2020-01-01T10:00:00.000Z');
    assert.equal(iso(fila(ids.a2).conexion_registrada), '2020-01-02T10:00:00.000Z');
  });

  test('mapping start and end are the min creadaEn and the max actualizadaEn', () => {
    assert.equal(iso(fila(ids.a1).mapeo_inicio), '2020-01-03T10:00:00.000Z');
    assert.equal(iso(fila(ids.a1).mapeo_fin), '2020-01-08T10:00:00.000Z');
  });

  test('re-validation: the latest validation and its state, including invalida', () => {
    // Clock mix: this mark is earlier than mapeo_fin; nothing here compares the two.
    assert.equal(iso(fila(ids.a1).validacion_ultima), '2020-01-07T10:00:00.000Z');
    assert.equal(fila(ids.a1).validacion_estado, 'invalida');
  });

  test('failed run then ok run: first run with its estado/fase, and first ok apart', () => {
    const a1 = fila(ids.a1);
    assert.equal(iso(a1.automatizacion_creada), '2020-01-09T10:00:00.000Z');
    assert.equal(iso(a1.primera_ejecucion), '2020-01-09T11:00:00.000Z');
    assert.equal(a1.primera_ejecucion_estado, 'fallo');
    assert.equal(a1.primera_ejecucion_fase, 'preparacion');
    assert.equal(iso(a1.primera_ejecucion_ok), '2020-01-09T13:00:00.000Z');
  });

  test('a connection that is only registered has every later mark null', () => {
    const a2 = fila(ids.a2);
    for (const marca of [
      a2.mapeo_inicio, a2.mapeo_fin, a2.validacion_ultima, a2.validacion_estado, a2.automatizacion_creada,
      a2.primera_ejecucion, a2.primera_ejecucion_estado, a2.primera_ejecucion_fase, a2.primera_ejecucion_ok,
    ]) {
      assert.equal(marca, null);
    }
  });

  test('a deactivated tenant still appears; cleared validation and no runs are null', () => {
    const b1 = fila(ids.b1);
    assert.equal(b1.tenant_id, ids.tenantB);
    assert.equal(b1.tenant_activo, false);
    assert.equal(iso(b1.alta_inicio), '2020-02-01T09:00:00.000Z');
    assert.equal(iso(b1.mapeo_inicio), '2020-02-02T10:00:00.000Z');
    assert.equal(iso(b1.mapeo_fin), '2020-02-04T10:00:00.000Z');
    assert.equal(b1.validacion_ultima, null);
    assert.equal(b1.validacion_estado, null);
    assert.equal(iso(b1.automatizacion_creada), '2020-02-05T10:00:00.000Z');
    assert.equal(b1.primera_ejecucion, null);
    assert.equal(b1.primera_ejecucion_estado, null);
    assert.equal(b1.primera_ejecucion_fase, null);
    assert.equal(b1.primera_ejecucion_ok, null);
  });
});
