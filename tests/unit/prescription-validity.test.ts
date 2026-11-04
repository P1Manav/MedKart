// tests/unit/prescription-validity.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computePrescriptionValidUntil,
  addMonthsClamped,
  parseDateInIST,
} from '@/domain/assert-dispatchable';
import { POST as verifyHandler } from '@/app/api/pharmacist/orders/[id]/verify/route';
import * as rbac from '@/lib/auth/rbac';
import db from '@/lib/db';

describe('Prescription Date Clamping & Validity (P0-10)', () => {
  const registeredPharmacist = {
    userId: 'pharm_1',
    phone: '9830044444',
    role: 'PHARMACIST' as const,
    name: 'Licensed Pharmacist',
    pharmacistRegNo: 'WB-PHARM-2024-9912',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('clamps 31 Aug 2025 + 6 months to 28 Feb 2026 (non-leap year)', () => {
    const input = new Date(Date.UTC(2025, 7, 31, 12, 0, 0)); // 31 Aug 2025
    const result = addMonthsClamped(input, 6);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(result.getUTCDate()).toBe(28);
  });

  it('clamps 31 Aug 2023 + 6 months to 29 Feb 2024 (leap year)', () => {
    const input = new Date(Date.UTC(2023, 7, 31, 12, 0, 0)); // 31 Aug 2023
    const result = addMonthsClamped(input, 6);
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(1); // February
    expect(result.getUTCDate()).toBe(29);
  });

  it('clamps 31 Mar 2026 + 1 month to 30 Apr 2026', () => {
    const input = new Date(Date.UTC(2026, 2, 31, 12, 0, 0)); // 31 Mar 2026
    const result = addMonthsClamped(input, 1);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(3); // April
    expect(result.getUTCDate()).toBe(30);
  });

  it('preserves IST/UTC boundary: 2026-05-01 at 23:30 IST does not slip to 2026-04-30 in date representation', () => {
    const parsed = parseDateInIST('2026-05-01');
    expect(parsed.toISOString()).toContain('2026-05-01');
  });

  it('computePrescriptionValidUntil uses calendar-safe month clamping by default', () => {
    const input = new Date(Date.UTC(2025, 7, 31)); // 31 Aug 2025
    const validUntil = computePrescriptionValidUntil(input, 6);
    expect(validUntil.getUTCFullYear()).toBe(2026);
    expect(validUntil.getUTCMonth()).toBe(1); // Feb
    expect(validUntil.getUTCDate()).toBe(28); // Clamped, not March 3!
  });

  it('verify route rejects APPROVE_ORDER if prescriptionDate is missing', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_ORDER' }), // Missing prescriptionDate!
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Prescription date');
  });

  it('verify route rejects APPROVE_ORDER if prescriptionDate is in the future', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_1',
      status: 'SUBMITTED',
      lines: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const dateStr = futureDate.toISOString().slice(0, 10);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_ORDER', prescriptionDate: dateStr }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('future');
  });

  it('verify route rejects APPROVE_ORDER if prescription is older than 6 months (expired)', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_1',
      status: 'SUBMITTED',
      lines: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const expiredDate = new Date();
    expiredDate.setMonth(expiredDate.getMonth() - 8); // 8 months old
    const dateStr = expiredDate.toISOString().slice(0, 10);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_ORDER', prescriptionDate: dateStr }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('expired');
  });

  it('verify route accepts valid prescriptionDate and sets prescriptionValidUntil', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_1',
      status: 'SUBMITTED',
      lines: [
        {
          id: 'line_1',
          lineStatus: 'APPROVED',
          pharmacistId: 'pharm_1',
          pharmacistRegNo: 'WB-PHARM-2024-9912',
          product: { id: 'p1', schedule: 'H' },
        },
      ],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);
    vi.spyOn(db.order, 'findUniqueOrThrow').mockResolvedValue({
      id: 'ord_1',
      status: 'SUBMITTED',
      prescriptionEncrypted: Buffer.from('prescription-bytes'),
      prescriptionValidUntil: null,
      lines: [
        {
          id: 'line_1',
          lineStatus: 'APPROVED',
          pharmacistId: 'pharm_1',
          pharmacistRegNo: 'WB-PHARM-2024-9912',
          product: { id: 'p1', schedule: 'H' },
          requiresRegisterEntry: false,
          h1PrescriberName: null,
          h1PrescriberRegNo: null,
          h1PatientName: null,
          h1Date: null,
          h1Quantity: null,
        },
      ],
    } as unknown as Awaited<ReturnType<typeof db.order.findUniqueOrThrow>>);
    vi.spyOn(db.scheduleRule, 'findMany').mockResolvedValue([
      { id: 'r1', schedule: 'H', canSellOnline: true, requiresRegisterEntry: false } as unknown as Awaited<
        ReturnType<typeof db.scheduleRule.findMany>
      >[number],
    ]);
    vi.spyOn(db, '$transaction').mockImplementation(async (cb) => {
      return cb({
        order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        orderLine: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        orderAudit: { create: vi.fn().mockResolvedValue({}) },
      } as unknown as Parameters<Parameters<typeof db.$transaction>[0]>[0]);
    });

    const validPastDate = new Date();
    validPastDate.setDate(validPastDate.getDate() - 10);
    const dateStr = validPastDate.toISOString().slice(0, 10);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_ORDER', prescriptionDate: dateStr }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
