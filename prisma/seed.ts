import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const adapter = new PrismaPg({ connectionString: requiredEnv('DATABASE_URL') });
const prisma = new PrismaClient({ adapter });

/**
 * Since CH-06 this seed is a convenience, not a precondition. No code path depends on
 * a `Tenant` row existing any more: the active tenant is named by each request and
 * validated before any handler runs (DEC-15), so an empty table answers `404
 * tenant-no-encontrado` rather than the `503 tenant-no-inicializado` CH-03 and CH-05
 * used to raise — that response is gone. The row is created only so a fresh database
 * gives the console something to select in its tenant picker on first load.
 */
async function main(): Promise<void> {
  const count = await prisma.tenant.count();
  if (count > 0) {
    console.log(`Seed skipped: ${count} tenant row(s) already present.`);
    return;
  }

  const tenant = await prisma.tenant.create({ data: { nombre: 'Food Store' } });
  console.log(
    `Seed: created tenant "${tenant.nombre}" (${tenant.id}). ` +
      'It is selectable in the console; nothing depends on it existing.',
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
