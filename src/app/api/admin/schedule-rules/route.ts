// src/app/api/admin/schedule-rules/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ScheduleType } from '@prisma/client';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';

const UpdateScheduleRuleSchema = z.object({
  schedule: z.nativeEnum(ScheduleType),
  canSellOnline: z.boolean(),
  requiresPrescription: z.boolean(),
  requiresPharmacistApproval: z.boolean(),
  requiresRegisterEntry: z.boolean(),
});

export async function GET() {
  try {
    await requireAuth(['OPS']);
    const rules = await db.scheduleRule.findMany({
      orderBy: { schedule: 'asc' },
    });
    return NextResponse.json({ success: true, rules });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth(['OPS']);
    const body = await req.json();

    const parsed = UpdateScheduleRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid rule payload' },
        { status: 400 }
      );
    }

    const { schedule, canSellOnline, requiresPrescription, requiresPharmacistApproval, requiresRegisterEntry } = parsed.data;

    const updated = await db.scheduleRule.update({
      where: { schedule },
      data: {
        canSellOnline,
        requiresPrescription,
        requiresPharmacistApproval,
        requiresRegisterEntry,
      },
    });

    console.log(
      `[ScheduleRulesAdmin] Schedule rule updated for ${schedule} by OPS user ${session.userId} (${session.name})`
    );

    return NextResponse.json({ success: true, rule: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
