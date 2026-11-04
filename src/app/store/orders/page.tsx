// src/app/store/orders/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
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
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Packing modal
  const [packingOrder, setPackingOrder] = useState<StoreOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [packing, setPacking] = useState(false);

  async function loadOrders() {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch {
      setError('Failed to fetch store orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

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
      await loadOrders();
    } catch {
      setError('Network communication failed.');
    } finally {
      setPacking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            Store Fulfillment & Packing Desk
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

                return (
                  <div key={ord.id} className="py-4 space-y-3">
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
                        {canPack ? (
                          <Button size="sm" onClick={() => setPackingOrder(ord)}>
                            Pack Order (Enter Invoice) &rarr;
                          </Button>
                        ) : isPacked ? (
                          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                            Packed & Ready for Handover
                          </span>
                        ) : (
                          <div className="text-right">
                            <Button size="sm" disabled variant="outline">
                              Pack Order (Locked)
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
                    Store Invoice / Bill Number (Mandatory)
                  </label>
                  <input
                    type="text"
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
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" isLoading={packing}>
                    Confirm & Mark Packed
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
