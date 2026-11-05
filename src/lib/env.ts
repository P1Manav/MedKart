// src/lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  PRESCRIPTION_ENC_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'PRESCRIPTION_ENC_KEY must be exactly 64 hex characters (32 bytes AES-256)'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  OTP_MOCK: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_DEMO_MODE: z.enum(['true', 'false']).optional(),
  HF_API_TOKEN: z.string().optional(),
  HF_OCR_MODEL: z.string().default('microsoft/trocr-base-handwritten'),
  PAYMENT_GATEWAY_KEY_ID: z.string().optional(),
  PAYMENT_GATEWAY_KEY_SECRET: z.string().optional(),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().optional(),
  SMS_PROVIDER_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let validatedEnv: Env | null = null;

export function getEnv(): Env {
  if (validatedEnv) return validatedEnv;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment configuration error (fail-closed):\n${errorDetails}`);
  }

  validatedEnv = result.data;
  return validatedEnv;
}
