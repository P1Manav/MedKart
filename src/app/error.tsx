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
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-8 shadow-sm text-center">
        {/* Calm Teal Warning Icon */}
        <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          {t('title')}
        </h1>

        <p className="mt-3 text-base text-stone-600 dark:text-stone-300 leading-relaxed">
          {t('description')}
        </p>

        {error.digest && (
          <p className="mt-2 text-xs font-mono text-stone-400 dark:text-stone-500">
            Reference ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleRetry}
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-lg font-medium text-base text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 transition-colors cursor-pointer"
          >
            {t('retry')}
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-base text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            {t('home')}
          </Link>
        </div>

        <p className="mt-6 text-xs text-stone-400 dark:text-stone-500">
          {t('support')}
        </p>
      </div>
    </div>
  );
}
