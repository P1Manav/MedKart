// src/components/payment/direct-upi-modal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { buildUpiUri } from '@/lib/payments/upi-config';
import { logger } from '@/lib/logger';

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
          dark: '#190042', // Brand Purple
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => logger.error('Failed to generate UPI QR code:', err));
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
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-[#190042] border border-[#e3ddef] animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#e3ddef] mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#f3effa] text-[#190042] border border-[#190042]/20">
              Path B — Direct UPI Transfer
            </span>
            <h3 className="text-xl font-black text-[#190042] mt-1">Real UPI Transfer</h3>
          </div>
          <button
            onClick={handleFinish}
            className="text-[#796e94] hover:text-[#190042] text-2xl font-bold p-1 cursor-pointer leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 text-center">
          <div className="bg-[#f9f8fc] border border-[#e3ddef] rounded-lg p-3 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#4a3e65] font-medium">Order Reference:</span>
              <strong className="font-mono text-[#190042]">{displayId}</strong>
            </div>
            {payeeVpa && (
              <div className="flex justify-between">
                <span className="text-[#4a3e65] font-medium">Payee VPA:</span>
                <strong className="font-mono text-[#190042]">{payeeVpa}</strong>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-[#e3ddef]">
              <span className="text-[#4a3e65] font-semibold">Total Payable:</span>
              <strong className="text-lg font-black text-[#190042]">₹{amount.toFixed(2)}</strong>
            </div>
          </div>

          {/* Genuine Merchant QR Code */}
          <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-[#B69D0C]/60 rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/payment-qr.jpg"
              alt={`Scan to pay ₹${amount.toFixed(2)} to ${payeeName}`}
              className="w-52 h-52 mx-auto rounded-lg shadow-sm bg-black p-1 border border-[#B69D0C]/30 object-contain"
              onError={(e) => {
                if (qrDataUrl) {
                  (e.target as HTMLImageElement).src = qrDataUrl;
                }
              }}
            />
            <span className="text-xs font-semibold text-[#190042] mt-2">
              Scan with PhonePe, Google Pay, Paytm, or BHIM
            </span>
          </div>

          {/* Deep link button for mobile devices */}
          {upiUri && (
            <div className="space-y-2">
              <a
                href={upiUri}
                className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-[#190042] hover:bg-[#26055f] text-white font-bold rounded-lg text-sm transition-colors shadow-sm border border-[#B69D0C]/40"
              >
                Open in Installed UPI App &rarr;
              </a>

              <button
                type="button"
                onClick={handleCopyUri}
                className="w-full text-xs text-[#4a3e65] hover:text-[#190042] font-medium underline py-1 cursor-pointer"
              >
                {copied ? '✓ UPI Intent URI copied to clipboard' : 'Copy raw UPI URI string'}
              </button>
            </div>
          )}

          {/* UTR Reference Input */}
          <div className="bg-[#f9f8fc] p-3.5 rounded-lg border border-[#e3ddef] text-left space-y-1.5">
            <label className="block text-xs font-bold text-[#190042]">
              Transaction UTR / Reference (12 Digits):
            </label>
            <input
              type="text"
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value.trim())}
              placeholder="e.g. 401234567890"
              className="w-full px-3 py-2 border border-[#e3ddef] bg-white rounded-md text-xs font-mono text-[#190042] focus:border-[#B69D0C] focus:outline-none"
            />
            <span className="text-[10px] text-[#796e94] block">
              Enter the 12-digit UPI reference ID from your banking app so store staff can immediately match it.
            </span>
            {utrError && (
              <p className="text-xs text-red-600 font-semibold">{utrError}</p>
            )}
          </div>

          {/* Honest Operational Notice */}
          <div className="bg-[#fcf8db] border border-[#B69D0C]/50 rounded-lg p-3 text-xs text-[#7b6905] text-left space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-[#594c03]">
              <span className="w-2 h-2 rounded-full bg-[#B69D0C]"></span>
              Manual Staff Verification Notice:
            </p>
            <p className="leading-relaxed">
              Direct UPI transfers require manual verification by licensed store staff or pharmacists before your order can proceed to packing.
            </p>
          </div>

          <Button
            type="button"
            variant="gold"
            onClick={handleFinish}
            disabled={submittingUtr}
            className="w-full text-base font-bold shadow-sm"
          >
            {submittingUtr ? 'Saving...' : 'Done / View Order Status &rarr;'}
          </Button>
        </div>
      </div>
    </div>
  );
};
