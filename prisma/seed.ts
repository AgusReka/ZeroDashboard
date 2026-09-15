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

async function main(): Promise<void> {
  const count = await prisma.tenant.count();
  if (count > 0) {
    console.log(`Seed skipped: ${count} tenant row(s) already present.`);
    return;
  }

  const tenant = await prisma.tenant.create({ data: { nombre: 'Food Store' } });
  console.log(`Seed: created tenant "${tenant.nombre}" (${tenant.id}).`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
