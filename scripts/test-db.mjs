// CH-31 (DEC-170): runs the suite against its own database, never the development one.
//
// The integration helpers already read TEST_DB_HOST/PORT/USER/PASSWORD/NAME; this script only
// makes sure the database they are pointed at exists and is migrated, then runs the suite
// with TEST_DB_NAME set. Nothing it prints contains the password.
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const NOMBRES_PROHIBIDOS = new Set(['zerodashboard', process.env.POSTGRES_DB].filter(Boolean));

function fallar(mensaje) {
  console.error(`test:db: ${mensaje}`);
  process.exit(1);
}

const destino = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD,
  database: process.env.TEST_DB_NAME ?? 'zerodashboard_test',
};

if (!destino.password) {
  fallar('TEST_DB_PASSWORD is required');
}
if (NOMBRES_PROHIBIDOS.has(destino.database)) {
  fallar(`TEST_DB_NAME must not name the development database (${destino.database})`);
}

// A database name cannot be a driver parameter, so it is quoted as an identifier instead.
const mantenimiento = new pg.Client({ ...destino, database: 'postgres' });
try {
  await mantenimiento.connect();
  const { rowCount } = await mantenimiento.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    destino.database,
  ]);
  if (rowCount === 0) {
    await mantenimiento.query(`CREATE DATABASE ${mantenimiento.escapeIdentifier(destino.database)}`);
    console.log(`test:db: created ${destino.database}`);
  }
} catch (error) {
  fallar(`cannot prepare ${destino.database} on ${destino.host}:${destino.port} (${error.code ?? error.name})`);
} finally {
  await mantenimiento.end().catch(() => {});
}

const url =
  `postgresql://${encodeURIComponent(destino.user)}:${encodeURIComponent(destino.password)}` +
  `@${destino.host}:${destino.port}/${encodeURIComponent(destino.database)}`;

function correr(comando, entorno) {
  const resultado = spawnSync(comando, { stdio: 'inherit', shell: true, env: { ...process.env, ...entorno } });
  return resultado.status ?? 1;
}

if (correr('npx prisma migrate deploy', { DATABASE_URL: url }) !== 0) {
  fallar(`migrations failed on ${destino.database}`);
}

// DATABASE_URL too: many suites only default it (`??=`), so one already exported in the shell
// would otherwise keep pointing their Prisma client at the development database.
process.exit(
  correr('npx tsx --test "src/**/*.test.ts"', { TEST_DB_NAME: destino.database, DATABASE_URL: url }),
);
