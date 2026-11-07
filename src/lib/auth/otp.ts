// src/lib/auth/otp.ts
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import db from '../db';
import { defaultOtpChain } from './otp-providers/chain';
import { logger } from '../logger';

export const OTP_EXPIRY_MINUTES = 5;
export const MAX_OTP_ATTEMPTS = 5;
export const MAX_OTP_REQUESTS_15M = 3;
export const MAX_OTP_REQUESTS_IP_15M = 5;
export const MAX_OTP_REQUESTS_1H = 10;
export const OTP_COOLDOWN_SECONDS = 30;

export interface OtpLimitsConfig {
  maxRequests15m: number;
  maxRequests1h: number;
  maxAttempts: number;
  expiryMinutes: number;
  cooldownSeconds?: number;
  allowTestFallback?: boolean;
}

export const DEFAULT_OTP_LIMITS: OtpLimitsConfig = {
  maxRequests15m: MAX_OTP_REQUESTS_15M,
  maxRequests1h: MAX_OTP_REQUESTS_1H,
  maxAttempts: MAX_OTP_ATTEMPTS,
  expiryMinutes: OTP_EXPIRY_MINUTES,
  cooldownSeconds: OTP_COOLDOWN_SECONDS,
  allowTestFallback: false,
};

export const UNLIMITED_OTP_LIMITS: OtpLimitsConfig = {
  maxRequests15m: 999999,
  maxRequests1h: 999999,
  maxAttempts: 999999,
  expiryMinutes: 30,
  cooldownSeconds: 0,
  allowTestFallback: false,
};

export { getOtpPepper } from './pepper';
import { getOtpPepper } from './pepper';

export function hashOtp(otp: string, salt: string = ''): string {
  const pepper = getOtpPepper();
  return createHmac('sha256', pepper).update(`${salt}:${otp}`).digest('hex');
}

export function generateNumericOtp(): string {
  // randomInt in node:crypto is [min, max) exclusive of max
  // [100000, 1000000) generates numbers from 100000 up to 999999 inclusive
  return randomInt(100000, 1000000).toString();
}

export interface RequestOtpResult {
  success: boolean;
  message: string;
  mockOtp?: string; // Included ONLY if DEMO_MODE === 'true' AND allowlisted demo phone
  statusCode?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  needsRegistration?: boolean;
  verifiedPhone?: string;
  user?: {
    id: string;
    phone: string;
    name: string;
    role: string;
    sessionVersion: number;
    pharmacistRegNo: string | null;
    storeId: string | null;
  };
}

export const SEEDED_DEMO_PHONES = ['9830011111', '9830044444', '9830066661', '9830099999'];

export function isDemoPhone(phone: string): boolean {
  const clean = phone.trim().replace(/\D/g, '');
  const allowed = process.env.DEMO_PHONES
    ? process.env.DEMO_PHONES.split(',').map((p) => p.trim())
    : SEEDED_DEMO_PHONES;
  return allowed.includes(clean);
}

