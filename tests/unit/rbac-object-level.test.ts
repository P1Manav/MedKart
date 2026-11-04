// tests/unit/rbac-object-level.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as imageHandler } from '@/app/api/prescription/[id]/image/route';
import { POST as verifyHandler } from '@/app/api/pharmacist/orders/[id]/verify/route';
import { POST as orderCreateHandler } from '@/app/api/orders/route';
import * as rbac from '@/lib/auth/rbac';
import * as cryptoModule from '@/lib/crypto/encrypt';
import * as auditLogModule from '@/lib/crypto/access-log';
import db from '@/lib/db';

describe('Object-Level Access Control & Verification Guards (P0-9)', () => {
  const customerA = {
    userId: 'cust_A',
    phone: '9830011111',
    role: 'CUSTOMER' as const,
    name: 'Customer A',
  };

  const storeStaffStore1 = {
    userId: 'staff_1',
    phone: '9830022222',
    role: 'STORE_STAFF' as const,
    name: 'Store Staff 1',
    storeId: 'store_salt_lake',
  };

  const opsUser = {
    userId: 'ops_1',
    phone: '9830099999',
    role: 'OPS' as const,
    name: 'Ops Officer',
  };

  const registeredPharmacist = {
    userId: 'pharm_1',
    phone: '9830044444',
    role: 'PHARMACIST' as const,
    name: 'Licensed Pharmacist',
    pharmacistRegNo: 'WB-PHARM-2024-9912',
  };

  const pharmacistNoReg = {
    userId: 'pharm_unregistered',
    phone: '9830033333',
    role: 'PHARMACIST' as const,
    name: 'Unregistered Pharmacist',
    pharmacistRegNo: null, // Missing registration number!
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditLogModule, 'logPrescriptionAccess').mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof auditLogModule.logPrescriptionAccess>>
    );
  });

  // ── 1. PRESCRIPTION IMAGE ROUTE OBJECT-LEVEL RBAC ───────────────────────

  it('image route returns 403 when Customer A tries to access Customer B prescription image', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(customerA);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_b',
      customerId: 'cust_B', // Belongs to Customer B!
      storeId: 'store_salt_lake',
      status: 'SUBMITTED',
      prescriptionEncrypted: Buffer.from('bytes'),
      prescriptionIv: Buffer.from('iv1234567890'),
      prescriptionAuthTag: Buffer.from('tag1234567890123'),
      prescriptionMime: 'image/jpeg',
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request('http://localhost/api/prescription/ord_b/image');
    const res = await imageHandler(req, { params: Promise.resolve({ id: 'ord_b' }) });
    expect(res.status).toBe(403);
  });

  it('image route returns 403 when Store Staff tries to view an order routed to a different store', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(storeStaffStore1);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_behala',
      customerId: 'cust_B',
      storeId: 'store_behala', // Different store!
      status: 'APPROVED',
      prescriptionEncrypted: Buffer.from('bytes'),
      prescriptionIv: Buffer.from('iv1234567890'),
      prescriptionAuthTag: Buffer.from('tag1234567890123'),
      prescriptionMime: 'image/jpeg',
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request('http://localhost/api/prescription/ord_behala/image');
    const res = await imageHandler(req, { params: Promise.resolve({ id: 'ord_behala' }) });
    expect(res.status).toBe(403);
  });

  it('image route returns 403 when Store Staff tries to view an order in SUBMITTED state (before approval)', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(storeStaffStore1);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_sub',
      customerId: 'cust_B',
      storeId: 'store_salt_lake',
      status: 'SUBMITTED', // Not APPROVED or later!
      prescriptionEncrypted: Buffer.from('bytes'),
      prescriptionIv: Buffer.from('iv1234567890'),
      prescriptionAuthTag: Buffer.from('tag1234567890123'),
      prescriptionMime: 'image/jpeg',
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request('http://localhost/api/prescription/ord_sub/image');
    const res = await imageHandler(req, { params: Promise.resolve({ id: 'ord_sub' }) });
    expect(res.status).toBe(403);
  });

  it('image route returns 200 when Store Staff views an order routed to their store in APPROVED state', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(storeStaffStore1);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_app',
      customerId: 'cust_B',
      storeId: 'store_salt_lake',
      status: 'APPROVED',
      prescriptionEncrypted: Buffer.from('bytes'),
      prescriptionIv: Buffer.from('iv1234567890'),
      prescriptionAuthTag: Buffer.from('tag1234567890123'),
      prescriptionMime: 'image/jpeg',
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);
    vi.spyOn(cryptoModule, 'decryptPrescription').mockReturnValue(Buffer.from('decrypted-image'));

    const req = new Request('http://localhost/api/prescription/ord_app/image');
    const res = await imageHandler(req, { params: Promise.resolve({ id: 'ord_app' }) });
    expect(res.status).toBe(200);
  });

  // ── 2. PHARMACIST VERIFICATION RBAC & LICENSE CHECK ──────────────────────

  it('verify route rejects OPS role with 403 (pharmacist verification is strictly reserved for PHARMACIST)', async () => {
    vi.spyOn(rbac, 'requireAuth').mockImplementation(async (allowedRoles) => {
      if (allowedRoles && !allowedRoles.includes('OPS')) {
        throw new rbac.AuthorizationError('Access denied: Role OPS is not authorized.');
      }
      return opsUser;
    });

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_ORDER' }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(403);
  });

  it('verify route rejects pharmacist without valid registration number with 403 (no fallback allowed)', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(pharmacistNoReg);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_ORDER' }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(403);
  });

  // ── 3. VERIFICATION LINE GUARDS & CONCURRENCY ───────────────────────────

  it('verify route rejects APPROVE_LINE with 409 if productId is null (unmatched line)', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_1',
      status: 'SUBMITTED',
      lines: [{ id: 'line_unmatched', productId: null, lineStatus: 'PENDING' }],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);
    vi.spyOn(db.scheduleRule, 'findMany').mockResolvedValue([]);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_LINE', lineId: 'line_unmatched' }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('unmatched line');
  });

  it('verify route rejects line actions with 404 if lineId does not belong to order', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_1',
      status: 'SUBMITTED',
      lines: [{ id: 'line_1', productId: 'p1', lineStatus: 'PENDING' }],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);
    vi.spyOn(db.scheduleRule, 'findMany').mockResolvedValue([]);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_LINE', lineId: 'non_existent_line' }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(404);
  });

  it('verify route returns 409 Conflict if order is no longer in SUBMITTED status', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_already_approved',
      status: 'APPROVED', // Already verified!
      lines: [{ id: 'line_1', productId: 'p1', lineStatus: 'APPROVED' }],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_already_approved/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE_ORDER' }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_already_approved' }) });
    expect(res.status).toBe(409);
  });

  it('verify route supports ADD_LINE manual entry and blocks Schedule X items', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(registeredPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_1',
      status: 'SUBMITTED',
      lines: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);
    vi.spyOn(db.scheduleRule, 'findMany').mockResolvedValue([
      { id: 'sr_x', schedule: 'X', canSellOnline: false } as unknown as Awaited<
        ReturnType<typeof db.scheduleRule.findMany>
      >[number],
    ]);
    vi.spyOn(db.product, 'findUnique').mockResolvedValue({
      id: 'prod_x',
      name: 'Ketamine',
      schedule: 'X',
      price: 500,
    } as unknown as Awaited<ReturnType<typeof db.product.findUnique>>);

    const req = new Request('http://localhost/api/pharmacist/orders/ord_1/verify', {
      method: 'POST',
      body: JSON.stringify({ action: 'ADD_LINE', productId: 'prod_x', quantity: 1 }),
    });

    const res = await verifyHandler(req, { params: Promise.resolve({ id: 'ord_1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('cannot be ordered online');
  });

  // ── 4. ORDER CREATION FAMILY PROFILE OWNERSHIP CHECK ───────────────────

  it('order creation rejects with 403 if familyProfileId belongs to another user', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(customerA);
    vi.spyOn(db.familyProfile, 'findUnique').mockResolvedValue({
      id: 'fam_other',
      userId: 'cust_B', // Belongs to customer B!
    } as unknown as Awaited<ReturnType<typeof db.familyProfile.findUnique>>);

    const form = new FormData();
    form.append('familyProfileId', 'fam_other');
    form.append('prescription', new File(['dummy'], 'rx.jpg', { type: 'image/jpeg' }));

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      body: form,
    });

    const res = await orderCreateHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('access denied');
  });
});
