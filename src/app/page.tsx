// src/app/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function RootHomePage() {
  return (
    <div className="max-w-4xl mx-auto py-10 space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <Badge variant="gold" className="text-sm px-3.5 py-1 font-bold">
          Kolkata Pharmacy Network • 46 Stores & Central Warehouse
        </Badge>
        <h1 className="text-3xl sm:text-5xl font-black text-[#190042] tracking-tight">
          Safe Monthly Reorders with Licensed Pharmacist Checks
        </h1>
        <p className="text-lg text-[#4a3e65] max-w-2xl mx-auto leading-relaxed">
          Reorder chronic monthly prescriptions in about 1 minute. Every prescription is verified by a registered pharmacist before same-day delivery from your nearest stocked local store.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link href="/customer/home">
            <Button variant="gold" size="xl" className="shadow-md text-xl font-black border border-[#9c8609]">
              Reorder My Medicines &rarr;
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="xl" className="font-bold border-[#190042]/30">
              Login with Phone OTP
            </Button>
          </Link>
        </div>
      </div>

      {/* Role Showcase for Reviewer */}
      <div className="space-y-4">
        <h2 className="text-center text-xs font-bold uppercase tracking-wider text-[#796e94]">
          Instant Reviewer Portals (1-Click Test Access)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer */}
          <Card className="hover:border-[#B69D0C] hover:shadow-md transition-all cursor-pointer border-[#e3ddef]">
            <CardHeader className="p-4 pb-2">
              <Badge variant="default" className="w-fit mb-2">Customer Role</Badge>
              <CardTitle className="text-base font-black text-[#190042]">
                Customer & Caregiver
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-[#4a3e65] space-y-3">
              <p>
                Debasish Ghosh reordering Metformin for his mother. 1-minute reorder, prescription upload, and tracking.
              </p>
              <Link href="/customer/home" className="block">
                <Button size="sm" variant="secondary" className="w-full font-bold">
                  Customer Portal &rarr;
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pharmacist */}
          <Card className="hover:border-[#B69D0C] hover:shadow-md transition-all cursor-pointer border-[#e3ddef]">
            <CardHeader className="p-4 pb-2">
              <Badge variant="gold" className="w-fit mb-2">Pharmacist Role</Badge>
              <CardTitle className="text-base font-black text-[#190042]">
                Verification Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-[#4a3e65] space-y-3">
              <p>
                Sunita Banerjee (Reg. WB-PHARM-2024-4102). Side-by-side prescription viewer (zoom/rotate/pan), AI draft items, approval actions.
              </p>
              <Link href="/pharmacist/queue" className="block">
                <Button size="sm" variant="gold" className="w-full font-bold">
                  Verification Desk &rarr;
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Store Staff */}
          <Card className="hover:border-[#B69D0C] hover:shadow-md transition-all cursor-pointer border-[#e3ddef]">
            <CardHeader className="p-4 pb-2">
              <Badge variant="otc" className="w-fit mb-2">Store Staff</Badge>
              <CardTitle className="text-base font-black text-[#190042]">
                Store Fulfillment Desk
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-[#4a3e65] space-y-3">
              <p>
                Salt Lake store. Pick list, invoice generation, pack lock (assertDispatchable gate), handover.
              </p>
              <Link href="/store/orders" className="block">
                <Button size="sm" variant="secondary" className="w-full font-bold">
                  Store Packing &rarr;
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Ops & Admin */}
          <Card className="hover:border-[#B69D0C] hover:shadow-md transition-all cursor-pointer border-[#e3ddef]">
            <CardHeader className="p-4 pb-2">
              <Badge variant="h1" className="w-fit mb-2">Central Ops</Badge>
              <CardTitle className="text-base font-black text-[#190042]">
                Operations Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-[#4a3e65] space-y-3">
              <p>
                Multi-store network oversight, verification SLAs, CSV inventory import, trigger refill reminder cron.
              </p>
              <Link href="/ops/dashboard" className="block">
                <Button size="sm" variant="secondary" className="w-full font-bold">
                  Ops Dashboard &rarr;
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Domain Safety Highlights */}
      <div className="bg-white border border-[#e3ddef] rounded-xl p-6 sm:p-8 space-y-4 shadow-xs">
        <h3 className="text-lg font-black text-[#190042]">Core Architecture & Safety Safeguards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-[#4a3e65]">
          <div className="space-y-1">
            <span className="font-bold text-[#190042] block text-sm">Deterministic Gating</span>
            <p>
              AI only produces a tentative DRAFT. A registered pharmacist must check every prescription. Postgres triggers & assertDispatchable guarantee zero Schedule X online sales.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-[#190042] block text-sm">DPDP Act 2023 Compliant</span>
            <p>
              Prescriptions encrypted at rest with AES-256-GCM. Served only through authorized decryption routes with an append-only access log recording every view.
            </p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-[#190042] block text-sm">Nearest Store Routing</span>
            <p>
              Haversine distance routing against live store inventory. Salt Lake, Behala, Howrah Maidan stores routed dynamically with stockout fallback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
