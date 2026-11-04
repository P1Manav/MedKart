// tests/unit/secrets-fail-closed.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptPrescription } from '@/lib/crypto/encrypt';
import { createSessionToken } from '@/lib/auth/session';
import { POST as cronPost, GET as cronGet } from '@/app/api/cron/reminders/route';

describe('Secrets Fail-Closed Enforcement (P0-4)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encryptPrescription throws if PRESCRIPTION_ENC_KEY is missing (no fallback)', () => {
    delete process.env.PRESCRIPTION_ENC_KEY;

    expect(() => encryptPrescription(Buffer.from('test'))).toThrow(
      /PRESCRIPTION_ENC_KEY/
    );
  });

  it('createSessionToken throws if SESSION_SECRET is missing (no fallback)', async () => {
    delete process.env.SESSION_SECRET;

    await expect(
      createSessionToken({
        userId: 'u1',
        phone: '9830011111',
        role: 'CUSTOMER',
        name: 'Test',
      })
    ).rejects.toThrow(/SESSION_SECRET/);
  });

  it('cron reminders route rejects requests using query param ?secret= with 401', async () => {
    process.env.CRON_SECRET = 'valid-super-secret-cron-token-123';
    const req = new Request('http://localhost/api/cron/reminders?secret=valid-super-secret-cron-token-123', {
      method: 'POST',
    });

    const res = await cronPost(req);
    expect(res.status).toBe(401);
  });

  it('cron reminders route rejects unauthenticated requests even in development', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    process.env.CRON_SECRET = 'valid-super-secret-cron-token-123';

    const req = new Request('http://localhost/api/cron/reminders', {
      method: 'GET',
    });

    const res = await cronGet(req);
    expect(res.status).toBe(401);
  });
});
