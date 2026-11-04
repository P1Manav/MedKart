// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import db from '@/lib/db';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name cannot exceed 80 characters'),
});

export async function GET() {
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
        },
      },
    },
  });

  return NextResponse.json({
    authenticated: true,
    user: {
      ...session,
      name: dbUser?.name || session.name,
      familyProfiles: dbUser?.familyProfiles || [],
      addresses: dbUser?.addresses || [],
    },
    demoMode,
  });
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

    const updated = await db.user.update({
      where: { id: session.userId },
      data: { name: parsed.data.name },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
