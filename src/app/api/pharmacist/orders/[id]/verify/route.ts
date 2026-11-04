// src/app/api/pharmacist/orders/[id]/verify/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { assertDispatchable, type DispatchableOrder } from '@/domain/assert-dispatchable';
import { validateTransition } from '@/domain/order-state';

const LineActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('APPROVE_LINE'),
    lineId: z.string(),
    genericConsentGiven: z.boolean().optional(),
    h1Details: z
      .object({
        prescriberName: z.string().min(1),
        prescriberRegNo: z.string().min(1),
        patientName: z.string().min(1),
        quantity: z.number().int().positive(),
      })
      .optional(),
  }),
  z.object({
    action: z.literal('EDIT_LINE'),
    lineId: z.string(),
    productId: z.string(),
    quantity: z.number().int().positive(),
    editNote: z.string().optional(),
  }),
  z.object({
    action: z.literal('REJECT_LINE'),
    lineId: z.string(),
    reason: z.string().min(3, 'Mandatory rejection reason required'),
  }),
  z.object({
    action: z.literal('REQUEST_REUPLOAD'),
    reason: z.string().min(5, 'Mandatory re-upload reason required for patient'),
  }),
  z.object({
    action: z.literal('APPROVE_ORDER'),
  }),
  z.object({
    action: z.literal('REJECT_ORDER'),
    reason: z.string().min(5, 'Mandatory rejection reason required'),
  }),
]);

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['PHARMACIST', 'OPS']);
    const { id: orderId } = await props.params;
    const body = await req.json();

    const parsed = LineActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const payload = parsed.data;

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

    const pharmacistRegNo = session.pharmacistRegNo || 'WB-PHARM-2024-4102';

    // ── 1. APPROVE SINGLE LINE ─────────────────────────────
    if (payload.action === 'APPROVE_LINE') {
      const line = order.lines.find((l) => l.id === payload.lineId);
      if (!line) {
        return NextResponse.json({ error: 'Line not found' }, { status: 404 });
      }

      await db.orderLine.update({
        where: { id: payload.lineId },
        data: {
          lineStatus: 'APPROVED',
          pharmacistId: session.userId,
          pharmacistRegNo,
          customerConsentGeneric: payload.genericConsentGiven ?? line.customerConsentGeneric,
          consentTimestamp: payload.genericConsentGiven ? new Date() : line.consentTimestamp,
          ...(payload.h1Details
            ? {
                h1PrescriberName: payload.h1Details.prescriberName,
                h1PrescriberRegNo: payload.h1Details.prescriberRegNo,
                h1PatientName: payload.h1Details.patientName,
                h1Date: new Date(),
                h1Quantity: payload.h1Details.quantity,
              }
            : {}),
        },
      });

      return NextResponse.json({ success: true, message: 'Line approved by pharmacist.' });
    }

    // ── 2. EDIT SINGLE LINE ───────────────────────────────
    if (payload.action === 'EDIT_LINE') {
      const product = await db.product.findUnique({ where: { id: payload.productId } });
      if (!product) {
        return NextResponse.json({ error: 'Selected product not found' }, { status: 404 });
      }

      await db.orderLine.update({
        where: { id: payload.lineId },
        data: {
          productId: payload.productId,
          quantity: payload.quantity,
          unitPrice: product.price,
          lineStatus: 'EDITED_APPROVED',
          pharmacistId: session.userId,
          pharmacistRegNo,
          editNote: payload.editNote || 'Modified by pharmacist after prescription check',
        },
      });

      return NextResponse.json({ success: true, message: 'Line updated and approved.' });
    }

    // ── 3. REJECT SINGLE LINE ─────────────────────────────
    if (payload.action === 'REJECT_LINE') {
      await db.orderLine.update({
        where: { id: payload.lineId },
        data: {
          lineStatus: 'REJECTED',
          pharmacistId: session.userId,
          pharmacistRegNo,
          rejectReason: payload.reason,
        },
      });

      return NextResponse.json({ success: true, message: 'Line rejected with reason.' });
    }

    // ── 4. REQUEST RE-UPLOAD ──────────────────────────────
    if (payload.action === 'REQUEST_REUPLOAD') {
      validateTransition(order.status as 'SUBMITTED', 'ON_HOLD');

      await db.order.update({
        where: { id: order.id },
        data: {
          status: 'ON_HOLD',
          prescriptionStatus: 'RE_UPLOAD_ASKED',
          auditEvents: {
            create: {
              actorId: session.userId,
              actorRole: session.role,
              fromStatus: order.status,
              toStatus: 'ON_HOLD',
              reason: payload.reason,
            },
          },
        },
      });

      // Also create an in-app notification & mock message for patient
      await db.notification.create({
        data: {
          userId: order.customerId,
          title: `Action needed: Prescription re-upload for ${order.displayId}`,
          body: payload.reason,
          link: `/customer/order/${order.id}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Order placed on hold. Customer requested to re-upload clear prescription.',
      });
    }

    // ── 5. REJECT FULL ORDER ──────────────────────────────
    if (payload.action === 'REJECT_ORDER') {
      validateTransition(order.status as 'SUBMITTED', 'REJECTED');

      await db.order.update({
        where: { id: order.id },
        data: {
          status: 'REJECTED',
          auditEvents: {
            create: {
              actorId: session.userId,
              actorRole: session.role,
              fromStatus: order.status,
              toStatus: 'REJECTED',
              reason: payload.reason,
            },
          },
        },
      });

      return NextResponse.json({ success: true, message: 'Order rejected.' });
    }

    // ── 6. APPROVE FULL ORDER ─────────────────────────────
    if (payload.action === 'APPROVE_ORDER') {
      validateTransition(order.status as 'SUBMITTED', 'APPROVED');

      // Fetch fresh order with lines
      const refreshedOrder = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          lines: {
            include: { product: true },
          },
        },
      });

      // Construct DispatchableOrder shape for verification check
      const checkPayload: DispatchableOrder = {
        id: refreshedOrder.id,
        status: refreshedOrder.status,
        prescriptionEncrypted: refreshedOrder.prescriptionEncrypted,
        prescriptionValidUntil: refreshedOrder.prescriptionValidUntil,
        lines: refreshedOrder.lines.map((l) => ({
          id: l.id,
          lineStatus: l.lineStatus,
          productSchedule: l.product?.schedule || 'H',
          pharmacistId: l.pharmacistId,
          pharmacistRegNo: l.pharmacistRegNo,
          requiresRegisterEntry: l.product?.schedule === 'H1',
          h1PrescriberName: l.h1PrescriberName,
          h1PrescriberRegNo: l.h1PrescriberRegNo,
          h1PatientName: l.h1PatientName,
          h1Date: l.h1Date,
          h1Quantity: l.h1Quantity,
        })),
      };

      const dispatchCheck = assertDispatchable(checkPayload);
      if (!dispatchCheck.canDispatch) {
        return NextResponse.json(
          {
            error: 'Order cannot be approved yet.',
            reasons: dispatchCheck.reasons,
          },
          { status: 400 }
        );
      }

      // Transition order to APPROVED
      await db.order.update({
        where: { id: order.id },
        data: {
          status: 'APPROVED',
          prescriptionStatus: 'APPROVED',
          auditEvents: {
            create: {
              actorId: session.userId,
              actorRole: session.role,
              fromStatus: order.status,
              toStatus: 'APPROVED',
              reason: `Approved by Pharmacist ${session.name} (Reg: ${pharmacistRegNo})`,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Order approved and ready for store packing!',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

