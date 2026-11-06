// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import db from '@/lib/db';
import { z } from 'zod';
import { Language } from '@prisma/client';
import { handleApiError } from '@/lib/api-error';

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name cannot exceed 80 characters').optional(),
  email: z.string().trim().email('Invalid email address').max(100).optional().or(z.literal('')),
  language: z.enum(['en', 'hi', 'bn']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  defaultAddress: z.object({
    addressText: z.string().trim().min(5, 'Address must be at least 5 characters'),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid 6-digit Indian PIN code'),
    lat: z.number().optional(),
    lng: z.number().optional(),
    label: z.string().optional(),
  }).optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    const demoMode = process.env.DEMO_MODE === 'true';

    if (!session) {
      return NextResponse.json({ authenticated: false, user: null, demoMode });
    }

    const dbUser = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        email: true,
        emailVerified: true,
        language: true,
        theme: true,
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

    return NextResponse.json({
      authenticated: true,
      user: {
        ...session,
        name: dbUser?.name || session.name,
        email: dbUser?.email || null,
        emailVerified: dbUser?.emailVerified || false,
        language: dbUser?.language || 'en',
        theme: dbUser?.theme || 'system',
        sessionVersion: dbUser?.sessionVersion || 1,
        familyProfiles: dbUser?.familyProfiles || [],
        addresses: dbUser?.addresses || [],
      },
      demoMode,
    });
  } catch (err: unknown) {
    return handleApiError(err, 'auth/me');
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid profile data' },
        { status: 400 }
      );
    }

    const { name, email, language, theme, defaultAddress } = parsed.data;
    const updateData: {
      name?: string;
      email?: string | null;
      language?: Language;
      theme?: string;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email === '' ? null : email;
    if (language !== undefined) updateData.language = language as Language;
    if (theme !== undefined) updateData.theme = theme;

    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        email: true,
        emailVerified: true,
        language: true,
        theme: true,
        sessionVersion: true,
      },
    });

    if (defaultAddress) {
      const existingAddress = await db.customerAddress.findFirst({
        where: { userId: session.userId },
      });

      if (existingAddress) {
        await db.customerAddress.update({
          where: { id: existingAddress.id },
          data: {
            addressText: defaultAddress.addressText,
            pincode: defaultAddress.pincode,
            label: defaultAddress.label || existingAddress.label,
            lat: defaultAddress.lat ?? existingAddress.lat,
            lng: defaultAddress.lng ?? existingAddress.lng,
          },
        });
      } else {
        await db.customerAddress.create({
          data: {
            userId: session.userId,
            addressText: defaultAddress.addressText,
            pincode: defaultAddress.pincode,
            label: defaultAddress.label || 'Home',
            lat: defaultAddress.lat ?? 22.5726,
            lng: defaultAddress.lng ?? 88.3639,
          },
        });
      }
    }

    const response = NextResponse.json({ success: true, user: updatedUser });

    // Synchronize cookies
    if (language) {
      response.cookies.set('NEXT_LOCALE', language, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    }
    if (theme) {
      response.cookies.set('medkart_theme', theme, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'This email is already in use by another account' }, { status: 409 });
    }
    return handleApiError(err, 'auth/me');
  }
}
