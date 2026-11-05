// src/app/api/auth/check-phone/route.ts
import { NextResponse } from 'next/server';

/**
 * Constant-time generic response to prevent phone enumeration attacks (Master Prompt v6).
 * MedKart does not expose whether a phone number is registered prior to OTP verification.
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'Lookup endpoint disabled to protect user privacy.',
  });
}
