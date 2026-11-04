// src/app/api/cron/reminders/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { isRefillReminderDue } from '@/domain/refill';

export interface RunRemindersOptions {
  asOfDate?: Date;
  isOpsCaller?: boolean;
}

export async function runRemindersJob(options: RunRemindersOptions = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  // Ignore asOfDate in production unless explicitly called by OPS
  const effectiveAsOfDate = isProduction && !options.isOpsCaller ? new Date() : (options.asOfDate || new Date());

  // Query active refill trackers where reminder hasn't been sent yet for this cycle
  const trackers = await db.refillTracker.findMany({
    where: { reminderSent: false },
    include: {
      familyProfile: {
        include: { user: true },
      },
      product: true,
    },
  });

  let remindersTriggered = 0;
  const dispatched = [];

  for (const tracker of trackers) {
    const isDue = isRefillReminderDue(
      tracker.runOutDate,
      tracker.remindDaysBefore,
      effectiveAsOfDate,
      tracker.reminderSent
    );

    if (isDue) {
      remindersTriggered++;

      // 1. Mark tracker reminderSent = true (Idempotency)
      await db.refillTracker.update({
        where: { id: tracker.id },
        data: { reminderSent: true },
      });

      const patientName = tracker.familyProfile.name;
      const medicineName = `${tracker.product.name} ${tracker.product.strength}`;
      const runOutFormatted = tracker.runOutDate.toISOString().split('T')[0];

      // 2. Create in-app notification
      await db.notification.create({
        data: {
          userId: tracker.familyProfile.userId,
          title: `Refill Reminder: ${medicineName}`,
          body: `Your supply for ${patientName} is running low (est. run-out date: ${runOutFormatted}). Tap to reorder before you run out.`,
          link: `/customer/order/new?refillTrackerId=${tracker.id}`,
        },
      });

      // 3. Write row to message_outbox (mock WhatsApp/SMS per DPDP & client spec)
      const msg = await db.messageOutbox.create({
        data: {
          userId: tracker.familyProfile.userId,
          channel: 'WHATSAPP',
          content: `[MedKart Pharmacy Reminder] Hello, your monthly medicine ${medicineName} for ${patientName} will run out on ${runOutFormatted}. Reorder online in 1 minute: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/customer/home`,
          status: 'SENT_MOCK',
        },
      });

      dispatched.push({
        trackerId: tracker.id,
        medicine: medicineName,
        patient: patientName,
        messageId: msg.id,
      });
    }
  }

  return {
    success: true,
    asOfDate: effectiveAsOfDate.toISOString(),
    evaluatedCount: trackers.length,
    remindersTriggered,
    dispatched,
  };
}

async function handleCronRequest(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: CRON_SECRET must be configured
    if (!cronSecret || !cronSecret.trim()) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron request. Bearer token required.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const asOfParam = url.searchParams.get('asOfDate');
    const asOfDate = asOfParam ? new Date(asOfParam) : new Date();

    const result = await runRemindersJob({ asOfDate });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Cron failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Export BOTH GET and POST (Vercel Cron triggers GET)
export async function GET(req: Request) {
  return handleCronRequest(req);
}

export async function POST(req: Request) {
  return handleCronRequest(req);
}
