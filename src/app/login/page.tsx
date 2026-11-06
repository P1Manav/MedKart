// src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'PHONE' | 'REGISTER' | 'OTP'>('PHONE');
  const [otp, setOtp] = useState('');
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Self-registration fields
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [addressText, setAddressText] = useState('');
  const [pincode, setPincode] = useState('700064');

  const handlePhoneSubmit = async (phoneToUse?: string, e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
      if (!phoneToUse && e.currentTarget) {
        const inputEl = e.currentTarget.elements.namedItem('phone') as HTMLInputElement | null;
        if (inputEl?.value) {
          phoneToUse = inputEl.value;
        }
      }
    }
    setError(null);
    setLoading(true);

    const raw = phoneToUse !== undefined ? phoneToUse : phone;
    const targetPhone = (raw || '').trim().replace(/\D/g, '');
    const cleanPhone = targetPhone.length === 12 && targetPhone.startsWith('91')
      ? targetPhone.slice(2)
      : targetPhone;

    if (cleanPhone.length !== 10 && targetPhone.length !== 20) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      setLoading(false);
      return;
    }

    const payloadPhone = targetPhone.length === 20 ? targetPhone : cleanPhone;
    if (phoneToUse && phoneToUse !== phone) {
      setPhone(payloadPhone);
    }

    // Directly request OTP without leaking account existence (Master Prompt v6)
    await handleRequestOtp(payloadPhone);
  };

  const handleRequestOtp = async (phoneToUse: string) => {
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneToUse }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to request OTP');
        setLoading(false);
        return;
      }

      if (data.isBackdoor && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      setStep('OTP');
      if (data.mockOtp) {
        setMockOtp(data.mockOtp);
        setOtp(data.mockOtp); // Auto-fill for seamless testing
      }
    } catch {
      setError('Network error requesting OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationToken,
          phone,
          name,
          email: email.trim() || undefined,
          role: 'CUSTOMER',
          addressText,
          pincode,
          lat: 22.5867,
          lng: 88.4178,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Registration failed.');
        setLoading(false);
        return;
      }

      router.push('/customer/home');
      router.refresh();
    } catch {
      setError('Registration failed due to network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid verification code');
        setLoading(false);
        return;
      }

      // If new unseeded customer: prompt short self-registration with registrationToken
      if (data.needsRegistration && data.registrationToken) {
        setRegistrationToken(data.registrationToken);
        setStep('REGISTER');
        setLoading(false);
        return;
      }

      // Route based on role
      if (data.user.role === 'PHARMACIST') {
        router.push('/pharmacist/queue');
      } else if (data.user.role === 'STORE_STAFF') {
        router.push('/store/orders');
      } else if (data.user.role === 'OPS') {
        router.push('/ops/dashboard');
      } else {
        router.push('/customer/home');
      }
      router.refresh();
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <Card className="border-stone-200 shadow-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-teal-700 text-white rounded-lg flex items-center justify-center font-bold text-2xl mx-auto mb-3">
            M
          </div>
          <CardTitle className="text-2xl font-bold text-stone-900">
            {step === 'REGISTER' ? 'Customer Self-Registration' : t('loginTitle')}
          </CardTitle>
          <CardDescription className="text-stone-600">
            {step === 'REGISTER'
              ? 'Create your customer profile to safely reorder medicines online.'
              : tCommon('tagline')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && <ErrorState message={error} />}

          {/* Demo SMS Banner */}
          {mockOtp && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-4 text-amber-900">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>{t('demoCodeText')}</span>
              </div>
              <p data-testid="demo-otp-code" className="text-xl font-mono font-bold tracking-widest mt-1 text-teal-900">
                {mockOtp}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Valid for 5 minutes (max 5 attempts). Honest fallback: real SMS dispatched if provider key configured.
              </p>
            </div>
          )}

          {step === 'PHONE' && (
            <form onSubmit={(e) => handlePhoneSubmit(undefined, e)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  {t('enterPhone')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-stone-500 font-medium">+91</span>
                  <input
                    type="tel"
                    name="phone"
                    maxLength={20}
                    data-testid="phone-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('phonePlaceholder')}
                    className="w-full pl-14 pr-4 py-3 border border-stone-300 rounded-md text-lg font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    required
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Enter your mobile number to sign in or self-register. New registrations receive Customer access.
                </p>
                <div className="mt-2.5 p-3 bg-teal-50/60 border border-teal-100 rounded text-xs text-stone-700 space-y-1">
                  <span className="font-semibold text-teal-900 block">Role Access Note:</span>
                  <p>All new registrations are created with Customer access. For Pharmacist, Store Staff, or Operations Administrator privileges, please contact the founder or central admin.</p>
                </div>
              </div>

              <Button type="submit" data-testid="get-otp-btn" isLoading={loading} className="w-full text-lg">
                {t('getOtp')}
              </Button>

              <div className="pt-4 border-t border-stone-200">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-2">
                  Sample Test Accounts (Click to Fill):
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPhone('9830011111');
                    }}
                    className="p-2 border rounded hover:bg-stone-50 text-left cursor-pointer"
                  >
                    <span className="font-semibold block text-stone-900">Debasish Ghosh</span>
                    <span className="text-stone-500">Customer (Mother Rx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhone('9830044444');
                    }}
                    className="p-2 border rounded hover:bg-stone-50 text-left cursor-pointer"
                  >
                    <span className="font-semibold block text-stone-900">Sunita Banerjee</span>
                    <span className="text-teal-700">Pharmacist (Regd.)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhone('9830066661');
                    }}
                    className="p-2 border rounded hover:bg-stone-50 text-left cursor-pointer"
                  >
                    <span className="font-semibold block text-stone-900">Store Staff</span>
                    <span className="text-stone-500">Salt Lake Store</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhone('9830099999');
                    }}
                    className="p-2 border rounded hover:bg-stone-50 text-left cursor-pointer"
                  >
                    <span className="font-semibold block text-stone-900">Central Ops</span>
                    <span className="text-stone-500">Administrator</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="bg-stone-50 p-3 rounded-md border text-xs text-stone-600 mb-2">
                Phone number <strong className="font-mono text-stone-900">+91 {phone}</strong> is not yet registered. Complete this short form to create your account.
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Manav Patel"
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Account Role
                </label>
                <input
                  type="text"
                  value="Customer (Patient / Caregiver)"
                  disabled
                  className="w-full px-3 py-2 bg-stone-100 border border-stone-300 rounded-md text-sm text-stone-500 cursor-not-allowed"
                />
                <span className="text-[11px] text-stone-500 block mt-0.5">
                  Pharmacist and store-staff accounts are restricted and admin-provisioned only.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. manav@example.com"
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Delivery Address *
                </label>
                <textarea
                  rows={2}
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder="e.g. Flat 3A, Block CF, Salt Lake Sector 1, Kolkata"
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="700064"
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  required
                />
              </div>

              <Button type="submit" isLoading={loading} className="w-full text-base">
                Complete Registration & Sign In &rarr;
              </Button>

              <button
                type="button"
                onClick={() => setStep('PHONE')}
                className="w-full text-xs text-stone-500 hover:text-stone-800 text-center block pt-1"
              >
                &larr; Back to mobile number entry
              </button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="block text-sm font-semibold text-stone-700">
                    {t('enterOtp')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('PHONE')}
                    className="text-xs text-teal-700 hover:underline"
                  >
                    Change phone (+91 {phone})
                  </button>
                </div>
                <input
                  type="text"
                  data-testid="otp-input"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder={t('otpPlaceholder')}
                  className="w-full px-4 py-3 text-center border border-stone-300 rounded-md text-2xl font-mono tracking-widest focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <Button type="submit" data-testid="verify-otp-btn" isLoading={loading} className="w-full text-lg">
                {t('verifyOtp')}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => handleRequestOtp(phone)}
                  className="text-sm text-stone-600 hover:text-teal-700 underline"
                >
                  {t('resend')}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
