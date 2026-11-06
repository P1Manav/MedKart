// src/lib/api-error.ts
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { randomBytes } from 'crypto';
import { logger } from './logger';
import { IllegalTransitionError } from '@/domain/order-state';
import { AuthorizationError } from '@/lib/auth/rbac';

export interface ApiErrorResponse {
  error: string;
  errorId?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

export function handleApiError(err: unknown, routeName?: string): NextResponse<ApiErrorResponse> {
  // 1. Zod validation errors
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    err.issues.forEach((issue) => {
      const path = issue.path.join('.') || 'root';
      fieldErrors[path] = fieldErrors[path] || [];
      fieldErrors[path].push(issue.message);
    });
    const firstMsg = err.issues[0]?.message || 'Validation failed';
    return NextResponse.json(
      { error: firstMsg, fieldErrors, success: false },
      { status: 400 }
    );
  }

  // 2. Authorization / Authentication errors
  if (err instanceof AuthorizationError || (err instanceof Error && err.name === 'AuthorizationError')) {
    const lower = err.message.toLowerCase();
    if (lower.includes('authentication required') || lower.includes('please log in') || lower.includes('session has expired')) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required', success: false },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err.message, success: false },
      { status: 403 }
    );
  }

  if (err instanceof Error) {
    const lower = err.message.toLowerCase();

    if (
      lower.includes('forbidden') ||
      lower.includes('insufficient role') ||
      lower.includes('access denied') ||
      lower.includes('not authorized') ||
      lower.includes('permission')
    ) {
      return NextResponse.json(
        { error: err.message, success: false },
        { status: 403 }
      );
    }

    if (
      lower.includes('unauthorized') ||
      lower.includes('session expired') ||
      lower.includes('no session cookie') ||
      lower.includes('invalid or expired session') ||
      lower.includes('authentication required') ||
      lower.includes('please log in')
    ) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required', success: false },
        { status: 401 }
      );
    }

    // Known domain / business logic errors
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json(
        { error: `Invalid order state transition: from ${err.from} to ${err.to}`, success: false },
        { status: 400 }
      );
    }

    if (
      lower.includes('rate limit') ||
      lower.includes('too many') ||
      lower.includes('please wait') ||
      lower.includes('account locked')
    ) {
      return NextResponse.json(
        { error: err.message, success: false },
        { status: 429 }
      );
    }

    if (lower.includes('not found')) {
      return NextResponse.json(
        { error: err.message, success: false },
        { status: 404 }
      );
    }
  }

  // 3. Unhandled, database, internal, or unexpected runtime errors
  const errorId = `err_${Date.now()}_${randomBytes(4).toString('hex')}`;
  logger.error(`[API Error ${errorId}] in ${routeName || 'route'}:`, err);

  return NextResponse.json(
    {
      error: 'Something went wrong',
      errorId,
      success: false,
    },
    { status: 500 }
  );
}
