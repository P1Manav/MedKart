// tests/unit/direct-upi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QRCode from 'qrcode';
import { POST as confirmManualHandler } from '@/app/api/payments/confirm-manual/route';
import { POST as submitUtrHandler } from '@/app/api/payments/submit-utr/route';
import { CreateOrderInputSchema } from '@/lib/validators/order-input';
import { getUpiConfig, buildUpiUri } from '@/lib/payments/upi-config';
import db from '@/lib/db';
import * as rbacModule from '@/lib/auth/rbac';

describe('Real UPI Payment Options (Path A & Path B) — Hardening Pass', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('Configurable Payee: Hides Direct UPI when UPI_PAYEE_VPA is unset, enables when set', () => {
    delete process.env.UPI_PAYEE_VPA;
    expect(getUpiConfig().enabled).toBe(false);
    expect(getUpiConfig().payeeVpa).toBeNull();

    process.env.UPI_PAYEE_VPA = 'merchant@okbank';
    process.env.UPI_PAYEE_NAME = 'MedKart Official Store';
    process.env.UPI_MAX_AMOUNT_INR = '150';

    const cfg = getUpiConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.payeeVpa).toBe('merchant@okbank');
    expect(cfg.payeeName).toBe('MedKart Official Store');
    expect(cfg.maxAmountInr).toBe(150);
  });

  it('Path B NPCI Spec: Generates valid UPI deep link with tr=<order id> and tn=<display id>', async () => {
    const orderId = 'ord_cuid_98765';
    const displayId = 'RX-50220';
    const amount = 85.5;
    const payeeVpa = 'demo_rx@bank';
    const payeeName = 'MedKart Pharmacy';

    const upiUri = buildUpiUri({
      payeeVpa,
      payeeName,
      amount,
      orderId,
      displayId,
    });

    expect(upiUri).toContain('pa=demo_rx%40bank');
    expect(upiUri).toContain('pn=MedKart%20Pharmacy');
    expect(upiUri).toContain('am=85.50');
    expect(upiUri).toContain('cu=INR');
    expect(upiUri).toContain('tr=ord_cuid_98765');
    expect(upiUri).toContain('tn=Order%20RX-50220');

    // Verify qrcode library successfully generates valid Data URL
    const qrDataUrl = await QRCode.toDataURL(upiUri);
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(qrDataUrl.length).toBeGreaterThan(100);
  });

  it('Order Validator: Requires explicit voluntary consent for DIRECT_UPI', () => {
    // Missing consent -> fails validation
    const invalid = CreateOrderInputSchema.safeParse({
      paymentMethod: 'DIRECT_UPI',
      directUpiConsent: false,
      addressText: 'Salt Lake Sector 1',
      addressLat: 22.5875,
      addressLng: 88.419,
    });
    expect(invalid.success).toBe(false);

    // Consent true -> passes validation
    const valid = CreateOrderInputSchema.safeParse({
      paymentMethod: 'DIRECT_UPI',
      directUpiConsent: true,
      addressText: 'Salt Lake Sector 1',
      addressLat: 22.5875,
      addressLng: 88.419,
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.paymentMethod).toBe('DIRECT_UPI');
      expect(valid.data.directUpiConsent).toBe(true);
    }
  });

  it('POST /api/payments/submit-utr: Rejects non-12-digit UTR references', async () => {
    vi.spyOn(rbacModule, 'requireAuth').mockResolvedValue({
      userId: 'cust_1',
      role: 'CUSTOMER',
    } as unknown as Awaited<ReturnType<typeof rbacModule.requireAuth>>);

    for (const invalidUtr of ['123', '12345678901', '1234567890123', 'abcd12345678']) {
      const req = new Request('http://localhost:3000/api/payments/submit-utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'ord_123',
          utrReference: invalidUtr,
        }),
      });

      const res = await submitUtrHandler(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('12 numeric digits');
    }
  });

  it('POST /api/payments/submit-utr: Rejects duplicate UTR already used on another order', async () => {
    vi.spyOn(rbacModule, 'requireAuth').mockResolvedValue({
      userId: 'cust_1',
      role: 'CUSTOMER',
    } as unknown as Awaited<ReturnType<typeof rbacModule.requireAuth>>);

    vi.spyOn(db.order, 'findUnique').mockImplementation((async ({ where }: { where: { id?: string; utr?: string } }) => {
      if (where.id) {
        return { id: 'ord_123', customerId: 'cust_1', status: 'PAYMENT_PENDING_VERIFICATION' };
      }
      if (where.utr) {
        return { id: 'ord_OTHER', displayId: 'RX-99999', status: 'SUBMITTED', utr: '123456789012' };
      }
      return null;
    }) as never);

    const req = new Request('http://localhost:3000/api/payments/submit-utr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_123',
        utrReference: '123456789012',
      }),
    });

    const res = await submitUtrHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already been submitted for Order #RX-99999');
  });

  it('POST /api/payments/submit-utr: Rejects UTR used on a rejected order', async () => {
    vi.spyOn(rbacModule, 'requireAuth').mockResolvedValue({
      userId: 'cust_1',
      role: 'CUSTOMER',
    } as unknown as Awaited<ReturnType<typeof rbacModule.requireAuth>>);

    vi.spyOn(db.order, 'findUnique').mockImplementation((async ({ where }: { where: { id?: string; utr?: string } }) => {
      if (where.id) {
        return { id: 'ord_123', customerId: 'cust_1', status: 'PAYMENT_PENDING_VERIFICATION' };
      }
      if (where.utr) {
        return { id: 'ord_REJECTED', displayId: 'RX-88888', status: 'REJECTED', utr: '123456789012' };
      }
      return null;
    }) as never);

    const req = new Request('http://localhost:3000/api/payments/submit-utr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_123',
        utrReference: '123456789012',
      }),
    });

    const res = await submitUtrHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('used on a rejected order and cannot be reused');
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

  it('POST /api/payments/confirm-manual: Validates strict 12-digit UTR format', async () => {
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
        utrReference: '12345', // not 12 digits
      }),
    });

    const res = await confirmManualHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('12 numeric digits');
  });

  it('POST /api/payments/confirm-manual: Updates status to SUBMITTED and logs actorId in audit', async () => {
    vi.spyOn(rbacModule, 'requireAuth').mockResolvedValue({
      userId: 'pharm_1',
      name: 'Sunita Banerjee',
      role: 'PHARMACIST',
    } as unknown as Awaited<ReturnType<typeof rbacModule.requireAuth>>);

    vi.spyOn(db.order, 'findUnique').mockImplementation((async ({ where }: { where: { id?: string; utr?: string } }) => {
      if (where.id) {
        return {
          id: 'ord_123',
          displayId: 'RX-50220',
          customerId: 'cust_1',
          status: 'PAYMENT_PENDING_VERIFICATION',
          paymentMethod: 'DIRECT_UPI',
          customer: { name: 'Debasish Ghosh', phone: '9830011111' },
        };
      }
      if (where.utr) {
        return null; // Unique!
      }
      return null;
    }) as never);

    vi.spyOn(db.orderAudit, 'findFirst').mockResolvedValue(null);
    let capturedAuditData: Record<string, unknown> | null = null;

    vi.spyOn(db, '$transaction').mockImplementation((async (callback: (tx: unknown) => unknown) => {
      return callback({
        order: { update: vi.fn().mockResolvedValue({}) },
        orderAudit: {
          create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedAuditData = args.data;
            return Promise.resolve(args.data);
          }),
        },
      });
    }) as never);

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

    // Verify confirmer is recorded in orderAudit
    expect(capturedAuditData).toMatchObject({
      orderId: 'ord_123',
      actorId: 'pharm_1',
      actorRole: 'PHARMACIST',
      fromStatus: 'PAYMENT_PENDING_VERIFICATION',
      toStatus: 'SUBMITTED',
      reason: expect.stringContaining('UTR / Ref: 998877665544'),
    });

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
