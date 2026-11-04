// src/app/customer/home/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface OrderItem {
  id: string;
  displayId: string;
  status: string;
  createdAt: string;
  store?: { name: string } | null;
  familyProfile?: { name: string; relationship: string } | null;
  lines: Array<{
    id: string;
    quantity: number;
    product?: { name: string; strength: string; price: number } | null;
  }>;
}

export default function CustomerHomePage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<'ALL' | 'MOTHER' | 'SELF'>('ALL');

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (data.orders) {
          setOrders(data.orders);
        }
      } catch (e) {
        console.error('Failed to load orders', e);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  const filteredOrders = orders.filter((ord) => {
    if (selectedProfile === 'MOTHER') return ord.familyProfile?.relationship === 'mother';
    if (selectedProfile === 'SELF') return !ord.familyProfile || ord.familyProfile.relationship === 'self';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* ─── 1. FAMILY PROFILE SWITCHER ───────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border border-stone-200">
        <div>
          <span className="text-xs uppercase font-semibold text-stone-500 block">
            Ordering For Profile:
          </span>
          <h2 className="text-lg font-bold text-stone-900">Debasish Ghosh’s Family</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedProfile('ALL')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              selectedProfile === 'ALL'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            All Members
          </button>
          <button
            onClick={() => setSelectedProfile('MOTHER')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              selectedProfile === 'MOTHER'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            Mother (Anjali Ghosh)
          </button>
          <button
            onClick={() => setSelectedProfile('SELF')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              selectedProfile === 'SELF'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            Myself
          </button>
        </div>
      </div>

      {/* ─── 2. VERY LARGE PROMINENT REORDER BUTTON (SPEC REQUIREMENT) ─── */}
      <div className="bg-gradient-to-b from-teal-50 to-white border-2 border-teal-600/30 rounded-xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="max-w-xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
            <span className="w-2 h-2 rounded-full bg-teal-600"></span>
            Monthly Medicine Refill
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            Reorder Monthly Prescription in ~1 Minute
          </h1>
          <p className="text-stone-600 text-base">
            Upload your prescription. A licensed pharmacist checks every medicine before same-day delivery from your nearest stocked Kolkata store.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/customer/order/new">
            <Button size="xl" className="w-full sm:w-auto px-12 py-5 text-xl font-bold shadow-lg">
              Reorder My Medicines
            </Button>
          </Link>
        </div>

        <p className="text-xs text-stone-500 pt-2 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Every prescription checked by a registered pharmacist. Strictly no Schedule X or narcotics online.
        </p>
      </div>

      {/* ─── 3. REFILL REMINDERS SECTION ───────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-bold text-stone-900">
              Upcoming Refill Reminders
            </CardTitle>
            <p className="text-sm text-stone-600">
              Calculated based on your prescribed dosage to make sure you never run out.
            </p>
          </div>
          <Badge variant="caution">Refill Alert</Badge>
        </CardHeader>
        <CardContent>
          <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-stone-900">
                  Metformin 500 mg (Strip of 15)
                </span>
                <Badge variant="h">Schedule H</Badge>
              </div>
              <p className="text-sm text-stone-600">
                For: <span className="font-semibold text-stone-800">Mother (Anjali Ghosh)</span> • Prescribed dose: 2 tablets/day
              </p>
              <p className="text-xs text-amber-900 font-medium">
                Supply runs low in approximately 5 days.
              </p>
            </div>

            <Link href="/customer/order/new">
              <Button size="sm" className="whitespace-nowrap">
                1-Tap Reorder
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ─── 4. RECENT ORDERS ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-stone-900">
            Recent Orders & Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              No orders found for this profile. Tap &quot;Reorder My Medicines&quot; above to place your monthly refill.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredOrders.map((ord) => {
                const statusBadgeVariant =
                  ord.status === 'APPROVED' || ord.status === 'PACKED' || ord.status === 'DELIVERED'
                    ? 'success'
                    : ord.status === 'ON_HOLD'
                    ? 'caution'
                    : ord.status === 'REJECTED'
                    ? 'blocked'
                    : 'default';

                return (
                  <div key={ord.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-base">{ord.displayId}</span>
                        <Badge variant={statusBadgeVariant}>{ord.status.replace('_', ' ')}</Badge>
                        {ord.familyProfile && (
                          <span className="text-xs text-stone-500">
                            (For {ord.familyProfile.relationship}: {ord.familyProfile.name})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-600">
                        {ord.lines.length} item(s) • Routed Store:{' '}
                        <span className="font-medium text-stone-800">
                          {ord.store?.name || 'Nearest Stocked Store'}
                        </span>
                      </p>
                      <p className="text-xs text-stone-400">
                        Placed on {new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <Link href={`/customer/order/${ord.id}`}>
                      <Button variant="outline" size="sm">
                        View Tracking Timeline &rarr;
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

