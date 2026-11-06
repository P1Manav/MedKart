// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import type { ScheduleType } from '@prisma/client';
import db from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q')?.trim() || '';
    const schedule = url.searchParams.get('schedule') as ScheduleType | null;
    const otcOnlyParam = url.searchParams.get('otcOnly') === 'true';
    const session = await getSession();
    const publicOtcOnly = process.env.PUBLIC_CATALOGUE_OTC_ONLY === 'true';

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

    if (otcOnlyParam || (!session && publicOtcOnly)) {
      whereClause.schedule = 'OTC';
    } else if (schedule) {
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
    return handleApiError(err, 'products');
  }
}
