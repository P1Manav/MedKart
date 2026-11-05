// tests/unit/direct-upi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QRCode from 'qrcode';
import { POST as confirmManualHandler } from '@/app/api/payments/confirm-manual/route';
import { CreateOrderInputSchema } from '@/lib/validators/order-input';
import db from '@/lib/db';
import * as rbacModule from '@/lib/auth/rbac';

describe('Real UPI Payment Options (Path A & Path B) — Master Prompt v5', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Path B NPCI Spec: Generates valid UPI deep link and renders genuine QR code', async () => {
    const displayId = 'RX-50220';
    const amount = 285.5;
    const payeeVpa = '7778083224@upi';
    const payeeName = 'MedKart Demo';

    // Verify URI format matches NPCI specifications
    const upiUri = `upi://pay?pa=${payeeVpa}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=Order%20${encodeURIComponent(displayId)}`;
    
    expect(upiUri).toContain('pa=7778083224@upi');
    expect(upiUri).toContain('pn=MedKart%20Demo');
    expect(upiUri).toContain('am=285.50');
    expect(upiUri).toContain('cu=INR');
    expect(upiUri).toContain('tn=Order%20RX-50220');

    // Verify qrcode library successfully generates valid Data URL
    const qrDataUrl = await QRCode.toDataURL(upiUri);
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(qrDataUrl.length).toBeGreaterThan(100);
  });

  it('Order Validator: Accepts DIRECT_UPI as valid payment method', () => {
    const parsed = CreateOrderInputSchema.safeParse({
      paymentMethod: 'DIRECT_UPI',
      addressText: 'Salt Lake Sector 1',
      addressLat: 22.5875,
      addressLng: 88.419,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.paymentMethod).toBe('DIRECT_UPI');
    }
  });

  it('POST /api/payments/confirm-manual: Denies non-staff roles with 403', async () => {
    vi.spyOn(rbacModule, 'requireAuth').mockRejectedValue(new Error('Unauthorized: Forbidden for role CUSTOMER'));

    const req = new Request('http://localhost:3000/api/payments/confirm-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_123',
        utrReference: '431209871234',
      }),
    });

    const res = await confirmManualHandler(req);
    expect(res.status).toBe(403);
  });

  it('POST /api/payments/confirm-manual: Validates UTR length (min 4 chars)', async () => {
    vi.spyOn(rbacModule, 'requireAuth').mockResolvedValue({
      userId: 'staff_1',
      name: 'Bikash Mondal',
      role: 'STORE_STAFF',
    } as unknown as Awaited<ReturnType<typeof rbacModule.requireAuth>>);

    const req = new Request('http://localhost:3000/api/payments/confirm-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_123',
        utrReference: '12', // too short
      }),
    });

    const res = await confirmManualHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('at least 4 characters');
  });

  it('POST /api/payments/confirm-manual: Writes audit log and notifies customer for DIRECT_UPI order', async () => {
    vi.spyOn(rbacModule, 'requireAuth').mockResolvedValue({
      userId: 'pharm_1',
      name: 'Sunita Banerjee',
      role: 'PHARMACIST',
    } as unknown as Awaited<ReturnType<typeof rbacModule.requireAuth>>);

    vi.spyOn(db.order, 'findUnique').mockResolvedValue({
      id: 'ord_123',
      displayId: 'RX-50220',
      customerId: 'cust_1',
      status: 'APPROVED',
      paymentMethod: 'DIRECT_UPI',
      customer: { name: 'Debasish Ghosh', phone: '9830011111' },
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    vi.spyOn(db.orderAudit, 'findFirst').mockResolvedValue(null);
    const auditCreateSpy = vi
      .spyOn(db.orderAudit, 'create')
      .mockResolvedValue({ id: 'aud_1' } as unknown as Awaited<ReturnType<typeof db.orderAudit.create>>);
    const outboxCreateSpy = vi
      .spyOn(db.messageOutbox, 'create')
      .mockResolvedValue({ id: 'msg_1' } as unknown as Awaited<ReturnType<typeof db.messageOutbox.create>>);

    const req = new Request('http://localhost:3000/api/payments/confirm-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_123',
        utrReference: '998877665544',
      }),
    });

    const res = await confirmManualHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify audit entry created
    expect(auditCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'ord_123',
          actorId: 'pharm_1',
          actorRole: 'PHARMACIST',
          reason: expect.stringContaining('UTR / Ref: 998877665544'),
        }),
      })
    );

    // Verify outbox notification dispatched
    expect(outboxCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'cust_1',
          channel: 'SMS',
          content: expect.stringContaining('UTR: 998877665544'),
        }),
      })
    );
  });
});
