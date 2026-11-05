// prisma/seed-reset.ts
import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      '⚠️  WARNING: This will delete ALL data in the database and re-seed from scratch.\nAre you sure you want to proceed? (yes/no): ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'yes');
      }
    );
  });
}

async function reset() {
  const isYes =
    process.argv.includes('--force') ||
    process.argv.includes('--yes') ||
    process.argv.includes('-y') ||
    process.env.CI === 'true' ||
    (await confirmReset());
  if (!isYes) {
    console.log('Seed reset cancelled.');
    process.exit(0);
  }

  console.log('🗑️  Cleaning existing database tables...');
  await prisma.orderAudit.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.prescriptionAccessLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.refillTracker.deleteMany();
  await prisma.messageOutbox.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.genericSubstitute.deleteMany();
  await prisma.storeStock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.familyProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.otpRecord.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.scheduleRule.deleteMany();
  await prisma.pincodeCoord.deleteMany();

  console.log('✅ Tables cleaned. Now re-running seed...');
  await import('./seed');
}

reset()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  });
