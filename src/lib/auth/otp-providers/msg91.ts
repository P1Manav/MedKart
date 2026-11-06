// src/lib/auth/otp-providers/msg91.ts
import type { OtpProvider, SendOtpParams, SendOtpResult } from './types';

export class Msg91Provider implements OtpProvider {
  readonly name = 'msg91';
  readonly channel = 'SMS' as const;

  isConfigured(): boolean {
    const key = process.env.MSG91_AUTH_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  async send(params: SendOtpParams): Promise<SendOtpResult> {
    const apiKey = process.env.MSG91_AUTH_KEY;
    if (!apiKey) {
      return { sent: false, provider: this.name, channel: this.channel, error: 'MSG91_AUTH_KEY not configured' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const digits = params.phone.replace(/\D/g, '').slice(-10);
      const res = await fetch('https://api.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          authkey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobile: `91${digits}`,
          otp: params.otp,
          template_id: process.env.MSG91_TEMPLATE_ID || process.env.SMS_PROVIDER_TEMPLATE_ID || 'default_otp_template',
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { sent: false, provider: this.name, channel: this.channel, error: `MSG91 HTTP ${res.status}: ${errText}` };
      }

      return { sent: true, provider: this.name, channel: this.channel };
    } catch (err: unknown) {
      return { sent: false, provider: this.name, channel: this.channel, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

