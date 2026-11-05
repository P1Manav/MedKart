// src/app/api/orders/[id]/reupload/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { validateTransition } from '@/domain/order-state';
import { validatePrescriptionFile, validateMagicBytes, stripExifGps } from '@/lib/validators/upload';
import { encryptPrescription } from '@/lib/crypto/encrypt';
import { getPrescriptionReader } from '@/lib/ai';
import { matchPrescriptionLine, type CatalogueProduct } from '@/lib/ai/fuzzy-matcher';
import { routeOrderToStore, type StoreStockItem, type OrderItemRequirement } from '@/domain/routing';

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['CUSTOMER']);
    const { id: orderId } = await props.params;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Object-level authorization: caller must own the order
    if (order.customerId !== session.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to modify another customer’s order.' },
        { status: 403 }
      );
    }

    // Order must be in ON_HOLD state
    if (order.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: `Cannot re-upload for order in "${order.status}" status. Only ON_HOLD orders accept re-uploads.` },
        { status: 409 }
      );
    }

    // Validate state transition
    validateTransition('ON_HOLD', 'SUBMITTED');

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Please select a prescription image file to upload.' }, { status: 400 });
    }

    const fileValidation = validatePrescriptionFile({ size: file.size, type: file.type });
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    const fileBytes = await file.arrayBuffer();
    let imageBuffer: Buffer = Buffer.from(fileBytes);

    const magicCheck = validateMagicBytes(imageBuffer);
    if (!magicCheck.valid) {
      return NextResponse.json({ error: magicCheck.error || 'Invalid file format' }, { status: 400 });
    }

    imageBuffer = stripExifGps(imageBuffer);

    // Encrypt replacement prescription with fresh IV and auth tag
    const enc = encryptPrescription(imageBuffer);

    // Fetch catalogue products
    const catalogueRaw = await db.product.findMany({ where: { active: true } });
    const catalogue: CatalogueProduct[] = catalogueRaw.map((p) => ({
      id: p.id,
      name: p.name,
      strength: p.strength,
      form: p.form,
      price: p.price,
      schedule: p.schedule,
      packSize: p.packSize,
    }));

    // Re-run AI reader
    const reader = getPrescriptionReader();
    const aiResult = await reader.read(imageBuffer, file.type || 'image/png');

    const matchedLines = (aiResult.data?.lines || []).map((aiLine) => {
      const match = matchPrescriptionLine(aiLine, catalogue);
      return {
        aiLine,
        match,
      };
    });

    // Re-evaluate store routing with the replacement prescription requirements
    const storesWithStock = await db.store.findMany({
      where: { active: true },
      include: { stock: true },
    });

    const storeItems: StoreStockItem[] = storesWithStock.map((s) => {
      const stockMap: Record<string, number> = {};
      s.stock.forEach((st) => {
        stockMap[st.productId] = st.quantity;
      });
      return {
        storeId: s.id,
        storeName: s.name,
        lat: s.lat,
        lng: s.lng,
        active: s.active,
        stock: stockMap,
      };
    });

    const aiRequirements: OrderItemRequirement[] = matchedLines
      .filter((l) => l.match.matchedProduct && !l.match.isBlockedNotSoldOnline)
      .map((l) => ({
        productId: l.match.matchedProduct!.id,
        quantity: l.aiLine.quantity || 1,
      }));

    let recomputedStoreId: string | null = order.storeId;
    let routingIssue: string | null = null;

    if (aiRequirements.length > 0 && order.addressLat && order.addressLng) {
      if (storeItems.length > 0) {
        try {
          const routeResult = routeOrderToStore(
            { lat: order.addressLat, lng: order.addressLng },
            storeItems,
            aiRequirements
          );
          recomputedStoreId = routeResult.assignedStoreId;
          if (!routeResult.isFullCoverage) {
            routingIssue = 'Partial stock at nearest store; requires multi-store split or warehouse dispatch';
          }
        } catch (err: unknown) {
          recomputedStoreId = null;
          routingIssue = err instanceof Error ? err.message : 'No stocked store found within delivery range';
        }
      } else {
        recomputedStoreId = null;
        routingIssue = 'No active stores available in network';
      }
    }

    // Execute in a single atomic transaction
    await db.$transaction(async (tx) => {
      // 1. Delete previous PENDING lines that needed re-checking
      await tx.orderLine.deleteMany({
        where: {
          orderId: order.id,
          lineStatus: 'PENDING',
        },
      });

      // 2. Create newly parsed draft lines
      if (matchedLines.length > 0) {
        await tx.orderLine.createMany({
          data: matchedLines.map((item) => ({
            orderId: order.id,
            productId: item.match.matchedProduct?.id,
            rawText: item.aiLine.raw_text,
            aiDrugName: item.aiLine.drug_name,
            aiStrength: item.aiLine.strength,
            aiConfidence: item.aiLine.confidence,
            aiAlternatives: {
              topCandidates: item.match.topCandidates,
              matcherScore: item.match.confidence,
            } as unknown as object,
            lineStatus: item.match.isBlockedNotSoldOnline ? 'BLOCKED_NOT_SOLD_ONLINE' : 'PENDING',
            quantity: item.aiLine.quantity || 1,
            unitPrice: item.match.matchedProduct?.price || null,
            needsReview: item.match.needsReview,
            rejectReason: item.match.reason || null,
          })),
        });
      }

      // 3. Update order back to SUBMITTED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'SUBMITTED',
          prescriptionStatus: 'PENDING',
          storeId: recomputedStoreId,
          routingIssue,
          prescriptionEncrypted: new Uint8Array(enc.encrypted),
          prescriptionIv: new Uint8Array(enc.iv),
          prescriptionAuthTag: new Uint8Array(enc.authTag),
          prescriptionMime: file.type || 'image/png',
          aiImageLegibility: aiResult.data?.image_legibility
            ? (aiResult.data.image_legibility.toUpperCase() as 'CLEAR' | 'PARTIAL' | 'UNREADABLE')
            : 'UNREADABLE',
          aiPrescriberText: aiResult.data?.prescriber_text,
          aiDateText: aiResult.data?.date_text,
          aiModelName: aiResult.modelName,
          aiLatencyMs: aiResult.latencyMs,
          manualEntryNeeded: aiResult.manualEntryNeeded,
          auditEvents: {
            create: {
              actorId: session.userId,
              actorRole: session.role,
              fromStatus: 'ON_HOLD',
              toStatus: 'SUBMITTED',
              reason: 'Customer re-uploaded clear prescription image',
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Prescription successfully re-uploaded. Order returned to pharmacist verification queue.',
      orderId: order.id,
      status: 'SUBMITTED',
      storeId: recomputedStoreId,
      routingIssue,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Re-upload failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
