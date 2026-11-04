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

    // Defensive setup: ensure ScheduleRules exist
    const ruleCount = await prisma.scheduleRule.count();
    if (ruleCount === 0) {
      await prisma.scheduleRule.createMany({
        data: [
          { schedule: 'OTC', canSellOnline: true, requiresPrescription: false, requiresPharmacistApproval: false, requiresRegisterEntry: false },
          { schedule: 'H', canSellOnline: true, requiresPrescription: true, requiresPharmacistApproval: true, requiresRegisterEntry: false },
          { schedule: 'H1', canSellOnline: true, requiresPrescription: true, requiresPharmacistApproval: true, requiresRegisterEntry: true },
          { schedule: 'X', canSellOnline: false, requiresPrescription: true, requiresPharmacistApproval: true, requiresRegisterEntry: false },
          { schedule: 'NARCOTIC', canSellOnline: false, requiresPrescription: true, requiresPharmacistApproval: true, requiresRegisterEntry: false },
        ],
        skipDuplicates: true,
      });
    }

    // Ensure store exists
    const storeCount = await prisma.store.count();
    if (storeCount === 0) {
      await prisma.store.create({
        data: {
          id: 'store_saltlake',
          name: 'MedKart Salt Lake',
          lat: 22.5867,
          lng: 88.4172,
          pincode: '700064',
          address: 'Sector 1, Salt Lake City',
        },
      });
    }

    // Ensure products exist for schedules H, H1, X
    const hProd = await prisma.product.findFirst({ where: { schedule: 'H' } });
    if (!hProd) {
      await prisma.product.create({
        data: {
          id: 'prod_metformin_500',
          name: 'Metformin 500 mg',
          strength: '500 mg',
          form: 'Tablet',
          packSize: 'Strip of 15',
          price: 30,
          schedule: 'H',
        },
      });
    }

    const h1Prod = await prisma.product.findFirst({ where: { schedule: 'H1' } });
    if (!h1Prod) {
      await prisma.product.create({
        data: {
          id: 'prod_alprazolam_05',
          name: 'Alprazolam 0.5 mg',
          strength: '0.5 mg',
          form: 'Tablet',
          packSize: 'Strip of 10',
          price: 45,
          schedule: 'H1',
        },
      });
    }

    const xProd = await prisma.product.findFirst({ where: { schedule: 'X' } });
    if (!xProd) {
      await prisma.product.create({
        data: {
          id: 'prod_methylphenidate_10',
          name: 'Methylphenidate 10 mg',
          strength: '10 mg',
          form: 'Tablet',
          packSize: 'Strip of 10',
          price: 120,
          schedule: 'X',
        },
      });
    }
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

    // Assert row immutability on rejected raw SQL update
    const unmodOrder = await prisma.order.findUniqueOrThrow({ where: { id: testId } });
    expect(unmodOrder.status).toBe('APPROVED');
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

    const unmodOrder = await prisma.order.findUniqueOrThrow({ where: { id: testId } });
    expect(unmodOrder.status).toBe('APPROVED');
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

    const unmodOrder = await prisma.order.findUniqueOrThrow({ where: { id: testId } });
    expect(unmodOrder.status).toBe('SUBMITTED');
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

    const unmodOrder = await prisma.order.findUniqueOrThrow({ where: { id: testId } });
    expect(unmodOrder.status).toBe('APPROVED');
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

    const unmodOrder = await prisma.order.findUniqueOrThrow({ where: { id: testId } });
    expect(unmodOrder.status).toBe('APPROVED');
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

    const unmodOrder = await prisma.order.findUniqueOrThrow({ where: { id: testId } });
    expect(unmodOrder.status).toBe('APPROVED');
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
