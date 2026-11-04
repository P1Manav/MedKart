// tests/unit/customer-messages.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/customer/messages/route';
import db from '@/lib/db';
import { requireAuth, AuthorizationError } from '@/lib/auth/rbac';

vi.mock('@/lib/db', () => ({
  default: {
    messageOutbox: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/rbac', () => ({
  requireAuth: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {
    constructor(msg?: string) {
      super(msg || 'Unauthorized');
      this.name = 'AuthorizationError';
    }
  },
}));

describe('Customer Outbox Messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthorizationError('Authentication required.'));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('fetches only the authenticated customer messages', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      userId: 'user_cust_1',
      role: 'CUSTOMER',
      phone: '9830011111',
      name: 'Debasish Ghosh',
    });

    const mockMessages = [
      {
        id: 'msg_1',
        userId: 'user_cust_1',
        channel: 'WHATSAPP' as const,
        content: 'MedKart Order MK-2026-0001 placed!',
        status: 'SENT_MOCK' as const,
        createdAt: new Date('2026-11-05T01:00:00Z'),
      },
    ];

    vi.mocked(db.messageOutbox.findMany).mockResolvedValue(
      mockMessages as unknown as Awaited<ReturnType<typeof db.messageOutbox.findMany>>
    );

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].content).toContain('MK-2026-0001');

    expect(db.messageOutbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_cust_1' },
      })
    );
  });
});
