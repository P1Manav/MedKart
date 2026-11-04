// tests/unit/idor-protection.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as createOrderHandler } from '@/app/api/orders/route';
import { POST as reuploadHandler } from '@/app/api/orders/[id]/reupload/route';
import { GET as getOrderHandler } from '@/app/api/orders/[id]/route';
import * as rbac from '@/lib/auth/rbac';
import db from '@/lib/db';

describe('IDOR & Foreign-Key Integrity Protection (P0-10, Fix #10)', () => {
  const customerA = {
    userId: 'cust_alice',
    phone: '9830011111',
    role: 'CUSTOMER' as const,
    name: 'Alice',
  };

  const customerB = {
    userId: 'cust_bob',
    phone: '9830022222',
    role: 'CUSTOMER' as const,
    name: 'Bob',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects order creation with 403 when familyProfileId belongs to a different customer', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(customerA);
    vi.spyOn(db.familyProfile, 'findUnique').mockResolvedValue({
      id: 'fam_bob_mother',
      userId: customerB.userId, // Belongs to customer B!
      name: 'Bob Mother',
      relationship: 'Mother',
      createdAt: new Date(),
    });

    const formData = new FormData();
    formData.append('familyProfileId', 'fam_bob_mother');
    formData.append('addressText', 'Salt Lake Sector 1, Kolkata');
    formData.append('paymentMethod', 'COD');
    const file = new File(['dummy bytes'], 'rx.jpg', { type: 'image/jpeg' });
    formData.append('prescription', file);

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      body: formData,
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid family profile or access denied/i);
  });

  it('rejects order creation with 403 when familyProfileId does not exist', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(customerA);
    vi.spyOn(db.familyProfile, 'findUnique').mockResolvedValue(null);

    const formData = new FormData();
    formData.append('familyProfileId', 'fam_nonexistent');
    formData.append('addressText', 'Salt Lake Sector 1, Kolkata');
    formData.append('paymentMethod', 'COD');
    const file = new File(['dummy bytes'], 'rx.jpg', { type: 'image/jpeg' });
    formData.append('prescription', file);

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      body: formData,
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid family profile or access denied/i);
  });

  it('rejects order creation with 400 when a cart item product does not exist in the active catalogue', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(customerA);
    vi.spyOn(db.product, 'findMany').mockResolvedValue([]); // No matching products

    const formData = new FormData();
    formData.append('addressText', 'Salt Lake Sector 1, Kolkata');
    formData.append('paymentMethod', 'COD');
    formData.append('cartItems', JSON.stringify([{ productId: 'prod_fake_id', quantity: 1 }]));
    const file = new File(['dummy bytes'], 'rx.jpg', { type: 'image/jpeg' });
    formData.append('prescription', file);

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      body: formData,
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not found in the active catalogue/i);
  });

  it('rejects re-upload with 403 when customer tries to re-upload on another customer order', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(customerA);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_bob_123',
      customerId: 'cust_bob', // Order owned by Bob
      status: 'ON_HOLD',
      lines: [],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const formData = new FormData();
    const file = new File(['dummy image'], 'rx.png', { type: 'image/png' });
    formData.append('file', file);

    const req = new Request('http://localhost/api/orders/ord_bob_123/reupload', {
      method: 'POST',
      body: formData,
    });

    const res = await reuploadHandler(req, { params: Promise.resolve({ id: 'ord_bob_123' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it('rejects order lookup with 403 when customer tries to access another customer order', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(customerA);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_bob_123',
      displayId: 'RX-50212',
      customerId: 'cust_bob', // Order owned by Bob
      status: 'SUBMITTED',
      storeId: 'store_1',
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request('http://localhost/api/orders/ord_bob_123');
    const res = await getOrderHandler(req, { params: Promise.resolve({ id: 'ord_bob_123' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it('rejects store staff access with 403 when order is routed to a different store', async () => {
    const storeStaff = {
      userId: 'staff_saltlake',
      phone: '9830099999',
      role: 'STORE_STAFF' as const,
      name: 'Salt Lake Staff',
      storeId: 'store_saltlake',
    };
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(storeStaff);
    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_456',
      displayId: 'RX-50215',
      customerId: 'cust_charlie',
      status: 'APPROVED',
      storeId: 'store_behala', // Routed to Behala, not Salt Lake!
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request('http://localhost/api/orders/ord_456');
    const res = await getOrderHandler(req, { params: Promise.resolve({ id: 'ord_456' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not routed to your store/i);
  });
});
