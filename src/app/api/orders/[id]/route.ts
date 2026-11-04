// src/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { safeOrderSelect } from '../route';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: orderParam } = await props.params;

    // Support lookup by both cuid ID and displayId (e.g. RX-50211)
    let order = await db.order.findUnique({
      where: { id: orderParam },
      select: safeOrderSelect,
    });

    if (!order) {
      order = await db.order.findUnique({
        where: { displayId: orderParam },
        select: safeOrderSelect,
      });
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Object-level authorization check
    if (session.role === 'CUSTOMER') {
      if (order.customerId !== session.userId) {
        return NextResponse.json(
          { error: 'You do not have permission to view another customer’s order.' },
          { status: 403 }
        );
      }
    } else if (session.role === 'STORE_STAFF') {
      if (!session.storeId || order.storeId !== session.storeId) {
        return NextResponse.json(
          { error: 'Access denied: order is not routed to your store.' },
          { status: 403 }
        );
      }
      // Store staff may only inspect order once approved by pharmacist
      const viewableStatuses = ['APPROVED', 'PACKED', 'HANDED_OVER', 'DELIVERED'];
      if (!viewableStatuses.includes(order.status)) {
        return NextResponse.json(
          { error: 'Order is still awaiting pharmacist verification.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve order';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
