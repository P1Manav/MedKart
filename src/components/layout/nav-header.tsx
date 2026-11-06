// src/components/layout/nav-header.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/providers/session-provider';

export const NavHeader: React.FC = () => {
  const currentLocale = useLocale();
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const {
    user,
    loading,
    demoMode,
    logout,
    quickLogin,
    updateLanguage,
  } = useSession();

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50 shadow-xs">
      {/* Top Utility Ribbon (Demo Switcher when DEMO_MODE=true and Language Switcher) */}
      <div className="bg-teal-900 text-teal-100 text-xs py-1.5 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-teal-800">
        {demoMode ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-teal-300">DEMO ROLES:</span>
            <button
              type="button"
              onClick={() => quickLogin('9830011111')}
              className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer transition hover:bg-teal-700"
            >
              Customer (Debasish)
            </button>
            <button
              type="button"
              onClick={() => quickLogin('9830044444')}
              className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer transition hover:bg-teal-700"
            >
              Pharmacist (Sunita)
            </button>
            <button
              type="button"
              onClick={() => quickLogin('9830066661')}
              className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer transition hover:bg-teal-700"
            >
              Store Staff (Salt Lake)
            </button>
            <button
              type="button"
              onClick={() => quickLogin('9830099999')}
              className="hover:underline text-white bg-teal-800 px-2 py-0.5 rounded cursor-pointer transition hover:bg-teal-700"
            >
              Ops Dashboard
            </button>
          </div>
        ) : (
          <div className="text-teal-300 font-medium">
            MedKart Official Healthcare Commerce Network &bull; Kolkata
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-teal-300">{tCommon('language')}:</span>
            <button
              type="button"
              onClick={() => updateLanguage('en')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${currentLocale === 'en' ? 'bg-teal-700 font-bold text-white' : 'hover:underline text-teal-200'}`}
            >
              English
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => updateLanguage('hi')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${currentLocale === 'hi' ? 'bg-teal-700 font-bold text-white' : 'hover:underline text-teal-200'}`}
            >
              हिंदी
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => updateLanguage('bn')}
              className={`px-1.5 py-0.5 rounded cursor-pointer ${currentLocale === 'bn' ? 'bg-teal-700 font-bold text-white' : 'hover:underline text-teal-200'}`}
            >
              বাংলা
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-[#0f766e] text-white flex items-center justify-center font-bold text-xl shadow-xs">
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
                    {tNav('reorderMedicines')}
                  </Link>
                  <Link href="/customer/order/new" className="text-stone-700 hover:text-teal-700">
                    {tNav('newOrder')}
                  </Link>
                  <Link href="/customer/profile" className="text-stone-700 hover:text-teal-700">
                    {tNav('profile')}
                  </Link>
                </>
              )}
              {user.role === 'PHARMACIST' && (
                <Link href="/pharmacist/queue" className="text-teal-800 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                  {tNav('verificationQueue')}
                </Link>
              )}
              {user.role === 'STORE_STAFF' && (
                <Link href="/store/orders" className="text-stone-700 hover:text-teal-700">
                  {tNav('storePacking')}
                </Link>
              )}
              {user.role === 'OPS' && (
                <>
                  <Link href="/ops/dashboard" className="text-stone-700 hover:text-teal-700">
                    {tNav('opsDashboard')}
                  </Link>
                  <Link href="/pharmacist/queue" className="text-stone-700 hover:text-teal-700">
                    {tNav('verificationQueue')}
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-24 h-8 bg-stone-100 dark:bg-stone-800 animate-pulse rounded" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                {user.role === 'CUSTOMER' ? (
                  <Link href="/customer/profile" className="text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline block">
                    {user.name}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 block">{user.name}</span>
                )}
                <span className="text-xs text-stone-500 dark:text-stone-400 block">
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
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                {tCommon('logout')}
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm">{tNav('loginWithPhone')}</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
