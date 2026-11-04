// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import type { OrderStatus } from '@prisma/client';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { encryptPrescription } from '@/lib/crypto/encrypt';
import { getPrescriptionReader } from '@/lib/ai';
import { matchPrescriptionLine, type CatalogueProduct } from '@/lib/ai/fuzzy-matcher';
import { routeOrderToStore, type StoreStockItem, type OrderItemRequirement } from '@/domain/routing';
import { computePrescriptionValidUntil } from '@/domain/assert-dispatchable';
import { validatePrescriptionFile } from '@/lib/validators/upload';

export const safeOrderSelect = {
  id: true,
  displayId: true,
  customerId: true,
  familyProfileId: true,
  storeId: true,
  status: true,
  addressText: true,
  addressLat: true,
  addressLng: true,
  paymentMethod: true,
  prescriptionMime: true,
  prescriptionStatus: true,
  prescriptionValidUntil: true,
  aiImageLegibility: true,
  aiPrescriberText: true,
  aiDateText: true,
  aiModelName: true,
  aiLatencyMs: true,
  manualEntryNeeded: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
  familyProfile: {
    select: {
      id: true,
      name: true,
      relationship: true,
    },
  },
  store: {
    select: {
      id: true,
      name: true,
      address: true,
      pincode: true,
    },
  },
  lines: {
    select: {
      id: true,
      productId: true,
      rawText: true,
      aiDrugName: true,
      aiStrength: true,
      aiConfidence: true,
      aiAlternatives: true,
      lineStatus: true,
      quantity: true,
      unitPrice: true,
      needsReview: true,
      rejectReason: true,
      pharmacistId: true,
      pharmacistRegNo: true,
      customerConsentGeneric: true,
      product: {
        select: {
          id: true,
          name: true,
          strength: true,
          form: true,
          schedule: true,
          price: true,
          packSize: true,
        },
      },
    },
  },
  auditEvents: {
    select: {
      id: true,
      actorRole: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      timestamp: true,
    },
    orderBy: { timestamp: 'desc' as const },
  },
};

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const url = new URL(req.url);

    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100);
    const cursor = url.searchParams.get('cursor');
    const statusFilter = (url.searchParams.get('status') as OrderStatus | null) || undefined;
    const storeFilter = url.searchParams.get('storeId') || undefined;

    const paginationArgs = {
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    };

    if (session.role === 'CUSTOMER') {
      const orders = await db.order.findMany({
        where: {
          customerId: session.userId,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        select: safeOrderSelect,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs,
      });

      const hasMore = orders.length > limit;
      const results = hasMore ? orders.slice(0, limit) : orders;
      const nextCursor = hasMore ? results[results.length - 1]?.id : null;

      return NextResponse.json({ orders: results, nextCursor });
    }

    if (session.role === 'PHARMACIST' || session.role === 'OPS') {
      const orders = await db.order.findMany({
        where: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(storeFilter ? { storeId: storeFilter } : {}),
        },
        select: safeOrderSelect,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs,
      });

      const hasMore = orders.length > limit;
      const results = hasMore ? orders.slice(0, limit) : orders;
      const nextCursor = hasMore ? results[results.length - 1]?.id : null;

      return NextResponse.json({ orders: results, nextCursor });
    }

    if (session.role === 'STORE_STAFF') {
      // Fix storeId undefined over-fetching bug: if storeId is missing, return empty
      if (!session.storeId) {
        return NextResponse.json({ orders: [], nextCursor: null });
      }

      const orders = await db.order.findMany({
        where: {
          storeId: session.storeId,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        select: safeOrderSelect,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs,
      });

      const hasMore = orders.length > limit;
      const results = hasMore ? orders.slice(0, limit) : orders;
      const nextCursor = hasMore ? results[results.length - 1]?.id : null;

      return NextResponse.json({ orders: results, nextCursor });
    }

    return NextResponse.json({ orders: [], nextCursor: null });
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

    if (familyProfileId) {
      const familyProfile = await db.familyProfile.findUnique({
        where: { id: familyProfileId },
        select: { userId: true },
      });
      if (!familyProfile || familyProfile.userId !== session.userId) {
        return NextResponse.json(
          { error: 'Invalid family profile or access denied.' },
          { status: 403 }
        );
      }
    }
    const addressText = (formData.get('addressText') as string) || 'Salt Lake, Kolkata';
    const addressLat = parseFloat((formData.get('addressLat') as string) || '22.5875');
    const addressLng = parseFloat((formData.get('addressLng') as string) || '88.4190');
    const paymentMethod = (formData.get('paymentMethod') as 'MOCK_UPI' | 'COD') || 'COD';
    const file = formData.get('prescription') as File | null;

    // Check optional pre-selected cart items
    const cartItemsRaw = formData.get('cartItems') as string | null;
    let cartItems: Array<{ productId: string; quantity: number }> = [];
    if (cartItemsRaw) {
      try {
        cartItems = JSON.parse(cartItemsRaw);
      } catch {
        cartItems = [];
      }
    }

    // Defence-in-depth: Validate cart items against active catalogue and schedule rules
    if (cartItems.length > 0) {
      const cartProductIds = cartItems.map((c) => c.productId);
      const cartProducts = await db.product.findMany({
        where: { id: { in: cartProductIds }, active: true },
      });

      if (cartProducts.length !== new Set(cartProductIds).size) {
        return NextResponse.json(
          { error: 'One or more selected products were not found in the active catalogue.' },
          { status: 400 }
        );
      }

      const allScheduleRules = await db.scheduleRule.findMany();
      const rulesMap = new Map(allScheduleRules.map((r) => [r.schedule, r]));

      for (const p of cartProducts) {
        const rule = rulesMap.get(p.schedule);
        if (rule && !rule.canSellOnline) {
          return NextResponse.json(
            { error: 'This item cannot be ordered online. Please visit your nearest store.' },
            { status: 400 }
          );
        }
      }
    }

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

    // Run AI pipeline via production-safe reader factory
    const reader = getPrescriptionReader();
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

    const cartProductDetails = cartItems.length > 0
      ? await db.product.findMany({ where: { id: { in: cartItems.map((c) => c.productId) } } })
      : [];
    const cartProdMap = new Map(cartProductDetails.map((p) => [p.id, p]));

    const cartRequirements: OrderItemRequirement[] = cartItems.map((c) => ({
      productId: c.productId,
      quantity: c.quantity || 1,
    }));

    const aiRequirements: OrderItemRequirement[] = matchedLines
      .filter((l) => l.match.matchedProduct && !l.match.isBlockedNotSoldOnline)
      .map((l) => ({
        productId: l.match.matchedProduct!.id,
        quantity: l.aiLine.quantity || 1,
      }));

    const requirements = [...cartRequirements, ...aiRequirements];

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

    const cartLinesToCreate = cartItems.map((c) => {
      const prod = cartProdMap.get(c.productId);
      return {
        productId: c.productId,
        rawText: `Cart Selection: ${prod?.name || ''} ${prod?.strength || ''}`.trim(),
        aiDrugName: prod?.name || null,
        aiStrength: prod?.strength || null,
        aiConfidence: 1.0,
        aiAlternatives: {} as unknown as object,
        lineStatus: 'PENDING' as const,
        quantity: c.quantity || 1,
        unitPrice: prod?.price || null,
        needsReview: prod?.schedule !== 'OTC',
        rejectReason: null,
      };
    });

    const aiLinesToCreate = matchedLines.map((item) => ({
      productId: item.match.matchedProduct?.id,
      rawText: item.aiLine.raw_text,
      aiDrugName: item.aiLine.drug_name,
      aiStrength: item.aiLine.strength,
      aiConfidence: item.aiLine.confidence,
      aiAlternatives: {
        topCandidates: item.match.topCandidates,
        matcherScore: item.match.confidence,
      } as unknown as object,
      lineStatus: item.match.isBlockedNotSoldOnline
        ? ('BLOCKED_NOT_SOLD_ONLINE' as const)
        : ('PENDING' as const),
      quantity: item.aiLine.quantity || 1,
      unitPrice: item.match.matchedProduct?.price || null,
      needsReview: item.match.needsReview,
      rejectReason: item.match.reason || null,
    }));

    const allLinesToCreate = cartLinesToCreate.length > 0 ? cartLinesToCreate : aiLinesToCreate;

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
          : 'UNREADABLE',
        aiPrescriberText: aiResult.data?.prescriber_text,
        aiDateText: aiResult.data?.date_text,
        aiModelName: aiResult.modelName,
        aiLatencyMs: aiResult.latencyMs,
        manualEntryNeeded: aiResult.manualEntryNeeded,
        lines: {
          create: allLinesToCreate,
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

