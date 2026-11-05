// src/app/api/payments/webhook/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/payments/gateway';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'PAYMENT_GATEWAY_WEBHOOK_SECRET is not configured on the server.' },
        { status: 500 }
      );
    }

    // Verify HMAC-SHA256 signature with constant-time equality
    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature: rejected by constant-time verification.' },
        { status: 400 }
      );
    }

    let payload: {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            notes?: Record<string, string>;
          };
        };
        order?: {
          entity?: {
            id?: string;
            receipt?: string;
            notes?: Record<string, string>;
          };
        };
      };
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventName = payload.event;
    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity = payload.payload?.order?.entity;
      const receipt = orderEntity?.receipt || paymentEntity?.notes?.orderReceipt;

      if (receipt) {
        // Try finding order by displayId or ID
        const order = await db.order.findFirst({
          where: {
            OR: [{ id: receipt }, { displayId: receipt }],
          },
        });

        if (order) {
          // Log payment confirmation audit event
          await db.orderAudit.create({
            data: {
              orderId: order.id,
              actorId: 'RAZORPAY_GATEWAY',
              actorRole: 'SYSTEM',
              fromStatus: order.status,
              toStatus: order.status,
              reason: `Sandbox payment captured via Razorpay webhook. Transaction ID: ${paymentEntity?.id || 'simulated_txn'}`,
            },
          }).catch(() => null);

          // Dispatch simulated confirmation notification to outbox
          await db.messageOutbox.create({
            data: {
              userId: order.customerId,
              channel: 'SMS',
              content: `MedKart: Real Sandbox Payment Confirmed for Order ${order.displayId}. Transaction Ref: ${paymentEntity?.id || 'sandbox_test'}. No real money was charged.`,
              status: 'SENT_MOCK',
            },
          }).catch(() => null);
        }
      }
    }

    return NextResponse.json({ status: 'ok', received: true, event: eventName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook processing error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
