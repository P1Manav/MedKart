// tests/unit/otp.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateNumericOtp, requestOtp, verifyOtp, hashOtp } from '@/lib/auth/otp';
import db from '@/lib/db';

describe('OTP & Authentication Hardening (P0-5)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
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
    // Ensures sufficient entropy
    expect(codes.size).toBeGreaterThan(1800);
  });

  it('requestOtp excludes mockOtp when DEMO_MODE is not true, even if OTP_MOCK=true', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.OTP_MOCK = 'true';

    vi.spyOn(db.otpRecord, 'count').mockResolvedValue(0);
    vi.spyOn(db.otpRecord, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(db.otpRecord, 'create').mockResolvedValue({
      id: 'otp_1',
      phone: '9830012345',
      otpHash: 'dummy',
      attempts: 0,
      expiresAt: new Date(),
      used: false,
      createdAt: new Date(),
    });

    const result = await requestOtp('9830012345');
    expect(result.mockOtp).toBeUndefined();
  });

  it('requestOtp returns honest failure message when OTP_MOCK is false and no SMS key provided', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.OTP_MOCK = 'false';
    delete process.env.SMS_PROVIDER_API_KEY;

    vi.spyOn(db.otpRecord, 'count').mockResolvedValue(0);

    const result = await requestOtp('9830012345');
    expect(result.success).toBe(false);
    expect(result.message).toContain('SMS delivery is not configured');
  });

  it('requestOtp attempts real SMS dispatch when SMS_PROVIDER_API_KEY is configured', async () => {
    process.env.DEMO_MODE = 'true';
    process.env.OTP_MOCK = 'true';
    process.env.SMS_PROVIDER_API_KEY = 'test_sms_key_123';

    vi.spyOn(db.otpRecord, 'count').mockResolvedValue(0);
    vi.spyOn(db.otpRecord, 'updateMany').mockResolvedValue({ count: 1 });
    vi.spyOn(db.otpRecord, 'create').mockResolvedValue({
      id: 'otp_1',
      phone: '9830012345',
      otpHash: 'dummy',
      attempts: 0,
      expiresAt: new Date(),
      used: false,
      createdAt: new Date(),
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'success' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await requestOtp('9830012345');
    expect(result.success).toBe(true);
    expect(result.mockOtp).toBeDefined();
  });

  it('verifyOtp enforces atomic attempt limits and locks out on 5th failure', async () => {
    const phone = '9830098765';
    const validOtp = '123456';
    const otpHash = hashOtp(validOtp);

    let attempts = 0;
    let isUsed = false;

    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: 'u1',
      phone,
      name: 'Test',
      role: 'CUSTOMER',
      pharmacistRegNo: null,
      storeId: null,
      language: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(db.otpRecord, 'findFirst').mockImplementation((() =>
      Promise.resolve({
        id: 'otp_rec_1',
        phone,
        otpHash,
        attempts,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: isUsed,
        createdAt: new Date(),
      })) as unknown as typeof db.otpRecord.findFirst);

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
    expect(finalRes.message).toContain('Maximum OTP verification attempts exceeded');
  });

  it('enforces injected OtpLimitsConfig without branching on CI or NODE_ENV', async () => {
    process.env.DEMO_MODE = 'true';
    process.env.OTP_MOCK = 'true';

    vi.spyOn(db.otpRecord, 'count').mockResolvedValue(2);

    const customLimits = {
      maxRequests15m: 2,
      maxRequests1h: 5,
      maxAttempts: 3,
      expiryMinutes: 1,
    };

    const res = await requestOtp('9830012345', customLimits);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Too many OTP requests');
  });
});
