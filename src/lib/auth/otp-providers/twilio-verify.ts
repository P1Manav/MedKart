// src/lib/auth/otp-providers/twilio-verify.ts
import type { OtpProvider, SendOtpParams, SendOtpResult } from './types';

export class TwilioVerifyProvider implements OtpProvider {
  readonly name = 'twilio_verify';
  readonly channel = 'SMS' as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
    );
  }

  async send(params: SendOtpParams): Promise<SendOtpResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!sid || !token || !serviceSid) {
      return { sent: false, provider: this.name, channel: this.channel, error: 'Twilio credentials not configured' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const digits = params.phone.replace(/\D/g, '').slice(-10);
      const e164 = `+91${digits}`;
      const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;

      const body = new URLSearchParams({
        To: e164,
        Channel: 'sms',
        CustomCode: params.otp,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { sent: false, provider: this.name, channel: this.channel, error: `Twilio HTTP ${res.status}: ${errText}` };
      }

      return { sent: true, provider: this.name, channel: this.channel };
    } catch (err: unknown) {
      return { sent: false, provider: this.name, channel: this.channel, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

