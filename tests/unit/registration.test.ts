// tests/unit/registration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as registerHandler, RegisterInputSchema } from '@/app/api/auth/register/route';
import db from '@/lib/db';
import * as otpModule from '@/lib/auth/otp';

describe('Self-Service Customer Registration (Master Prompt v5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Schema Validation: Rejects invalid phone numbers and non-CUSTOMER roles', () => {
    // Bad phone
    const badPhone = RegisterInputSchema.safeParse({
      phone: '12345',
      name: 'John Doe',
      role: 'CUSTOMER',
      addressText: '123 Main St, Kolkata',
      pincode: '700001',
    });
    expect(badPhone.success).toBe(false);

    // Non-CUSTOMER role attempt
    const badRole = RegisterInputSchema.safeParse({
      phone: '9830099991',
      name: 'Hacker',
      role: 'PHARMACIST',
      addressText: '123 Main St, Kolkata',
      pincode: '700001',
    });
    expect(badRole.success).toBe(false);

    // Valid customer payload
    const valid = RegisterInputSchema.safeParse({
      phone: '9876543210',
      name: 'Real Reviewer',
      role: 'CUSTOMER',
      addressText: 'Sector 5, Salt Lake, Kolkata',
      pincode: '700091',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.phone).toBe('9876543210');
      expect(valid.data.role).toBe('CUSTOMER');
    }
  });

  it('POST /api/auth/register: Rejects duplicate phone with 409 Conflict', async () => {
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: 'usr_existing',
      phone: '9876543210',
      name: 'Existing Customer',
      role: 'CUSTOMER',
    } as unknown as Awaited<ReturnType<typeof db.user.findUnique>>);

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9876543210',
        name: 'Duplicate Guy',
        role: 'CUSTOMER',
        addressText: 'Salt Lake Sector 1',
        pincode: '700064',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('already exists');
  });

  it('POST /api/auth/register: Successfully creates User, Address, FamilyProfile and triggers OTP', async () => {
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
      role: 'CUSTOMER',
      language: 'en',
    };

    vi.spyOn(db, '$transaction').mockImplementation(async (callback) => {
      const txMock = {
        user: { create: vi.fn().mockResolvedValue(createdUser) },
        customerAddress: { create: vi.fn().mockResolvedValue({ id: 'addr_1' }) },
        familyProfile: { create: vi.fn().mockResolvedValue({ id: 'fam_1' }) },
      };
      return (callback as unknown as (tx: typeof txMock) => unknown)(txMock);
    });

    vi.spyOn(otpModule, 'requestOtp').mockResolvedValue({
      success: true,
      message: 'OTP sent',
      mockOtp: '456789',
    });

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9876543210',
        name: 'Dr. Reviewer',
        role: 'CUSTOMER',
        addressText: 'Block AC, Salt Lake, Kolkata',
        pincode: '700064',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.mockOtp).toBe('456789');
  });
});
