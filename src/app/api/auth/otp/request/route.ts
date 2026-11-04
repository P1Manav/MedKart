// src/app/api/auth/otp/request/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestOtp } from '@/lib/auth/otp';

const RequestSchema = z.object({
  phone: z.string().min(10, 'Mobile number must be at least 10 digits'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const result = await requestOtp(parsed.data.phone);
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 429 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

