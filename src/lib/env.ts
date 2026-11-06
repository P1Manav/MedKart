// src/lib/env.ts
import { z } from 'zod';
import { logger } from './logger';

const EnvSchema = z.object({
  // Core
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),
  PUBLIC_CATALOGUE_OTC_ONLY: z.enum(['true', 'false']).optional(),

  // Session/Crypto
  SESSION_SECRET: z.string().optional(),
  PRESCRIPTION_ENC_KEY: z.string().optional(),
  OTP_PEPPER: z.string().optional(),

  // OTP/SMS
  SMS_PROVIDER: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  SMS_PROVIDER_TEMPLATE_ID: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  FAST2SMS_API_KEY: z.string().optional(),

  // Email
  EMAIL_PROVIDER: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Demo
  DEMO_MODE: z.enum(['true', 'false']).optional(),
  DEMO_PHONES: z.string().optional(),

  // AI/OCR
  AI_READER: z.enum(['hf', 'tesseract', 'mock']).optional(),
  HF_API_TOKEN: z.string().optional(),
  HF_OCR_MODEL: z.string().default('microsoft/trocr-base-handwritten'),

  // Payments
  PAYMENT_GATEWAY_KEY_ID: z.string().optional(),
  PAYMENT_GATEWAY_KEY_SECRET: z.string().optional(),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().optional(),

  // UPI
  UPI_PAYEE_VPA: z.string().optional(),
  UPI_PAYEE_NAME: z.string().optional(),
  UPI_MAX_AMOUNT_INR: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let validatedEnv: Env | null = null;
let hasWarned = false;

export function validateEnv(env: Record<string, string | undefined> = process.env): Env {
  const isProd = env.NODE_ENV === 'production';
  const errors: string[] = [];

  // In production, required secrets MUST fail closed
  if (isProd) {
    if (!env.DATABASE_URL || env.DATABASE_URL.trim().length === 0) {
      errors.push('DATABASE_URL is required in production');
    }
    if (!env.SESSION_SECRET || env.SESSION_SECRET.trim().length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters in production');
    }
    if (!env.PRESCRIPTION_ENC_KEY || !/^[0-9a-fA-F]{64}$/.test(env.PRESCRIPTION_ENC_KEY.trim())) {
      errors.push('PRESCRIPTION_ENC_KEY must be exactly 64 hex characters (32 bytes AES-256) in production');
    }
    if (!env.CRON_SECRET || env.CRON_SECRET.trim().length < 16) {
      errors.push('CRON_SECRET must be at least 16 characters in production');
    }
    if (!env.OTP_PEPPER || env.OTP_PEPPER.trim().length < 16) {
      errors.push('OTP_PEPPER must be at least 16 characters in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Production environment configuration error (fail-closed):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation error:\n${errorDetails}`);
  }

  // Warn once for optional groups that are disabled (no secret values logged)
  if (!hasWarned && env.NODE_ENV !== 'test') {
    hasWarned = true;
    const data = result.data;

    const hasSms = Boolean(
      data.MSG91_AUTH_KEY ||
      data.TWILIO_ACCOUNT_SID ||
      data.FAST2SMS_API_KEY ||
      data.SMS_PROVIDER === 'mock'
    );
    if (!hasSms) {
      logger.warn('[ENV] SMS provider credentials not configured (MSG91/Twilio/Fast2SMS). Real OTP SMS delivery is disabled.');
    }

    const hasEmail = Boolean(data.RESEND_API_KEY || data.BREVO_API_KEY || data.SMTP_HOST);
    if (!hasEmail) {
      logger.warn('[ENV] Email credentials not configured (Resend/Brevo/SMTP). Email OTP delivery is disabled.');
    }

    const hasPaymentGateway = Boolean(data.PAYMENT_GATEWAY_KEY_ID && data.PAYMENT_GATEWAY_KEY_SECRET);
    if (!hasPaymentGateway) {
      logger.warn('[ENV] Payment gateway credentials not configured. Falling back to sandbox payment modal.');
    }

    const hasDirectUpi = Boolean(data.UPI_PAYEE_VPA);
    if (!hasDirectUpi) {
      logger.warn('[ENV] UPI_PAYEE_VPA not set. Path B Direct UPI option is hidden.');
    }

    const hasHfToken = Boolean(data.HF_API_TOKEN);
    if (!hasHfToken) {
      logger.warn('[ENV] HF_API_TOKEN not set. Tier 1 TrOCR falls back to Tier 2 Tesseract.js WASM.');
    }
  }

  return result.data;
}

export function getEnv(): Env {
  if (validatedEnv) return validatedEnv;
  validatedEnv = validateEnv();
  return validatedEnv;
}
