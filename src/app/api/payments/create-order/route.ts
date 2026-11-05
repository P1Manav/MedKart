// src/app/api/payments/create-order/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isGatewayConfigured, createSandboxPaymentOrder } from '@/lib/payments/gateway';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const receipt = String(body.receipt || `rcpt_${Date.now()}`);

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    if (!isGatewayConfigured()) {
      return NextResponse.json({
        isGatewayConfigured: false,
        message: 'Payment gateway credentials absent. Fallback to NPCI test spec sandbox modal.',
      });
    }

    const rpOrder = await createSandboxPaymentOrder({
      amount,
      receipt,
      notes: {
        userId: session.userId,
        orderReceipt: receipt,
      },
    });

    return NextResponse.json({
      isGatewayConfigured: true,
      orderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      keyId: process.env.PAYMENT_GATEWAY_KEY_ID,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create payment order';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

