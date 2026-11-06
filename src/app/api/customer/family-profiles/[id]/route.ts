// src/app/api/customer/family-profiles/[id]/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import db from '@/lib/db';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-error';

const UpdateFamilyProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must be at most 60 characters').optional(),
  relationship: z.string().trim().min(2, 'Relationship must be at least 2 characters').max(30, 'Relationship must be at most 30 characters').optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await db.familyProfile.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Family profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateFamilyProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const updated = await db.familyProfile.update({
      where: { id },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.relationship && { relationship: parsed.data.relationship.toLowerCase() }),
      },
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: unknown) {
    return handleApiError(err, 'customer/family-profiles/[id]');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await db.familyProfile.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Family profile not found' }, { status: 404 });
    }

    // Check if this family profile has associated orders
    const orderCount = await db.order.count({
      where: { familyProfileId: id },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete family profile with existing order history' },
        { status: 400 }
      );
    }

    // Delete any refill trackers associated with this profile first
    await db.refillTracker.deleteMany({
      where: { familyProfileId: id },
    });

    await db.familyProfile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Family member removed successfully' });
  } catch (err: unknown) {
    return handleApiError(err, 'customer/family-profiles/[id]');
  }
}
