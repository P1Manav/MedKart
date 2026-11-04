// src/app/customer/order/new/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { MockUpiModal } from '@/components/payment/mock-upi-modal';

interface CatalogueItem {
  id: string;
  name: string;
  strength: string;
  form: string;
  packSize: string;
  price: number;
  schedule: string;
  canSellOnline: boolean;
  requiresPrescription: boolean;
}

interface CartItem {
  product: CatalogueItem;
  quantity: number;
}

interface FamilyProfile {
  id: string;
  name: string;
  relationship: string;
}

export default function OrderBuilderPage() {
  const t = useTranslations('customer');
  const tc = useTranslations('common');
  const router = useRouter();

  // Mode: Upload Prescription vs Search Catalogue
  const [activeTab, setActiveTab] = useState<'PRESCRIPTION' | 'CATALOGUE'>('PRESCRIPTION');

  // Catalogue & Cart state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogueItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User and Profiles state
  const [userName, setUserName] = useState('');
  const [familyProfiles, setFamilyProfiles] = useState<FamilyProfile[]>([]);
  const [familyProfile, setFamilyProfile] = useState<string>('self');
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRel, setNewMemberRel] = useState('mother');
  const [addingMember, setAddingMember] = useState(false);

  // Address and payment state
  const [address, setAddress] = useState('Block BD-12, Sector 1, Salt Lake, Kolkata - 700064');
  const [paymentMethod, setPaymentMethod] = useState<'MOCK_UPI' | 'COD'>('COD');

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);

  // Fetch session details on mount
  useEffect(() => {
    async function loadUserData() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUserName(data.user.name || '');
          if (Array.isArray(data.user.familyProfiles)) {
            setFamilyProfiles(data.user.familyProfiles);
          }
          if (data.user.addresses && data.user.addresses.length > 0 && data.user.addresses[0].addressText) {
            setAddress(data.user.addresses[0].addressText);
          }
        }
      } catch {
        // non-fatal
      }
    }
    loadUserData();
  }, []);

  // Debounced search catalogue
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (data.products) {
          setSearchResults(data.products);
        }
      } catch {
        // search non-fatal
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddToCart = (product: CatalogueItem) => {
    if (!product.canSellOnline) {
      setBlockedNotice(`"${product.name} ${product.strength}" (${product.schedule}): This item cannot be ordered online. Please visit your nearest store.`);
      return;
    }
    setBlockedNotice(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

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

  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    try {
      const res = await fetch('/api/customer/family-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          relationship: newMemberRel.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        setFamilyProfiles((prev) => [...prev, data.profile]);
        setFamilyProfile(data.profile.id);
        setNewMemberName('');
        setShowAddFamily(false);
      }
    } catch {
      // non-fatal
    } finally {
      setAddingMember(false);
    }
  };

  const executeSubmission = async (overridePayment?: 'MOCK_UPI' | 'COD') => {
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
      formData.append('paymentMethod', overridePayment || paymentMethod);

      if (cart.length > 0) {
        formData.append(
          'cartItems',
          JSON.stringify(
            cart.map((c) => ({
              productId: c.product.id,
              quantity: c.quantity,
            }))
          )
        );
      }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please attach or take a photo of your prescription.');
      return;
    }

    if (paymentMethod === 'MOCK_UPI') {
      setShowUpiModal(true);
      return;
    }

    await executeSubmission();
  };

  const handleUpiSuccess = async (_vpa: string) => {
    setShowUpiModal(false);
    await executeSubmission('MOCK_UPI');
  };

  const handleUpiFailure = (reason: string) => {
    setShowUpiModal(false);
    setError(`Payment Unsuccessful: ${reason}. You can retry or switch to Cash on Delivery.`);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      <div>
        <span className="text-xs uppercase font-semibold text-stone-500 block">
          Healthcare Commerce &bull; Reorder
        </span>
        <h1 className="text-2xl font-bold text-stone-900 mt-0.5">
          {t('reorderMedicines')}
        </h1>
        <p className="text-stone-600 text-sm mt-1">
          {t('pharmacistCheckNotice')}
        </p>
      </div>

      {error && <ErrorState message={error} />}

      {/* Mode Switcher: Prescription vs Catalogue */}
      <div className="flex border-b border-stone-200">
        <button
          type="button"
          onClick={() => setActiveTab('PRESCRIPTION')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
            activeTab === 'PRESCRIPTION'
              ? 'border-teal-700 text-teal-900'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          {t('uploadPrescription')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CATALOGUE')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'CATALOGUE'
              ? 'border-teal-700 text-teal-900'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <span>Search Catalogue & Cart</span>
          {cart.length > 0 && (
            <span className="bg-teal-700 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Catalogue & Cart Builder View */}
      {activeTab === 'CATALOGUE' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold text-stone-900">
                Search Kolkata Medicine Catalogue
              </CardTitle>
              <p className="text-xs text-stone-500">
                Add prescribed medicines directly to your reorder basket before attaching your prescription image.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medicines (e.g. Metformin, Telmisartan, Pantoprazole)..."
                  className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-md text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
                <svg
                  className="w-4 h-4 text-stone-400 absolute left-3 top-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {blockedNotice && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-md">
                  {blockedNotice}
                </div>
              )}

              {searching && (
                <p className="text-xs text-stone-500 italic">Searching catalogue...</p>
              )}

              {searchResults.length > 0 && (
                <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto border border-stone-200 rounded-md">
                  {searchResults.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs hover:bg-stone-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">{item.name}</span>
                          <span className="text-stone-500">{item.strength}</span>
                          <Badge
                            variant={
                              item.schedule === 'OTC'
                                ? 'otc'
                                : item.schedule === 'H'
                                ? 'h'
                                : item.schedule === 'H1'
                                ? 'h1'
                                : 'blocked'
                            }
                          >
                            {item.schedule}
                          </Badge>
                        </div>
                        <p className="text-stone-500 mt-0.5">
                          {item.packSize} • ₹{item.price}
                          {!item.canSellOnline && (
                            <span className="text-red-700 font-semibold ml-2">Blocked Online (Schedule {item.schedule})</span>
                          )}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={item.canSellOnline ? 'primary' : 'outline'}
                        onClick={() => handleAddToCart(item)}
                        className={!item.canSellOnline ? 'text-red-700 border-red-300 hover:bg-red-50' : ''}
                      >
                        {item.canSellOnline ? 'Add to Order +' : 'Blocked Online ⛔'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Cart Items */}
              {cart.length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-teal-200 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-900 block">
                    Your Reorder Basket ({cart.length} item{cart.length === 1 ? '' : 's'}):
                  </span>
                  <div className="divide-y divide-stone-100">
                    {cart.map((item) => (
                      <div key={item.product.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-stone-900">
                            {item.product.name} {item.product.strength}
                          </span>
                          <Badge variant="h" className="ml-2 text-[10px]">
                            {item.product.schedule}
                          </Badge>
                          <p className="text-stone-500">₹{item.product.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, -1)}
                            className="w-6 h-6 border rounded flex items-center justify-center font-bold hover:bg-stone-50 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-bold w-4 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, 1)}
                            className="w-6 h-6 border rounded flex items-center justify-center font-bold hover:bg-stone-50 cursor-pointer"
                          >
                            +
                          </button>
                          <span className="font-bold text-stone-900 ml-3">
                            ₹{(item.product.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-sm font-bold">
                    <span>Estimated Total:</span>
                    <span className="text-teal-900 text-base">₹{cartTotal.toFixed(2)}</span>
                  </div>

                  <p className="text-[11px] text-stone-500">
                    * Final billed total will be confirmed upon pharmacist verification of your prescription.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── 1. PRESCRIPTION UPLOAD & PREVIEW ──────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold text-stone-900 flex items-center justify-between">
              <span>{t('uploadPrescription')}</span>
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
                    Or select a synthetic test prescription for testing:
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: For Myself (Default) */}
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
                  <span className="block text-base font-semibold">
                    {t('self')} {userName ? `(${userName})` : ''}
                  </span>
                  <span className="block text-xs text-stone-500">Personal order</span>
                </div>
              </label>

              {/* Option 2+: Any Registered Family Profiles */}
              {familyProfiles.map((p) => (
                <label
                  key={p.id}
                  className={`p-4 border rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${
                    familyProfile === p.id
                      ? 'border-teal-600 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-600'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="familyProfile"
                    checked={familyProfile === p.id}
                    onChange={() => setFamilyProfile(p.id)}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <div>
                    <span className="block text-base font-semibold capitalize">
                      {p.relationship} ({p.name})
                    </span>
                    <span className="block text-xs text-stone-500">Caregiver monthly refill</span>
                  </div>
                </label>
              ))}
            </div>

            {/* Quick Add Family Member Inline */}
            <div className="pt-2">
              {!showAddFamily ? (
                <button
                  type="button"
                  onClick={() => setShowAddFamily(true)}
                  className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                >
                  + Add another family member (Mother, Father, Spouse, Child)
                </button>
              ) : (
                <div className="bg-stone-50 p-3 rounded-md border border-stone-200 space-y-2 text-xs">
                  <span className="font-bold text-stone-700 block">Add New Family Member:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Full Name (e.g. Anjali Ghosh)"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="px-2.5 py-1.5 border rounded bg-white font-medium"
                    />
                    <select
                      value={newMemberRel}
                      onChange={(e) => setNewMemberRel(e.target.value)}
                      className="px-2 py-1.5 border rounded bg-white font-medium"
                    >
                      <option value="mother">Mother</option>
                      <option value="father">Father</option>
                      <option value="spouse">Spouse</option>
                      <option value="child">Child</option>
                      <option value="other">Other</option>
                    </select>
                    <Button size="sm" type="button" onClick={handleAddFamilyMember} isLoading={addingMember}>
                      Add & Select
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowAddFamily(false)}
                      className="text-stone-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── 3. DELIVERY ADDRESS & STORE ROUTING ───────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-stone-900">
                3. {t('deliveryAddress')}
              </CardTitle>
              <button
                type="button"
                onClick={() => setAddress('Block BD-12, Sector 1, Salt Lake, Kolkata - 700064')}
                className="text-xs text-teal-700 hover:underline font-medium cursor-pointer"
              >
                Fill Sample Kolkata Address
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                {t('selectAddress')}:
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House/Flat number, Street name, Area, Kolkata or Howrah with PIN code"
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
              Automatic nearest store routing: Nearest Kolkata/Howrah store will fulfill if stocked, with automatic fallback to nearest stocked location.
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
                  <span className="block text-xs text-stone-500">UPI (Google Pay, PhonePe, Paytm, QR)</span>
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

      {/* Realistic Mock UPI Modal (Section 4 Spec Requirement) */}
      <MockUpiModal
        isOpen={showUpiModal}
        amount={cartTotal > 0 ? cartTotal : 185.0}
        onSuccess={handleUpiSuccess}
        onFailure={handleUpiFailure}
        onClose={() => setShowUpiModal(false)}
      />
    </div>
  );
}
