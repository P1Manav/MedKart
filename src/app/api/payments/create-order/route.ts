// src/app/api/payments/create-order/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { isGatewayConfigured, createSandboxPaymentOrder } from '@/lib/payments/gateway';
import { handleApiError } from '@/lib/api-error';

export const maxDuration = 30;

const CreateOrderSchema = z.object({
  orderId: z.string({ message: 'Order ID is required' }).min(1, 'Order ID is required'),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input: orderId is required' },
        { status: 400 }
      );
    }

    const { orderId } = parsed.data;

    // Fetch order and lines to compute amount strictly on the server
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Ensure customer owns order or user has staff role
    if (order.customerId !== session.userId && !['PHARMACIST', 'STORE_STAFF', 'OPS'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Compute amount strictly on the server from verified order lines
    const serverAmount = order.lines.reduce((total, line) => {
      const price = line.unitPrice ?? line.product?.price ?? 0;
      return total + price * line.quantity;
    }, 0);

    // If order has no approved priced lines yet (e.g. freshly uploaded prescription awaiting review),
    // provide a nominal provisional authorization amount so sandbox payment flow can open cleanly.
    const effectiveAmount = serverAmount > 0 ? serverAmount : 150;

    if (!isGatewayConfigured()) {
      return NextResponse.json({
        isGatewayConfigured: false,
        amount: effectiveAmount,
        message: 'Payment gateway credentials absent. Fallback to NPCI test spec sandbox modal.',
      });
    }

    const rpOrder = await createSandboxPaymentOrder({
      amount: effectiveAmount,
      receipt: order.displayId,
      notes: {
        userId: session.userId,
        orderId: order.id,
        orderReceipt: order.displayId,
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
    return handleApiError(err, 'payments/create-order');
  }
}
