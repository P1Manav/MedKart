// src/app/api/store/orders/[id]/deliver/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth, assertStoreStaffAccess } from '@/lib/auth/rbac';
import { validateTransition } from '@/domain/order-state';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['STORE_STAFF', 'OPS', 'CUSTOMER']);
    const { id: orderId } = await props.params;

    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (session.role === 'STORE_STAFF') {
      assertStoreStaffAccess(session, order.storeId);
    } else if (session.role === 'CUSTOMER') {
      if (order.customerId !== session.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    validateTransition(order.status as 'HANDED_OVER', 'DELIVERED');

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED' },
      });

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          actorId: session.userId,
          actorRole: session.role,
          fromStatus: 'HANDED_OVER',
          toStatus: 'DELIVERED',
          reason: `Delivery confirmed by ${session.role} (${session.name || session.userId})`,
        },
      });

      await tx.messageOutbox.create({
        data: {
          userId: order.customerId,
          channel: 'SMS',
          content: `MedKart: Order ${order.displayId} has been delivered successfully. Thank you for choosing MedKart Pharmacy!`,
          status: 'SENT_MOCK',
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Order ${order.displayId} successfully delivered.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Delivery confirmation failed';
    const status = msg.includes('Unauthorized') || msg.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
