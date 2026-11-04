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

    orders.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      if (o.storeId) {
        storeOrderCounts[o.storeId] = (storeOrderCounts[o.storeId] || 0) + 1;
      }
    });

    const ordersByStore = allStores.map((s) => ({
      storeId: s.id,
      storeName: s.name,
      address: s.address,
      orderCount: storeOrderCounts[s.id] || 0,
    }));

    // 3. Verification SLA & Rejection Breakdown from Audit Logs
    const verificationAudits = await db.orderAudit.findMany({
      where: {
        toStatus: { in: ['APPROVED', 'ON_HOLD', 'REJECTED'] },
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

    // Map order creation to first verification action
    const orderCreatedMap = new Map(orders.map((o) => [o.id, o.createdAt.getTime()]));
    const firstVerificationPerOrder = new Map<string, number>();
    const rejectionReasonsMap: Record<string, number> = {};
    let rejectedCount = 0;
    let totalVerifications = 0;

    verificationAudits.forEach((audit) => {
      totalVerifications++;
      if (audit.toStatus === 'REJECTED') {
        rejectedCount++;
        const r = audit.reason || 'Other / Unspecified';
        rejectionReasonsMap[r] = (rejectionReasonsMap[r] || 0) + 1;
      }

      if (!firstVerificationPerOrder.has(audit.orderId)) {
        const createdMs = orderCreatedMap.get(audit.orderId);
        if (createdMs) {
          const duration = Math.max(0, audit.timestamp.getTime() - createdMs);
          firstVerificationPerOrder.set(audit.orderId, duration);
        }
      }
    });

    const durationsMs = Array.from(firstVerificationPerOrder.values());
    const medianVerificationMinutes = calculateMedianSlaMinutes(durationsMs);

    const rejectionRate =
      totalVerifications > 0
        ? Number(((rejectedCount / totalVerifications) * 100).toFixed(1))
        : null;

    const rejectionBreakdown = Object.entries(rejectionReasonsMap).map(([reason, count]) => ({
      reason,
      count,
    }));

    // 4. Blocked items count (Schedule X / Narcotics / unsellable items)
    const blockedItemsCount = await db.orderLine.count({
      where: {
        lineStatus: 'BLOCKED_NOT_SOLD_ONLINE',
      },
    });

    return NextResponse.json({
      success: true,
      metrics: {
        activeStoresCount,
        totalOrdersCount: orders.length,
        statusCounts,
        ordersByStore,
        medianVerificationMinutes,
        rejectionRate,
        rejectionBreakdown,
        blockedItemsCount,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to compute ops metrics';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
