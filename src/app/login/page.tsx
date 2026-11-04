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
  const router = useRouter();
  const [phone, setPhone] = useState('9830011111');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [otp, setOtp] = useState('');
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to request OTP');
        return;
      }

      setStep('OTP');
      if (data.mockOtp) {
        setMockOtp(data.mockOtp);
        setOtp(data.mockOtp); // Auto-fill for seamless reviewer testing
      }
    } catch {
      setError('Network connection error. Please try again.');
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
          <CardTitle className="text-2xl font-bold text-stone-900">{t('loginTitle')}</CardTitle>
          <CardDescription className="text-stone-600">
            Monthly prescription medicine reordering with licensed pharmacist safety checks.
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
              <p className="text-xl font-mono font-bold tracking-widest mt-1 text-teal-900">
                {mockOtp}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Valid for 5 minutes (max 5 attempts).
              </p>
            </div>
          )}

          {step === 'PHONE' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  {t('enterPhone')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-stone-500 font-medium">+91</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('phonePlaceholder')}
                    className="w-full pl-14 pr-4 py-3 border border-stone-300 rounded-md text-lg font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <Button type="submit" isLoading={loading} className="w-full text-lg">
                {t('getOtp')}
              </Button>

              <div className="pt-4 border-t border-stone-200">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block mb-2">
                  Sample Test Accounts:
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
                </div>
              </div>
            </form>
          ) : (
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
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder={t('otpPlaceholder')}
                  className="w-full px-4 py-3 text-center border border-stone-300 rounded-md text-2xl font-mono tracking-widest focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <Button type="submit" isLoading={loading} className="w-full text-lg">
                {t('verifyOtp')}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
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

