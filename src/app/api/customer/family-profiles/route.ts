// src/app/api/customer/family-profiles/route.ts
import { NextResponse } from 'next/server';
import { requireAuth, AuthorizationError } from '@/lib/auth/rbac';
import db from '@/lib/db';
import { z } from 'zod';

const CreateFamilyProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must be at most 60 characters'),
  relationship: z.string().trim().min(2, 'Relationship must be at least 2 characters').max(30, 'Relationship must be at most 30 characters'),
});

export async function GET() {
  try {
    const session = await requireAuth();
    const profiles = await db.familyProfile.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ success: true, profiles });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch family profiles' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = CreateFamilyProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const profile = await db.familyProfile.create({
      data: {
        userId: session.userId,
        name: parsed.data.name,
        relationship: parsed.data.relationship.toLowerCase(),
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create family profile' }, { status: 500 });
  }
}

