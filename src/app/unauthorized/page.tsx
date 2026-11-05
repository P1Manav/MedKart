// src/app/unauthorized/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function UnauthorizedPage() {
  return (
    <div className="max-w-md mx-auto my-16">
      <Card className="text-center p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-3xl font-bold">
          !
        </div>
        <CardTitle className="text-2xl font-bold text-stone-900 mb-2">
          Access Restricted
        </CardTitle>
        <p className="text-sm text-stone-600 mb-6">
          Your current role does not have authorization to access this area. You may need to switch to an account with appropriate permissions.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/">
            <Button className="w-full">Return to Home</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full">Sign in with different account</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
