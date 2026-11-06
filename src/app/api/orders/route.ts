// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import type { OrderStatus } from '@prisma/client';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { encryptPrescription } from '@/lib/crypto/encrypt';
import { getPrescriptionReader } from '@/lib/ai';
import { matchPrescriptionLine, type CatalogueProduct } from '@/lib/ai/fuzzy-matcher';
import { routeOrderToStore, type StoreStockItem, type OrderItemRequirement } from '@/domain/routing';
import { handleApiError } from '@/lib/api-error';
import { computePrescriptionValidUntil } from '@/domain/assert-dispatchable';
import { CreateOrderInputSchema, PrescriptionFileSchema } from '@/lib/validators/order-input';
import { validateMagicBytes, stripExifGps } from '@/lib/validators/upload';

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
  routingIssue: true,
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
          genericOriginals: {
            select: {
              id: true,
              genericProduct: {
                select: {
                  id: true,
                  name: true,
                  strength: true,
                  form: true,
                  price: true,
                  packSize: true,
                },
              },
            },
          },
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
      // Return store-assigned orders or unassigned network orders
      if (!session.storeId) {
        return NextResponse.json({ orders: [], nextCursor: null });
      }

      const orders = await db.order.findMany({
        where: {
          OR: [
            { storeId: session.storeId },
            { storeId: null },
          ],
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
    return handleApiError(err, 'orders/GET');
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(['CUSTOMER']);
    const formData = await req.formData();

    // Check optional pre-selected cart items
    const cartItemsRaw = formData.get('cartItems') as string | null;
    let rawCartItems: unknown = [];
    if (cartItemsRaw) {
      try {
        rawCartItems = JSON.parse(cartItemsRaw);
      } catch {
        return NextResponse.json(
          {
            error: 'Invalid cartItems format: must be valid JSON array',
            fieldErrors: { cartItems: ['Invalid JSON format'] },
          },
          { status: 400 }
        );
      }
    }

    const consentVal = formData.get('directUpiConsent');
    const rawInput = {
      addressText: formData.get('addressText') ?? undefined,
      addressLat: formData.get('addressLat') ?? undefined,
      addressLng: formData.get('addressLng') ?? undefined,
      paymentMethod: formData.get('paymentMethod') ?? undefined,
      familyProfileId: formData.get('familyProfileId') || null,
      cartItems: rawCartItems,
      directUpiConsent: consentVal === 'true' || consentVal === '1',
    };

    const parsedInput = CreateOrderInputSchema.safeParse(rawInput);
    if (!parsedInput.success) {
      return handleApiError(parsedInput.error, 'orders/create');
    }

    const {
      addressText,
      addressLat,
      addressLng,
      paymentMethod,
      familyProfileId,
      cartItems,
    } = parsedInput.data;

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

    // Defence-in-depth: Validate cart items against active catalogue and schedule rules
    let cartProducts: Array<{ id: string; price: number; schedule: import('@prisma/client').ScheduleType }> = [];
    if (cartItems.length > 0) {
      const cartProductIds = cartItems.map((c) => c.productId);
      cartProducts = await db.product.findMany({
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

    let finalPaymentMethod = paymentMethod;
    if (finalPaymentMethod === 'DIRECT_UPI') {
      const serverTotal = cartProducts.reduce((sum, p) => {
        const item = cartItems.find((c) => c.productId === p.id);
        return sum + p.price * (item?.quantity || 1);
      }, 0);
      const maxAmountInr = Number(process.env.UPI_MAX_AMOUNT_INR) || 100;
      if (serverTotal > maxAmountInr) {
        // Amount exceeds UPI_MAX_AMOUNT_INR: fallback to sandbox payment per spec
        finalPaymentMethod = 'MOCK_UPI';
      }
    }

    const file = formData.get('prescription') as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        {
          error: 'Prescription image is required.',
          fieldErrors: { prescription: ['Prescription image file is required'] },
        },
        { status: 400 }
      );
    }

    const fileValidation = PrescriptionFileSchema.safeParse({ size: file.size, type: file.type });
    if (!fileValidation.success) {
      const msg = fileValidation.error.issues[0]?.message || 'Invalid prescription image';
      return NextResponse.json(
        {
          error: msg,
          fieldErrors: { prescription: [msg] },
        },
        { status: 400 }
      );
    }

    // Read bytes
    const arrayBuffer = await file.arrayBuffer();
    let imageBuffer: Buffer = Buffer.from(arrayBuffer);

    // Magic bytes verification
    const magicResult = validateMagicBytes(imageBuffer);
    if (!magicResult.valid) {
      return NextResponse.json(
        {
          error: magicResult.error || 'Invalid file format',
          fieldErrors: { prescription: [magicResult.error || 'Invalid file format'] },
        },
        { status: 400 }
      );
    }

    // Strip EXIF / GPS metadata before saving
    imageBuffer = stripExifGps(imageBuffer);

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
    let routingIssue: string | null = null;

    if (requirements.length > 0) {
      if (storeItems.length > 0) {
        try {
          const routeResult = routeOrderToStore(
            { lat: addressLat, lng: addressLng },
            storeItems,
            requirements
          );
          provisionalStoreId = routeResult.assignedStoreId;
          if (!routeResult.isFullCoverage) {
            routingIssue = 'Partial stock at nearest store; requires multi-store split or warehouse dispatch';
          }
        } catch {
          provisionalStoreId = null;
          routingIssue = 'No stocked store found within delivery range';
        }
      } else {
        provisionalStoreId = null;
        routingIssue = 'No active stores available for order routing';
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
        routingIssue,
        status: finalPaymentMethod === 'DIRECT_UPI' ? 'PAYMENT_PENDING_VERIFICATION' : 'SUBMITTED',
        addressText,
        addressLat,
        addressLng,
        paymentMethod: finalPaymentMethod,
        directUpiConsent: parsedInput.data.directUpiConsent,
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
            toStatus: finalPaymentMethod === 'DIRECT_UPI' ? 'PAYMENT_PENDING_VERIFICATION' : 'SUBMITTED',
            reason: finalPaymentMethod === 'DIRECT_UPI'
              ? 'Order placed with Direct UPI transfer awaiting staff verification of transaction reference'
              : 'Order placed by customer with prescription upload',
          },
        },
      },
      include: {
        lines: {
          include: { product: true },
        },
      },
    });

    // Surface simulated notifications to customer message outbox (Mock honesty)
    await db.messageOutbox.create({
      data: {
        userId: session.userId,
        channel: 'WHATSAPP',
        content: `MedKart Order ${order.displayId} placed! Your prescription is in queue for registered pharmacist verification. Track status: /customer/order/${order.id}`,
        status: 'SENT_MOCK',
      },
    }).catch(() => null);

    if (finalPaymentMethod === 'MOCK_UPI') {
      await db.messageOutbox.create({
        data: {
          userId: session.userId,
          channel: 'SMS',
          content: `MedKart: Sandbox payment confirmed for Order ${order.displayId}. (Razorpay Sandbox Mode — No real money charged).`,
          status: 'SENT_MOCK',
        },
      }).catch(() => null);
    } else if (finalPaymentMethod === 'DIRECT_UPI') {
      await db.messageOutbox.create({
        data: {
          userId: session.userId,
          channel: 'SMS',
          content: `MedKart: Direct UPI transfer pending verification for Order ${order.displayId}. Store staff will confirm receipt against transaction note before dispatch.`,
          status: 'SENT_MOCK',
        },
      }).catch(() => null);
    }

    const calculatedOrderTotal = allLinesToCreate.reduce(
      (sum, line) => sum + (line.unitPrice || 0) * (line.quantity || 1),
      0
    );

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        displayId: order.displayId,
        status: order.status,
        storeId: order.storeId,
        routingIssue: order.routingIssue,
        manualEntryNeeded: order.manualEntryNeeded,
        linesCount: order.lines.length,
        totalAmount: calculatedOrderTotal,
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, 'orders/POST');
  }
}

