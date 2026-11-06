// src/app/register/page.tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const [registrationToken, setRegistrationToken] = useState(tokenFromUrl || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [addressText, setAddressText] = useState('');
  const [pincode, setPincode] = useState('700064');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenFromUrl) {
      setRegistrationToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationToken) {
      setError('Registration token is required. Please verify your phone number via login first.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationToken,
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

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <Card className="border-stone-200 shadow-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-[#B69D0C] text-[#190042] rounded-lg flex items-center justify-center font-black text-2xl mx-auto mb-3 shadow-md border border-[#9c8609]">
            M
          </div>
          <CardTitle className="text-2xl font-black text-[#190042]">
            Customer Self-Registration
          </CardTitle>
          <CardDescription className="text-stone-600">
            Complete your profile to safely order medicines online with licensed pharmacist oversight.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && <ErrorState message={error} />}

          {!registrationToken && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-2">
              <p className="font-semibold">Verification Required</p>
              <p>
                To register, please start at the login page to verify your mobile number.
              </p>
              <Link href="/login" className="inline-block text-teal-700 font-semibold underline">
                &larr; Go to Login & Verify Phone
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs text-stone-600 space-y-1">
              <span className="font-semibold text-stone-700 block">Account Privileges:</span>
              <p>Self-registration creates a Customer account for prescription orders and refills. For Pharmacist, Store Staff, or Admin access, please contact the founder or administrator.</p>
            </div>

            <Button
              type="submit"
              disabled={!registrationToken}
              isLoading={loading}
              className="w-full text-base"
            >
              Complete Registration & Sign In &rarr;
            </Button>

            <Link
              href="/login"
              className="w-full text-xs text-stone-500 hover:text-stone-800 text-center block pt-1"
            >
              &larr; Back to login
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto py-12 px-4 text-center">Loading registration...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

