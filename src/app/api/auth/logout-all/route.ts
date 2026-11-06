// src/app/api/auth/logout-all/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { clearSessionCookie } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api-error';

export async function POST() {
  try {
    const session = await requireAuth();

    // Increment sessionVersion in database to invalidate all active tokens for this user
    await db.user.update({
      where: { id: session.userId },
      data: { sessionVersion: { increment: 1 } },
    });

    // Clear current device's cookie
    await clearSessionCookie();

    return NextResponse.json({
      success: true,
      message: 'All active sessions on all devices have been signed out.',
    });
  } catch (err: unknown) {
    return handleApiError(err, 'auth/logout-all');
  }
}
