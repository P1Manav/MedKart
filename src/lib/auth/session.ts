// src/lib/auth/session.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from '@prisma/client';

const SESSION_COOKIE_NAME = 'medkart_session';
const DEFAULT_EXPIRATION = '7d';

export interface SessionPayload {
  userId: string;
  phone: string;
  role: UserRole;
  name: string;
  sessionVersion?: number;
  pharmacistRegNo?: string | null;
  storeId?: string | null;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is not configured or is shorter than 32 characters. Cannot sign session token.');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(DEFAULT_EXPIRATION)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();

  let isSecure = process.env.NODE_ENV === 'production';
  try {
    const { headers } = await import('next/headers');
    const headerStore = await headers();
    const host = headerStore.get('host') || headerStore.get('x-forwarded-host') || '';
    const proto = headerStore.get('x-forwarded-proto') || '';
    if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      isSecure = true;
    }
    if (proto === 'https') {
      isSecure = true;
    }
  } catch {
    // If headers() is unavailable outside request context, rely on isSecure
  }

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

