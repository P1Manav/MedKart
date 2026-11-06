// src/lib/auth/otp-providers/twilio-verify.ts
import type { OtpProvider, SendOtpParams, SendOtpResult } from './types';

export class TwilioVerifyProvider implements OtpProvider {
  readonly name = 'twilio_verify';
  readonly channel = 'SMS' as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_VERIFY_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER)
    );
  }

  async send(params: SendOtpParams): Promise<SendOtpResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const phoneFrom = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || (!serviceSid && !phoneFrom)) {
      return { sent: false, provider: this.name, channel: this.channel, error: 'Twilio credentials not configured' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const digits = params.phone.replace(/\D/g, '').slice(-10);
      const e164 = params.phone.startsWith('+') ? params.phone : `+91${digits}`;

      // Case 1: Standard Twilio Programmable Messages API (via MessagingServiceSid MG... or From phone number)
      if (phoneFrom || (serviceSid && serviceSid.startsWith('MG'))) {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
        const bodyParams: Record<string, string> = {
          To: e164,
          Body: `Your MedKart verification code is: ${params.otp}. Valid for 5 minutes.`,
        };
        if (serviceSid && serviceSid.startsWith('MG')) {
          bodyParams.MessagingServiceSid = serviceSid;
        } else if (phoneFrom) {
          bodyParams.From = phoneFrom;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(bodyParams).toString(),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return { sent: false, provider: this.name, channel: this.channel, error: `Twilio HTTP ${res.status}: ${errText}` };
        }

        return { sent: true, provider: this.name, channel: this.channel };
      }

      // Case 2: Twilio Verify API v2 (starts with VA...)
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

