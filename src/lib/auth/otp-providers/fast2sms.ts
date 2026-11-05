// src/lib/auth/otp-providers/fast2sms.ts
import type { OtpProvider, SendOtpParams, SendOtpResult } from './types';

export class Fast2SmsProvider implements OtpProvider {
  readonly name = 'fast2sms';
  readonly channel = 'SMS' as const;

  isConfigured(): boolean {
    return Boolean(process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY.trim().length > 0);
  }

  async send(params: SendOtpParams): Promise<SendOtpResult> {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      return { sent: false, provider: this.name, channel: this.channel, error: 'FAST2SMS_API_KEY not configured' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const rawNumber = params.phone.replace(/\D/g, '').slice(-10);
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variables_values: params.otp,
          route: 'otp',
          numbers: rawNumber,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { sent: false, provider: this.name, channel: this.channel, error: `Fast2SMS HTTP ${res.status}: ${errText}` };
      }

      return { sent: true, provider: this.name, channel: this.channel };
    } catch (err: unknown) {
      return { sent: false, provider: this.name, channel: this.channel, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

