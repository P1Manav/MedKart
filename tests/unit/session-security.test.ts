// tests/unit/session-security.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCookieSet = vi.fn();
let mockHost = 'localhost:3000';
let mockProto = 'http';
const originalNodeEnv = process.env.NODE_ENV;

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    set: mockCookieSet,
    get: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'host' || name === 'x-forwarded-host') return mockHost;
      if (name === 'x-forwarded-proto') return mockProto;
      return null;
    },
  })),
}));

vi.mock('@/lib/db', () => ({
  default: {
    otpRecord: {
      findFirst: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/otp-providers/chain', () => ({
  defaultOtpChain: {
    dispatch: vi.fn(),
  },
}));

describe('Task 6: Security Knobs Independent of CI & Session Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = 'super-secret-key-that-is-at-least-32-chars-long!';
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  describe('Session Cookie Security (outside localhost & demo mode)', () => {
    it('sets Secure: true when accessed via external host even if DEMO_MODE=true', async () => {
      process.env.DEMO_MODE = 'true';
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      mockHost = 'medkart.vercel.app';
      mockProto = 'https';

      const { setSessionCookie } = await import('@/lib/auth/session');
      await setSessionCookie({
        userId: 'usr_abc',
        phone: '9830012345',
        role: 'CUSTOMER',
        name: 'Anita Roy',
      });

      expect(mockCookieSet).toHaveBeenCalledWith(
        'medkart_session',
        expect.any(String),
        expect.objectContaining({
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      );
    });

    it('sets Secure: false when running on localhost in development', async () => {
      process.env.DEMO_MODE = 'true';
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      mockHost = 'localhost:3000';
      mockProto = 'http';

      const { setSessionCookie } = await import('@/lib/auth/session');
      await setSessionCookie({
        userId: 'usr_abc',
        phone: '9830012345',
        role: 'CUSTOMER',
        name: 'Anita Roy',
      });

      expect(mockCookieSet).toHaveBeenCalledWith(
        'medkart_session',
        expect.any(String),
        expect.objectContaining({
          secure: false,
          httpOnly: true,
        })
      );
    });
  });

  describe('Anti-Enumeration & DB-backed Rate Limits', () => {
    it('OTP request returns identical response for registered and unregistered phones', async () => {
      const db = (await import('@/lib/db')).default;
      const { defaultOtpChain } = await import('@/lib/auth/otp-providers/chain');
      const { requestOtp } = await import('@/lib/auth/otp');

      vi.mocked(db.otpRecord.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpRecord.count).mockResolvedValue(0);
      vi.mocked(db.otpRecord.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(db.otpRecord.create).mockResolvedValue({ id: 'rec_1' } as never);

      vi.mocked(defaultOtpChain.dispatch).mockResolvedValue({
        success: true,
        mockOtpAllowed: false,
      } as never);

      const resRegistered = await requestOtp('9830011111'); // Demo / known registered
      const resUnregistered = await requestOtp('9830098765'); // Unregistered number

      expect(resRegistered.success).toBe(true);
      expect(resUnregistered.success).toBe(true);
      expect(resRegistered.message).toBe('Verification code sent successfully to your phone.');
      expect(resUnregistered.message).toBe('Verification code sent successfully to your phone.');
      expect(resRegistered.mockOtp).toBeUndefined();
      expect(resUnregistered.mockOtp).toBeUndefined();
    });

    it('enforces DB-backed IP rate limit for OTP generation', async () => {
      const db = (await import('@/lib/db')).default;
      const { requestOtp } = await import('@/lib/auth/otp');

      vi.mocked(db.otpRecord.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpRecord.count).mockImplementation((async (args: unknown) => {
        const query = args as { where?: { ipAddress?: string } } | undefined;
        if (query?.where?.ipAddress === '203.0.113.195') {
          return 5; // IP threshold reached
        }
        return 0;
      }) as never);

      const res = await requestOtp('9830077777', undefined, '203.0.113.195');
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(429);
      expect(res.message).toContain('Too many verification requests from this IP address');
    });

    it('enforces DB-backed phone rate limit (15 minute window)', async () => {
      const db = (await import('@/lib/db')).default;
      const { requestOtp } = await import('@/lib/auth/otp');

      vi.mocked(db.otpRecord.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpRecord.count).mockImplementation((async (args: unknown) => {
        const query = args as { where?: { phone?: string } } | undefined;
        if (query?.where?.phone === '9830055555') {
          return 3; // Phone 15m threshold reached
        }
        return 0;
      }) as never);

      const res = await requestOtp('9830055555');
      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(429);
      expect(res.message).toContain('Too many OTP requests. Please wait a few minutes before trying again.');
    });
  });
});
