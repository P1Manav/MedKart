// src/lib/auth/pepper.ts
import { randomBytes } from 'crypto';

let devFallbackPepper: string | null = null;

export function getOtpPepper(): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper || pepper.trim().length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: OTP_PEPPER environment variable is missing or shorter than 16 characters. Refusing to operate in production.'
      );
    }
    if (!devFallbackPepper) {
      devFallbackPepper = randomBytes(32).toString('hex');
    }
    return devFallbackPepper;
  }
  return pepper;
}
