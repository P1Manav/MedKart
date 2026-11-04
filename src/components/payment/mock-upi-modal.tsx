// src/components/payment/mock-upi-modal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MockUpiModalProps {
  isOpen: boolean;
  amount: number;
  orderId?: string;
  onSuccess: (vpa: string) => void;
  onFailure: (reason: string) => void;
  onClose: () => void;
}

export const MockUpiModal: React.FC<MockUpiModalProps> = ({
  isOpen,
  amount,
  orderId,
  onSuccess,
  onFailure,
  onClose,
}) => {
  const [vpa, setVpa] = useState('customer@upi');
  const [vpaError, setVpaError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(299); // 5 minutes countdown
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(299);
      setVpaError(null);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const validateVpa = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setVpaError('Please enter a UPI ID (e.g. yourname@bank)');
      return false;
    }
    if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) {
      setVpaError('Invalid UPI ID format. Must include username and bank handle (e.g. mobile@upi)');
      return false;
    }
    setVpaError(null);
    return true;
  };

  const handleSimulateSuccess = () => {
    if (!validateVpa(vpa)) return;
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      onSuccess(vpa.trim());
    }, 600);
  };

  const handleSimulateFailure = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
      onFailure('UPI transaction declined by issuing bank (Simulated Test Mode Failure)');
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full bg-white shadow-2xl border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Test Mode Banner */}
        <div className="bg-amber-500 text-amber-950 text-xs font-bold py-1.5 px-4 text-center tracking-wide uppercase flex items-center justify-center gap-2 border-b border-amber-600">
          <span className="w-2 h-2 rounded-full bg-amber-900 animate-ping"></span>
          Simulated UPI Sandbox Gateway (NPCI Test Spec)
        </div>

        <CardHeader className="bg-stone-50 border-b border-stone-200 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-teal-800 text-white font-bold flex items-center justify-center text-sm">
                UPI
              </div>
              <div>
                <CardTitle className="text-base font-bold text-stone-900">
                  Unified Payments Interface
                </CardTitle>
                <p className="text-xs text-stone-500">Fast & Secure Bank Transfer</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-500 block">Amount to Pay</span>
              <span className="text-xl font-extrabold text-teal-900">
                ₹{amount.toFixed(2)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {orderId && (
            <div className="text-xs text-stone-500 flex justify-between pb-2 border-b">
              <span>Order Reference:</span>
              <span className="font-mono font-semibold text-stone-800">{orderId}</span>
            </div>
          )}

          {/* Simulated QR Code */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-center space-y-2">
            <div className="relative inline-block bg-white p-3 rounded-lg border shadow-xs">
              <svg
                className="w-36 h-36 mx-auto text-stone-900"
                viewBox="0 0 100 100"
                fill="currentColor"
              >
                {/* Simulated QR Pattern */}
                <rect x="5" y="5" width="28" height="28" rx="2" fill="none" stroke="currentColor" strokeWidth="6" />
                <rect x="13" y="13" width="12" height="12" />
                <rect x="67" y="5" width="28" height="28" rx="2" fill="none" stroke="currentColor" strokeWidth="6" />
                <rect x="75" y="13" width="12" height="12" />
                <rect x="5" y="67" width="28" height="28" rx="2" fill="none" stroke="currentColor" strokeWidth="6" />
                <rect x="13" y="75" width="12" height="12" />
                <rect x="42" y="10" width="8" height="16" />
                <rect x="42" y="32" width="16" height="8" />
                <rect x="10" y="42" width="16" height="8" />
                <rect x="32" y="42" width="8" height="16" />
                <rect x="46" y="46" width="8" height="8" fill="#0f766e" />
                <rect x="60" y="42" width="16" height="8" />
                <rect x="76" y="42" width="8" height="16" />
                <rect x="42" y="60" width="16" height="8" />
                <rect x="60" y="60" width="8" height="16" />
                <rect x="42" y="76" width="16" height="8" />
                <rect x="70" y="70" width="16" height="16" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-teal-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                  MOCK QR
                </span>
              </div>
            </div>
            <p className="text-xs text-stone-600">
              Scan with any UPI App (Google Pay, PhonePe, Paytm, BHIM)
            </p>
            <div className="text-xs text-stone-400">
              Session expires in: <span className="font-mono font-bold text-amber-700">{timeFormatted}</span>
            </div>
          </div>

          {/* VPA Input & Quick Fill */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700">
              Or Enter Virtual Payment Address (VPA) / UPI ID:
            </label>
            <div className="relative">
              <input
                type="text"
                value={vpa}
                onChange={(e) => {
                  setVpa(e.target.value);
                  if (vpaError) setVpaError(null);
                }}
                placeholder="e.g. mobile@upi or username@bank"
                className="w-full px-3 py-2 border border-stone-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
            {vpaError && (
              <p className="text-xs text-red-600 font-medium">{vpaError}</p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-stone-500">Quick Test VPAs:</span>
              <button
                type="button"
                onClick={() => {
                  setVpa('customer@upi');
                  setVpaError(null);
                }}
                className="text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-0.5 rounded border border-stone-300 cursor-pointer"
              >
                customer@upi
              </button>
              <button
                type="button"
                onClick={() => {
                  setVpa('debasish@okhdfcbank');
                  setVpaError(null);
                }}
                className="text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-0.5 rounded border border-stone-300 cursor-pointer"
              >
                debasish@okhdfcbank
              </button>
              <button
                type="button"
                onClick={() => {
                  setVpa('anjali.ghosh@icici');
                  setVpaError(null);
                }}
                className="text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-0.5 rounded border border-stone-300 cursor-pointer"
              >
                anjali.ghosh@icici
              </button>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <Button
              type="button"
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2"
              onClick={handleSimulateSuccess}
              isLoading={simulating}
            >
              Verify & Authorize UPI Payment ₹{amount.toFixed(2)}
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSimulateFailure}
                disabled={simulating}
                className="text-xs text-red-700 hover:bg-red-50 p-1.5 rounded border border-red-200 font-medium transition-colors cursor-pointer"
              >
                Simulate Bank Decline (Test Error)
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={simulating}
                className="text-xs text-stone-600 hover:bg-stone-100 p-1.5 rounded border border-stone-200 transition-colors cursor-pointer"
              >
                Cancel / Choose Other Method
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
