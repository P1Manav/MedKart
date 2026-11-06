// src/app/error.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { logger } from '@/lib/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}

export default function ErrorBoundary({ error, reset, retry }: ErrorProps) {
  useEffect(() => {
    // Redacting logger ensures no sensitive tokens/PII in logs
    logger.error('[App Error Boundary caught]:', error);
  }, [error]);

  const handleRetry = () => {
    if (typeof retry === 'function') {
      retry();
    } else if (typeof reset === 'function') {
      reset();
    } else {
      window.location.reload();
    }
  };

  // Safe i18n lookup with graceful fallback
  let t: (key: string) => string;
  try {
    const intl = useTranslations('error');
    t = (k: string) => intl(k);
  } catch {
    t = (k: string) => {
      const fallbacks: Record<string, string> = {
        title: 'Something Went Wrong',
        description: 'An unexpected error occurred while loading this page. Our team has been alerted.',
        retry: 'Try Again',
        home: 'Return to Home',
        support: 'If this problem persists, please contact MedKart Support.',
      };
      return fallbacks[k] || k;
    };
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white border border-[#e3ddef] rounded-xl p-8 shadow-sm text-center">
        {/* Gold Warning Icon */}
        <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-[#fcf8db] border border-[#B69D0C] text-[#B69D0C]">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-black text-[#190042] tracking-tight">
          {t('title')}
        </h1>

        <p className="mt-3 text-base text-[#4a3e65] leading-relaxed">
          {t('description')}
        </p>

        {error.digest && (
          <p className="mt-2 text-xs font-mono text-[#796e94]">
            Reference ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleRetry}
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-lg font-bold text-base text-white bg-[#190042] hover:bg-[#26055f] active:bg-[#10002b] border border-[#B69D0C]/40 focus:outline-none focus:ring-2 focus:ring-[#B69D0C] focus:ring-offset-2 transition-colors cursor-pointer shadow-xs"
          >
            {t('retry')}
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-lg font-bold text-base text-[#190042] bg-[#fcf8db] hover:bg-[#B69D0C] hover:text-[#190042] border border-[#B69D0C] transition-colors"
          >
            {t('home')}
          </Link>
        </div>

        <p className="mt-6 text-xs text-[#796e94]">
          {t('support')}
        </p>
      </div>
    </div>
  );
}
