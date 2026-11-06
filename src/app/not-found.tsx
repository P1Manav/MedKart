// src/app/not-found.tsx
import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-8 shadow-sm text-center">
        {/* Teal 404 Badge */}
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 mb-4">
          404 Error
        </div>

        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          Page Not Found
        </h1>

        <p className="mt-3 text-base text-stone-600 dark:text-stone-300 leading-relaxed">
          The requested page or prescription order could not be found. It may have been moved, completed, or the link may be invalid.
        </p>

        <div className="mt-4 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-lg text-xs text-stone-500 dark:text-stone-400 space-y-1">
          <p>পৃষ্ঠাটি পাওয়া যায়নি • এই পাতা বা অর্ডারটি খুঁজে পাওয়া যাচ্ছে না।</p>
          <p>पृष्ठ नहीं मिला • यह पृष्ठ या ऑर्डर मौजूद नहीं है।</p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-base text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 transition-colors"
          >
            Return to Home
          </Link>

          <Link
            href="/customer/order/new"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-base text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            New Order
          </Link>
        </div>
      </div>
    </div>
  );
}
