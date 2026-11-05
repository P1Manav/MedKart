// src/lib/auth/otp-providers/email.ts
import type { OtpProvider, SendOtpParams, SendOtpResult } from './types';

export class EmailOtpProvider implements OtpProvider {
  readonly name: string;
  readonly channel = 'EMAIL' as const;

  constructor() {
    this.name = process.env.EMAIL_PROVIDER || 'resend';
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.RESEND_API_KEY ||
      process.env.BREVO_API_KEY ||
      process.env.SMTP_HOST
    );
  }

  async send(params: SendOtpParams): Promise<SendOtpResult> {
    if (!params.email) {
      return {
        sent: false,
        provider: this.name,
        channel: this.channel,
        error: 'No email address provided for email OTP fallback',
      };
    }

    if (process.env.RESEND_API_KEY) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'MedKart <noreply@medkart.in>',
            to: params.email,
            subject: `Your MedKart Verification Code: ${params.otp}`,
            text: `Your MedKart verification code is ${params.otp}. It is valid for 5 minutes. Do not share this code with anyone.`,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return { sent: false, provider: 'resend', channel: this.channel, error: `Resend HTTP ${res.status}: ${errText}` };
        }
        return { sent: true, provider: 'resend', channel: this.channel };
      } catch (err: unknown) {
        return { sent: false, provider: 'resend', channel: this.channel, error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (process.env.BREVO_API_KEY) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'MedKart Pharmacy', email: process.env.EMAIL_FROM || 'noreply@medkart.in' },
            to: [{ email: params.email }],
            subject: `Your MedKart Verification Code: ${params.otp}`,
            textContent: `Your MedKart verification code is ${params.otp}. It is valid for 5 minutes.`,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return { sent: false, provider: 'brevo', channel: this.channel, error: `Brevo HTTP ${res.status}: ${errText}` };
        }
        return { sent: true, provider: 'brevo', channel: this.channel };
      } catch (err: unknown) {
        return { sent: false, provider: 'brevo', channel: this.channel, error: err instanceof Error ? err.message : String(err) };
      }
    }

    return { sent: false, provider: this.name, channel: this.channel, error: 'Email provider credentials not configured' };
  }
}

