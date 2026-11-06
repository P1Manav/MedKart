// src/app/api/prescription/[id]/image/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth, assertPrescriptionAccess } from '@/lib/auth/rbac';
import { decryptPrescription } from '@/lib/crypto/encrypt';
import { logPrescriptionAccess } from '@/lib/crypto/access-log';
import { handleApiError } from '@/lib/api-error';

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: orderParam } = await props.params;

    // Fetch order metadata and encrypted bytes by cuid ID or displayId (e.g. RX-50214)
    let order = await db.order.findUnique({
      where: { id: orderParam },
      select: {
        id: true,
        customerId: true,
        storeId: true,
        status: true,
        prescriptionEncrypted: true,
        prescriptionIv: true,
        prescriptionAuthTag: true,
        prescriptionMime: true,
      },
    });

    if (!order) {
      order = await db.order.findUnique({
        where: { displayId: orderParam },
        select: {
          id: true,
          customerId: true,
          storeId: true,
          status: true,
          prescriptionEncrypted: true,
          prescriptionIv: true,
          prescriptionAuthTag: true,
          prescriptionMime: true,
        },
      });
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Object-level authorization check per role and state
    assertPrescriptionAccess(session, {
      customerId: order.customerId,
      storeId: order.storeId,
      status: order.status,
    });

    if (!order.prescriptionEncrypted || !order.prescriptionIv || !order.prescriptionAuthTag) {
      return NextResponse.json({ error: 'No prescription attached to this order' }, { status: 404 });
    }

    // Decrypt on the fly
    const decryptedBytes = decryptPrescription(
      Buffer.from(order.prescriptionEncrypted),
      Buffer.from(order.prescriptionIv),
      Buffer.from(order.prescriptionAuthTag)
    );

    // Extract client IP for DPDP append-only audit log
    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    // Log access
    await logPrescriptionAccess({
      userId: session.userId,
      userRole: session.role,
      orderId: order.id,
      action: 'VIEW',
      clientIp,
    });

    return new NextResponse(new Uint8Array(decryptedBytes), {
      status: 200,
      headers: {
        'Content-Type': order.prescriptionMime || 'image/png',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, 'prescription/image');
  }
}
