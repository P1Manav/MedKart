// src/app/layout.tsx
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notoSans, notoSansDevanagari, notoSansBengali } from '@/lib/fonts';
import './globals.css';
import { NavHeader } from '@/components/layout/nav-header';
import { SessionProvider } from '@/components/providers/session-provider';

export const metadata: Metadata = {
  title: 'MedKart Pharmacy — Safe Monthly Reorders with Pharmacist Verification',
  description: 'Online prescription reordering system for Kolkata with registered pharmacist verification on every order.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = rawLocale && ['en', 'hi', 'bn'].includes(rawLocale) ? rawLocale : 'en';
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${notoSans.variable} ${notoSansDevanagari.variable} ${notoSansBengali.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900 font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionProvider>
            <NavHeader />
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
              {children}
            </main>
            <footer className="bg-white border-t border-stone-200 py-6 text-center text-xs text-stone-500">
              <div className="max-w-7xl mx-auto px-4">
                <p className="font-semibold text-stone-700">MedKart Pharmacy Network (Licensed Pharmacy Stores, Central Warehouse, Kolkata & Howrah)</p>
                <p className="mt-1">Compliant with Drugs and Cosmetics Act & DPDP Act 2023. Prescriptions are encrypted and audited. All orders checked by a registered pharmacist.</p>
              </div>
            </footer>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
