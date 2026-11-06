// src/components/payment/direct-upi-modal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { buildUpiUri } from '@/lib/payments/upi-config';

interface DirectUpiModalProps {
  isOpen: boolean;
  orderId: string;
  displayId: string;
  amount: number;
  payeeVpa?: string;
  payeeName?: string;
  onClose: () => void;
}

export const DirectUpiModal: React.FC<DirectUpiModalProps> = ({
  isOpen,
  orderId,
  displayId,
  amount,
  payeeVpa: initialPayeeVpa,
  payeeName: initialPayeeName,
  onClose,
}) => {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [payeeVpa, setPayeeVpa] = useState<string>(initialPayeeVpa || '');
  const [payeeName, setPayeeName] = useState<string>(initialPayeeName || 'MedKart Demo');
  const [utrInput, setUtrInput] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [utrSubmitted, setUtrSubmitted] = useState(false);

  // Fetch payment config if payeeVpa wasn't passed directly
  useEffect(() => {
    if (!initialPayeeVpa) {
      fetch('/api/payments/config')
        .then((res) => res.json())
        .then((data) => {
          if (data?.directUpi?.payeeVpa) {
            setPayeeVpa(data.directUpi.payeeVpa);
            if (data.directUpi.payeeName) {
              setPayeeName(data.directUpi.payeeName);
            }
          }
        })
        .catch(() => {});
    }
  }, [initialPayeeVpa]);

  // Standard NPCI UPI URI with orderId (tr) and displayId (tn)
  const upiUri = payeeVpa
    ? buildUpiUri({
        payeeVpa,
        payeeName,
        amount,
        orderId,
        displayId,
      })
    : '';

  useEffect(() => {
    if (isOpen && upiUri) {
      QRCode.toDataURL(upiUri, {
        width: 256,
        margin: 2,
        color: {
          dark: '#0f766e', // teal-700
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate UPI QR code:', err));
    }
  }, [isOpen, upiUri]);

  if (!isOpen) return null;

  const handleCopyUri = () => {
    if (!upiUri) return;
    navigator.clipboard.writeText(upiUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFinish = async () => {
    setUtrError(null);
    const cleanUtr = utrInput.trim();
    if (cleanUtr.length > 0 && !/^\d{12}$/.test(cleanUtr)) {
      setUtrError('UTR must be exactly 12 numeric digits.');
      return;
    }

    if (/^\d{12}$/.test(cleanUtr) && !utrSubmitted) {
      setSubmittingUtr(true);
      try {
        const res = await fetch('/api/payments/submit-utr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            utrReference: cleanUtr,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setUtrError(data?.error || 'Failed to record UTR.');
          setSubmittingUtr(false);
          return;
        }
      } catch {
        setUtrError('Network error submitting UTR.');
        setSubmittingUtr(false);
        return;
      }
      setSubmittingUtr(false);
      setUtrSubmitted(true);
    }

    onClose();
    router.push(`/customer/order/${orderId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-stone-900 rounded-xl shadow-2xl max-w-md w-full p-6 text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800 mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
              Path B — Direct UPI Transfer
            </span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">Real UPI Transfer</h3>
          </div>
          <button
            onClick={handleFinish}
            className="text-stone-400 hover:text-stone-600 text-lg font-bold p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 text-center">
          <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-lg p-3 text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500 dark:text-stone-400">Order Reference:</span>
              <strong className="font-mono text-stone-900 dark:text-stone-100">{displayId}</strong>
            </div>
            {payeeVpa && (
              <div className="flex justify-between">
                <span className="text-stone-500 dark:text-stone-400">Payee VPA:</span>
                <strong className="font-mono text-teal-800 dark:text-teal-400">{payeeVpa}</strong>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500 dark:text-stone-400">Total Payable:</span>
              <strong className="text-base text-stone-900 dark:text-stone-100">₹{amount.toFixed(2)}</strong>
            </div>
          </div>

          {/* Genuine Dynamic QR Code */}
          <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-stone-800 border-2 border-dashed border-teal-300 dark:border-teal-700 rounded-lg">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Scan to pay ₹${amount.toFixed(2)} for ${displayId}`}
                className="w-52 h-52 mx-auto rounded shadow-sm bg-white p-2"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-xs text-stone-400">
                {payeeVpa ? 'Generating genuine QR...' : 'Direct UPI is not currently configured by administrator.'}
              </div>
            )}
            <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-2">
              Scan with Google Pay, PhonePe, Paytm, or BHIM
            </span>
          </div>

          {/* Deep link button for mobile devices */}
          {upiUri && (
            <div className="space-y-2">
              <a
                href={upiUri}
                className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
              >
                Open in Installed UPI App &rarr;
              </a>

              <button
                type="button"
                onClick={handleCopyUri}
                className="w-full text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 underline py-1 cursor-pointer"
              >
                {copied ? '✓ UPI Intent URI copied to clipboard' : 'Copy raw UPI URI string'}
              </button>
            </div>
          )}

          {/* UTR Reference Input */}
          <div className="bg-stone-50 dark:bg-stone-800/40 p-3 rounded-lg border border-stone-200 dark:border-stone-700 text-left space-y-1.5">
            <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200">
              Transaction UTR / Reference (12 Digits):
            </label>
            <input
              type="text"
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value.trim())}
              placeholder="e.g. 401234567890"
              className="w-full px-2.5 py-1.5 border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 rounded text-xs font-mono text-stone-900 dark:text-stone-100"
            />
            <span className="text-[10px] text-stone-500 block">
              Enter the 12-digit UPI reference ID from your banking app so store staff can immediately match it.
            </span>
            {utrError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{utrError}</p>
            )}
          </div>

          {/* Honest Operational Notice */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-[11px] text-amber-900 dark:text-amber-200 text-left space-y-1">
            <p className="font-bold flex items-center gap-1 text-amber-950 dark:text-amber-100">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Manual Staff Verification Notice:
            </p>
            <p>
              Direct UPI transfers require manual verification by licensed store staff or pharmacists before your order can proceed to packing.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleFinish}
            disabled={submittingUtr}
            className="w-full text-base font-semibold"
          >
            {submittingUtr ? 'Saving...' : 'Done / View Order Status &rarr;'}
          </Button>
        </div>
      </div>
    </div>
  );
};
