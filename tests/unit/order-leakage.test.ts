// tests/unit/order-leakage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as getOrdersHandler } from '@/app/api/orders/route';
import { GET as getOrderByIdHandler } from '@/app/api/orders/[id]/route';
import * as rbac from '@/lib/auth/rbac';
import db from '@/lib/db';

describe('Order Data Exposure & Blob Leakage Prevention (P0-8)', () => {
  const mockPharmacist = {
    userId: 'pharm_sunita',
    phone: '9830044444',
    role: 'PHARMACIST' as const,
    name: 'Sunita Sharma',
    pharmacistRegNo: 'WB-PHARM-2024-4102',
  };

  const sampleOrderInDb = {
    id: 'ord_leak_test_1',
    displayId: 'RX-50211',
    status: 'SUBMITTED',
    prescriptionStatus: 'PENDING',
    addressText: 'Salt Lake',
    createdAt: new Date(),
    manualEntryNeeded: false,
    prescriptionEncrypted: Buffer.from('secret_encrypted_data'),
    prescriptionIv: Buffer.from('123456789012'),
    prescriptionAuthTag: Buffer.from('1234567890123456'),
    customer: { id: 'cust_1', name: 'Debasish', phone: '9830011111' },
    lines: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/orders NEVER leaks prescriptionEncrypted, prescriptionIv, or prescriptionAuthTag in its response', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockPharmacist);
    vi.spyOn(db.order, 'findMany').mockResolvedValue([
      {
        id: sampleOrderInDb.id,
        displayId: sampleOrderInDb.displayId,
        status: sampleOrderInDb.status,
        prescriptionStatus: sampleOrderInDb.prescriptionStatus,
        addressText: sampleOrderInDb.addressText,
        createdAt: sampleOrderInDb.createdAt,
        manualEntryNeeded: sampleOrderInDb.manualEntryNeeded,
        customer: { id: 'cust_1', name: 'Debasish' },
        lines: [],
      },
    ] as unknown as Awaited<ReturnType<typeof db.order.findMany>>);

    const req = new Request('http://localhost/api/orders');
    const res = await getOrdersHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.orders).toHaveLength(1);

    const returnedOrder = body.orders[0];
    expect(returnedOrder).not.toHaveProperty('prescriptionEncrypted');
    expect(returnedOrder).not.toHaveProperty('prescriptionIv');
    expect(returnedOrder).not.toHaveProperty('prescriptionAuthTag');
    if (returnedOrder.customer) {
      expect(returnedOrder.customer).not.toHaveProperty('phone');
    }
  });

  it('GET /api/orders/[id] NEVER leaks encrypted blobs in its response', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockPharmacist);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: sampleOrderInDb.id,
      displayId: sampleOrderInDb.displayId,
      status: sampleOrderInDb.status,
      prescriptionStatus: sampleOrderInDb.prescriptionStatus,
      addressText: sampleOrderInDb.addressText,
      createdAt: sampleOrderInDb.createdAt,
      manualEntryNeeded: sampleOrderInDb.manualEntryNeeded,
      customerId: 'cust_1',
      customer: { id: 'cust_1', name: 'Debasish' },
      lines: [],
      auditEvents: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request(`http://localhost/api/orders/${sampleOrderInDb.id}`);
    const res = await getOrderByIdHandler(req, { params: Promise.resolve({ id: sampleOrderInDb.id }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.order).not.toHaveProperty('prescriptionEncrypted');
    expect(body.order).not.toHaveProperty('prescriptionIv');
    expect(body.order).not.toHaveProperty('prescriptionAuthTag');
  });
});
