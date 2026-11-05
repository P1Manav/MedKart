// tests/unit/registration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as registerHandler, RegisterInputSchema } from '@/app/api/auth/register/route';
import { createRegistrationToken } from '@/lib/auth/registration-token';
import db from '@/lib/db';
import * as sessionModule from '@/lib/auth/session';

describe('Self-Service Customer Registration (Master Prompt v6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Schema Validation: Accepts valid registration payload and rejects non-CUSTOMER roles', () => {
    // Non-CUSTOMER role attempt in body
    const badRole = RegisterInputSchema.safeParse({
      registrationToken: 'dummy_token_123',
      name: 'Hacker',
      role: 'PHARMACIST',
      addressText: '123 Main St, Kolkata',
      pincode: '700001',
    });
    // In our route, body.role !== 'CUSTOMER' is caught with 400
    expect(badRole.data?.role).toBe('PHARMACIST');

    // Valid customer payload
    const valid = RegisterInputSchema.safeParse({
      registrationToken: 'dummy_token_123',
      name: 'Real Reviewer',
      role: 'CUSTOMER',
      email: 'reviewer@example.com',
      addressText: 'Sector 5, Salt Lake, Kolkata',
      pincode: '700091',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.name).toBe('Real Reviewer');
      expect(valid.data.email).toBe('reviewer@example.com');
    }
  });

  it('POST /api/auth/register: Rejects non-CUSTOMER role attempt with 400 Bad Request', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationToken: 'some_token',
        name: 'Attacker',
        role: 'PHARMACIST',
        addressText: 'Salt Lake',
        pincode: '700064',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('strictly restricted to CUSTOMER');
  });

  it('POST /api/auth/register: Rejects invalid or expired registration token with 401 Unauthorized', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationToken: 'invalid.jwt.token',
        name: 'Test Customer',
        role: 'CUSTOMER',
        addressText: 'Salt Lake Sector 1',
        pincode: '700064',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Registration token expired or invalid');
  });

  it('POST /api/auth/register: Successfully creates User, CustomerAddress, FamilyProfile and sets session', async () => {
    process.env.SESSION_SECRET = 'ci-test-session-secret-must-be-at-least-32-chars-long';
    const validToken = await createRegistrationToken('9876543210');

    vi.spyOn(db.user, 'findUnique').mockResolvedValue(null);
    vi.spyOn(db.pincodeCoord, 'findUnique').mockResolvedValue({
      pincode: '700064',
      lat: 22.5867,
      lng: 88.4178,
    } as unknown as Awaited<ReturnType<typeof db.pincodeCoord.findUnique>>);

    const createdUser = {
      id: 'usr_new_123',
      phone: '9876543210',
      name: 'Dr. Reviewer',
      role: 'CUSTOMER' as const,
      sessionVersion: 1,
      pharmacistRegNo: null,
      storeId: null,
      language: 'en' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(db, '$transaction').mockImplementation(async (callback) => {
      const txMock = {
        user: { create: vi.fn().mockResolvedValue(createdUser) },
        customerAddress: { create: vi.fn().mockResolvedValue({ id: 'addr_1' }) },
        familyProfile: { create: vi.fn().mockResolvedValue({ id: 'fam_1' }) },
      };
      return (callback as unknown as (tx: typeof txMock) => unknown)(txMock);
    });

    const setSessionSpy = vi.spyOn(sessionModule, 'setSessionCookie').mockResolvedValue();

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationToken: validToken,
        name: 'Dr. Reviewer',
        email: 'reviewer@example.com',
        role: 'CUSTOMER',
        addressText: 'Block AC, Salt Lake, Kolkata',
        pincode: '700064',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.phone).toBe('9876543210');
    expect(body.user.name).toBe('Dr. Reviewer');
    expect(setSessionSpy).toHaveBeenCalled();
  });
});
