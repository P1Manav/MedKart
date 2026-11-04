// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  const demoMode = process.env.DEMO_MODE === 'true';

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null, demoMode });
  }

  return NextResponse.json({
    authenticated: true,
    user: session,
    demoMode,
  });
}

