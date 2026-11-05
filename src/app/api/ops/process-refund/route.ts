// src/app/api/ops/process-refund/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { validateTransition } from '@/domain/order-state';

const ProcessRefundSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  refundRef: z.string().trim().min(4, 'Refund reference / UTR is required').max(50),
});

export async function POST(req: Request) {
  try {
    const session = await requireAuth(['OPS']);
    const body = await req.json();
    const parsed = ProcessRefundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { orderId, refundRef } = parsed.data;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'REFUND_DUE') {
      return NextResponse.json(
        { error: `Order is in status ${order.status}, not REFUND_DUE.` },
        { status: 400 }
      );
    }

    validateTransition('REFUND_DUE', 'CANCELLED');

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          actorId: session.userId,
          actorRole: session.role,
          fromStatus: 'REFUND_DUE',
          toStatus: 'CANCELLED',
          reason: `Customer refund disbursed and settled by Ops. Transaction Ref: ${refundRef}`,
        },
      });

      await tx.messageOutbox.create({
        data: {
          userId: order.customerId,
          channel: 'SMS',
          content: `MedKart: Your refund for Order ${order.displayId} has been successfully disbursed (Ref: ${refundRef}).`,
          status: 'SENT_MOCK',
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Refund successfully processed and order closed.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process refund';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
