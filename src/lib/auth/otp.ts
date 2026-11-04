// src/lib/auth/otp.ts
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import db from '../db';

export const OTP_EXPIRY_MINUTES = 5;
export const MAX_OTP_ATTEMPTS = 5;
export const MAX_OTP_REQUESTS_15M = 5;
export const MAX_OTP_REQUESTS_1H = 10;

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function generateNumericOtp(): string {
  // randomInt in node:crypto is [min, max) exclusive of max
  // [100000, 1000000) generates numbers from 100000 up to 999999 inclusive
  return randomInt(100000, 1000000).toString();
}

export interface RequestOtpResult {
  success: boolean;
  message: string;
  mockOtp?: string; // Included ONLY if DEMO_MODE === 'true'
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  user?: {
    id: string;
    phone: string;
    name: string;
    role: string;
    pharmacistRegNo: string | null;
    storeId: string | null;
  };
}

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const normalizedPhone = phone.trim().replace(/\D/g, '');
  if (normalizedPhone.length < 10) {
    return { success: false, message: 'Invalid phone number format.' };
  }

  // Check mocked SMS provider configuration
  const isMock = process.env.OTP_MOCK === 'true';
  if (!isMock) {
    return {
      success: false,
      message: 'SMS delivery is not configured in this deployment (Mock mode disabled).',
    };
  }

  // Rate limiting check: max requests in last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentRequestsCount = await db.otpRecord.count({
    where: {
      phone: normalizedPhone,
      createdAt: { gte: fifteenMinutesAgo },
    },
  });

  if (recentRequestsCount >= MAX_OTP_REQUESTS_15M) {
    return {
      success: false,
      message: 'Too many OTP requests. Please wait a few minutes before trying again.',
    };
  }

  // Hourly rate limit check (ASSUMPTIONS A7)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyCount = await db.otpRecord.count({
    where: {
      phone: normalizedPhone,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (hourlyCount >= MAX_OTP_REQUESTS_1H) {
    return {
      success: false,
      message: 'Too many requests for this phone number today. Please try again later.',
    };
  }

  const plainOtp = generateNumericOtp();
  const hashedOtp = hashOtp(plainOtp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any previously active OTPs for this phone
  await db.otpRecord.updateMany({
    where: { phone: normalizedPhone, used: false },
    data: { used: true },
  });

  // Create new OTP record
  await db.otpRecord.create({
    data: {
      phone: normalizedPhone,
      otpHash: hashedOtp,
      expiresAt,
      attempts: 0,
      used: false,
    },
  });

  const isDemo = process.env.DEMO_MODE === 'true';

  return {
    success: true,
    message: isDemo
      ? 'OTP generated (Demo Mode active)'
      : 'OTP sent successfully to your phone.',
    mockOtp: isDemo ? plainOtp : undefined,
  };
}

export async function verifyOtp(phone: string, submittedOtp: string): Promise<VerifyOtpResult> {
  const normalizedPhone = phone.trim().replace(/\D/g, '');
  const hashed = hashOtp(submittedOtp.trim());

  // Find latest active OTP record
  const record = await db.otpRecord.findFirst({
    where: {
      phone: normalizedPhone,
      used: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    return { success: false, message: 'No active OTP request found. Please request a new OTP.' };
  }

  // Check attempt limit
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await db.otpRecord.updateMany({
      where: { id: record.id },
      data: { used: true },
    });
    return {
      success: false,
      message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.',
    };
  }

  // Check expiration
  if (new Date() > record.expiresAt) {
    await db.otpRecord.updateMany({
      where: { id: record.id },
      data: { used: true },
    });
    return {
      success: false,
      message: 'OTP has expired. Please request a new one.',
    };
  }

  // Timing-safe hash comparison
  const bufferA = Buffer.from(record.otpHash, 'hex');
  const bufferB = Buffer.from(hashed, 'hex');
  const isMatch = bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);

  if (!isMatch) {
    // Atomic attempt increment guarded by lt: MAX_OTP_ATTEMPTS
    await db.otpRecord.updateMany({
      where: { id: record.id, attempts: { lt: MAX_OTP_ATTEMPTS }, used: false },
      data: { attempts: { increment: 1 } },
    });

    const newAttempts = record.attempts + 1;
    if (newAttempts >= MAX_OTP_ATTEMPTS) {
      await db.otpRecord.updateMany({
        where: { id: record.id },
        data: { used: true },
      });
      return {
        success: false,
        message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.',
      };
    }

    const remaining = MAX_OTP_ATTEMPTS - newAttempts;
    return {
      success: false,
      message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // Success! Atomically mark used
  const consumed = await db.otpRecord.updateMany({
    where: { id: record.id, used: false, attempts: { lt: MAX_OTP_ATTEMPTS } },
    data: { used: true },
  });

  if (consumed.count === 0) {
    return {
      success: false,
      message: 'OTP has already been used or attempts exceeded.',
    };
  }

  // Find or create user
  let user = await db.user.findUnique({
    where: { phone: normalizedPhone },
  });

  if (!user) {
    // Default to customer role if registering for the first time
    user = await db.user.create({
      data: {
        phone: normalizedPhone,
        name: `Customer (${normalizedPhone.slice(-4)})`,
        role: 'CUSTOMER',
      },
    });
  }

  return {
    success: true,
    message: 'OTP verified successfully.',
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      pharmacistRegNo: user.pharmacistRegNo,
      storeId: user.storeId,
    },
  };
}
