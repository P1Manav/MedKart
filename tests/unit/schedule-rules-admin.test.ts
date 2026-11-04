// tests/unit/schedule-rules-admin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '@/app/api/admin/schedule-rules/route';
import * as rbac from '@/lib/auth/rbac';
import db from '@/lib/db';

vi.mock('@/lib/auth/rbac', () => ({
  requireAuth: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock('@/lib/db', () => ({
  default: {
    scheduleRule: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Admin Schedule Rules API (Spec §5.1, Screen 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/admin/schedule-rules rejects non-OPS users', async () => {
    vi.mocked(rbac.requireAuth).mockRejectedValueOnce(
      new Error('Access denied. Role "CUSTOMER" is not authorized for this resource.')
    );

    const res = await GET();
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access denied');
  });

  it('GET /api/admin/schedule-rules returns rules list for OPS user', async () => {
    vi.mocked(rbac.requireAuth).mockResolvedValueOnce({
      userId: 'ops_1',
      phone: '9830099999',
      name: 'Ops Admin',
      role: 'OPS',
    });

    const mockRules = [
      { schedule: 'OTC', canSellOnline: true, requiresPrescription: false, requiresPharmacistApproval: false, requiresRegisterEntry: false },
      { schedule: 'H', canSellOnline: true, requiresPrescription: true, requiresPharmacistApproval: true, requiresRegisterEntry: false },
    ];
    vi.mocked(db.scheduleRule.findMany).mockResolvedValueOnce(
      mockRules as unknown as Awaited<ReturnType<typeof db.scheduleRule.findMany>>
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.rules).toHaveLength(2);
  });

  it('PATCH /api/admin/schedule-rules rejects invalid payload', async () => {
    vi.mocked(rbac.requireAuth).mockResolvedValueOnce({
      userId: 'ops_1',
      phone: '9830099999',
      name: 'Ops Admin',
      role: 'OPS',
    });

    const req = new Request('http://localhost/api/admin/schedule-rules', {
      method: 'PATCH',
      body: JSON.stringify({ schedule: 'INVALID_SCHEDULE' }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('PATCH /api/admin/schedule-rules updates rule when authorized', async () => {
    vi.mocked(rbac.requireAuth).mockResolvedValueOnce({
      userId: 'ops_1',
      phone: '9830099999',
      name: 'Ops Admin',
      role: 'OPS',
    });

    const updatedRule = {
      schedule: 'H' as const,
      canSellOnline: true,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: false,
    };
    vi.mocked(db.scheduleRule.update).mockResolvedValueOnce(
      updatedRule as unknown as Awaited<ReturnType<typeof db.scheduleRule.update>>
    );

    const req = new Request('http://localhost/api/admin/schedule-rules', {
      method: 'PATCH',
      body: JSON.stringify(updatedRule),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.rule.schedule).toBe('H');
  });
});
