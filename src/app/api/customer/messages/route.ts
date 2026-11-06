// src/app/api/customer/messages/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { handleApiError } from '@/lib/api-error';

export async function GET() {
  try {
    const session = await requireAuth();

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
    return handleApiError(err, 'customer/messages');
  }
}
