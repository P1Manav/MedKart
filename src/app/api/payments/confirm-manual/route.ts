// src/app/api/payments/confirm-manual/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { handleApiError } from '@/lib/api-error';

const ConfirmManualSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  utrReference: z.string().trim().regex(/^\d{12}$/, 'Transaction Reference / UTR must be exactly 12 numeric digits'),
});

export async function POST(req: Request) {
  try {
    const session = await requireAuth(['PHARMACIST', 'STORE_STAFF', 'OPS']);
    const body = await req.json();
    const parsed = ConfirmManualSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid confirmation data' },
        { status: 400 }
      );
    }

    const { orderId, utrReference } = parsed.data;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'REJECTED') {
      return NextResponse.json(
        { success: false, message: 'Cannot confirm payment for a rejected order.' },
        { status: 400 }
      );
    }

    if (order.paymentMethod !== 'DIRECT_UPI') {
      return NextResponse.json(
        { success: false, message: `Order payment method is ${order.paymentMethod}, not DIRECT_UPI.` },
        { status: 400 }
      );
    }

    // Check if this UTR is already associated with another order or a rejected order
    const existingWithUtr = await db.order.findUnique({
      where: { utr: utrReference },
    });

    if (existingWithUtr && existingWithUtr.id !== order.id) {
      const msg = existingWithUtr.status === 'REJECTED'
        ? 'This 12-digit UTR was used on a rejected order and cannot be reused.'
        : `This 12-digit UTR has already been confirmed for Order #${existingWithUtr.displayId} and cannot be reused.`;
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }

    // Check if already confirmed
    const existingAudit = await db.orderAudit.findFirst({
      where: {
        orderId: order.id,
        reason: { contains: 'Direct UPI payment verified' },
      },
    });

    if (existingAudit) {
      return NextResponse.json(
        {
          success: true,
          message: 'Direct UPI payment was already verified for this order.',
          alreadyVerified: true,
        },
        { status: 200 }
      );
    }

    const nextStatus = order.status === 'PAYMENT_PENDING_VERIFICATION' ? 'SUBMITTED' : order.status;

    // Record real audit log confirming manual payment verification and update status
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          utr: utrReference,
        },
      });

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          actorId: session.userId,
          actorRole: session.role,
          fromStatus: order.status,
          toStatus: nextStatus,
          reason: `Direct UPI payment verified by ${session.role} (${session.name || session.userId}). UTR / Ref: ${utrReference}`,
        },
      });
    });

    // Notify customer in message outbox
    await db.messageOutbox.create({
      data: {
        userId: order.customerId,
        channel: 'SMS',
        content: `MedKart: Direct UPI transfer confirmed for Order ${order.displayId} (UTR: ${utrReference}). Verified by store staff.`,
        status: 'SENT_MOCK',
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: `Direct UPI payment verified and confirmed with UTR ${utrReference}.`,
    });
  } catch (err: unknown) {
    return handleApiError(err, 'payments/confirm-manual');
  }
}
