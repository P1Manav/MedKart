// src/app/not-found.tsx
import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white border border-[#e3ddef] rounded-xl p-8 shadow-sm text-center">
        {/* Gold 404 Badge */}
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-[#fcf8db] text-[#7b6905] border border-[#B69D0C] mb-4">
          404 Error
        </div>

        <h1 className="text-3xl font-black text-[#190042] tracking-tight">
          Page Not Found
        </h1>

        <p className="mt-3 text-base text-[#4a3e65] leading-relaxed">
          The requested page or prescription order could not be found. It may have been moved, completed, or the link may be invalid.
        </p>

        <div className="mt-4 p-3 bg-[#f9f8fc] border border-[#e3ddef] rounded-lg text-xs text-[#796e94] space-y-1">
          <p>পৃষ্ঠাটি পাওয়া যায়নি • এই পাতা বা অর্ডারটি খুঁজে পাওয়া যাচ্ছে না।</p>
          <p>पृष्ठ नहीं मिला • यह पृष्ठ या ऑर्डर मौजूद नहीं है।</p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-lg font-bold text-base text-white bg-[#190042] hover:bg-[#26055f] active:bg-[#10002b] border border-[#B69D0C]/40 transition-colors shadow-xs"
          >
            Return to Home
          </Link>

          <Link
            href="/customer/order/new"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-6 py-3 rounded-lg font-bold text-base text-[#190042] bg-[#fcf8db] hover:bg-[#B69D0C] hover:text-[#190042] border border-[#B69D0C] transition-colors"
          >
            New Order
          </Link>
        </div>
      </div>
    </div>
  );
}
