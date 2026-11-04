// src/app/customer/order/new/page.tsx
'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

export default function OrderBuilderPage() {
  const t = useTranslations('customer');
  const tc = useTranslations('common');
  const router = useRouter();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Address and payment state
  const [familyProfile, setFamilyProfile] = useState<'prof_debasish_mother' | 'self'>('prof_debasish_mother');
  const [address, setAddress] = useState('Block BD-12, Sector 1, Salt Lake, Kolkata - 700064');
  const [paymentMethod, setPaymentMethod] = useState<'MOCK_UPI' | 'COD'>('COD');

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side resize to <=1600px JPEG per spec §4
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG or PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const resizedFile = new File([blob], selected.name, {
                  type: 'image/jpeg',
                });
                setFile(resizedFile);
                setPreviewUrl(URL.createObjectURL(resizedFile));
                setError(null);
              }
            },
            'image/jpeg',
            0.85
          );
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(selected);
  };

  const handleRetake = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUseSampleRx = async (samplePath: string) => {
    try {
      const res = await fetch(samplePath);
      const blob = await res.blob();
      const sampleFile = new File([blob], 'sample_rx.png', { type: 'image/png' });
      setFile(sampleFile);
      setPreviewUrl(URL.createObjectURL(sampleFile));
      setError(null);
    } catch {
      setError('Could not load sample prescription.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please attach or take a photo of your prescription.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('prescription', file);
      formData.append('familyProfileId', familyProfile === 'self' ? '' : familyProfile);
      formData.append('addressText', address);
      formData.append('addressLat', '22.5875');
      formData.append('addressLng', '88.4190');
      formData.append('paymentMethod', paymentMethod);

      const res = await fetch('/api/orders', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to submit order.');
        setLoading(false);
        return;
      }

      router.push(`/customer/order/${data.order.id}`);
    } catch {
      setError('Network communication failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Upload Prescription & Reorder</h1>
          <p className="text-sm text-stone-600 mt-1">
            Our AI reads your doctor’s prescription as a draft. Every line is checked and verified by a licensed pharmacist.
          </p>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── 1. PRESCRIPTION UPLOAD & PREVIEW ──────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-stone-900 flex items-center justify-between">
              <span>1. {t('uploadPrescription')}</span>
              <span className="text-xs font-normal text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                AES-256-GCM Encrypted
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!previewUrl ? (
              <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center space-y-4 bg-stone-50/50">
                <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-stone-800">
                    {t('uploadPrescription')}
                  </p>
                  <p className="text-xs text-stone-500">
                    {t('uploadHelp')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="rx-upload"
                  />
                  <label htmlFor="rx-upload">
                    <Button type="button" onClick={() => fileInputRef.current?.click()}>
                      {t('chooseFile')}
                    </Button>
                  </label>
                </div>

                {/* Demo Quick-Pick Synthetic Prescriptions */}
                <div className="pt-4 border-t border-stone-200 text-left">
                  <span className="text-xs font-semibold text-stone-500 block mb-2">
                    Or select a synthetic test prescription:
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleUseSampleRx('/seed/prescriptions/rx_50211_metformin_clean.png')}
                      className="px-2.5 py-1.5 bg-white border border-stone-300 rounded hover:bg-stone-50 cursor-pointer"
                    >
                      Sample 1: Metformin 500 mg (Clean)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUseSampleRx('/seed/prescriptions/rx_50214_telmisartan.png')}
                      className="px-2.5 py-1.5 bg-white border border-stone-300 rounded hover:bg-stone-50 cursor-pointer"
                    >
                      Sample 2: Telmisartan 40 mg
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUseSampleRx('/seed/prescriptions/rx_sample_blurry_unreadable.png')}
                      className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded hover:bg-amber-100 cursor-pointer"
                    >
                      Sample 3: Blurry/Cropped (Manual Entry trigger)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUseSampleRx('/seed/prescriptions/rx_sample_blocked_schedule_x.png')}
                      className="px-2.5 py-1.5 bg-red-50 border border-red-300 text-red-900 rounded hover:bg-red-100 cursor-pointer"
                    >
                      Sample 4: Schedule X (Blocked Online)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border border-stone-200 rounded-lg overflow-hidden bg-stone-900 text-center max-h-96 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Prescription preview"
                    className="max-h-96 w-auto object-contain mx-auto"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Image ready for secure encrypted upload</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleRetake}>
                    {t('retake')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── 2. PATIENT PROFILE & RECIPIENT ────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-stone-900">
              2. {t('profileFor')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-4 border rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${
                  familyProfile === 'prof_debasish_mother'
                    ? 'border-teal-600 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-600'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="familyProfile"
                  checked={familyProfile === 'prof_debasish_mother'}
                  onChange={() => setFamilyProfile('prof_debasish_mother')}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="block text-base">{t('mother')} (Anjali Ghosh)</span>
                  <span className="block text-xs text-stone-500">Caregiver monthly refill</span>
                </div>
              </label>

              <label
                className={`p-4 border rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${
                  familyProfile === 'self'
                    ? 'border-teal-600 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-600'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="familyProfile"
                  checked={familyProfile === 'self'}
                  onChange={() => setFamilyProfile('self')}
                  className="text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="block text-base">{t('self')} (Debasish Ghosh)</span>
                  <span className="block text-xs text-stone-500">Personal order</span>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ─── 3. DELIVERY ADDRESS & STORE ROUTING ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-stone-900">
              3. {t('deliveryAddress')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                {t('selectAddress')}:
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="w-full p-3 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                required
              />
            </div>
            <p className="text-xs text-stone-500 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-teal-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Automatic nearest store routing: Salt Lake store will fulfill if stocked, with automatic fallback to nearest stocked location.
            </p>
          </CardContent>
        </Card>

        {/* ─── 4. PAYMENT SELECTION ──────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-stone-900">
              4. {t('paymentMethod')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3.5 border rounded-lg cursor-pointer flex items-center gap-3 ${
                  paymentMethod === 'COD'
                    ? 'border-teal-600 bg-teal-50 text-teal-900 font-semibold'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                />
                <div>
                  <span className="block text-sm">{t('cod')}</span>
                  <span className="block text-xs text-stone-500">Pay at your doorstep</span>
                </div>
              </label>

              <label
                className={`p-3.5 border rounded-lg cursor-pointer flex items-center gap-3 ${
                  paymentMethod === 'MOCK_UPI'
                    ? 'border-teal-600 bg-teal-50 text-teal-900 font-semibold'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'MOCK_UPI'}
                  onChange={() => setPaymentMethod('MOCK_UPI')}
                />
                <div>
                  <span className="block text-sm">{t('mockUpi')}</span>
                  <span className="block text-xs text-stone-500">Simulated instant payment</span>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Safety statement & Submit */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs text-teal-900 space-y-1">
          <p className="font-semibold text-sm text-teal-950 flex items-center gap-1.5">
            <svg className="w-5 h-5 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Registered Pharmacist Verification Mandate:
          </p>
          <p>
            By submitting this order, your prescription will be reviewed by a licensed pharmacist before any medicine is dispensed or packed. If anything is unclear, the pharmacist will contact you or request a clear re-upload.
          </p>
        </div>

        <Button
          type="submit"
          isLoading={loading}
          disabled={!file}
          size="lg"
          className="w-full text-lg shadow-md"
        >
          {tc('submit')} &rarr;
        </Button>
      </form>
    </div>
  );
}
