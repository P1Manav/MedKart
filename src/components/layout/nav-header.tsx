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
    <header className="bg-[#190042] border-b border-[#B69D0C]/30 sticky top-0 z-50 shadow-md">
      {/* Top Utility Ribbon (Demo Switcher when DEMO_MODE=true and Language Switcher) */}
      <div className="bg-[#10002b] text-slate-200 text-xs py-1.5 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#B69D0C]/20">
        {demoMode ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#B69D0C] tracking-wide">DEMO ROLES:</span>
            <button
              type="button"
              onClick={() => quickLogin('9830011111')}
              className="text-white bg-[#190042] border border-[#B69D0C]/40 hover:border-[#B69D0C] px-2 py-0.5 rounded cursor-pointer transition hover:bg-[#B69D0C] hover:text-[#190042] font-medium"
            >
              Customer (Debasish)
            </button>
            <button
              type="button"
              onClick={() => quickLogin('9830044444')}
              className="text-white bg-[#190042] border border-[#B69D0C]/40 hover:border-[#B69D0C] px-2 py-0.5 rounded cursor-pointer transition hover:bg-[#B69D0C] hover:text-[#190042] font-medium"
            >
              Pharmacist (Sunita)
            </button>
            <button
              type="button"
              onClick={() => quickLogin('9830066661')}
              className="text-white bg-[#190042] border border-[#B69D0C]/40 hover:border-[#B69D0C] px-2 py-0.5 rounded cursor-pointer transition hover:bg-[#B69D0C] hover:text-[#190042] font-medium"
            >
              Store Staff (Salt Lake)
            </button>
            <button
              type="button"
              onClick={() => quickLogin('9830099999')}
              className="text-white bg-[#190042] border border-[#B69D0C]/40 hover:border-[#B69D0C] px-2 py-0.5 rounded cursor-pointer transition hover:bg-[#B69D0C] hover:text-[#190042] font-medium"
            >
              Ops Dashboard
            </button>
          </div>
        ) : (
          <div className="text-[#fcf8db] font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B69D0C]"></span>
            <span>MedKart Official Healthcare Commerce Network &bull; Kolkata</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-medium">{tCommon('language')}:</span>
            <button
              type="button"
              onClick={() => updateLanguage('en')}
              className={`px-2 py-0.5 rounded cursor-pointer transition text-xs ${currentLocale === 'en' ? 'bg-[#B69D0C] font-bold text-[#190042]' : 'hover:text-[#B69D0C] text-slate-200'}`}
            >
              English
            </button>
            <span className="text-slate-500">|</span>
            <button
              type="button"
              onClick={() => updateLanguage('hi')}
              className={`px-2 py-0.5 rounded cursor-pointer transition text-xs ${currentLocale === 'hi' ? 'bg-[#B69D0C] font-bold text-[#190042]' : 'hover:text-[#B69D0C] text-slate-200'}`}
            >
              हिंदी
            </button>
            <span className="text-slate-500">|</span>
            <button
              type="button"
              onClick={() => updateLanguage('bn')}
              className={`px-2 py-0.5 rounded cursor-pointer transition text-xs ${currentLocale === 'bn' ? 'bg-[#B69D0C] font-bold text-[#190042]' : 'hover:text-[#B69D0C] text-slate-200'}`}
            >
              বাংলা
            </button>
          </div>

          {user && (
            <Link
              href={user.role === 'CUSTOMER' ? '/customer/profile' : user.role === 'PHARMACIST' ? '/pharmacist/queue' : user.role === 'STORE_STAFF' ? '/store/orders' : '/ops/dashboard'}
              className="text-xs font-semibold text-[#fcf8db] hover:text-[#B69D0C] flex items-center gap-1 bg-[#190042] px-2 py-0.5 rounded border border-[#B69D0C]/40 hover:border-[#B69D0C] transition"
            >
              <span>👤</span>
              <span className="max-w-[120px] truncate">{user.name || 'Profile'}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-[#B69D0C] text-[#190042] flex items-center justify-center font-black text-2xl shadow-sm border border-[#9c8609] group-hover:scale-105 transition-transform">
              M
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white block leading-tight">
                Med<span className="text-[#B69D0C]">Kart</span>
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#d6be20] block">Kolkata Network</span>
            </div>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-5 text-sm font-semibold">
              {user.role === 'CUSTOMER' && (
                <>
                  <Link href="/customer/home" className="text-slate-200 hover:text-[#B69D0C] transition-colors">
                    {tNav('reorderMedicines')}
                  </Link>
                  <Link href="/customer/order/new" className="text-slate-200 hover:text-[#B69D0C] transition-colors">
                    {tNav('newOrder')}
                  </Link>
                  <Link href="/customer/profile" className="text-slate-200 hover:text-[#B69D0C] transition-colors">
                    {tNav('profile')}
                  </Link>
                </>
              )}
              {user.role === 'PHARMACIST' && (
                <Link href="/pharmacist/queue" className="text-[#B69D0C] font-bold flex items-center gap-2 bg-[#10002b] px-3 py-1.5 rounded-md border border-[#B69D0C]/40">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B69D0C] animate-pulse"></span>
                  {tNav('verificationQueue')}
                </Link>
              )}
              {user.role === 'STORE_STAFF' && (
                <Link href="/store/orders" className="text-slate-200 hover:text-[#B69D0C] transition-colors">
                  {tNav('storePacking')}
                </Link>
              )}
              {user.role === 'OPS' && (
                <>
                  <Link href="/ops/dashboard" className="text-[#B69D0C] hover:text-white transition-colors">
                    {tNav('opsDashboard')}
                  </Link>
                  <Link href="/pharmacist/queue" className="text-slate-200 hover:text-[#B69D0C] transition-colors">
                    {tNav('verificationQueue')}
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-24 h-8 bg-[#2d1066] animate-pulse rounded" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="text-right block">
                {user.role === 'CUSTOMER' ? (
                  <Link href="/customer/profile" className="text-sm font-bold text-white hover:text-[#B69D0C] transition-colors block">
                    {user.name}
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-white block">{user.name}</span>
                )}
                <span className="text-xs text-[#d6be20] font-medium block">
                  {user.role === 'PHARMACIST' && user.pharmacistRegNo
                    ? `Reg: ${user.pharmacistRegNo}`
                    : user.role}
                </span>
              </div>
              <Badge
                variant={
                  user.role === 'PHARMACIST'
                    ? 'gold'
                    : user.role === 'OPS'
                    ? 'h1'
                    : 'default'
                }
              >
                {user.role}
              </Badge>
              <Button
                variant="gold"
                size="sm"
                onClick={() => logout()}
                className="text-xs px-3 py-1 min-h-[36px]"
              >
                {tCommon('logout')}
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="gold" size="sm" className="font-bold min-h-[40px]">
                {tNav('loginWithPhone')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
