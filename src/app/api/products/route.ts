// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import type { ScheduleType } from '@prisma/client';
import db from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q')?.trim() || '';
    const schedule = url.searchParams.get('schedule') as ScheduleType | null;

    const whereClause: {
      active: boolean;
      name?: { contains: string; mode: 'insensitive' };
      schedule?: ScheduleType;
    } = {
      active: true,
    };

    if (query) {
      whereClause.name = { contains: query, mode: 'insensitive' };
    }

    if (schedule) {
      whereClause.schedule = schedule;
    }

    const [products, scheduleRules] = await Promise.all([
      db.product.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        take: 50,
        select: {
          id: true,
          name: true,
          strength: true,
          form: true,
          packSize: true,
          price: true,
          schedule: true,
          genericGroupId: true,
        },
      }),
      db.scheduleRule.findMany(),
    ]);

    const rulesMap = new Map(scheduleRules.map((r) => [r.schedule, r]));

    const enriched = products.map((p) => {
      const rule = rulesMap.get(p.schedule);
      return {
        ...p,
        canSellOnline: rule ? rule.canSellOnline : true,
        requiresPrescription: rule ? rule.requiresPrescription : false,
        requiresPharmacistApproval: rule ? rule.requiresPharmacistApproval : false,
        requiresRegisterEntry: rule ? rule.requiresRegisterEntry : false,
      };
    });

    return NextResponse.json({ success: true, products: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch catalogue products';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
