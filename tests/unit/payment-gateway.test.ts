// tests/unit/payment-gateway.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'u_test', role: 'CUSTOMER' }),
}));

vi.mock('@/lib/db', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    orderAudit: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'audit_created' }),
    },
    messageOutbox: {
      create: vi.fn().mockResolvedValue({ id: 'outbox_created' }),
    },
  },
}));

import {
  isGatewayConfigured,
  verifyWebhookSignature,
} from '@/lib/payments/gateway';
import db from '@/lib/db';
import { POST as webhookPost } from '@/app/api/payments/webhook/route';
import { POST as createOrderPost } from '@/app/api/payments/create-order/route';

describe('Payment Gateway & Webhook Signature Verification (Section 4)', () => {
  const originalEnv = { ...process.env };
  const mockSecret = 'whsec_sample_test_secret_key_1234567890';

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('detects gateway configuration presence accurately', () => {
    delete process.env.PAYMENT_GATEWAY_KEY_ID;
    delete process.env.PAYMENT_GATEWAY_KEY_SECRET;
    expect(isGatewayConfigured()).toBe(false);

    process.env.PAYMENT_GATEWAY_KEY_ID = 'rzp_test_12345';
    process.env.PAYMENT_GATEWAY_KEY_SECRET = 'secret_test_abcde';
    expect(isGatewayConfigured()).toBe(true);
  });

  it('verifies valid HMAC-SHA256 webhook signatures with constant-time equality', () => {
    const rawPayload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test_123', amount: 18500 } } },
    });

    const validSignature = crypto
      .createHmac('sha256', mockSecret)
      .update(rawPayload)
      .digest('hex');

    expect(verifyWebhookSignature(rawPayload, validSignature, mockSecret)).toBe(true);
  });

  it('strictly rejects invalid or tampered HMAC-SHA256 webhook signatures', () => {
    const rawPayload = JSON.stringify({ event: 'payment.captured' });
    const tamperedPayload = JSON.stringify({ event: 'payment.captured', amount: 999999 });

    const signature = crypto
      .createHmac('sha256', mockSecret)
      .update(rawPayload)
      .digest('hex');

    // Tampered payload
    expect(verifyWebhookSignature(tamperedPayload, signature, mockSecret)).toBe(false);

    // Wrong signature string
    expect(verifyWebhookSignature(rawPayload, 'wrong_signature_12345', mockSecret)).toBe(false);

    // Wrong secret
    expect(verifyWebhookSignature(rawPayload, signature, 'different_secret')).toBe(false);

    // Empty or null inputs
    expect(verifyWebhookSignature(rawPayload, null, mockSecret)).toBe(false);
  });

  it('POST /api/payments/webhook rejects requests with wrong signature with HTTP 400', async () => {
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET = mockSecret;

    const payload = JSON.stringify({ event: 'payment.captured' });
    const req = new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': 'invalid_forged_signature_hex',
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid webhook signature');
  });

  it('POST /api/payments/webhook accepts valid signature and returns HTTP 200', async () => {
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET = mockSecret;

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_test_987654', amount: 18500 } },
      },
    });

    const validSig = crypto
      .createHmac('sha256', mockSecret)
      .update(payload)
      .digest('hex');

    const req = new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': validSig,
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.received).toBe(true);
  });

  it('POST /api/payments/webhook rejects replay using idempotency key', async () => {
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET = mockSecret;

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_replay_123', amount: 18500 } },
      },
    });

    const validSig = crypto
      .createHmac('sha256', mockSecret)
      .update(payload)
      .digest('hex');

    // Mock existing audit log having this replay key
    vi.spyOn(db.orderAudit, 'findFirst').mockResolvedValueOnce({
      id: 'audit_1',
      orderId: 'ord_1',
      reason: 'Sandbox payment captured via Razorpay webhook. Transaction ID: pay_replay_123',
    } as unknown as Awaited<ReturnType<typeof db.orderAudit.findFirst>>);

    const req = new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': validSig,
        'x-razorpay-event-id': 'pay_replay_123',
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replayed).toBe(true);
    expect(body.message).toContain('already processed');
  });

  it('POST /api/payments/create-order requires validated orderId input', async () => {
    const req = new Request('http://localhost/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await createOrderPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Order ID is required');
  });

  it('POST /api/payments/create-order computes amount on server from order lines', async () => {
    delete process.env.PAYMENT_GATEWAY_KEY_ID;
    delete process.env.PAYMENT_GATEWAY_KEY_SECRET;

    vi.spyOn(db.order, 'findUnique').mockResolvedValueOnce({
      id: 'ord_123',
      displayId: 'RX-50220',
      customerId: 'u_test',
      lines: [
        { quantity: 2, unitPrice: 50, product: { price: 50 } },
        { quantity: 1, unitPrice: 35, product: { price: 35 } },
      ],
    } as unknown as Awaited<ReturnType<typeof db.order.findUnique>>);

    const req = new Request('http://localhost/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord_123', amount: 999999 }), // client amount must be ignored!
    });

    const res = await createOrderPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isGatewayConfigured).toBe(false);
    expect(body.amount).toBe(135); // 2 * 50 + 1 * 35 = 135
  });
});
