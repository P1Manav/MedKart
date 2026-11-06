// src/app/pharmacist/queue/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load queue');
  return res.json();
};
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

interface QueueOrder {
  id: string;
  displayId: string;
  status: string;
  createdAt: string;
  manualEntryNeeded: boolean;
  routingIssue?: string | null;
  customer: { name: string; phone: string };
  familyProfile?: { name: string; relationship: string } | null;
  store?: { name: string } | null;
  lines: Array<{
    id: string;
    lineStatus: string;
    rawText: string;
    product?: { name: string; strength: string; schedule: string } | null;
  }>;
}

export default function PharmacistQueuePage() {
  const t = useTranslations('pharmacist');
  const tc = useTranslations('common');
  const [filter, setFilter] = useState<'ALL' | 'WAITING' | 'ON_HOLD' | 'APPROVED'>('WAITING');

  const { data: queueData, error: queueError, isLoading: queueLoading, mutate } = useSWR('/api/orders', fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true,
  });

  const orders: QueueOrder[] = queueData?.orders
    ? [...queueData.orders].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    : [];
  const loading = queueLoading && !queueData;

  const calculateWaitTimeMinutes = (createdAtStr: string) => {
    const diffMs = Date.now() - new Date(createdAtStr).getTime();
    return Math.floor(diffMs / (1000 * 60));
  };

  const isAwaitingReview = (o: QueueOrder) =>
    o.status === 'SUBMITTED' || o.status === 'PAYMENT_PENDING_VERIFICATION';

  const filteredOrders = orders.filter((o) => {
    if (filter === 'WAITING') return isAwaitingReview(o);
    if (filter === 'ON_HOLD') return o.status === 'ON_HOLD';
    if (filter === 'APPROVED') return o.status === 'APPROVED' || o.status === 'PACKED';
    return true;
  });

  const waitingCount = orders.filter(isAwaitingReview).length;

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      {/* Queue Header & SLA metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-900">
              {t('queueTitle')}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#fcf8db] text-[#7b6905] border border-[#B69D0C]">
              {waitingCount} Pending Review
            </span>
          </div>
          <p className="text-sm text-[#4a3e65] mt-1">
            Statutory duty: Verify prescription legitimacy, dosage, and schedule rules before dispensing.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setFilter('WAITING')}
            className={`px-3 py-1.5 rounded-md font-bold cursor-pointer transition ${
              filter === 'WAITING'
                ? 'bg-[#190042] text-white border border-[#B69D0C]/40 shadow-xs'
                : 'bg-white border border-[#e3ddef] text-[#4a3e65] hover:bg-[#f3effa]'
            }`}
          >
            {tc('pending')} ({waitingCount})
          </button>
          <button
            onClick={() => setFilter('ON_HOLD')}
            className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
              filter === 'ON_HOLD'
                ? 'bg-amber-600 text-white'
                : 'bg-white border text-stone-700 hover:bg-stone-50'
            }`}
          >
            {tc('onHold')} ({orders.filter((o) => o.status === 'ON_HOLD').length})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
              filter === 'ALL'
                ? 'bg-stone-800 text-white'
                : 'bg-white border text-stone-700 hover:bg-stone-50'
            }`}
          >
            All Orders ({orders.length})
          </button>
        </div>
      </div>

      {/* Verification Queue Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-stone-800">
            Incoming Orders Sorted by Waiting Time (SLA Target: &lt;15 mins)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queueError ? (
            <ErrorState
              title="Failed to load verification queue"
              message={queueError instanceof Error ? queueError.message : 'Could not retrieve pending prescription orders. Please try again.'}
              onRetry={() => mutate()}
            />
          ) : loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              title="No orders in queue"
              description={`No orders found matching the filter "${filter}". All customer prescriptions are cleared!`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase font-semibold text-stone-500 bg-stone-50/50">
                    <th className="py-3 px-4">Order / Waiting SLA</th>
                    <th className="py-3 px-4">Patient / Caregiver</th>
                    <th className="py-3 px-4">Prescribed Items</th>
                    <th className="py-3 px-4">AI Legibility</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOrders.map((ord) => {
                    const waitMins = calculateWaitTimeMinutes(ord.createdAt);
                    const slaBreached = waitMins > 15;

                    return (
                      <tr key={ord.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-stone-900">{ord.displayId}</div>
                          {ord.routingIssue && (
                            <Badge variant="caution" className="text-[10px] bg-amber-100 text-amber-900 border-amber-300 block w-fit mt-1">
                              ⚠ Routing Needs Manual Review
                            </Badge>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                slaBreached ? 'bg-red-500 animate-ping' : 'bg-[#B69D0C]'
                              }`}
                            ></span>
                            <span
                              className={`text-xs font-medium ${
                                slaBreached ? 'text-red-700 font-bold' : 'text-stone-500'
                              }`}
                            >
                              Wait: {waitMins} min{waitMins === 1 ? '' : 's'}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-medium text-stone-800 block">
                            {ord.customer.name}
                          </span>
                          <span className="text-xs text-stone-500 block">
                            {ord.familyProfile
                              ? `For ${ord.familyProfile.relationship} (${ord.familyProfile.name})`
                              : 'Personal Rx'}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="max-w-xs space-y-0.5">
                            {ord.lines.slice(0, 2).map((l, i) => (
                              <div key={i} className="text-xs text-stone-700 truncate flex items-center gap-1">
                                <span>{l.product ? `${l.product.name} ${l.product.strength}` : l.rawText}</span>
                                {l.product?.schedule && (
                                  <Badge variant={l.product.schedule === 'H1' ? 'h1' : 'h'} className="text-[9px] px-1 py-0">
                                    {l.product.schedule}
                                  </Badge>
                                )}
                              </div>
                            ))}
                            {ord.lines.length > 2 && (
                              <span className="text-[10px] text-stone-400 font-semibold block">
                                +{ord.lines.length - 2} more item(s)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          {ord.manualEntryNeeded ? (
                            <Badge variant="caution" className="text-xs">
                              Manual Entry Needed
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-xs">
                              AI Draft (OCR Clear)
                            </Badge>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <Badge
                            variant={
                              ord.status === 'APPROVED' || ord.status === 'PACKED'
                                ? 'success'
                                : ord.status === 'ON_HOLD'
                                ? 'caution'
                                : 'default'
                            }
                          >
                            {ord.status}
                          </Badge>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <Link href={`/pharmacist/review/${ord.id}`}>
                            <Button size="sm">
                              {t('reviewOrder')} &rarr;
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

