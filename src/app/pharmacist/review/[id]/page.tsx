// src/app/pharmacist/review/[id]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';

interface ReviewOrder {
  id: string;
  displayId: string;
  status: string;
  paymentMethod?: string | null;
  prescriptionStatus: string;
  prescriptionValidUntil?: string | null;
  aiDateText?: string | null;
  createdAt: string;
  customer: { name: string; phone: string };
  familyProfile?: { name: string; relationship: string } | null;
  store?: { name: string } | null;
  auditEvents?: Array<{
    id: string;
    actorRole: string;
    reason: string | null;
    timestamp: string;
  }>;
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
      genericOriginals?: Array<{
        id: string;
        genericProduct: {
          id: string;
          name: string;
          strength: string;
          form: string;
          price: number;
          packSize: string;
        };
      }>;
    } | null;
  }>;
}

export default function PharmacistReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations('pharmacist');
  const tc = useTranslations('common');
  const router = useRouter();
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

  // Prescription date confirmation (P0-10)
  const [prescriptionDate, setPrescriptionDate] = useState<string>('');
  const [dateConfirmed, setDateConfirmed] = useState<boolean>(false);

  // Direct UPI confirmation states (Master Prompt v5)
  const [upiUtrInput, setUpiUtrInput] = useState('');
  const [confirmingUpi, setConfirmingUpi] = useState(false);

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
        if (found.aiDateText && /^\d{4}-\d{2}-\d{2}$/.test(found.aiDateText.trim())) {
          setPrescriptionDate(found.aiDateText.trim());
        } else if (!prescriptionDate) {
          setPrescriptionDate(new Date().toISOString().slice(0, 10));
        }
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
      router.refresh();
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

  const isPrescriptionExpired = () => {
    if (!prescriptionDate) return false;
    const parts = prescriptionDate.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const rx = new Date(Date.UTC(y, m, d, 6, 30));
    if (isNaN(rx.getTime())) return false;
    const totalMonths = m + 6;
    const targetY = y + Math.floor(totalMonths / 12);
    const targetM = ((totalMonths % 12) + 12) % 12;
    const maxDays = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
    const clampedD = Math.min(d, maxDays);
    const validUntil = new Date(Date.UTC(targetY, targetM, clampedD, 6, 30));
    return validUntil.getTime() < Date.now();
  };

  const getExpirationDateString = () => {
    if (!prescriptionDate) return '';
    const parts = prescriptionDate.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const totalMonths = m + 6;
    const targetY = y + Math.floor(totalMonths / 12);
    const targetM = ((totalMonths % 12) + 12) % 12;
    const maxDays = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
    const clampedD = Math.min(d, maxDays);
    const validUntil = new Date(Date.UTC(targetY, targetM, clampedD));
    return validUntil.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleApproveOrder = () => {
    if (!prescriptionDate) {
      setError('Prescription date is required to approve the order.');
      return;
    }
    if (!dateConfirmed) {
      setError('Please verify and confirm the prescription date.');
      return;
    }
    if (isPrescriptionExpired()) {
      setError('Cannot approve: this prescription has expired.');
      return;
    }
    executeAction({ action: 'APPROVE_ORDER', prescriptionDate });
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

  const handleConfirmDirectUpi = async () => {
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
          orderId: order?.id,
          utrReference: upiUtrInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to confirm Direct UPI receipt.');
      } else {
        setActionMessage(data.message);
        setUpiUtrInput('');
        await loadOrder();
        router.refresh();
      }
    } catch {
      setError('Network communication failed.');
    } finally {
      setConfirmingUpi(false);
    }
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
              &larr; {tc('back')}
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowReuploadModal(true)}
          >
            {t('requestReupload')}
          </Button>
          <Button
            size="sm"
            data-testid="approve-order-header-btn"
            onClick={handleApproveOrder}
            disabled={
              order.status === 'APPROVED' ||
              !prescriptionDate ||
              !dateConfirmed ||
              isPrescriptionExpired()
            }
            title={
              !dateConfirmed
                ? 'Please verify and confirm prescription date before approving'
                : isPrescriptionExpired()
                ? 'Prescription is expired'
                : undefined
            }
            className="shadow-sm"
          >
            {t('approveFullOrder')} &rarr;
          </Button>
        </div>
      </div>

      {/* Prescription Date & Validity Verification Card (P0-10) */}
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="py-3 px-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 block">
                Prescription Date (Rx Issue Date)
              </span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="date"
                  value={prescriptionDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setPrescriptionDate(e.target.value);
                    setDateConfirmed(false);
                  }}
                  className="text-sm font-medium border border-stone-300 rounded px-2 py-1 bg-white text-stone-900 shadow-xs focus:ring-2 focus:ring-teal-600"
                />
                {order.aiDateText && (
                  <span className="text-xs text-stone-500">
                    (AI detected: <strong className="text-stone-700">{order.aiDateText}</strong>)
                  </span>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-2 sm:mt-4">
              <input
                type="checkbox"
                checked={dateConfirmed}
                disabled={!prescriptionDate || isPrescriptionExpired()}
                onChange={(e) => setDateConfirmed(e.target.checked)}
                className="rounded border-stone-300 text-teal-700 focus:ring-teal-600 h-4 w-4"
              />
              <span className="text-xs font-medium text-stone-800">
                I verify that the prescription is dated{' '}
                <span className="font-bold">{prescriptionDate || '...'}</span> and is within validity window
              </span>
            </label>
          </div>

          {prescriptionDate && !isPrescriptionExpired() && (
            <div className="text-xs text-stone-600">
              Valid until:{' '}
              <strong className="text-stone-900 font-bold">{getExpirationDateString()}</strong> (6-month window)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Path B: Direct UPI Payment Verification (Master Prompt v5) */}
      {order.paymentMethod === 'DIRECT_UPI' && (() => {
        const upiVerified = order.auditEvents?.find((a) =>
          a.reason?.includes('Direct UPI payment verified')
        );
        return (
          <Card className={upiVerified ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-300 bg-amber-50/70'}>
            <CardContent className="py-3 px-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    upiVerified ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-950'
                  }`}>
                    {upiVerified ? '✓ Payment Verified' : 'Direct UPI: Payment Pending Verification'}
                  </span>
                  <span className="text-xs font-mono text-stone-600">Payee VPA: Configured in UPI_PAYEE_VPA</span>
                </div>
                <p className="text-xs text-stone-700">
                  {upiVerified
                    ? upiVerified.reason
                    : 'Customer chose Direct UPI Transfer. Verify the 12-digit UTR on bank statement before dispensing.'}
                </p>
              </div>

              {!upiVerified && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={upiUtrInput}
                    onChange={(e) => setUpiUtrInput(e.target.value)}
                    placeholder="Enter 12-digit UTR Ref"
                    className="text-xs font-mono border border-stone-300 rounded px-2.5 py-1.5 bg-white text-stone-900 w-44 focus:ring-2 focus:ring-teal-600"
                  />
                  <Button
                    size="sm"
                    onClick={handleConfirmDirectUpi}
                    isLoading={confirmingUpi}
                    className="text-xs whitespace-nowrap bg-teal-700 hover:bg-teal-800"
                  >
                    Confirm Direct UPI Receipt
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Red Expiration Warning Banner (P0-10) */}
      {isPrescriptionExpired() && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-900 text-sm rounded-md font-semibold flex items-center gap-2">
          <span>⚠️ Prescription expired on {getExpirationDateString()}. Cannot approve.</span>
        </div>
      )}

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
                <span>{t('prescriptionViewer')}</span>
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
                  title={t('zoomOut')}
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
                  title={t('zoomIn')}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 border rounded hover:bg-stone-100 text-xs font-semibold px-2 cursor-pointer"
                  title="Rotate 90 degrees"
                >
                  {t('rotate')}
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
              const genericSub = line.product?.genericOriginals?.[0]?.genericProduct;
              const priceDiff =
                genericSub && line.product ? Math.round(line.product.price - genericSub.price) : 0;

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
                            AI DRAFT (Automated handwriting recognition)
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
                    {genericSub && (
                      <div className="p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-950 space-y-2">
                        <div className="flex justify-between font-semibold">
                          <span>
                            Generic Alternative Available: {genericSub.name} {genericSub.strength}
                          </span>
                          <span className="text-emerald-800 font-bold">
                            Save ₹{priceDiff} (₹{genericSub.price} vs ₹{line.product?.price})
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600">
                          Price difference only; no clinical claim. Requires both pharmacist approval AND patient consent.
                        </p>
                        <label className="flex items-center gap-2 font-medium cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={!!genericConsents[line.id] || line.customerConsentGeneric}
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
