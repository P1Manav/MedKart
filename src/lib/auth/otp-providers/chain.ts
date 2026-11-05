// src/lib/auth/otp-providers/chain.ts
import { createHmac } from 'crypto';
import db from '../../db';
import type { SendOtpParams, OtpProvider, SendOtpResult } from './types';
import { Msg91Provider } from './msg91';
import { TwilioVerifyProvider } from './twilio-verify';
import { Fast2SmsProvider } from './fast2sms';
import { EmailOtpProvider } from './email';
import { MockOtpProvider, DEMO_PHONES } from './mock';

export { DEMO_PHONES };

export interface DispatchOtpResult {
  success: boolean;
  provider: string;
  channel: 'SMS' | 'EMAIL';
  mockOtpAllowed: boolean;
  error?: string;
  isConfigured: boolean;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return '+91 **********';
  return `+91 ${digits.slice(0, 2)}****${digits.slice(-4)}`;
}

export function hashPhoneForLog(phone: string): string {
  const pepper = process.env.OTP_PEPPER || 'default-pepper-medkart-dev-32-chars-long';
  const digits = phone.replace(/\D/g, '').slice(-10);
  return createHmac('sha256', pepper).update(digits).digest('hex');
}

export class OtpProviderChain {
  private smsProviders: Map<string, OtpProvider>;
  private emailProvider: EmailOtpProvider;
  private mockProvider: MockOtpProvider;

  constructor() {
    this.smsProviders = new Map<string, OtpProvider>([
      ['msg91', new Msg91Provider()],
      ['twilio_verify', new TwilioVerifyProvider()],
      ['fast2sms', new Fast2SmsProvider()],
    ]);
    this.emailProvider = new EmailOtpProvider();
    this.mockProvider = new MockOtpProvider();
  }

  getPrimarySmsProvider(): OtpProvider | null {
    const selected = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
    if (selected && this.smsProviders.has(selected)) {
      return this.smsProviders.get(selected)!;
    }
    // Auto-detect based on configured credentials
    for (const provider of this.smsProviders.values()) {
      if (provider.isConfigured()) return provider;
    }
    return null;
  }

  isDemoNumber(phone: string): boolean {
    const raw = phone.replace(/\D/g, '').slice(-10);
    return DEMO_PHONES.includes(raw);
  }

  async dispatch(params: SendOtpParams): Promise<DispatchOtpResult> {
    const isDemoMode = process.env.DEMO_MODE === 'true';
    const isAllowlistedDemoPhone = this.isDemoNumber(params.phone);
    const mockAllowed = isDemoMode && isAllowlistedDemoPhone;

    const primarySms = this.getPrimarySmsProvider();
    let dispatchResult: SendOtpResult | null = null;

    if (primarySms && primarySms.isConfigured()) {
      dispatchResult = await primarySms.send(params);
    }

    // If SMS failed or was not configured, try Email if user provided an email
    if ((!dispatchResult || !dispatchResult.sent) && params.email && this.emailProvider.isConfigured()) {
      const emailRes = await this.emailProvider.send(params);
      if (emailRes.sent) {
        dispatchResult = emailRes;
      }
    }

    // If still unsent and mock is allowed (demo phone + demo mode)
    if ((!dispatchResult || !dispatchResult.sent) && mockAllowed) {
      const mockRes = await this.mockProvider.send(params);
      if (mockRes.sent) {
        dispatchResult = mockRes;
      }
    }

    const finalSuccess = Boolean(dispatchResult && dispatchResult.sent);
    const providerName = dispatchResult?.provider || primarySms?.name || 'none';
    const channel = dispatchResult?.channel || 'SMS';
    const errorMsg =
      dispatchResult?.error ||
      (!finalSuccess
        ? 'SMS service not configured on this instance. Use a demo account or configure MSG91_AUTH_KEY / TWILIO_ACCOUNT_SID.'
        : undefined);

    // Record delivery attempt into database audit table
    try {
      if (typeof db?.otpDelivery?.create === 'function') {
        await db.otpDelivery.create({
          data: {
            phoneHash: hashPhoneForLog(params.phone),
            maskedPhone: maskPhone(params.phone),
            channel,
            provider: providerName,
            status: finalSuccess ? 'DELIVERED' : 'FAILED',
            errorCode: errorMsg || null,
            costInCredits: dispatchResult?.costInCredits ?? null,
          },
        });
      }
    } catch (logErr) {
      console.warn('[OtpProviderChain] Failed to record OtpDelivery audit log:', logErr);
    }

    return {
      success: finalSuccess,
      provider: providerName,
      channel,
      mockOtpAllowed: mockAllowed,
      error: errorMsg,
      isConfigured: Boolean(primarySms && primarySms.isConfigured()),
    };
  }
}

export const defaultOtpChain = new OtpProviderChain();
