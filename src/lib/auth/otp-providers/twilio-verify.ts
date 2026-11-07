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

      let e164 = params.phone.trim();
      if (!e164.startsWith('+')) {
        const rawDigits = e164.replace(/\D/g, '');
        if (rawDigits.length === 11 && rawDigits.startsWith('1')) {
          e164 = `+${rawDigits}`;
        } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
          e164 = `+${rawDigits}`;
        } else {
          e164 = `+91${rawDigits.slice(-10)}`;
        }
      }

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
          let errMsg = `Twilio HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.message) {
              errMsg = parsed.message;
            }
          } catch {
            if (errText) errMsg += `: ${errText}`;
          }
          return { sent: false, provider: this.name, channel: this.channel, error: errMsg };
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
        let errMsg = `Twilio HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.message) {
            errMsg = parsed.message;
          }
        } catch {
          if (errText) errMsg += `: ${errText}`;
        }
        return { sent: false, provider: this.name, channel: this.channel, error: errMsg };
      }

      return { sent: true, provider: this.name, channel: this.channel };
    } catch (err: unknown) {
      return { sent: false, provider: this.name, channel: this.channel, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

