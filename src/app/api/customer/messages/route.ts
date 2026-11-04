// src/app/api/customer/messages/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth, AuthorizationError } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messages = await db.messageOutbox.findMany({
      where: {
        userId: session.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        channel: m.channel,
        content: m.content,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
