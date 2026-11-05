// src/app/api/payments/config/route.ts
import { NextResponse } from 'next/server';
import { isGatewayConfigured } from '@/lib/payments/gateway';
import { getUpiConfig } from '@/lib/payments/upi-config';

export async function GET() {
  const upi = getUpiConfig();
  const gateway = isGatewayConfigured();

  return NextResponse.json({
    gatewayConfigured: gateway,
    directUpi: {
      enabled: upi.enabled,
      payeeVpa: upi.payeeVpa,
      payeeName: upi.payeeName,
      maxAmountInr: upi.maxAmountInr,
    },
  });
}
