// src/components/payment/direct-upi-modal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface DirectUpiModalProps {
  isOpen: boolean;
  orderId: string;
  displayId: string;
  amount: number;
  onClose: () => void;
}

export const DirectUpiModal: React.FC<DirectUpiModalProps> = ({
  isOpen,
  orderId,
  displayId,
  amount,
  onClose,
}) => {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // NPCI standard UPI payment URI (Spec Section 4)
  const upiUri = `upi://pay?pa=7778083224@upi&pn=MedKart%20Demo&am=${amount.toFixed(2)}&cu=INR&tn=Order%20${encodeURIComponent(displayId)}`;

  useEffect(() => {
    if (isOpen) {
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
    navigator.clipboard.writeText(upiUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFinish = () => {
    onClose();
    router.push(`/customer/order/${orderId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-stone-900 border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 text-teal-800">
              Path B — Direct UPI Transfer
            </span>
            <h3 className="text-lg font-bold text-stone-900 mt-1">Real UPI Demo Transfer</h3>
          </div>
          <button
            onClick={handleFinish}
            className="text-stone-400 hover:text-stone-600 text-lg font-bold p-1"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 text-center">
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Order Reference:</span>
              <strong className="font-mono text-stone-900">{displayId}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Demo Payee VPA:</span>
              <strong className="font-mono text-teal-800">7778083224@upi</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Total Payable:</span>
              <strong className="text-base text-stone-900">₹{amount.toFixed(2)}</strong>
            </div>
          </div>

          {/* Genuine Dynamic QR Code */}
          <div className="flex flex-col items-center justify-center p-3 bg-white border-2 border-dashed border-teal-300 rounded-lg">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Scan to pay ₹${amount.toFixed(2)} for ${displayId}`}
                className="w-56 h-56 mx-auto rounded shadow-sm"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-stone-400">
                Generating genuine QR...
              </div>
            )}
            <span className="text-[11px] text-stone-500 mt-2">
              Scan with Google Pay, PhonePe, Paytm, or BHIM
            </span>
          </div>

          {/* Deep link button for mobile devices */}
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
              className="w-full text-xs text-stone-600 hover:text-stone-900 underline py-1"
            >
              {copied ? '✓ UPI Intent URI copied to clipboard' : 'Copy raw UPI URI string'}
            </button>
          </div>

          {/* Honest Operational Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 text-left space-y-1">
            <p className="font-bold flex items-center gap-1 text-amber-950">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Manual Staff Verification Notice:
            </p>
            <p>
              Direct UPI transfers to a demo VPA do not trigger automated webhooks without a merchant banking aggregator. Your order has been placed in an <strong>awaiting manual confirmation</strong> state. Store staff will verify receipt against your transaction note before packing.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleFinish}
            className="w-full text-base font-semibold"
          >
            I Have Transferred / View Order Status &rarr;
          </Button>
        </div>
      </div>
    </div>
  );
};
