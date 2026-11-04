// src/app/api/ops/run-reminders/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import { runRemindersJob } from '@/app/api/cron/reminders/route';

export async function POST(req: Request) {
  try {
    const session = await requireAuth(['OPS']);

    let asOfDate: Date | undefined;
    try {
      const body = await req.json();
      if (body.asOfDate) {
        asOfDate = new Date(body.asOfDate);
      }
    } catch {
      // Body is optional
    }

    console.log(`[Ops] Reminder run triggered by user ${session.userId} (${session.name})`);
    const result = await runRemindersJob({ asOfDate, isOpsCaller: true });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to run reminders';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
