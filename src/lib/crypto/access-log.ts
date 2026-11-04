// src/lib/crypto/access-log.ts
import { createHash } from 'crypto';
import db from '../db';
import type { AccessAction } from '@prisma/client';

export function hashIpAddress(ip: string): string {
  return createHash('sha256').update(ip.trim()).digest('hex').substring(0, 32);
}

export interface LogAccessParams {
  userId: string;
  userRole: string;
  orderId: string;
  action: AccessAction;
  clientIp?: string;
}

/**
 * Writes an append-only audit entry whenever a prescription image is viewed or downloaded.
 * Implements DPDP Act 2023 compliance for sensitive health data.
 */
export async function logPrescriptionAccess(params: LogAccessParams): Promise<void> {
  const ipHash = hashIpAddress(params.clientIp || '127.0.0.1');

  await db.prescriptionAccessLog.create({
    data: {
      userId: params.userId,
      userRole: params.userRole,
      orderId: params.orderId,
      action: params.action,
      ipHash,
    },
  });
}
