// tests/unit/metrics.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateMedianSlaMinutes } from '@/lib/metrics';
import { GET as getMetricsHandler } from '@/app/api/ops/metrics/route';
import * as rbac from '@/lib/auth/rbac';
import db from '@/lib/db';

describe('Operational Metrics Calculations (P0-7, Fix #3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates median verification time correctly for odd number of durations', () => {
    // 5 minutes, 10 minutes, 15 minutes
    const durations = [15 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000];
    const median = calculateMedianSlaMinutes(durations);
    expect(median).toBe(10);
  });

  it('calculates median verification time correctly for even number of durations', () => {
    // 6, 8, 12, 16 minutes -> median is (8 + 12)/2 = 10 minutes
    const durations = [16 * 60 * 1000, 6 * 60 * 1000, 8 * 60 * 1000, 12 * 60 * 1000];
    const median = calculateMedianSlaMinutes(durations);
    expect(median).toBe(10);
  });

  it('returns null when duration list is empty', () => {
    const median = calculateMedianSlaMinutes([]);
    expect(median).toBeNull();
  });

  describe('GET /api/ops/metrics live computation', () => {
    const mockOpsUser = {
      userId: 'ops_1',
      phone: '9830099999',
      role: 'OPS' as const,
      name: 'Central Ops Admin',
    };

    it('computes live store counts, line rejection rate, and Schedule X block rate from DB', async () => {
      vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockOpsUser);

      // Stores
      vi.spyOn(db.store, 'count').mockResolvedValue(10);
      vi.spyOn(db.store, 'findMany').mockResolvedValue([
        { id: 'store_1', name: 'Salt Lake', address: 'Sector 1' },
        { id: 'store_2', name: 'Behala', address: 'Chowrasta' },
      ] as unknown as Awaited<ReturnType<typeof db.store.findMany>>);

      // Orders
      vi.spyOn(db.order, 'findMany').mockResolvedValue([
        { id: 'ord_1', status: 'PACKED', storeId: 'store_1', createdAt: new Date('2026-11-04T10:00:00Z') },
        { id: 'ord_2', status: 'SUBMITTED', storeId: null, createdAt: new Date('2026-11-04T10:10:00Z') },
      ] as unknown as Awaited<ReturnType<typeof db.order.findMany>>);

      // Order Audits
      vi.spyOn(db.orderAudit, 'findMany').mockResolvedValue([
        {
          orderId: 'ord_1',
          fromStatus: 'SUBMITTED',
          toStatus: 'APPROVED',
          reason: 'Pharmacist approved',
          timestamp: new Date('2026-11-04T10:08:00Z'), // 8 minutes duration
        },
      ] as unknown as Awaited<ReturnType<typeof db.orderAudit.findMany>>);

      // Order lines counts
      vi.spyOn(db.orderLine, 'count')
        .mockResolvedValueOnce(50) // total lines
        .mockResolvedValueOnce(5)  // rejected lines (10%)
        .mockResolvedValueOnce(2);  // blocked Schedule X lines (4%)

      // Outbox
      vi.spyOn(db.messageOutbox, 'findMany').mockResolvedValue([
        {
          id: 'msg_1',
          userId: 'cust_1',
          channel: 'WHATSAPP',
          content: 'Refill Reminder for Metformin',
          status: 'SENT_MOCK',
          createdAt: new Date('2026-11-04T10:05:00Z'),
          user: { name: 'Debasish', phone: '9830011111' },
        },
      ] as unknown as Awaited<ReturnType<typeof db.messageOutbox.findMany>>);

      const res = await getMetricsHandler();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.metrics.activeStoresCount).toBe(10);
      expect(data.metrics.totalOrdersCount).toBe(2);
      expect(data.metrics.unassignedOrdersCount).toBe(1);
      expect(data.metrics.medianVerificationMinutes).toBe(8);
      expect(data.metrics.rejectionRate).toBe(10); // 5 / 50 * 100
      expect(data.metrics.blockedItemsCount).toBe(2);
      expect(data.metrics.blockedItemsRate).toBe(4); // 2 / 50 * 100
      expect(data.metrics.recentOutboxMessages).toHaveLength(1);
    });

    it('returns empty/zero states gracefully when database has no orders or lines', async () => {
      vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockOpsUser);

      vi.spyOn(db.store, 'count').mockResolvedValue(0);
      vi.spyOn(db.store, 'findMany').mockResolvedValue([]);
      vi.spyOn(db.order, 'findMany').mockResolvedValue([]);
      vi.spyOn(db.orderAudit, 'findMany').mockResolvedValue([]);
      vi.spyOn(db.orderLine, 'count').mockResolvedValue(0);
      vi.spyOn(db.messageOutbox, 'findMany').mockResolvedValue([]);

      const res = await getMetricsHandler();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.metrics.activeStoresCount).toBe(0);
      expect(data.metrics.totalOrdersCount).toBe(0);
      expect(data.metrics.unassignedOrdersCount).toBe(0);
      expect(data.metrics.medianVerificationMinutes).toBeNull();
      expect(data.metrics.rejectionRate).toBeNull();
      expect(data.metrics.blockedItemsCount).toBe(0);
      expect(data.metrics.blockedItemsRate).toBeNull();
      expect(data.metrics.recentOutboxMessages).toEqual([]);
    });
  });
});
