// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api-error';

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (err: unknown) {
    return handleApiError(err, 'auth/logout');
  }
}

