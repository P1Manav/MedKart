// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const startTime = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          status: 'CONNECTED',
          latencyMs,
        },
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    logger.error('Healthcheck DB ping failed:', err);
    return NextResponse.json(
      {
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        database: {
          status: 'DISCONNECTED',
          error: 'Database ping failed',
        },
      },
      { status: 503 }
    );
  }
}