export async function requestOtp(
  phone: string,
  limits: OtpLimitsConfig = DEFAULT_OTP_LIMITS,
  ipAddress?: string
): Promise<RequestOtpResult> {
  const normalizedPhone = phone.trim().replace(/\D/g, '');
  if (normalizedPhone.length < 10) {
    return { success: false, message: 'Invalid phone number format.', statusCode: 400 };
  }

  // 1. Cooldown check: cooldown between requests to the same phone
  const cooldownSecs = limits.cooldownSeconds ?? OTP_COOLDOWN_SECONDS;
  if (cooldownSecs > 0) {
    const cooldownThreshold = new Date(Date.now() - cooldownSecs * 1000);
    const recentCooldown = await db.otpRecord.findFirst({
      where: {
        phone: normalizedPhone,
        createdAt: { gte: cooldownThreshold },
      },
    });
    if (recentCooldown) {
      return {
        success: false,
        message: `Please wait ${cooldownSecs} seconds before requesting another verification code.`,
        statusCode: 429,
      };
    }
  }

  // 2. Lockout check: block for 1 hour on 5 failed verify attempts
  if (limits.maxAttempts < 100) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const lockedRecord = await db.otpRecord.findFirst({
      where: {
        phone: normalizedPhone,
        attempts: { gte: limits.maxAttempts },
        createdAt: { gte: oneHourAgo },
      },
    });
    if (lockedRecord && lockedRecord.attempts >= limits.maxAttempts) {
      return {
        success: false,
        message: 'This phone number has been temporarily locked due to repeated failed attempts. Please try again after 1 hour.',
        statusCode: 429,
      };
    }
  }

  // 3. Rate limiting check: max requests in last 15 minutes per phone
  if (limits.maxRequests15m < 1000) {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequestsCount = await db.otpRecord.count({
      where: {
        phone: normalizedPhone,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentRequestsCount >= limits.maxRequests15m) {
      return {
        success: false,
        message: 'Too many OTP requests. Please wait a few minutes before trying again.',
        statusCode: 429,
      };
    }

    // 4. IP rate limit check (5 requests per 15 min per IP)
    if (ipAddress && ipAddress !== '127.0.0.1' && ipAddress !== '::1') {
      const ipCount = await db.otpRecord.count({
        where: {
          ipAddress,
          createdAt: { gte: fifteenMinutesAgo },
        },
      });
      if (ipCount >= MAX_OTP_REQUESTS_IP_15M) {
        return {
          success: false,
          message: 'Too many verification requests from this IP address. Please wait a few minutes.',
          statusCode: 429,
        };
      }
    }
  }

  // 5. Hourly rate limit check
  if (limits.maxRequests1h < 1000) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyCount = await db.otpRecord.count({
      where: {
        phone: normalizedPhone,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (hourlyCount >= limits.maxRequests1h) {
      return {
        success: false,
        message: 'Too many requests for this phone number today. Please try again later.',
        statusCode: 429,
      };
    }
  }

  const plainOtp = generateNumericOtp();
  const salt = randomBytes(16).toString('hex');
  const hashedOtp = hashOtp(plainOtp, salt);
  const expiresAt = new Date(Date.now() + limits.expiryMinutes * 60 * 1000);

  // Invalidate any previously active OTPs for this phone
  await db.otpRecord.updateMany({
    where: { phone: normalizedPhone, used: false },
    data: { used: true },
  });

  // Create new OTP record with salt and ipAddress
  await db.otpRecord.create({
    data: {
      phone: normalizedPhone,
      otpHash: hashedOtp,
      salt,
      ipAddress: ipAddress || null,
      expiresAt,
      attempts: 0,
      used: false,
    },
  });

  // Dispatch via provider chain (Twilio / MSG91 / Fast2SMS / Email / Mock)
  let dispatchSent = false;
  let mockAllowed = false;
  let dispatchError: string | undefined;
  try {
    const dispatch = await defaultOtpChain.dispatch({
      phone: normalizedPhone,
      otp: plainOtp,
      ipAddress,
    });
    dispatchSent = Boolean(dispatch.success);
    mockAllowed = Boolean(dispatch.mockOtpAllowed);
    dispatchError = dispatch.error;
  } catch (err: unknown) {
    logger.warn('[OTP] Provider dispatch threw non-fatal exception:', err);
  }

  // If dispatch failed AND mock is NOT allowed AND limits.allowTestFallback is not set:
  if (!dispatchSent && !mockAllowed && !limits.allowTestFallback) {
    return {
      success: false,
      message: dispatchError || 'SMS service not configured on this instance. Use a demo account or configure MSG91_AUTH_KEY / TWILIO_ACCOUNT_SID.',
      statusCode: 503,
    };
  }

  return {
    success: true,
    message: 'Verification code sent successfully to your phone.',
    mockOtp: (mockAllowed || limits.allowTestFallback) ? plainOtp : undefined,
  };
}

export async function verifyOtp(
  phone: string,
  submittedOtp: string,
  limits: OtpLimitsConfig = DEFAULT_OTP_LIMITS
): Promise<VerifyOtpResult> {
  const normalizedPhone = phone.trim().replace(/\D/g, '');
  if (normalizedPhone.length < 10) {
    return { success: false, message: 'Invalid phone number format.' };
  }

  // 1. Lockout check (1 hour block on 5 failed attempts)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const lockedRecord = await db.otpRecord.findFirst({
    where: {
      phone: normalizedPhone,
      attempts: { gte: limits.maxAttempts },
      createdAt: { gte: oneHourAgo },
    },
  });
  if (lockedRecord && lockedRecord.attempts >= limits.maxAttempts) {
    return {
      success: false,
      message: 'This account has been temporarily locked due to repeated failed attempts. Please try again after 1 hour.',
    };
  }

  // 2. Find latest active OTP record
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

  // 3. Check attempt limit
  if (record.attempts >= limits.maxAttempts) {
    await db.otpRecord.updateMany({
      where: { id: record.id },
      data: { used: true },
    });
    return {
      success: false,
      message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.',
    };
  }

  // 4. Check expiration
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

  // 5. Timing-safe salted HMAC comparison
  const expectedHash = hashOtp(submittedOtp.trim(), record.salt);
  const bufferA = Buffer.from(record.otpHash, 'hex');
  const bufferB = Buffer.from(expectedHash, 'hex');
  const isMatch = bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);

  if (!isMatch) {
    // Atomic attempt increment guarded by lt: limits.maxAttempts
    await db.otpRecord.updateMany({
      where: { id: record.id, attempts: { lt: limits.maxAttempts }, used: false },
      data: { attempts: { increment: 1 } },
    });

    const newAttempts = record.attempts + 1;
    if (newAttempts >= limits.maxAttempts) {
      await db.otpRecord.updateMany({
        where: { id: record.id },
        data: { used: true },
      });
      return {
        success: false,
        message: 'Maximum OTP verification attempts exceeded. Account locked for 1 hour. Please request a new OTP later.',
      };
    }

    const remaining = limits.maxAttempts - newAttempts;
    return {
      success: false,
      message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // Success! Atomically mark used
  const consumed = await db.otpRecord.updateMany({
    where: { id: record.id, used: false, attempts: { lt: limits.maxAttempts } },
    data: { used: true },
  });

  if (consumed.count === 0) {
    return {
      success: false,
      message: 'OTP has already been used or attempts exceeded.',
    };
  }

  // Look up user in database
  const user = await db.user.findUnique({
    where: { phone: normalizedPhone },
  });

  if (!user) {
    // User enumeration defense: do not automatically create user.
    // Signal that registration is needed with this verified phone.
    return {
      success: true,
      needsRegistration: true,
      verifiedPhone: normalizedPhone,
      message: 'Phone verified successfully. Please complete your registration.',
    };
  }

  return {
    success: true,
    message: 'OTP verified successfully.',
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
      pharmacistRegNo: user.pharmacistRegNo,
      storeId: user.storeId,
    },
  };
}
