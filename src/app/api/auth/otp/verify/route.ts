// src/app/api/auth/otp/verify/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/auth/otp';
import { setSessionCookie } from '@/lib/auth/session';
import type { UserRole } from '@prisma/client';

const VerifySchema = z.object({
  phone: z.string().min(10),
  otp: z.string().length(6, 'Verification code must be 6 digits'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid code format' },
        { status: 400 }
      );
    }

    const result = await verifyOtp(parsed.data.phone, parsed.data.otp);
    if (!result.success || !result.user) {
      return NextResponse.json({ success: false, message: result.message }, { status: 401 });
    }

    // Set signed HTTP-only session cookie
    await setSessionCookie({
      userId: result.user.id,
      phone: result.user.phone,
      name: result.user.name,
      role: result.user.role as UserRole,
      pharmacistRegNo: result.user.pharmacistRegNo,
      storeId: result.user.storeId,
    });

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: result.user,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

