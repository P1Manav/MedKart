// tests/unit/otp.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateNumericOtp, requestOtp, verifyOtp, hashOtp, getOtpPepper } from '@/lib/auth/otp';
import db from '@/lib/db';

describe('Production-Grade OTP & Authentication Hardening (Master Prompt v6)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.OTP_PEPPER = 'medkart-test-otp-pepper-at-least-32-chars-long';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('generateNumericOtp generates valid 6-digit codes including boundary 999999', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const code = generateNumericOtp();
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThanOrEqual(999999);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(1800);
  });

  it('hashOtp uses HMAC-SHA256 with per-record salt and pepper', () => {
    const salt1 = 'salt_abc_123';
    const salt2 = 'salt_xyz_456';
    const code = '123456';

    const hash1 = hashOtp(code, salt1);
    const hash2 = hashOtp(code, salt2);

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).not.toBe(hash2); // Salt prevents rainbow tables
  });

  it('getOtpPepper fails closed in production when OTP_PEPPER is missing', () => {
    delete process.env.OTP_PEPPER;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.CI;

    expect(() => getOtpPepper()).toThrow(/OTP_PEPPER environment variable is missing/);
  });

  it('requestOtp: allowlisted demo accounts receive mockOtp when DEMO_MODE=true', async () => {
    process.env.DEMO_MODE = 'true';

    vi.spyOn(db.otpRecord, 'findFirst').mockResolvedValue(null);
    vi.spyOn(db.otpRecord, 'count').mockResolvedValue(0);
    vi.spyOn(db.otpRecord, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(db.otpRecord, 'create').mockResolvedValue({
      id: 'otp_1',
      phone: '9830011111',
      otpHash: 'dummy',
      salt: 'dummy',
      ipAddress: null,
      attempts: 0,
      expiresAt: new Date(),
      used: false,
      createdAt: new Date(),
    });

    const result = await requestOtp('9830011111'); // Debasish Ghosh demo phone
    expect(result.success).toBe(true);
    expect(result.mockOtp).toBeDefined();
    expect(result.mockOtp).toMatch(/^\d{6}$/);
  });

  it('requestOtp: non-demo numbers NEVER receive mockOtp even if DEMO_MODE=true', async () => {
    process.env.DEMO_MODE = 'true';
    process.env.SMS_PROVIDER_API_KEY = 'test_key';

    vi.spyOn(db.otpRecord, 'findFirst').mockResolvedValue(null);
    vi.spyOn(db.otpRecord, 'count').mockResolvedValue(0);
    vi.spyOn(db.otpRecord, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(db.otpRecord, 'create').mockResolvedValue({
      id: 'otp_2',
      phone: '9876543210',
      otpHash: 'dummy',
      salt: 'dummy',
      ipAddress: null,
      attempts: 0,
      expiresAt: new Date(),
      used: false,
      createdAt: new Date(),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    const result = await requestOtp('9876543210'); // Real non-demo phone
    expect(result.success).toBe(true);
    expect(result.mockOtp).toBeUndefined(); // NEVER leaked
  });

  it('requestOtp: non-demo numbers fail with 503 when no SMS provider is configured', async () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.SMS_PROVIDER;
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.SMS_PROVIDER_API_KEY;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.FAST2SMS_API_KEY;

    vi.spyOn(db.otpRecord, 'findFirst').mockResolvedValue(null);
    vi.spyOn(db.otpRecord, 'count').mockResolvedValue(0);
    vi.spyOn(db.otpRecord, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(db.otpRecord, 'create').mockResolvedValue({
      id: 'otp_3',
      phone: '9876543210',
      otpHash: 'dummy',
      salt: 'dummy',
      ipAddress: null,
      attempts: 0,
      expiresAt: new Date(),
      used: false,
      createdAt: new Date(),
    });

    const result = await requestOtp('9876543210');
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.message).toContain('SMS service not configured on this instance');
  });

  it('requestOtp: enforces 30-second cooldown between requests to the same phone', async () => {
    vi.spyOn(db.otpRecord, 'findFirst').mockResolvedValue({
      id: 'recent_1',
      phone: '9830011111',
      otpHash: 'dummy',
      salt: 'dummy',
      ipAddress: null,
      attempts: 0,
      expiresAt: new Date(),
      used: false,
      createdAt: new Date(Date.now() - 10 * 1000), // 10s ago (< 30s)
    });

    const res = await requestOtp('9830011111');
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.message).toContain('30 seconds');
  });

  it('verifyOtp enforces atomic attempt limits and locks out on 5th failure', async () => {
    const phone = '9830098765';
    const validOtp = '123456';
    const salt = 'salt_random_777';
    const otpHash = hashOtp(validOtp, salt);

    let attempts = 0;
    let isUsed = false;

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: 'u1',
      phone,
      name: 'Test Customer',
      role: 'CUSTOMER',
      email: null,
      emailVerified: false,
      sessionVersion: 1,
      theme: 'system',
      pharmacistRegNo: null,
      storeId: null,
      language: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(db.otpRecord, 'findFirst').mockImplementation(((args?: { where?: { attempts?: unknown } }) => {
      if (args?.where?.attempts) {
        return Promise.resolve(attempts >= 5 ? { id: 'locked_rec', attempts } : null);
      }
      return Promise.resolve({
        id: 'otp_rec_1',
        phone,
        otpHash,
        salt,
        ipAddress: null,
        attempts,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: isUsed,
        createdAt: new Date(),
      });
    }) as unknown as typeof db.otpRecord.findFirst);

    vi.spyOn(db.otpRecord, 'updateMany').mockImplementation(((args: { data?: { used?: boolean; attempts?: { increment?: number } } }) => {
      const data = args?.data;
      if (data?.used !== undefined) isUsed = data.used;
      if (data?.attempts?.increment) attempts += data.attempts.increment;
      return Promise.resolve({ count: 1 });
    }) as unknown as typeof db.otpRecord.updateMany);

    // 4 wrong attempts
    for (let i = 0; i < 4; i++) {
      const res = await verifyOtp(phone, '000000');
      expect(res.success).toBe(false);
    }

    // 5th wrong attempt should lock out
    const lockRes = await verifyOtp(phone, '000000');
    expect(lockRes.success).toBe(false);

    // 6th attempt should be blocked due to maximum attempts exceeded
    const finalRes = await verifyOtp(phone, validOtp);
    expect(finalRes.success).toBe(false);
    expect(finalRes.message).toMatch(/Maximum OTP verification attempts exceeded|temporarily locked/);
  });

  it('verifyOtp signals needsRegistration: true without user auto-creation for unseeded phones', async () => {
    const phone = '9876543210';
    const validOtp = '654321';
    const salt = 'salt_unreg_999';
    const otpHash = hashOtp(validOtp, salt);

    vi.spyOn(db.user, 'findUnique').mockResolvedValue(null); // Unregistered user
    vi.spyOn(db.otpRecord, 'findFirst').mockImplementation(((args?: { where?: { attempts?: unknown } }) => {
      if (args?.where?.attempts) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: 'otp_rec_unreg',
        phone,
        otpHash,
        salt,
        ipAddress: null,
        attempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
        createdAt: new Date(),
      });
    }) as unknown as typeof db.otpRecord.findFirst);
    vi.spyOn(db.otpRecord, 'updateMany').mockResolvedValue({ count: 1 });

    const result = await verifyOtp(phone, validOtp);
    expect(result.success).toBe(true);
    expect(result.needsRegistration).toBe(true);
    expect(result.verifiedPhone).toBe(phone);
    expect(result.user).toBeUndefined(); // User not auto-created
  });
});
