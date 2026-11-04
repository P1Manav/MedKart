// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { encryptPrescription } from '@/lib/crypto/encrypt';
import { GeminiReader } from '@/lib/ai/gemini-reader';
import { MockReader } from '@/lib/ai/mock-reader';
import { matchPrescriptionLine, type CatalogueProduct } from '@/lib/ai/fuzzy-matcher';
import { routeOrderToStore, type StoreStockItem, type OrderItemRequirement } from '@/domain/routing';
import { computePrescriptionValidUntil } from '@/domain/assert-dispatchable';
import { validatePrescriptionFile } from '@/lib/validators/upload';

export async function GET() {
  try {
    const session = await requireAuth();

    if (session.role === 'CUSTOMER') {
      const orders = await db.order.findMany({
        where: { customerId: session.userId },
        include: {
          familyProfile: true,
          store: true,
          lines: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ orders });
    }

    if (session.role === 'PHARMACIST' || session.role === 'OPS') {
      const orders = await db.order.findMany({
        include: {
          customer: true,
          familyProfile: true,
          store: true,
          lines: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ orders });
    }

    if (session.role === 'STORE_STAFF') {
      const orders = await db.order.findMany({
        where: { storeId: session.storeId || undefined },
        include: {
          customer: true,
          familyProfile: true,
          store: true,
          lines: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ orders });
    }

    return NextResponse.json({ orders: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(['CUSTOMER']);
    const formData = await req.formData();

    const familyProfileId = (formData.get('familyProfileId') as string) || null;
    const addressText = (formData.get('addressText') as string) || 'Salt Lake, Kolkata';
    const addressLat = parseFloat((formData.get('addressLat') as string) || '22.5875');
    const addressLng = parseFloat((formData.get('addressLng') as string) || '88.4190');
    const paymentMethod = (formData.get('paymentMethod') as 'MOCK_UPI' | 'COD') || 'COD';
    const file = formData.get('prescription') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Prescription image is required.' }, { status: 400 });
    }

    // Validate size (≤5MB) and MIME type (JPEG/PNG) per ASSUMPTION A6
    const fileValidation = validatePrescriptionFile({ size: file.size, type: file.type });
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    // Read bytes
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Encrypt prescription image with AES-256-GCM
    const enc = encryptPrescription(imageBuffer);

    // Fetch active catalogue products for fuzzy matching
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

    // Run AI pipeline (GeminiReader if key present, else MockReader)
    const reader = process.env.GEMINI_API_KEY ? new GeminiReader() : new MockReader('valid');
    const aiResult = await reader.read(imageBuffer, file.type || 'image/png');

    // Generate unique display ID (RX-NNNNN)
    const count = await db.order.count();
    const displayId = `RX-${50220 + count}`;

    // Calculate default prescription valid-until date (6 months)
    const validUntil = computePrescriptionValidUntil(new Date(), 6);

    // Match lines against catalogue
    const matchedLines = (aiResult.data?.lines || []).map((aiLine) => {
      const match = matchPrescriptionLine(aiLine, catalogue);
      return {
        aiLine,
        match,
      };
    });

    // Provisional Store Routing based on stock coverage
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

    const requirements: OrderItemRequirement[] = matchedLines
      .filter((l) => l.match.matchedProduct && !l.match.isBlockedNotSoldOnline)
      .map((l) => ({
        productId: l.match.matchedProduct!.id,
        quantity: l.aiLine.quantity || 1,
      }));

    let provisionalStoreId: string | null = null;
    if (requirements.length > 0 && storeItems.length > 0) {
      try {
        const routeResult = routeOrderToStore(
          { lat: addressLat, lng: addressLng },
          storeItems,
          requirements
        );
        provisionalStoreId = routeResult.assignedStoreId;
      } catch {
        provisionalStoreId = storeItems[0]?.storeId || null;
      }
    }

    // Create Order and Lines in DB
    const order = await db.order.create({
      data: {
        displayId,
        customerId: session.userId,
        familyProfileId,
        storeId: provisionalStoreId,
        status: 'SUBMITTED',
        addressText,
        addressLat,
        addressLng,
        paymentMethod,
        prescriptionEncrypted: new Uint8Array(enc.encrypted),
        prescriptionIv: new Uint8Array(enc.iv),
        prescriptionAuthTag: new Uint8Array(enc.authTag),
        prescriptionMime: file.type || 'image/png',
        prescriptionStatus: 'PENDING',
        prescriptionValidUntil: validUntil,
        aiImageLegibility: aiResult.data?.image_legibility
          ? (aiResult.data.image_legibility.toUpperCase() as 'CLEAR' | 'PARTIAL' | 'UNREADABLE')
          : 'CLEAR',
        aiPrescriberText: aiResult.data?.prescriber_text,
        aiDateText: aiResult.data?.date_text,
        aiModelName: aiResult.modelName,
        aiLatencyMs: aiResult.latencyMs,
        manualEntryNeeded: aiResult.manualEntryNeeded,
        lines: {
          create: matchedLines.map((item) => ({
            productId: item.match.matchedProduct?.id,
            rawText: item.aiLine.raw_text,
            aiDrugName: item.aiLine.drug_name,
            aiStrength: item.aiLine.strength,
            aiConfidence: item.match.confidence,
            aiAlternatives: item.match.topCandidates as unknown as object,
            lineStatus: item.match.isBlockedNotSoldOnline
              ? 'BLOCKED_NOT_SOLD_ONLINE'
              : 'PENDING',
            quantity: item.aiLine.quantity || 1,
            unitPrice: item.match.matchedProduct?.price || null,
            needsReview: item.match.needsReview,
            rejectReason: item.match.reason || null,
          })),
        },
        auditEvents: {
          create: {
            actorId: session.userId,
            actorRole: session.role,
            fromStatus: 'DRAFT',
            toStatus: 'SUBMITTED',
            reason: 'Order placed by customer with prescription upload',
          },
        },
      },
      include: {
        lines: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        displayId: order.displayId,
        status: order.status,
        manualEntryNeeded: order.manualEntryNeeded,
        linesCount: order.lines.length,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create order';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

