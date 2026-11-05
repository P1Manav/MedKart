// src/app/api/payments/submit-utr/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';

const SubmitUtrSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  utrReference: z.string().trim().min(4, 'UTR reference must be at least 4 characters').max(50),
});

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = SubmitUtrSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid UTR' }, { status: 400 });
    }

    const { orderId, utrReference } = parsed.data;

    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only customer who owns order or staff can submit UTR
    if (order.customerId !== session.userId && session.role !== 'OPS' && session.role !== 'STORE_STAFF') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Record UTR submission in audit
    await db.orderAudit.create({
      data: {
        orderId: order.id,
        actorId: session.userId,
        actorRole: session.role,
        fromStatus: order.status,
        toStatus: order.status,
        reason: `Customer submitted Direct UPI transaction UTR: ${utrReference}`,
      },
    });

    return NextResponse.json({ success: true, message: 'UTR reference recorded' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record UTR';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
