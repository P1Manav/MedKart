// src/app/store/orders/page.tsx
'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch store orders');
  return res.json();
};
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';

interface StoreOrder {
  id: string;
  displayId: string;
  status: string;
  addressText: string;
  paymentMethod: string;
  createdAt: string;
  customer: { name: string; phone: string };
  store?: { id: string; name: string } | null;
  auditEvents?: Array<{
    id: string;
    actorRole: string;
    reason: string | null;
    timestamp: string;
  }>;
  lines: Array<{
    id: string;
    lineStatus: string;
    quantity: number;
    unitPrice: number | null;
    product?: {
      name: string;
      strength: string;
      schedule: string;
      packSize: string;
    } | null;
  }>;
}

export default function StoreOrdersPage() {
  const t = useTranslations('store');
  const tc = useTranslations('common');
  const router = useRouter();
  const { data: ordersData, error: _swrError, isLoading: swrLoading, mutate } = useSWR(
    '/api/orders?limit=100',
    fetcher,
    { refreshInterval: 5000 }
  );

  const orders: StoreOrder[] = ordersData?.orders || [];
  const loading = swrLoading && !ordersData;
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Packing modal
  const [packingOrder, setPackingOrder] = useState<StoreOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [packing, setPacking] = useState(false);

  // Direct UPI confirmation modal state (Master Prompt v5)
  const [confirmingUpiOrder, setConfirmingUpiOrder] = useState<StoreOrder | null>(null);
  const [upiUtrInput, setUpiUtrInput] = useState('');
  const [confirmingUpi, setConfirmingUpi] = useState(false);

  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packingOrder || !invoiceNumber.trim()) return;

    setPacking(true);
    setError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/store/orders/${packingOrder.id}/pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: invoiceNumber.trim() }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || (data.reasons && data.reasons.join('; ')) || 'Pack failed');
        return;
      }

      setActionSuccess(`Order ${packingOrder.displayId} successfully packed! Invoice: ${invoiceNumber.trim()}`);
      setPackingOrder(null);
      setInvoiceNumber('');
      await mutate();
      router.refresh();
    } catch {
      setError('Network communication failed.');
    } finally {
      setPacking(false);
    }
  };

  const handleConfirmUpiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingUpiOrder) return;
    if (!/^\d{12}$/.test(upiUtrInput.trim())) {
      setError('Please enter a valid 12-digit numeric UTR reference.');
      return;
    }

    setConfirmingUpi(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/confirm-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: confirmingUpiOrder.id,
          utrReference: upiUtrInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to confirm Direct UPI receipt');
      } else {
        setActionSuccess(data.message);
        setConfirmingUpiOrder(null);
        setUpiUtrInput('');
        await mutate();
        router.refresh();
      }
    } catch {
      setError('Network communication failed.');
    } finally {
      setConfirmingUpi(false);
    }
  };

  const handleHandover = async (orderId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/store/orders/${orderId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerName: 'MedKart Local Fleet' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Handover failed');
      setActionSuccess(data.message);
      await mutate();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Handover failed');
    }
  };

  const handleDeliver = async (orderId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/store/orders/${orderId}/deliver`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delivery confirmation failed');
      setActionSuccess(data.message);
      await mutate();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delivery confirmation failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {t('title')}
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Pick stock, pack approved items, record GST invoice, and handover to delivery associates.
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md font-medium">
          {actionSuccess}
        </div>
      )}

      {error && <ErrorState message={error} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-800">
            Orders Assigned to Salt Lake & Kolkata Network Stores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-stone-500">No store orders found.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {orders.map((ord) => {
                const canPack = ord.status === 'APPROVED';
                const isPacked = ord.status === 'PACKED';
                const isHandedOver = ord.status === 'HANDED_OVER';
                const isUpiConfirmed = ord.auditEvents?.some((a) =>
                  a.reason?.includes('Direct UPI payment verified')
                );

                return (
                  <div key={ord.id} data-testid={`order-card-${ord.displayId}`} className="py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-base">{ord.displayId}</span>
                          <Badge
                            variant={
                              isPacked || isHandedOver
                                ? 'success'
                                : canPack
                                ? 'h'
                                : ord.status === 'ON_HOLD'
                                ? 'caution'
                                : 'default'
                            }
                          >
                            {ord.status}
                          </Badge>
                          {ord.paymentMethod === 'DIRECT_UPI' && (
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                isUpiConfirmed
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {isUpiConfirmed ? '✓ Direct UPI Verified' : 'Direct UPI: Unverified'}
                            </span>
                          )}
                          <span className="text-xs text-stone-500">
                            Fulfillment Store: <strong className="text-stone-800">{ord.store?.name || 'Local Store'}</strong>
                          </span>
                        </div>
                        <p className="text-xs text-stone-500">
                          Customer: {ord.customer.name} ({ord.customer.phone}) • Delivery: {ord.addressText}
                        </p>
                      </div>

                      {/* Store Staff Action Buttons */}
                      <div className="flex items-center gap-2">
                        {ord.paymentMethod === 'DIRECT_UPI' && !isUpiConfirmed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setConfirmingUpiOrder(ord);
                              setUpiUtrInput('');
                            }}
                            className="border-amber-400 text-amber-900 hover:bg-amber-50 text-xs"
                          >
                            Confirm UPI Receipt
                          </Button>
                        )}
                        {canPack ? (
                          <Button size="sm" data-testid={`pack-order-btn-${ord.displayId}`} onClick={() => setPackingOrder(ord)}>
                            {t('packOrder')} &rarr;
                          </Button>
                        ) : isPacked ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              {t('readyToPack')}
                            </span>
                            <Button size="sm" onClick={() => handleHandover(ord.id)} className="text-xs">
                              Hand Over to Courier &rarr;
                            </Button>
                          </div>
                        ) : isHandedOver ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-indigo-800 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                              Out for Delivery
                            </span>
                            <Button size="sm" variant="outline" onClick={() => handleDeliver(ord.id)} className="text-xs">
                              Confirm Delivered &check;
                            </Button>
                          </div>
                        ) : ord.status === 'DELIVERED' ? (
                          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                            ✓ Delivered
                          </span>
                        ) : (
                          <div className="text-right">
                            <Button size="sm" data-testid={`pack-order-btn-${ord.displayId}`} disabled variant="outline">
                              {t('packOrder')}
                            </Button>
                            <span className="block text-[10px] text-amber-800 font-medium mt-0.5">
                              Disabled: Awaiting Pharmacist Prescription Approval
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pick List for Store Staff */}
                    <div className="bg-stone-50 p-3 rounded-md border border-stone-200 text-xs space-y-1">
                      <span className="font-semibold text-stone-600 uppercase text-[10px] tracking-wider block">
                        Pick List:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ord.lines.map((l) => (
                          <div key={l.id} className="flex items-center justify-between bg-white p-2 rounded border border-stone-200">
                            <span>
                              {l.product ? `${l.product.name} ${l.product.strength}` : 'Custom line'}
                            </span>
                            <span className="font-bold text-teal-900">
                              Qty: {l.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice / Pack Modal Dialog */}
      {packingOrder && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full bg-white shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-stone-900">
                Pack Order {packingOrder.displayId}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePackSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {t('invoiceNumber')} (Mandatory)
                  </label>
                  <input
                    type="text"
                    data-testid="invoice-number-input"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-SL-2026-8812"
                    className="w-full p-2.5 border rounded-md text-sm font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Pharmacist prescription approval verified. Transitioning to PACKED will lock items and generate handover receipt.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPackingOrder(null)}>
                    {tc('cancel')}
                  </Button>
                  <Button type="submit" data-testid="confirm-pack-btn" size="sm" isLoading={packing}>
                    {t('packOrder')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Direct UPI Receipt Confirmation Modal (Master Prompt v5) */}
      {confirmingUpiOrder && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full bg-white shadow-2xl border-amber-300">
            <CardHeader>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 w-fit">
                Staff Verification
              </span>
              <CardTitle className="text-lg font-bold text-stone-900 mt-1">
                Confirm Direct UPI Receipt — {confirmingUpiOrder.displayId}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfirmUpiSubmit} className="space-y-4">
                <div className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded border border-stone-200">
                  Customer: <strong>{confirmingUpiOrder.customer.name}</strong> (+91 {confirmingUpiOrder.customer.phone})
                  <br />
                  Payee VPA: <span className="font-mono text-teal-800">Configured in UPI_PAYEE_VPA</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    12-digit UPI UTR / Bank Reference Number *
                  </label>
                  <input
                    type="text"
                    value={upiUtrInput}
                    onChange={(e) => setUpiUtrInput(e.target.value)}
                    placeholder="e.g. 431209871234"
                    className="w-full p-2.5 border rounded-md text-sm font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Verifying this transaction writes an immutable audit record with your staff ID and timestamp.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingUpiOrder(null)}
                  >
                    {tc('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={confirmingUpi}
                    className="bg-teal-700 hover:bg-teal-800"
                  >
                    Verify & Confirm Receipt
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

