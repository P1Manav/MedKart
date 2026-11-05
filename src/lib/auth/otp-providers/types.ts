// src/lib/auth/otp-providers/types.ts

export interface SendOtpParams {
  phone: string;
  otp: string;
  email?: string;
  ipAddress?: string;
}

export interface SendOtpResult {
  sent: boolean;
  provider: string;
  channel: 'SMS' | 'EMAIL';
  costInCredits?: number;
  error?: string;
}

export interface OtpProvider {
  readonly name: string;
  readonly channel: 'SMS' | 'EMAIL';
  isConfigured(): boolean;
  send(params: SendOtpParams): Promise<SendOtpResult>;
}

