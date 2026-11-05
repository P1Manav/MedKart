// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'medkart_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || 'dev_session_secret_at_least_32_characters_long_for_signing';
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  let session: { userId: string; role: string; name: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecretKey(), {
        algorithms: ['HS256'],
      });
      session = payload as unknown as { userId: string; role: string; name: string };
    } catch {
      session = null;
    }
  }

  // Redirect unauthenticated requests to login with redirect param
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.role;

  // Role-based access control guards
  if (pathname.startsWith('/pharmacist') && role !== 'PHARMACIST' && role !== 'OPS') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (pathname.startsWith('/store') && role !== 'STORE_STAFF' && role !== 'OPS') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (pathname.startsWith('/ops') && role !== 'OPS') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (pathname.startsWith('/customer') && role !== 'CUSTOMER' && role !== 'OPS') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/customer/:path*',
    '/pharmacist/:path*',
    '/store/:path*',
    '/ops/:path*',
  ],
};
