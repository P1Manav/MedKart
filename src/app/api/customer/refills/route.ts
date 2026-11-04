// src/app/api/customer/refills/route.ts
import { NextResponse } from 'next/server';
import { requireAuth, AuthorizationError } from '@/lib/auth/rbac';
import db from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();

    // Find all family profile IDs belonging to this user
    const profiles = await db.familyProfile.findMany({
      where: { userId: session.userId },
      select: { id: true },
    });

    const profileIds = profiles.map((p) => p.id);

    const refills = await db.refillTracker.findMany({
      where: {
        familyProfileId: { in: profileIds },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            strength: true,
            packSize: true,
            schedule: true,
            price: true,
          },
        },
        familyProfile: {
          select: {
            id: true,
            name: true,
            relationship: true,
          },
        },
      },
      orderBy: { runOutDate: 'asc' },
    });

    return NextResponse.json({
      success: true,
      refills: refills.map((r) => ({
        id: r.id,
        productName: `${r.product.name} ${r.product.strength}`,
        packSize: r.product.packSize,
        schedule: r.product.schedule,
        unitsDispensed: r.unitsDispensed,
        unitsPerDay: r.unitsPerDay,
        daysOfSupply: r.daysOfSupply,
        runOutDate: r.runOutDate.toISOString(),
        forProfile: `${r.familyProfile.relationship}: ${r.familyProfile.name}`,
      })),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch refills' }, { status: 500 });
  }
}

