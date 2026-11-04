// src/components/layout/nav-header.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface UserSession {
  userId: string;
  phone: string;
  name: string;
  role: 'CUSTOMER' | 'PHARMACIST' | 'STORE_STAFF' | 'OPS';
  pharmacistRegNo?: string | null;
  storeId?: string | null;
}

export const NavHeader: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState('en');

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  const handleQuickLogin = async (phone: string, defaultOtp: string = '123456') => {
    try {
      // 1. Request OTP
      const reqRes = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const reqData = await reqRes.json();
      const otpToUse = reqData.mockOtp || defaultOtp;

      // 2. Verify OTP
      const verRes = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpToUse }),
      });
      const verData = await verRes.json();

      if (verData.success) {
        await fetchSession();
        if (verData.user.role === 'PHARMACIST') {
          router.push('/pharmacist/queue');
        } else if (verData.user.role === 'STORE_STAFF') {
          router.push('/store/orders');
        } else if (verData.user.role === 'OPS') {
          router.push('/ops/dashboard');
        } else {
          router.push('/customer/home');
        }
        router.refresh();
      }
    } catch (err) {
      console.error('Quick login error:', err);
    }
  };

  const switchLanguage = (newLocale: string) => {
    setLocale(newLocale);
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50 shadow-xs">
      {/* Demo Switcher Ribbon */}
      <div className="bg-teal-900 text-teal-100 text-xs py-1.5 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-teal-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-teal-300">DEMO ROLES:</span>
          <button
            onClick={() => handleQuickLogin('9830011111')}
            className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer"
          >
            Customer (Debasish)
          </button>
          <button
            onClick={() => handleQuickLogin('9830044444')}
            className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer"
          >
            Pharmacist (Sunita)
          </button>
          <button
            onClick={() => handleQuickLogin('9830066661')}
            className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer"
          >
            Store Staff (Salt Lake)
          </button>
          <button
            onClick={() => handleQuickLogin('9830099999')}
            className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer"
          >
            Ops Dashboard
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-teal-300">Language:</span>
          <button
            onClick={() => switchLanguage('en')}
            className={`px-1.5 py-0.5 rounded ${locale === 'en' ? 'bg-teal-700 font-bold text-white' : 'hover:underline'}`}
          >
            English
          </button>
          <span>|</span>
          <button
            onClick={() => switchLanguage('hi')}
            className={`px-1.5 py-0.5 rounded ${locale === 'hi' ? 'bg-teal-700 font-bold text-white' : 'hover:underline'}`}
          >
            हिंदी
          </button>
          <span>|</span>
          <button
            onClick={() => switchLanguage('bn')}
            className={`px-1.5 py-0.5 rounded ${locale === 'bn' ? 'bg-teal-700 font-bold text-white' : 'hover:underline'}`}
          >
            বাংলা
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-[#0f766e] text-white flex items-center justify-center font-bold text-xl">
              M
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-stone-900 block leading-tight">
                MedKart
              </span>
              <span className="text-xs text-stone-500 block">Kolkata Pharmacy Network</span>
            </div>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
              {user.role === 'CUSTOMER' && (
                <>
                  <Link href="/customer/home" className="text-stone-700 hover:text-teal-700">
                    Reorder Medicines
                  </Link>
                  <Link href="/customer/order/new" className="text-stone-700 hover:text-teal-700">
                    New Order
                  </Link>
                </>
              )}
              {user.role === 'PHARMACIST' && (
                <Link href="/pharmacist/queue" className="text-teal-800 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                  Verification Queue
                </Link>
              )}
              {user.role === 'STORE_STAFF' && (
                <Link href="/store/orders" className="text-stone-700 hover:text-teal-700">
                  Store Packing & Handover
                </Link>
              )}
              {user.role === 'OPS' && (
                <>
                  <Link href="/ops/dashboard" className="text-stone-700 hover:text-teal-700">
                    Ops Dashboard
                  </Link>
                  <Link href="/pharmacist/queue" className="text-stone-700 hover:text-teal-700">
                    Verification Queue
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-24 h-8 bg-stone-100 animate-pulse rounded" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="text-sm font-semibold text-stone-900 block">{user.name}</span>
                <span className="text-xs text-stone-500 block">
                  {user.role === 'PHARMACIST' && user.pharmacistRegNo
                    ? `Reg: ${user.pharmacistRegNo}`
                    : user.role}
                </span>
              </div>
              <Badge
                variant={
                  user.role === 'PHARMACIST'
                    ? 'h'
                    : user.role === 'OPS'
                    ? 'h1'
                    : 'default'
                }
              >
                {user.role}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm">Login with Phone</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

