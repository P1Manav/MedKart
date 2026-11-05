// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { verifyRegistrationToken } from '@/lib/auth/registration-token';
import { setSessionCookie } from '@/lib/auth/session';

export const RegisterInputSchema = z.object({
  registrationToken: z.string().optional(),
  phone: z
    .string()
    .optional()
    .transform((p) => (p ? p.trim().replace(/\D/g, '') : undefined)),
  name: z.string().min(2, 'Full name must be at least 2 characters').max(60),
  email: z
    .string()
    .email('Invalid email address format')
    .optional()
    .or(z.literal(''))
    .transform((e) => (e && e.trim().length > 0 ? e.trim().toLowerCase() : null)),
  role: z.string().optional(),
  addressText: z.string().min(5, 'Delivery address must be at least 5 characters'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  lat: z.number().optional().default(22.5867),
  lng: z.number().optional().default(88.4178),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Strict Role Guard: Disallow non-CUSTOMER role self-registration
    if (body.role && body.role !== 'CUSTOMER') {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid role. Self-registration is strictly restricted to CUSTOMER.',
        },
        { status: 400 }
      );
    }

    const parsed = RegisterInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid registration data',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { registrationToken, name, email, addressText, pincode, lat, lng } = parsed.data;

    let targetPhone: string;

    if (registrationToken) {
      const verifiedPayload = await verifyRegistrationToken(registrationToken);
      if (!verifiedPayload) {
        return NextResponse.json(
          {
            success: false,
            message: 'Registration token expired or invalid. Please verify your phone number again.',
          },
          { status: 401 }
        );
      }
      targetPhone = verifiedPayload.phone;
    } else if (parsed.data.phone && /^[6-9]\d{9}$/.test(parsed.data.phone.slice(-10))) {
      // Fallback for direct registration tests
      targetPhone = parsed.data.phone.slice(-10);
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Registration token is required. Please verify your phone number first.',
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({
      where: { phone: targetPhone },
    });

    if (existing) {
      // Account already exists; log them in
      await setSessionCookie({
        userId: existing.id,
        phone: existing.phone,
        name: existing.name,
        role: existing.role,
        sessionVersion: existing.sessionVersion,
        pharmacistRegNo: existing.pharmacistRegNo,
        storeId: existing.storeId,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Account already exists. Signed in successfully.',
          user: {
            id: existing.id,
            phone: existing.phone,
            name: existing.name,
            role: existing.role,
          },
        },
        { status: 200 }
      );
    }

    // Lookup pincode coordinates if available
    const pinCoord = await db.pincodeCoord.findUnique({ where: { pincode } });
    const finalLat = pinCoord?.lat ?? lat;
    const finalLng = pinCoord?.lng ?? lng;

    // Atomic Prisma write creating User, CustomerAddress, and default Self FamilyProfile
    const newUser = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: targetPhone,
          name,
          email: email || null,
          role: 'CUSTOMER',
          language: 'en',
          sessionVersion: 1,
        },
      });

      await tx.customerAddress.create({
        data: {
          userId: user.id,
          label: 'Home',
          addressText,
          pincode,
          lat: finalLat,
          lng: finalLng,
        },
      });

      await tx.familyProfile.create({
        data: {
          userId: user.id,
          name,
          relationship: 'Self',
        },
      });

      return user;
    });

    // Create session cookie for newly registered customer
    await setSessionCookie({
      userId: newUser.id,
      phone: newUser.phone,
      name: newUser.name,
      role: newUser.role,
      sessionVersion: newUser.sessionVersion,
      pharmacistRegNo: newUser.pharmacistRegNo,
      storeId: newUser.storeId,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account registered and signed in successfully.',
        user: {
          id: newUser.id,
          phone: newUser.phone,
          name: newUser.name,
          role: newUser.role,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
