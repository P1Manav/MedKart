// src/app/api/ops/metrics/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { calculateMedianSlaMinutes } from '@/lib/metrics';

export async function GET() {
  try {
    await requireAuth(['OPS']);

    // 1. Store counts
    const activeStoresCount = await db.store.count({ where: { active: true } });
    const allStores = await db.store.findMany({
      where: { active: true },
      select: { id: true, name: true, address: true },
    });

    // 2. Orders volume & status counts
    const orders = await db.order.findMany({
      select: {
        id: true,
        status: true,
        storeId: true,
        createdAt: true,
      },
    });

    const statusCounts: Record<string, number> = {};
    const storeOrderCounts: Record<string, number> = {};
    let unassignedOrdersCount = 0;

    orders.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      if (o.storeId) {
        storeOrderCounts[o.storeId] = (storeOrderCounts[o.storeId] || 0) + 1;
      } else {
        unassignedOrdersCount++;
      }
    });

    const ordersByStore = allStores.map((s) => ({
      storeId: s.id,
      storeName: s.name,
      address: s.address,
      orderCount: storeOrderCounts[s.id] || 0,
    }));

    // 3. Verification SLA between SUBMITTED and APPROVED/REJECTED
    const verificationAudits = await db.orderAudit.findMany({
      where: {
        fromStatus: 'SUBMITTED',
        toStatus: { in: ['APPROVED', 'REJECTED'] },
      },
      select: {
        orderId: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    const orderCreatedMap = new Map(orders.map((o) => [o.id, o.createdAt.getTime()]));
    const firstVerificationDurations: number[] = [];
    const recordedOrderIds = new Set<string>();
    const rejectionReasonsMap: Record<string, number> = {};

    verificationAudits.forEach((audit) => {
      if (audit.toStatus === 'REJECTED') {
        const r = audit.reason || 'Other / Unspecified';
        rejectionReasonsMap[r] = (rejectionReasonsMap[r] || 0) + 1;
      }

      if (!recordedOrderIds.has(audit.orderId)) {
        recordedOrderIds.add(audit.orderId);
        const createdMs = orderCreatedMap.get(audit.orderId);
        if (createdMs) {
          const duration = Math.max(0, audit.timestamp.getTime() - createdMs);
          firstVerificationDurations.push(duration);
        }
      }
    });

    const medianVerificationMinutes = calculateMedianSlaMinutes(firstVerificationDurations);

    // 4. Line Status Rejection Rate & Schedule X Block Rate
    const totalLinesCount = await db.orderLine.count();
    const rejectedLinesCount = await db.orderLine.count({
      where: { lineStatus: 'REJECTED' },
    });
    const blockedItemsCount = await db.orderLine.count({
      where: { lineStatus: 'BLOCKED_NOT_SOLD_ONLINE' },
    });

    const rejectionRate =
      totalLinesCount > 0
        ? Number(((rejectedLinesCount / totalLinesCount) * 100).toFixed(1))
        : null;

    const blockedItemsRate =
      totalLinesCount > 0
        ? Number(((blockedItemsCount / totalLinesCount) * 100).toFixed(1))
        : null;

    const rejectionBreakdown = Object.entries(rejectionReasonsMap).map(([reason, count]) => ({
      reason,
      count,
    }));

    // 5. Recent Dispatches from Message Outbox (Section 4 Honesty)
    const recentOutboxMessages = await db.messageOutbox.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, phone: true },
        },
      },
    });

    // 6. Orders awaiting refund settlement
    const refundDueOrders = await db.order.findMany({
      where: { status: 'REFUND_DUE' },
      select: {
        id: true,
        displayId: true,
        paymentMethod: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
        auditEvents: {
          select: { reason: true, timestamp: true },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      metrics: {
        activeStoresCount,
        totalOrdersCount: orders.length,
        statusCounts,
        ordersByStore,
        unassignedOrdersCount,
        medianVerificationMinutes,
        rejectionRate,
        rejectionBreakdown,
        blockedItemsCount,
        blockedItemsRate,
        totalLinesCount,
        refundDueOrders: refundDueOrders.map((r) => ({
          id: r.id,
          displayId: r.displayId || r.id,
          paymentMethod: r.paymentMethod || 'COD',
          customerName: r.customer?.name || 'Customer',
          customerPhone: r.customer?.phone || '',
          reason: r.auditEvents?.[0]?.reason || 'Order cancelled/rejected',
          createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt || Date.now())).toISOString(),
        })),
        recentOutboxMessages: recentOutboxMessages.map((m) => ({
          id: m.id,
          recipient: `${m.user.name} (${m.user.phone})`,
          channel: m.channel,
          content: m.content,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to compute ops metrics';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
