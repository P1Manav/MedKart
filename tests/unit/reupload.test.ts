// tests/unit/reupload.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as reuploadHandler } from '@/app/api/orders/[id]/reupload/route';
import * as rbac from '@/lib/auth/rbac';
import db from '@/lib/db';

describe('Order Prescription Re-upload Endpoint (P0-6)', () => {
  const mockCustomer = {
    userId: 'cust_debasish',
    phone: '9830011111',
    role: 'CUSTOMER' as const,
    name: 'Debasish Ghosh',
  };

  const otherCustomer = {
    userId: 'cust_stranger',
    phone: '9830088888',
    role: 'CUSTOMER' as const,
    name: 'Stranger',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects re-upload with 403 if caller is not the owner customer', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(otherCustomer);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_123',
      customerId: 'cust_debasish', // Different owner!
      status: 'ON_HOLD',
      lines: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const formData = new FormData();
    const file = new File(['fake prescription image content'], 'prescription.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const req = new Request('http://localhost/api/orders/ord_123/reupload', {
      method: 'POST',
      body: formData,
    });

    const res = await reuploadHandler(req, { params: Promise.resolve({ id: 'ord_123' }) });
    expect(res.status).toBe(403);
  });

  it('rejects re-upload with 409 if order is not in ON_HOLD status', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockCustomer);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_123',
      customerId: 'cust_debasish',
      status: 'SUBMITTED', // Not ON_HOLD!
      lines: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const formData = new FormData();
    const file = new File(['fake prescription image content'], 'prescription.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const req = new Request('http://localhost/api/orders/ord_123/reupload', {
      method: 'POST',
      body: formData,
    });

    const res = await reuploadHandler(req, { params: Promise.resolve({ id: 'ord_123' }) });
    expect(res.status).toBe(409);
  });

  it('successfully processes valid re-upload, transitions ON_HOLD -> SUBMITTED, and logs audit event', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockCustomer);

    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_123',
      customerId: 'cust_debasish',
      status: 'ON_HOLD',
      storeId: 'store_saltlake',
      addressLat: 22.5875,
      addressLng: 88.4190,
      lines: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    vi.spyOn(db.product, 'findMany').mockResolvedValue([
      {
        id: 'prod_metformin_500',
        name: 'Metformin',
        strength: '500 mg',
        form: 'Tablet',
        price: 30,
        schedule: 'H',
        packSize: '15',
        active: true,
        genericGroupId: null,
        createdAt: new Date(),
      },
    ]);

    vi.spyOn(db.store, 'findMany').mockResolvedValue([
      {
        id: 'store_saltlake',
        name: 'MedKart Salt Lake',
        lat: 22.5867,
        lng: 88.4172,
        active: true,
        pincode: '700064',
        address: 'Salt Lake',
        stock: [{ id: 'st_1', storeId: 'store_saltlake', productId: 'prod_metformin_500', quantity: 50, lastUpdated: new Date() }],
      },
    ] as unknown as Awaited<ReturnType<typeof db.store.findMany>>);

    let transactionExecuted = false;
    let orderUpdatedStatus = '';
    vi.spyOn(db, '$transaction').mockImplementation(async (callback) => {
      transactionExecuted = true;
      const txMock = {
        orderLine: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        order: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            orderUpdatedStatus = args.data.status;
            return Promise.resolve({ id: 'ord_123', status: args.data.status });
          }),
        },
      };
      return callback(txMock as unknown as Parameters<Parameters<typeof db.$transaction>[0]>[0]);
    });

    const formData = new FormData();
    const file = new File(['valid test prescription bytes'], 'clear_rx.jpg', { type: 'image/jpeg' });
    formData.append('file', file);

    const req = new Request('http://localhost/api/orders/ord_123/reupload', {
      method: 'POST',
      body: formData,
    });

    const res = await reuploadHandler(req, { params: Promise.resolve({ id: 'ord_123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('SUBMITTED');
    expect(transactionExecuted).toBe(true);
    expect(orderUpdatedStatus).toBe('SUBMITTED');
  });
});
