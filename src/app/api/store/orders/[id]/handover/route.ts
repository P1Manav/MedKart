// src/app/api/store/orders/[id]/handover/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth, assertStoreStaffAccess } from '@/lib/auth/rbac';
import { validateTransition } from '@/domain/order-state';

const HandoverSchema = z.object({
  partnerName: z.string().trim().min(2, 'Delivery partner name is required').max(60).default('MedKart Local Fleet'),
  trackingId: z.string().trim().max(60).optional(),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['STORE_STAFF', 'OPS']);
    const { id: orderId } = await props.params;

    const body = await req.json().catch(() => ({}));
    const parsed = HandoverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    assertStoreStaffAccess(session, order.storeId);
    validateTransition(order.status as 'PACKED', 'HANDED_OVER');

    const { partnerName, trackingId } = parsed.data;

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'HANDED_OVER' },
      });

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          actorId: session.userId,
          actorRole: session.role,
          fromStatus: 'PACKED',
          toStatus: 'HANDED_OVER',
          reason: `Handed over to delivery partner: ${partnerName}${trackingId ? ` (Tracking: ${trackingId})` : ''}`,
        },
      });

      await tx.messageOutbox.create({
        data: {
          userId: order.customerId,
          channel: 'SMS',
          content: `MedKart: Order ${order.displayId} is out for delivery via ${partnerName}! Track progress: /customer/order/${order.id}`,
          status: 'SENT_MOCK',
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Order ${order.displayId} handed over for dispatch to ${partnerName}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Handover failed';
    const status = msg.includes('Unauthorized') || msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
