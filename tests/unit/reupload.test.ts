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
});
