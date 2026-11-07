// src/app/api/pharmacist/orders/[id]/verify/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth, AuthorizationError } from '@/lib/auth/rbac';
import {
  assertDispatchable,
  computePrescriptionValidUntil,
  parseDateInIST,
  type DispatchableOrder,
} from '@/domain/assert-dispatchable';
import { validateTransition } from '@/domain/order-state';
import { handleApiError } from '@/lib/api-error';

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
    action: z.literal('ADD_LINE'),
    productId: z.string().min(1, 'Product selection is required'),
    quantity: z.number().int().positive('Quantity must be greater than 0'),
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
    prescriptionDate: z.string().min(10, 'Prescription date is required (YYYY-MM-DD)'),
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
    const session = await requireAuth(['PHARMACIST']);
    if (!session.pharmacistRegNo || !session.pharmacistRegNo.trim()) {
      throw new AuthorizationError(
        'A registered pharmacist license registration number is required to verify prescriptions.'
      );
    }
    const pharmacistRegNo = session.pharmacistRegNo.trim();

    const { id: orderId } = await props.params;
    const body = await req.json();

    const parsed = LineActionSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.');
      const msg =
        field === 'prescriptionDate'
          ? 'Prescription date is required (YYYY-MM-DD)'
          : issue?.message || 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
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

    if (order.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `Cannot verify order: order is in status ${order.status}. Only SUBMITTED orders can be reviewed.` },
        { status: 409 }
      );
    }

    let rxDate: Date | null = null;
    let validUntil: Date | null = null;
    if (payload.action === 'APPROVE_ORDER') {
      try {
        rxDate = parseDateInIST(payload.prescriptionDate);
      } catch {
        return NextResponse.json(
          { error: 'Invalid prescription date format. Please provide YYYY-MM-DD.' },
          { status: 400 }
        );
      }

      const now = new Date();
      // Compare calendar date in Indian Standard Time (UTC+5:30) so that prescriptions
      // issued today are never falsely flagged as "in the future" due to UTC time-of-day offsets.
      const todayIST = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
      if (payload.prescriptionDate > todayIST) {
        return NextResponse.json(
          { error: 'Prescription date cannot be in the future.' },
          { status: 400 }
        );
      }

      validUntil = computePrescriptionValidUntil(rxDate, 6);
      if (validUntil.getTime() < now.getTime()) {
        const expiredStr = validUntil.toISOString().slice(0, 10);
        return NextResponse.json(
          { error: `Prescription has expired on ${expiredStr}. Cannot approve an expired prescription.` },
          { status: 400 }
        );
      }
    }

    const rules = await db.scheduleRule.findMany();
    const ruleMap = new Map(rules.map((r) => [r.schedule, r]));

    // ── 1. APPROVE SINGLE LINE ─────────────────────────────
    if (payload.action === 'APPROVE_LINE') {
      const line = order.lines.find((l) => l.id === payload.lineId);
      if (!line) {
        return NextResponse.json({ error: 'Line not found' }, { status: 404 });
      }

      if (!line.productId) {
        return NextResponse.json(
          { error: 'Cannot approve an unread or unmatched line. Please edit or match to a product first.' },
          { status: 409 }
        );
      }

      // Block approval if item cannot be sold online
      const lineRule = line.product ? ruleMap.get(line.product.schedule) : null;
      if (line.lineStatus === 'BLOCKED_NOT_SOLD_ONLINE' || (lineRule && !lineRule.canSellOnline)) {
        return NextResponse.json(
          { error: "This item cannot be ordered online. Please visit your nearest store." },
          { status: 409 }
        );
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
      const line = order.lines.find((l) => l.id === payload.lineId);
      if (!line) {
        return NextResponse.json({ error: 'Line not found' }, { status: 404 });
      }

      const product = await db.product.findUnique({ where: { id: payload.productId } });
      if (!product) {
        return NextResponse.json({ error: 'Selected product not found' }, { status: 404 });
      }

      // Block swapping to an item that cannot be sold online
      const productRule = ruleMap.get(product.schedule);
      if (productRule && !productRule.canSellOnline) {
        return NextResponse.json(
          { error: "This item cannot be ordered online. Please visit your nearest store." },
          { status: 409 }
        );
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

    // ── 3. ADD SINGLE LINE (MANUAL ENTRY) ─────────────────
    if (payload.action === 'ADD_LINE') {
      const product = await db.product.findUnique({ where: { id: payload.productId } });
      if (!product) {
        return NextResponse.json({ error: 'Selected product not found' }, { status: 404 });
      }

      // Block adding an item that cannot be sold online
      const productRule = ruleMap.get(product.schedule);
      if (productRule && !productRule.canSellOnline) {
        return NextResponse.json(
          { error: "This item cannot be ordered online. Please visit your nearest store." },
          { status: 409 }
        );
      }

      await db.orderLine.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: payload.quantity,
          unitPrice: product.price,
          rawText: `[Manual Entry] ${product.name}`,
          lineStatus: 'EDITED_APPROVED',
          pharmacistId: session.userId,
          pharmacistRegNo,
          editNote: payload.editNote || 'Manually added by pharmacist during verification',
        },
      });

      return NextResponse.json({ success: true, message: 'Line added and approved by pharmacist.' });
    }

    // ── 4. REJECT SINGLE LINE ─────────────────────────────
    if (payload.action === 'REJECT_LINE') {
      const line = order.lines.find((l) => l.id === payload.lineId);
      if (!line) {
        return NextResponse.json({ error: 'Line not found' }, { status: 404 });
      }

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

    // ── 5. REQUEST RE-UPLOAD ──────────────────────────────
    if (payload.action === 'REQUEST_REUPLOAD') {
      validateTransition(order.status as 'SUBMITTED', 'ON_HOLD');

      const res = await db.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: 'SUBMITTED' },
          data: {
            status: 'ON_HOLD',
            prescriptionStatus: 'RE_UPLOAD_ASKED',
          },
        });

        if (updated.count === 0) {
          return { conflict: true };
        }

        await tx.orderAudit.create({
          data: {
            orderId: order.id,
            actorId: session.userId,
            actorRole: session.role,
            fromStatus: order.status,
            toStatus: 'ON_HOLD',
            reason: payload.reason,
          },
        });

        await tx.notification.create({
          data: {
            userId: order.customerId,
            title: `Action needed: Prescription re-upload for ${order.displayId}`,
            body: payload.reason,
            link: `/customer/order/${order.id}`,
          },
        });

        return { conflict: false };
      });

      if (res.conflict) {
        return NextResponse.json(
          { error: 'Order was already decided by another pharmacist or is no longer pending verification.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Order placed on hold. Customer requested to re-upload clear prescription.',
      });
    }

    // ── 6. REJECT FULL ORDER ──────────────────────────────
    if (payload.action === 'REJECT_ORDER') {
      const isPaidMethod = order.paymentMethod === 'MOCK_UPI' || order.paymentMethod === 'DIRECT_UPI';
      const targetStatus = isPaidMethod ? 'REFUND_DUE' : 'REJECTED';
      validateTransition(order.status as 'SUBMITTED', targetStatus);

      const res = await db.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: 'SUBMITTED' },
          data: {
            status: targetStatus,
          },
        });

        if (updated.count === 0) {
          return { conflict: true };
        }

        await tx.orderAudit.create({
          data: {
            orderId: order.id,
            actorId: session.userId,
            actorRole: session.role,
            fromStatus: order.status,
            toStatus: targetStatus,
            reason: isPaidMethod
              ? `${payload.reason} [Payment method was ${order.paymentMethod}; refund queued for ops disbursement]`
              : payload.reason,
          },
        });

        return { conflict: false };
      });

      if (res.conflict) {
        return NextResponse.json(
          { error: 'Order was already decided by another pharmacist or is no longer pending verification.' },
          { status: 409 }
        );
      }

      return NextResponse.json({ success: true, message: 'Order rejected.' });
    }

    // ── 7. APPROVE FULL ORDER ─────────────────────────────
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

      // Construct DispatchableOrder shape for verification check.
      // Any PENDING line is checked assuming approval by this reviewing pharmacist.
      const checkPayload: DispatchableOrder = {
        id: refreshedOrder.id,
        status: refreshedOrder.status,
        prescriptionEncrypted: refreshedOrder.prescriptionEncrypted,
        prescriptionValidUntil: validUntil!,
        lines: refreshedOrder.lines.map((l) => {
          const rule = l.product ? ruleMap.get(l.product.schedule) : null;
          return {
            id: l.id,
            lineStatus: l.lineStatus === 'PENDING' ? 'APPROVED' : l.lineStatus,
            productSchedule: l.product?.schedule || 'H',
            canSellOnline: rule ? rule.canSellOnline : true,
            pharmacistId: l.pharmacistId || session.userId,
            pharmacistRegNo: l.pharmacistRegNo || pharmacistRegNo,
            requiresRegisterEntry: rule ? rule.requiresRegisterEntry : false,
            h1PrescriberName: l.h1PrescriberName,
            h1PrescriberRegNo: l.h1PrescriberRegNo,
            h1PatientName: l.h1PatientName,
            h1Date: l.h1Date || rxDate!,
            h1Quantity: l.h1Quantity,
          };
        }),
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

      const res = await db.$transaction(async (tx) => {
        // Auto-approve any pending lines under the reviewing licensed pharmacist
        await tx.orderLine.updateMany({
          where: {
            orderId: order.id,
            lineStatus: 'PENDING',
          },
          data: {
            lineStatus: 'APPROVED',
            pharmacistId: session.userId,
            pharmacistRegNo,
          },
        });

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: 'SUBMITTED' },
          data: {
            status: 'APPROVED',
            prescriptionStatus: 'APPROVED',
            prescriptionValidUntil: validUntil,
          },
        });

        if (updated.count === 0) {
          return { conflict: true };
        }

        // Ensure any H1 lines have h1Date set from prescription date if missing
        await tx.orderLine.updateMany({
          where: {
            orderId: order.id,
            h1PrescriberName: { not: null },
            h1Date: null,
          },
          data: {
            h1Date: rxDate,
          },
        });

        await tx.orderAudit.create({
          data: {
            orderId: order.id,
            actorId: session.userId,
            actorRole: session.role,
            fromStatus: order.status,
            toStatus: 'APPROVED',
            reason: `Approved by Pharmacist ${session.name} (Reg: ${pharmacistRegNo})`,
          },
        });

        return { conflict: false };
      });

      if (res.conflict) {
        return NextResponse.json(
          { error: 'Order was already decided by another pharmacist or is no longer pending verification.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Order approved and ready for store packing!',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return handleApiError(err, 'pharmacist/orders/[id]/verify');
  }
}


