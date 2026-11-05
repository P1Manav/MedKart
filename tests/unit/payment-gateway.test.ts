// tests/unit/payment-gateway.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'u_test', role: 'CUSTOMER' }),
}));

import {
  isGatewayConfigured,
  verifyWebhookSignature,
} from '@/lib/payments/gateway';
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

  it('POST /api/payments/create-order returns fallback indicator when gateway keys are missing', async () => {
    delete process.env.PAYMENT_GATEWAY_KEY_ID;
    delete process.env.PAYMENT_GATEWAY_KEY_SECRET;

    const req = new Request('http://localhost/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 185.0 }),
    });

    const res = await createOrderPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isGatewayConfigured).toBe(false);
    expect(body.message).toContain('Fallback to NPCI test spec');
  });
});
