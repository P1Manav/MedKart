// src/app/customer/order/[id]/page.tsx
'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load order');
  return res.json();
};
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Timeline, type TimelineStep } from '@/components/ui/timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface OrderDetail {
  id: string;
  displayId: string;
  status: string;
  prescriptionStatus: string;
  addressText: string;
  createdAt: string;
  manualEntryNeeded: boolean;
  store?: { name: string; address: string } | null;
  familyProfile?: { name: string; relationship: string } | null;
  lines: Array<{
    id: string;
    rawText: string;
    lineStatus: string;
    quantity: number;
    unitPrice: number | null;
    rejectReason: string | null;
    product?: {
      name: string;
      strength: string;
      packSize: string;
      schedule: string;
    } | null;
  }>;
  auditEvents: Array<{
    id: string;
    actorRole: string;
    fromStatus: string;
    toStatus: string;
    reason: string | null;
    timestamp: string;
  }>;
}

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations('customer');
  const tc = useTranslations('common');
  const router = useRouter();
  const { id } = use(params);

  const { data: orderData, error: _swrError, isLoading: swrLoading, mutate } = useSWR(
    `/api/orders/${id}`,
    fetcher,
    { refreshInterval: 4000 }
  );

  const order: OrderDetail | null = orderData?.order || null;
  const loading = swrLoading && !orderData;
  const [error, setError] = useState<string | null>(null);

  // Re-upload form state when ON_HOLD
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploading, setReuploading] = useState(false);

  const handleReuploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reuploadFile) return;

    setReuploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', reuploadFile);

      const res = await fetch(`/api/orders/${order?.id || id}/reupload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to re-upload prescription.');
        return;
      }

      await mutate();
      router.refresh();
      setReuploadFile(null);
    } catch {
      setError('Network connection error. Failed to re-upload prescription.');
    } finally {
      setReuploading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <ErrorState message={error || 'Order could not be loaded.'} />
        <Link href="/customer/home" className="mt-4 inline-block text-[#B69D0C] font-bold hover:underline">
          &larr; {tc('back')}
        </Link>
      </div>
    );
  }

  // Build timeline steps
  const isOnHold = order.status === 'ON_HOLD';

  const steps: TimelineStep[] = [
    {
      status: 'SUBMITTED',
      title: 'Order Placed & Prescription Submitted',
      description: `Uploaded on ${new Date(order.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      state: 'completed',
    },
    {
      status: 'SUBMITTED',
      title: 'Pharmacist Prescription Check',
      description:
        isOnHold
          ? 'On Hold: The pharmacist requested a clear re-upload (see below).'
          : order.status === 'SUBMITTED'
          ? 'A licensed pharmacist is actively verifying your doctor’s prescription and checking for schedule compliance.'
          : 'Prescription verified and approved by a registered pharmacist.',
      state: isOnHold
        ? 'on_hold'
        : order.status === 'SUBMITTED'
        ? 'current'
        : 'completed',
    },
    {
      status: 'APPROVED',
      title: 'Approved & Routed to Store',
      description:
        order.store
          ? `Routed to ${order.store.name} (${order.store.address || 'Kolkata'}) based on stock availability.`
          : 'Awaiting store assignment.',
      state:
        order.status === 'APPROVED'
          ? 'current'
          : ['PACKED', 'HANDED_OVER', 'DELIVERED'].includes(order.status)
          ? 'completed'
          : 'upcoming',
    },
    {
      status: 'PACKED',
      title: 'Packed at Local Pharmacy Store',
      description: 'Store staff verify batch numbers, pack items, and generate the final bill.',
      state:
        order.status === 'PACKED'
          ? 'current'
          : ['HANDED_OVER', 'DELIVERED'].includes(order.status)
          ? 'completed'
          : 'upcoming',
    },
    {
      status: 'HANDED_OVER',
      title: 'Handed Over to Delivery Associate',
      description: 'Dispatched for same-day delivery to your doorstep in Kolkata.',
      state:
        order.status === 'HANDED_OVER'
          ? 'current'
          : order.status === 'DELIVERED'
          ? 'completed'
          : 'upcoming',
    },
    {
      status: 'DELIVERED',
      title: 'Delivered',
      description: 'Package delivered safely to your address.',
      state: order.status === 'DELIVERED' ? 'completed' : 'upcoming',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900">{order.displayId}</h1>
            <Badge
              variant={
                order.status === 'APPROVED' || order.status === 'PACKED' || order.status === 'DELIVERED'
                  ? 'success'
                  : order.status === 'ON_HOLD'
                  ? 'caution'
                  : order.status === 'REJECTED'
                  ? 'blocked'
                  : 'default'
              }
            >
              {order.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Order for {order.familyProfile ? `${order.familyProfile.name} (${order.familyProfile.relationship})` : 'Myself'}
          </p>
        </div>

        <Link href="/customer/home">
          <Button variant="outline" size="sm">
            &larr; {tc('back')}
          </Button>
        </Link>
      </div>

      {/* ─── ON HOLD ACTION CARD (RE-UPLOAD PROMPT) ───────────── */}
      {isOnHold && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center gap-2 text-lg">
              <span className="w-3 h-3 rounded-full bg-amber-600 animate-pulse"></span>
              Action Required: Prescription Re-upload Requested
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-amber-950">
              The pharmacist inspected your prescription and noted:
            </p>
            <div className="p-3 bg-white/80 rounded border border-amber-200 text-sm font-medium text-amber-900">
              &ldquo;{order.lines[0]?.rejectReason || 'Prescription image is blurry or illegible. Please upload a clear photo showing doctor signature, patient name, and date.'}&rdquo;
            </div>

            <form onSubmit={handleReuploadSubmit} className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-amber-900">
                Upload clear replacement photo:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setReuploadFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
              <div>
                <Button type="submit" size="sm" isLoading={reuploading} disabled={!reuploadFile}>
                  Submit Clear Prescription
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── ORDER TIMELINE ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-stone-900">Order Progress Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline steps={steps} />
        </CardContent>
      </Card>

      {/* ─── PRESCRIBED MEDICINES ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-stone-900">{t('selectedMedicines')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-stone-100">
            {order.lines.map((line) => (
              <div key={line.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">
                      {line.product ? `${line.product.name} ${line.product.strength}` : line.rawText}
                    </span>
                    {line.product?.schedule && (
                      <Badge variant={line.product.schedule === 'H1' ? 'h1' : line.product.schedule === 'OTC' ? 'otc' : 'h'}>
                        {line.product.schedule}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-stone-500">
                    {tc('quantity')}: {line.quantity} {line.product?.packSize ? `(${line.product.packSize})` : ''}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-stone-900">
                    ₹{line.unitPrice ? line.unitPrice * line.quantity : '—'}
                  </span>
                  <Badge variant={line.lineStatus === 'APPROVED' ? 'success' : line.lineStatus === 'REJECTED' ? 'blocked' : 'default'} className="block mt-1 text-[10px]">
                    {line.lineStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {(() => {
            const orderTotal = order.lines.reduce(
              (sum, l) => sum + (l.unitPrice || 0) * (l.quantity || 1),
              0
            );
            return (
              <div className="pt-4 mt-3 border-t border-[#e3ddef] flex justify-between items-center text-sm">
                <span className="font-bold text-[#190042]">Total Order Amount:</span>
                <span className="font-black text-lg text-[#190042]">
                  {orderTotal > 0 ? `₹${orderTotal}` : 'Awaiting pharmacist verification'}
                </span>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ─── PRESCRIPTION IMAGE PREVIEW ────────────────────── */}
      <Card className="border-[#e3ddef] shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-black text-[#190042]">
            Uploaded Prescription
          </CardTitle>
          <a
            href={`/api/prescription/${order.id}/image`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#B69D0C] hover:underline font-bold"
          >
            Open Full Image ↗
          </a>
        </CardHeader>
        <CardContent>
          <div className="bg-[#10002b] rounded-lg p-3 text-center flex items-center justify-center max-h-80 overflow-hidden border border-[#B69D0C]/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/prescription/${order.id}/image`}
              alt="Prescription scan"
              className="max-h-72 object-contain rounded"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── DELIVERY & STORE DETAILS ────────────────────────── */}
      <Card className="border-[#e3ddef] shadow-xs">
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-bold text-[#796e94] text-xs uppercase block">{t('deliveryAddress')}</span>
            <p className="mt-1 text-[#190042] font-medium">{order.addressText || 'Kolkata, West Bengal'}</p>
          </div>
          <div>
            <span className="font-bold text-[#796e94] text-xs uppercase block">Assigned Fulfillment Store</span>
            <p className="mt-1 font-black text-[#190042]">{order.store?.name || 'Nearest Stocked Store'}</p>
            <p className="text-xs text-[#796e94]">{order.store?.address}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
