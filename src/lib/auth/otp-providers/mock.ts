// src/lib/auth/otp-providers/mock.ts
import type { OtpProvider, SendOtpParams, SendOtpResult } from './types';

export const DEMO_PHONES = [
  '9830011111', // Debasish Ghosh (Customer)
  '9830022222', // Rina Sen (Customer)
  '9830033333', // Amitava Roy (Customer)
  '9830044444', // Sunita Banerjee (Pharmacist)
  '9830066661', // Bikash Das (Store Staff - Salt Lake)
  '9830099999', // Central Ops Administrator
];

export class MockOtpProvider implements OtpProvider {
  readonly name = 'mock';
  readonly channel = 'SMS' as const;

  isConfigured(): boolean {
    return process.env.DEMO_MODE === 'true' || process.env.OTP_PROVIDER === 'mock';
  }

  isDemoPhone(phone: string): boolean {
    const raw = phone.replace(/\D/g, '').slice(-10);
    return DEMO_PHONES.includes(raw);
  }

  async send(params: SendOtpParams): Promise<SendOtpResult> {
    const isExplicitMock = process.env.OTP_PROVIDER === 'mock';
    const isDemoModeAllowlisted = process.env.DEMO_MODE === 'true' && this.isDemoPhone(params.phone);

    if (isExplicitMock || isDemoModeAllowlisted) {
      return { sent: true, provider: this.name, channel: this.channel };
    }

    return {
      sent: false,
      provider: this.name,
      channel: this.channel,
      error: 'Mock OTP provider only permitted for allowlisted demo accounts in DEMO_MODE.',
    };
  }
}

