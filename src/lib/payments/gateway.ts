// src/lib/payments/gateway.ts
import crypto from 'crypto';

export interface CreateOrderParams {
  amount: number; // in INR rupees (e.g. 185.00)
  receipt: string; // internal order ID or display ID
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number; // in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export function isGatewayConfigured(): boolean {
  const keyId = process.env.PAYMENT_GATEWAY_KEY_ID;
  const keySecret = process.env.PAYMENT_GATEWAY_KEY_SECRET;
  return Boolean(keyId && keySecret && keyId.trim().length > 0 && keySecret.trim().length > 0);
}

/**
 * Creates an order on Razorpay / Cashfree test sandbox.
 */
export async function createSandboxPaymentOrder(
  params: CreateOrderParams
): Promise<RazorpayOrderResponse> {
  const keyId = process.env.PAYMENT_GATEWAY_KEY_ID;
  const keySecret = process.env.PAYMENT_GATEWAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Payment gateway keys (PAYMENT_GATEWAY_KEY_ID, PAYMENT_GATEWAY_KEY_SECRET) are not configured.');
  }

  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const amountInPaise = Math.round(params.amount * 100);

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes || {},
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Razorpay API Error (${res.status}): ${errorText || res.statusText}`);
  }

  const data = (await res.json()) as RazorpayOrderResponse;
  return data;
}

/**
 * Verifies webhook HMAC-SHA256 signature using constant-time comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined
): boolean {
  if (!signature || !secret || !rawBody) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(signature, 'utf-8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}
