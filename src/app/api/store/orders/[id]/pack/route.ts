// src/app/api/store/orders/[id]/pack/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth, assertStoreStaffAccess } from '@/lib/auth/rbac';
import { assertDispatchable, type DispatchableOrder } from '@/domain/assert-dispatchable';
import { validateTransition } from '@/domain/order-state';
import { handleApiError } from '@/lib/api-error';

const PackSchema = z.object({
  invoiceNumber: z.string().min(2, 'Invoice number is required'),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['STORE_STAFF', 'OPS']);
    const { id: orderId } = await props.params;

    const body = await req.json();
    const parsed = PackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

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

    // Object-level authorization check: store staff can only pack their store's orders
    assertStoreStaffAccess(session, order.storeId);

    // Direct UPI payment verification gate: staff must have explicitly confirmed payment receipt
    if (order.paymentMethod === 'DIRECT_UPI') {
      const paymentAudit = await db.orderAudit.findFirst({
        where: {
          orderId: order.id,
          reason: { contains: 'Direct UPI payment verified' },
        },
      });

      if (!paymentAudit) {
        return NextResponse.json(
          { error: "Cannot pack: Direct UPI payment has not been confirmed by staff. Use 'Confirm UPI Receipt' first." },
          { status: 400 }
        );
      }
    }

    // State machine check: must transition from APPROVED -> PACKED
    validateTransition(order.status as 'APPROVED', 'PACKED');

    const scheduleRules = await db.scheduleRule.findMany();
    const ruleMap = new Map(scheduleRules.map((r) => [r.schedule, r]));

    // Defence in depth: assertDispatchable check
    const dispatchPayload: DispatchableOrder = {
      id: order.id,
      status: order.status,
      prescriptionEncrypted: order.prescriptionEncrypted,
      prescriptionValidUntil: order.prescriptionValidUntil,
      lines: order.lines.map((l) => {
        const rule = l.product ? ruleMap.get(l.product.schedule) : null;
        return {
          id: l.id,
          lineStatus: l.lineStatus,
          productSchedule: l.product?.schedule || 'H',
          canSellOnline: rule ? rule.canSellOnline : true,
          pharmacistId: l.pharmacistId,
          pharmacistRegNo: l.pharmacistRegNo,
          requiresRegisterEntry: rule ? rule.requiresRegisterEntry : false,
          h1PrescriberName: l.h1PrescriberName,
          h1PrescriberRegNo: l.h1PrescriberRegNo,
          h1PatientName: l.h1PatientName,
          h1Date: l.h1Date,
          h1Quantity: l.h1Quantity,
        };
      }),
    };

    const dispatchCheck = assertDispatchable(dispatchPayload);
    if (!dispatchCheck.canDispatch) {
      return NextResponse.json(
        {
          error: 'Dispatch blocked: order has not passed pharmacist verification.',
          reasons: dispatchCheck.reasons,
        },
        { status: 400 }
      );
    }

    // Update order status to PACKED (also validated by DB trigger!)
    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        status: 'PACKED',
        auditEvents: {
          create: {
            actorId: session.userId,
            actorRole: session.role,
            fromStatus: order.status,
            toStatus: 'PACKED',
            reason: `Packed by store staff (Invoice: ${parsed.data.invoiceNumber})`,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Order successfully packed and marked ready for handover.',
      order: { id: updated.id, status: updated.status },
    });
  } catch (err: unknown) {
    return handleApiError(err, 'store/orders/pack');
  }
}

