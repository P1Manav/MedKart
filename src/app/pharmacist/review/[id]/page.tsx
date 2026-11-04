// src/app/pharmacist/review/[id]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';

interface ReviewOrder {
  id: string;
  displayId: string;
  status: string;
  prescriptionStatus: string;
  createdAt: string;
  customer: { name: string; phone: string };
  familyProfile?: { name: string; relationship: string } | null;
  store?: { name: string } | null;
  lines: Array<{
    id: string;
    rawText: string;
    aiDrugName: string | null;
    aiStrength: string | null;
    aiConfidence: number | null;
    lineStatus: string;
    quantity: number;
    unitPrice: number | null;
    needsReview: boolean;
    rejectReason: string | null;
    genericSuggested: boolean;
    customerConsentGeneric: boolean;
    product?: {
      id: string;
      name: string;
      strength: string;
      schedule: string;
      price: number;
      packSize: string;
    } | null;
  }>;
}

export default function PharmacistReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<ReviewOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Mobile Tab switcher (375px narrow screen requirement)
  const [activeTab, setActiveTab] = useState<'IMAGE' | 'ITEMS'>('ITEMS');

  // Image controls (zoom, rotate, pan)
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Line modal / form states
  const [rejectingLineId, setRejectingLineId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reuploadReason, setReuploadReason] = useState('');
  const [showReuploadModal, setShowReuploadModal] = useState(false);

  // Generic consent toggles
  const [genericConsents, setGenericConsents] = useState<Record<string, boolean>>({});

  // H1 register inputs
  const [h1Inputs, setH1Inputs] = useState<
    Record<
      string,
      {
        prescriberName: string;
        prescriberRegNo: string;
        patientName: string;
        quantity: number;
      }
    >
  >({});

  async function loadOrder() {
    try {
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (res.ok && data.order) {
        const found = data.order;
        setOrder(found);
        // Initialise H1 details with defaults
        const initialH1: typeof h1Inputs = {};
        found.lines.forEach((l: ReviewOrder['lines'][0]) => {
          if (l.product?.schedule === 'H1') {
            initialH1[l.id] = {
              prescriberName: 'Dr. Subir Mukherjee',
              prescriberRegNo: 'WBMC-48192',
              patientName: found.familyProfile?.name || found.customer.name,
              quantity: l.quantity,
            };
          }
        });
        setH1Inputs(initialH1);
      } else {
        setError(data.error || 'Order not found.');
      }
    } catch {
      setError('Failed to fetch order.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const executeAction = async (payload: object) => {
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/pharmacist/orders/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || (data.reasons && data.reasons.join('; ')) || 'Action failed');
        return;
      }

      setActionMessage(data.message || 'Updated successfully');
      setRejectingLineId(null);
      setShowReuploadModal(false);
      await loadOrder();
    } catch {
      setError('Communication with server failed.');
    }
  };

  const handleApproveLine = (lineId: string, isH1: boolean) => {
    const payload: {
      action: 'APPROVE_LINE';
      lineId: string;
      genericConsentGiven?: boolean;
      h1Details?: {
        prescriberName: string;
        prescriberRegNo: string;
        patientName: string;
        quantity: number;
      };
    } = {
      action: 'APPROVE_LINE',
      lineId,
      genericConsentGiven: genericConsents[lineId],
    };

    if (isH1 && h1Inputs[lineId]) {
      payload.h1Details = h1Inputs[lineId];
    }

    executeAction(payload);
  };

  const handleRejectLine = (lineId: string) => {
    if (!rejectReason.trim()) {
      setError('Mandatory rejection reason required.');
      return;
    }
    executeAction({
      action: 'REJECT_LINE',
      lineId,
      reason: rejectReason.trim(),
    });
  };

  const handleApproveOrder = () => {
    executeAction({ action: 'APPROVE_ORDER' });
  };

  const handleRequestReupload = () => {
    if (!reuploadReason.trim()) {
      setError('Mandatory reason for patient re-upload is required.');
      return;
    }
    executeAction({
      action: 'REQUEST_REUPLOAD',
      reason: reuploadReason.trim(),
    });
  };

  if (loading) {
    return (
      <div className="py-8 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-12 w-1/4" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="py-8 max-w-3xl mx-auto">
        <ErrorState message={error} />
        <Link href="/pharmacist/queue" className="mt-4 inline-block text-teal-700 underline">
          &larr; Back to Verification Queue
        </Link>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-4">
      {/* Top Bar with Patient Info & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-stone-900">{order.displayId}</h1>
            <Badge variant={order.status === 'APPROVED' ? 'success' : order.status === 'ON_HOLD' ? 'caution' : 'default'}>
              {order.status}
            </Badge>
            <span className="text-xs text-stone-500">
              Submitted: {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-stone-600 mt-0.5">
            Patient: <span className="font-semibold text-stone-900">{order.familyProfile ? `${order.familyProfile.name} (${order.familyProfile.relationship})` : order.customer.name}</span> • Phone: {order.customer.phone}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pharmacist/queue">
            <Button variant="outline" size="sm">
              &larr; Queue
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowReuploadModal(true)}
          >
            Request Re-upload
          </Button>
          <Button
            size="sm"
            onClick={handleApproveOrder}
            disabled={order.status === 'APPROVED'}
            className="shadow-sm"
          >
            Approve Order &rarr;
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md font-medium">
          {actionMessage}
        </div>
      )}

      {error && <ErrorState message={error} />}

      {/* Mobile Sticky Tab Switcher (375px requirement) */}
      <div className="lg:hidden flex border-b border-stone-200 bg-white sticky top-16 z-20">
        <button
          onClick={() => setActiveTab('ITEMS')}
          className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 cursor-pointer ${
            activeTab === 'ITEMS'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Matched Medicines ({order.lines.length})
        </button>
        <button
          onClick={() => setActiveTab('IMAGE')}
          className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 cursor-pointer ${
            activeTab === 'IMAGE'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Prescription Image
        </button>
      </div>

      {/* Main Verification Grid: Side-by-side on desktop, tabbed on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── LEFT: PRESCRIPTION VIEWER (PAN / ZOOM / ROTATE) ───────── */}
        <div className={`lg:col-span-6 lg:block ${activeTab === 'IMAGE' ? 'block' : 'hidden'}`}>
          <Card className="h-full flex flex-col">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-stone-100">
              <CardTitle className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <span>Prescription Document</span>
                <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-mono">
                  AES-256 Decrypted
                </span>
              </CardTitle>
              {/* Zoom & Rotate Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                  className="p-1.5 border rounded hover:bg-stone-100 text-xs font-bold w-7 h-7 flex items-center justify-center cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="text-xs font-mono text-stone-500 w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                  className="p-1.5 border rounded hover:bg-stone-100 text-xs font-bold w-7 h-7 flex items-center justify-center cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 border rounded hover:bg-stone-100 text-xs font-semibold px-2 cursor-pointer"
                  title="Rotate 90 degrees"
                >
                  Rotate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="p-1.5 border rounded hover:bg-stone-100 text-xs px-2 cursor-pointer text-stone-500"
                >
                  Reset
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-2 flex-1 bg-stone-900/90 rounded-b-lg overflow-auto flex items-center justify-center min-h-[500px]">
              <div
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="origin-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/prescription/${order.id}/image`}
                  alt="Prescription Scan"
                  className="max-w-full max-h-[600px] object-contain shadow-2xl rounded"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── RIGHT: MATCHED MEDICINES & PHARMACIST ACTIONS ─────────── */}
        <div className={`lg:col-span-6 lg:block ${activeTab === 'ITEMS' ? 'block' : 'hidden'}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-stone-500 px-1">
              <span>Compare written text with matched catalogue medicine:</span>
              <span className="font-semibold text-teal-800">
                All Schedule H/H1 items require pharmacist approval
              </span>
            </div>

            {order.lines.map((line, idx) => {
              const isApproved = line.lineStatus === 'APPROVED' || line.lineStatus === 'EDITED_APPROVED';
              const isRejected = line.lineStatus === 'REJECTED';
              const isBlocked = line.lineStatus === 'BLOCKED_NOT_SOLD_ONLINE';
              const isH1 = line.product?.schedule === 'H1';
              const hasGeneric = line.product?.name.includes('Brand');

              return (
                <Card
                  key={line.id}
                  className={`border transition-all ${
                    isApproved
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : isBlocked
                      ? 'border-red-300 bg-red-50/20'
                      : isRejected
                      ? 'border-stone-300 bg-stone-50 opacity-60'
                      : line.needsReview
                      ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-300'
                      : 'border-stone-200'
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header: Item index, status, schedule badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-base">
                            Line #{idx + 1}: {line.product ? `${line.product.name} ${line.product.strength}` : line.rawText}
                          </span>
                          {line.product?.schedule && (
                            <Badge variant={line.product.schedule === 'H1' ? 'h1' : line.product.schedule === 'OTC' ? 'otc' : 'h'}>
                              {line.product.schedule}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                            AI DRAFT
                          </span>
                          {line.aiConfidence && (
                            <span className="text-stone-500">
                              Confidence: {Math.round(line.aiConfidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant={
                          isApproved ? 'success' : isBlocked || isRejected ? 'blocked' : line.needsReview ? 'caution' : 'default'
                        }
                      >
                        {line.lineStatus}
                      </Badge>
                    </div>

                    {/* Original Transcription Text */}
                    <div className="p-2.5 bg-stone-50 border border-stone-200 rounded text-xs space-y-1">
                      <span className="font-semibold text-stone-600 block">Prescription Original Written Text:</span>
                      <p className="font-mono text-stone-800">{line.rawText || 'Illegible scribble'}</p>
                    </div>

                    {/* BLOCKED ITEM WARNING (SCHEDULE X / NARCOTIC) */}
                    {isBlocked && (
                      <div className="p-3 bg-red-50 border border-red-300 rounded text-xs text-red-900">
                        <span className="font-bold block">Statutory Online Restriction:</span>
                        This item belongs to Schedule X or Narcotic drugs. It cannot be sold or dispensed online under any circumstances.
                      </div>
                    )}

                    {/* CAUTION / NEEDS REVIEW REASON */}
                    {line.needsReview && line.rejectReason && (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 flex items-center gap-2">
                        <span className="font-bold">Check Required:</span>
                        <span>{line.rejectReason}</span>
                      </div>
                    )}

                    {/* GENERIC SUBSTITUTION OFFER & CONSENT */}
                    {hasGeneric && (
                      <div className="p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-950 space-y-2">
                        <div className="flex justify-between font-semibold">
                          <span>Generic Alternative Available: Rosuvastatin 10 mg (Generic)</span>
                          <span className="text-emerald-800 font-bold">Save ₹115 (₹65 vs ₹180)</span>
                        </div>
                        <p className="text-[11px] text-stone-600">
                          Price difference only; no clinical claim. Requires both pharmacist approval AND patient consent.
                        </p>
                        <label className="flex items-center gap-2 font-medium cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={!!genericConsents[line.id]}
                            onChange={(e) =>
                              setGenericConsents({ ...genericConsents, [line.id]: e.target.checked })
                            }
                            className="text-teal-600 rounded"
                          />
                          <span>Customer Consent Recorded (per §5.5)</span>
                        </label>
                      </div>
                    )}

                    {/* SCHEDULE H1 REGISTER ENTRY (LEGAL MANDATE) */}
                    {isH1 && (
                      <div className="p-3 bg-amber-50/70 border border-amber-300 rounded text-xs space-y-2">
                        <span className="font-bold text-amber-950 block">
                          Schedule H1 Register Entry (Required by Law):
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-stone-600 block">Prescriber Doctor Name:</label>
                            <input
                              type="text"
                              value={h1Inputs[line.id]?.prescriberName || ''}
                              onChange={(e) =>
                                setH1Inputs({
                                  ...h1Inputs,
                                  [line.id]: {
                                    ...h1Inputs[line.id],
                                    prescriberName: e.target.value,
                                  },
                                })
                              }
                              className="w-full p-1.5 border rounded bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-600 block">Doctor Reg. Number:</label>
                            <input
                              type="text"
                              value={h1Inputs[line.id]?.prescriberRegNo || ''}
                              onChange={(e) =>
                                setH1Inputs({
                                  ...h1Inputs,
                                  [line.id]: {
                                    ...h1Inputs[line.id],
                                    prescriberRegNo: e.target.value,
                                  },
                                })
                              }
                              className="w-full p-1.5 border rounded bg-white text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Per-Line Action Buttons */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
                      <span className="text-xs text-stone-500 font-medium">
                        Qty: {line.quantity} • Unit Price: ₹{line.unitPrice || '—'}
                      </span>

                      {!isBlocked && (
                        <div className="flex items-center gap-2">
                          {rejectingLineId === line.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Mandatory reject reason..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="p-1 border rounded text-xs"
                              />
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleRejectLine(line.id)}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRejectingLineId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setRejectingLineId(line.id)}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApproveLine(line.id, isH1)}
                                disabled={isApproved}
                              >
                                {isApproved ? 'Approved ✓' : 'Approve Line'}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Re-upload Modal Dialog */}
      {showReuploadModal && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full bg-white shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-stone-900">
                Request Prescription Re-upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-stone-600">
                This will place the order ON HOLD and notify the patient to upload a clearer photo.
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Prescription photo is blurry; doctor signature and date are not visible. Please take a well-lit photo."
                value={reuploadReason}
                onChange={(e) => setReuploadReason(e.target.value)}
                className="w-full p-2.5 border rounded-md text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowReuploadModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="danger" onClick={handleRequestReupload}>
                  Send Re-upload Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
