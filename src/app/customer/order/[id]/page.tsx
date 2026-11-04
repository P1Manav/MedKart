// src/app/customer/order/[id]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
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
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-upload form state when ON_HOLD
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploading, setReuploading] = useState(false);

  async function loadOrder() {
    try {
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (res.ok && data.order) {
        setOrder(data.order);
      } else {
        setError(data.error || 'Order not found or you do not have permission to view it.');
      }
    } catch {
      setError('Failed to fetch order details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

      await loadOrder();
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
        <Link href="/customer/home" className="mt-4 inline-block text-teal-700 hover:underline">
          &larr; Back to Home
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
            &larr; Back to My Orders
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
          <CardTitle className="text-lg font-bold text-stone-900">Medicines in this Order</CardTitle>
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
                    Qty: {line.quantity} {line.product?.packSize ? `(${line.product.packSize})` : ''}
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
        </CardContent>
      </Card>

      {/* ─── DELIVERY & STORE DETAILS ────────────────────────── */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-stone-500 text-xs uppercase block">Delivery Address</span>
            <p className="mt-1 text-stone-800">{order.addressText || 'Kolkata, West Bengal'}</p>
          </div>
          <div>
            <span className="font-semibold text-stone-500 text-xs uppercase block">Assigned Fulfillment Store</span>
            <p className="mt-1 font-semibold text-teal-800">{order.store?.name || 'Nearest Stocked Store'}</p>
            <p className="text-xs text-stone-500">{order.store?.address}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
