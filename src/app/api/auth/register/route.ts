// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requestOtp } from '@/lib/auth/otp';

export const RegisterInputSchema = z.object({
  phone: z
    .string()
    .transform((p) => p.trim().replace(/\D/g, ''))
    .refine((p) => /^[6-9]\d{9}$/.test(p.length === 12 && p.startsWith('91') ? p.slice(2) : p), {
      message: 'Must be a valid 10-digit Indian mobile number (starting with 6-9)',
    })
    .transform((p) => (p.length === 12 && p.startsWith('91') ? p.slice(2) : p)),
  name: z.string().min(2, 'Full name must be at least 2 characters').max(60),
  role: z.literal('CUSTOMER', {
    message: 'Only CUSTOMER role self-registration is allowed',
  }),
  addressText: z.string().min(5, 'Delivery address must be at least 5 characters'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  lat: z.number().optional().default(22.5867),
  lng: z.number().optional().default(88.4178),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
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

    const { phone, name, addressText, pincode, lat, lng } = parsed.data;

    // Check for existing user
    const existing = await db.user.findUnique({
      where: { phone },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: 'An account with this phone number already exists. Please log in directly.',
        },
        { status: 409 }
      );
    }

    // Lookup pincode coordinates if available in database table, else use provided/default
    const pinCoord = await db.pincodeCoord.findUnique({ where: { pincode } });
    const finalLat = pinCoord?.lat ?? lat;
    const finalLng = pinCoord?.lng ?? lng;

    // Atomic Prisma write creating User, CustomerAddress, and default Self FamilyProfile
    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          phone,
          name,
          role: 'CUSTOMER',
          language: 'en',
        },
      });

      await tx.customerAddress.create({
        data: {
          userId: newUser.id,
          label: 'Home',
          addressText,
          pincode,
          lat: finalLat,
          lng: finalLng,
        },
      });

      await tx.familyProfile.create({
        data: {
          userId: newUser.id,
          name,
          relationship: 'Self',
        },
      });

      return newUser;
    });

    // Automatically trigger real OTP generation for the registered user
    const otpResult = await requestOtp(phone);

    return NextResponse.json(
      {
        success: true,
        message: 'Account registered successfully. Verification code dispatched.',
        mockOtp: otpResult.mockOtp,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
