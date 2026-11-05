// src/app/api/auth/check-phone/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';

const CheckPhoneSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CheckPhoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid phone number' },
        { status: 400 }
      );
    }

    const normalized = parsed.data.phone.trim().replace(/\D/g, '');
    const phoneToLookup = normalized.length === 12 && normalized.startsWith('91')
      ? normalized.slice(2)
      : normalized;

    const user = await db.user.findUnique({
      where: { phone: phoneToLookup },
      select: { id: true, name: true, role: true },
    });

    return NextResponse.json({
      success: true,
      exists: Boolean(user),
      name: user?.name,
      role: user?.role,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
