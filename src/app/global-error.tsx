// src/app/global-error.tsx
'use client';

import React, { useEffect } from 'react';
import { logger } from '@/lib/logger';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}

export default function GlobalError({ error, reset, retry }: GlobalErrorProps) {
  useEffect(() => {
    logger.error('[Global Error caught]:', error);
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

  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-teal-50 border border-teal-200 text-teal-700">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-stone-900">
            Application Error
          </h1>

          <p className="mt-3 text-base text-stone-600">
            MedKart Pharmacy encountered a critical error. Please retry or refresh the page.
          </p>

          {error?.digest && (
            <p className="mt-2 text-xs font-mono text-stone-400">
              Error Ref: {error.digest}
            </p>
          )}

          <div className="mt-6">
            <button
              onClick={handleRetry}
              className="min-h-[48px] w-full px-6 py-3 rounded-lg font-medium text-base text-white bg-teal-700 hover:bg-teal-800 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
