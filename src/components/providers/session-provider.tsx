// src/components/providers/session-provider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

export interface UserSession {
  userId: string;
  phone: string;
  name: string;
  role: 'CUSTOMER' | 'PHARMACIST' | 'STORE_STAFF' | 'OPS';
  email?: string | null;
  emailVerified?: boolean;
  theme?: string;
  language?: string;
  sessionVersion?: number;
  pharmacistRegNo?: string | null;
  storeId?: string | null;
  familyProfiles?: Array<{ id: string; name: string; relationship: string }>;
  addresses?: Array<{
    id: string;
    label: string;
    addressText: string;
    pincode: string;
    lat: number;
    lng: number;
  }>;
}

interface SessionContextType {
  user: UserSession | null;
  loading: boolean;
  authenticated: boolean;
  demoMode: boolean;
  theme: 'light' | 'dark' | 'system';
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  quickLogin: (phone: string, defaultOtp?: string) => Promise<boolean>;
  updateTheme: (newTheme: 'light' | 'dark' | 'system') => Promise<void>;
  updateLanguage: (locale: 'en' | 'hi' | 'bn') => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  loading: true,
  authenticated: false,
  demoMode: false,
  theme: 'system',
  refresh: async () => {},
  logout: async () => {},
  quickLogin: async () => false,
  updateTheme: async () => {},
  updateLanguage: async () => {},
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch session');
  }
  return res.json();
};

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR('/api/auth/me', fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Read initial theme from cookie if present
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )medkart_theme=([^;]+)'));
      if (match && ['light', 'dark', 'system'].includes(match[2])) {
        setTheme(match[2] as 'light' | 'dark' | 'system');
      }
    }
  }, []);

  // Update theme state if user object specifies one
  useEffect(() => {
    if (data?.user?.theme && ['light', 'dark', 'system'].includes(data.user.theme)) {
      setTheme(data.user.theme as 'light' | 'dark' | 'system');
    }
  }, [data?.user?.theme]);

  // Apply dark mode class to <html>
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      await mutate({ authenticated: false, user: null, demoMode: data?.demoMode || false }, false);
      router.push('/login');
      router.refresh();
    }
  }, [mutate, router, data?.demoMode]);

  const quickLogin = useCallback(
    async (phone: string, defaultOtp: string = '123456'): Promise<boolean> => {
      try {
        const reqRes = await fetch('/api/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const reqData = await reqRes.json();
        const otpToUse = reqData.mockOtp || defaultOtp;

        const verRes = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp: otpToUse }),
        });
        const verData = await verRes.json();

        if (verData.success) {
          await mutate();
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
          return true;
        }
        return false;
      } catch (err) {
        console.error('Quick login failed:', err);
        return false;
      }
    },
    [mutate, router]
  );

  const updateTheme = useCallback(
    async (newTheme: 'light' | 'dark' | 'system') => {
      setTheme(newTheme);
      document.cookie = `medkart_theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

      if (data?.authenticated) {
        try {
          await fetch('/api/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: newTheme }),
          });
          await mutate();
        } catch (e) {
          console.error('Failed to save theme preference to profile', e);
        }
      }
    },
    [data?.authenticated, mutate]
  );

  const updateLanguage = useCallback(
    async (locale: 'en' | 'hi' | 'bn') => {
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;

      if (data?.authenticated) {
        try {
          await fetch('/api/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: locale }),
          });
          await mutate();
        } catch (e) {
          console.error('Failed to save language preference to profile', e);
        }
      }
      router.refresh();
    },
    [data?.authenticated, mutate, router]
  );

  const user = data?.authenticated ? (data.user as UserSession) : null;
  const loading = isLoading && !data && !error;
  const authenticated = !!data?.authenticated;
  const demoMode = !!data?.demoMode;

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        authenticated,
        demoMode,
        theme,
        refresh,
        logout,
        quickLogin,
        updateTheme,
        updateLanguage,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
