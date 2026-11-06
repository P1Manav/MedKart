// src/app/api/auth/demo-login/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { setSessionCookie } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api-error';
import { isDemoPhone } from '@/lib/auth/otp';
import type { UserRole } from '@prisma/client';

const DemoLoginSchema = z.object({
  phone: z.string().min(10, 'Mobile number must be at least 10 digits'),
});

export async function POST(req: Request) {
  try {
    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (!isDemoMode && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, message: 'Demo fast-login is disabled in non-demo production.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = DemoLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number format.' },
        { status: 400 }
      );
    }

    const cleanPhone = parsed.data.phone.trim().replace(/\D/g, '');

    if (!isDemoPhone(cleanPhone)) {
      return NextResponse.json(
        { success: false, message: 'Fast-login is only permitted for demo accounts.' },
        { status: 403 }
      );
    }

    // Direct lookup of the demo persona
    const user = await db.user.findUnique({
      where: { phone: cleanPhone },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        email: true,
        emailVerified: true,
        language: true,
        sessionVersion: true,
        pharmacistRegNo: true,
        storeId: true,
        familyProfiles: {
          select: {
            id: true,
            name: true,
            relationship: true,
          },
        },
        addresses: {
          select: {
            id: true,
            label: true,
            addressText: true,
            pincode: true,
            lat: true,
            lng: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: `Demo user for phone ${cleanPhone} not found. Please ensure database is seeded.` },
        { status: 404 }
      );
    }

    // Set signed HTTP-only session cookie
    await setSessionCookie({
      userId: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role as UserRole,
      sessionVersion: user.sessionVersion,
      pharmacistRegNo: user.pharmacistRegNo,
      storeId: user.storeId,
    });

    return NextResponse.json({
      success: true,
      message: `Signed in as demo persona: ${user.name} (${user.role})`,
      user: {
        userId: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        email: user.email,
        emailVerified: user.emailVerified,
        language: user.language,
        sessionVersion: user.sessionVersion,
        pharmacistRegNo: user.pharmacistRegNo,
        storeId: user.storeId,
        familyProfiles: user.familyProfiles,
        addresses: user.addresses,
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, 'auth/demo-login');
  }
}
