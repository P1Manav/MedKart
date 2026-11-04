// tests/integration/db-trigger.test.ts
// Real database integration test verifying the PostgreSQL BEFORE UPDATE trigger
// Defense in Depth Layer 2 (Spec §5.2, Master Prompt v2 P0-2)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Postgres Dispatch Guard Trigger (Real PostgreSQL Integration)', () => {
  let prisma: PrismaClient;
  const isDbAvailable = Boolean(process.env.DATABASE_URL);

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not set. Real database tests require an accessible PostgreSQL instance.'
      );
    }
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('fails loudly if DATABASE_URL is unset', () => {
    expect(isDbAvailable).toBe(true);
  });

  it('rejects raw SQL status transition to PACKED when prescription is missing', async () => {
    const testId = `trg_test_nopres_${Date.now()}`;
    const customer = await prisma.user.create({
      data: { phone: `91${Date.now().toString().slice(-8)}`, name: 'Test Customer', role: 'CUSTOMER' },
    });
    const store = await prisma.store.findFirstOrThrow();
    const product = await prisma.product.findFirstOrThrow({ where: { schedule: 'H' } });

    await prisma.order.create({
      data: {
        id: testId,
        displayId: `RX-TRG-${Date.now().toString().slice(-5)}`,
        customerId: customer.id,
        storeId: store.id,
        status: 'APPROVED',
        prescriptionEncrypted: null, // Missing!
        prescriptionValidUntil: new Date('2028-12-31'),
        addressText: 'Kolkata Test Address',
        lines: {
          create: {
            productId: product.id,
            lineStatus: 'APPROVED',
            quantity: 1,
            pharmacistId: customer.id,
            pharmacistRegNo: 'WB-PHARM-2024-TEST',
          },
        },
      },
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE orders SET status = 'PACKED' WHERE id = '${testId}'`)
    ).rejects.toThrow(/Prescription image is missing/);
  });

  it('rejects raw SQL status transition to PACKED when prescription is expired', async () => {
    const testId = `trg_test_exp_${Date.now()}`;
    const customer = await prisma.user.create({
      data: { phone: `92${Date.now().toString().slice(-8)}`, name: 'Test Customer', role: 'CUSTOMER' },
    });
    const store = await prisma.store.findFirstOrThrow();
    const product = await prisma.product.findFirstOrThrow({ where: { schedule: 'H' } });

    await prisma.order.create({
      data: {
        id: testId,
        displayId: `RX-TRG-${Date.now().toString().slice(-5)}`,
        customerId: customer.id,
        storeId: store.id,
        status: 'APPROVED',
        prescriptionEncrypted: Buffer.from('test_prescription'),
        prescriptionValidUntil: new Date('2020-01-01'), // Expired!
        addressText: 'Kolkata Test Address',
        lines: {
          create: {
            productId: product.id,
            lineStatus: 'APPROVED',
            quantity: 1,
            pharmacistId: customer.id,
            pharmacistRegNo: 'WB-PHARM-2024-TEST',
          },
        },
      },
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE orders SET status = 'PACKED' WHERE id = '${testId}'`)
    ).rejects.toThrow(/Prescription is expired or invalid/);
  });

  it('rejects raw SQL status transition to PACKED when an active line is PENDING', async () => {
    const testId = `trg_test_pending_${Date.now()}`;
    const customer = await prisma.user.create({
      data: { phone: `93${Date.now().toString().slice(-8)}`, name: 'Test Customer', role: 'CUSTOMER' },
    });
    const store = await prisma.store.findFirstOrThrow();
    const product = await prisma.product.findFirstOrThrow({ where: { schedule: 'H' } });

    await prisma.order.create({
      data: {
        id: testId,
        displayId: `RX-TRG-${Date.now().toString().slice(-5)}`,
        customerId: customer.id,
        storeId: store.id,
        status: 'SUBMITTED',
        prescriptionEncrypted: Buffer.from('test_prescription'),
        prescriptionValidUntil: new Date('2028-12-31'),
        addressText: 'Kolkata Test Address',
        lines: {
          create: {
            productId: product.id,
            lineStatus: 'PENDING', // Unapproved!
            quantity: 1,
          },
        },
      },
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE orders SET status = 'PACKED' WHERE id = '${testId}'`)
    ).rejects.toThrow(/lack valid pharmacist approval/);
  });

  it('rejects raw SQL status transition to PACKED when pharmacist registration is missing', async () => {
    const testId = `trg_test_noreg_${Date.now()}`;
    const customer = await prisma.user.create({
      data: { phone: `94${Date.now().toString().slice(-8)}`, name: 'Test Customer', role: 'CUSTOMER' },
    });
    const store = await prisma.store.findFirstOrThrow();
    const product = await prisma.product.findFirstOrThrow({ where: { schedule: 'H' } });

    await prisma.order.create({
      data: {
        id: testId,
        displayId: `RX-TRG-${Date.now().toString().slice(-5)}`,
        customerId: customer.id,
        storeId: store.id,
        status: 'APPROVED',
        prescriptionEncrypted: Buffer.from('test_prescription'),
        prescriptionValidUntil: new Date('2028-12-31'),
        addressText: 'Kolkata Test Address',
        lines: {
          create: {
            productId: product.id,
            lineStatus: 'APPROVED',
            quantity: 1,
            pharmacistId: customer.id,
            pharmacistRegNo: null, // Missing reg no!
          },
        },
      },
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE orders SET status = 'PACKED' WHERE id = '${testId}'`)
    ).rejects.toThrow(/lack valid pharmacist approval/);
  });

  it('rejects raw SQL status transition to PACKED when Schedule H1 line lacks register details', async () => {
    const testId = `trg_test_noh1_${Date.now()}`;
    const customer = await prisma.user.create({
      data: { phone: `95${Date.now().toString().slice(-8)}`, name: 'Test Customer', role: 'CUSTOMER' },
    });
    const store = await prisma.store.findFirstOrThrow();
    const h1Product = await prisma.product.findFirstOrThrow({ where: { schedule: 'H1' } });

    await prisma.order.create({
      data: {
        id: testId,
        displayId: `RX-TRG-${Date.now().toString().slice(-5)}`,
        customerId: customer.id,
        storeId: store.id,
        status: 'APPROVED',
        prescriptionEncrypted: Buffer.from('test_prescription'),
        prescriptionValidUntil: new Date('2028-12-31'),
        addressText: 'Kolkata Test Address',
        lines: {
          create: {
            productId: h1Product.id,
            lineStatus: 'APPROVED',
            quantity: 1,
            pharmacistId: customer.id,
            pharmacistRegNo: 'WB-PHARM-2024-TEST',
            // Missing all mandatory H1 register columns!
            h1PrescriberName: null,
            h1PrescriberRegNo: null,
            h1PatientName: null,
            h1Date: null,
            h1Quantity: null,
          },
        },
      },
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE orders SET status = 'PACKED' WHERE id = '${testId}'`)
    ).rejects.toThrow(/Schedule H1 line\(s\) missing mandatory register entry/);
  });

  it('rejects raw SQL status transition to PACKED when a Schedule X line is approved', async () => {
    const testId = `trg_test_x_${Date.now()}`;
    const customer = await prisma.user.create({
      data: { phone: `96${Date.now().toString().slice(-8)}`, name: 'Test Customer', role: 'CUSTOMER' },
    });
    const store = await prisma.store.findFirstOrThrow();
    const xProduct = await prisma.product.findFirstOrThrow({ where: { schedule: 'X' } });

    await prisma.order.create({
      data: {
        id: testId,
        displayId: `RX-TRG-${Date.now().toString().slice(-5)}`,
        customerId: customer.id,
        storeId: store.id,
        status: 'APPROVED',
        prescriptionEncrypted: Buffer.from('test_prescription'),
        prescriptionValidUntil: new Date('2028-12-31'),
        addressText: 'Kolkata Test Address',
        lines: {
          create: {
            productId: xProduct.id,
            lineStatus: 'APPROVED', // Force-approved Schedule X line!
            quantity: 1,
            pharmacistId: customer.id,
            pharmacistRegNo: 'WB-PHARM-2024-TEST',
          },
        },
      },
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE orders SET status = 'PACKED' WHERE id = '${testId}'`)
    ).rejects.toThrow(/cannot be sold online/);
  });

  it('permits raw SQL status transition to PACKED when all safety criteria are satisfied', async () => {
    const testId = `trg_test_valid_${Date.now()}`;
    const customer = await prisma.user.create({
      data: { phone: `97${Date.now().toString().slice(-8)}`, name: 'Test Customer', role: 'CUSTOMER' },
    });
    const store = await prisma.store.findFirstOrThrow();
    const product = await prisma.product.findFirstOrThrow({ where: { schedule: 'H' } });

    await prisma.order.create({
      data: {
        id: testId,
        displayId: `RX-TRG-${Date.now().toString().slice(-5)}`,
        customerId: customer.id,
        storeId: store.id,
        status: 'APPROVED',
        prescriptionEncrypted: Buffer.from('test_prescription'),
        prescriptionValidUntil: new Date('2028-12-31'),
        addressText: 'Kolkata Test Address',
        lines: {
          create: {
            productId: product.id,
            lineStatus: 'APPROVED',
            quantity: 1,
            pharmacistId: customer.id,
            pharmacistRegNo: 'WB-PHARM-2024-TEST',
          },
        },
      },
    });

    const affected = await prisma.$executeRawUnsafe(
      `UPDATE orders SET status = 'PACKED' WHERE id = '${testId}'`
    );
    expect(affected).toBe(1);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: testId } });
    expect(updated.status).toBe('PACKED');
  });
});
