// src/app/customer/home/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface FamilyProfile {
  id: string;
  name: string;
  relationship: string;
}

interface OrderItem {
  id: string;
  displayId: string;
  status: string;
  createdAt: string;
  store?: { name: string } | null;
  familyProfile?: { id: string; name: string; relationship: string } | null;
  lines: Array<{
    id: string;
    quantity: number;
    product?: { name: string; strength: string; price: number } | null;
  }>;
}

interface CustomerMessage {
  id: string;
  channel: string;
  content: string;
  createdAt: string;
}

interface RefillItem {
  id: string;
  productName: string;
  packSize: string;
  schedule: string;
  runOutDate: string;
  forProfile: string;
  daysOfSupply: number;
}

export default function CustomerHomePage() {
  const t = useTranslations('customer');
  const [userName, setUserName] = useState<string>('');
  const [familyProfiles, setFamilyProfiles] = useState<FamilyProfile[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [refills, setRefills] = useState<RefillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<'ALL' | 'SELF' | string>('ALL');

  // Add family member modal state
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRel, setNewMemberRel] = useState('mother');
  const [addingMember, setAddingMember] = useState(false);

  // Edit name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');

  const loadData = async () => {
    try {
      const [meRes, ordersRes, messagesRes, refillsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/orders'),
        fetch('/api/customer/messages'),
        fetch('/api/customer/refills'),
      ]);

      const meData = await meRes.json();
      if (meData.authenticated && meData.user) {
        setUserName(meData.user.name || 'Customer');
        setEditNameVal(meData.user.name || '');
        if (Array.isArray(meData.user.familyProfiles)) {
          setFamilyProfiles(meData.user.familyProfiles);
        }
      }

      const ordersData = await ordersRes.json();
      if (ordersData.orders) {
        setOrders(ordersData.orders);
      }

      const messagesData = await messagesRes.json();
      if (messagesData.messages) {
        setMessages(messagesData.messages);
      }

      const refillsData = await refillsRes.json();
      if (refillsData.refills) {
        setRefills(refillsData.refills);
      }
    } catch (e) {
      console.error('Failed to load customer data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveName = async () => {
    if (!editNameVal.trim()) return;
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameVal.trim() }),
      });
      if (res.ok) {
        setUserName(editNameVal.trim());
        setIsEditingName(false);
      }
    } catch {
      // ignore
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
        setSelectedProfileId(data.profile.id);
        setNewMemberName('');
        setShowAddFamily(false);
      }
    } catch {
      // ignore
    } finally {
      setAddingMember(false);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    if (selectedProfileId === 'ALL') return true;
    if (selectedProfileId === 'SELF') return !ord.familyProfile;
    return ord.familyProfile?.id === selectedProfileId;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* ─── 1. FAMILY PROFILE SWITCHER ───────────────────────── */}
      <div className="bg-white p-4 rounded-lg border border-stone-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-semibold text-stone-500 block">
              {t('profileFor')}
            </span>
            {isEditingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={editNameVal}
                  onChange={(e) => setEditNameVal(e.target.value)}
                  className="px-2 py-1 text-sm border rounded font-bold text-stone-900 focus:outline-teal-600"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName}>
                  Save
                </Button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="text-xs text-stone-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-900">
                  {userName ? `${userName}’s Family` : 'My Family'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="text-xs text-teal-700 hover:underline cursor-pointer"
                >
                  (Edit Name)
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedProfileId('ALL')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                selectedProfileId === 'ALL'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              All Members
            </button>
            <button
              onClick={() => setSelectedProfileId('SELF')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                selectedProfileId === 'SELF'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {t('self')}
            </button>
            {familyProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors cursor-pointer capitalize ${
                  selectedProfileId === p.id
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {p.relationship}: {p.name}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowAddFamily(!showAddFamily)}
              className="px-2.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md cursor-pointer"
            >
              + Add Family Member
            </button>
          </div>
        </div>

        {/* Inline Add Family Member Form */}
        {showAddFamily && (
          <form
            onSubmit={handleAddFamilyMember}
            className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-3 bg-stone-50 p-3 rounded-md"
          >
            <span className="text-xs font-bold text-stone-700">Add Member:</span>
            <input
              type="text"
              placeholder="Full Name (e.g. Ramesh Ghosh)"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="text-xs px-2.5 py-1.5 border rounded bg-white font-medium"
              required
            />
            <select
              value={newMemberRel}
              onChange={(e) => setNewMemberRel(e.target.value)}
              className="text-xs px-2 py-1.5 border rounded bg-white font-medium"
            >
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="spouse">Spouse</option>
              <option value="child">Child</option>
              <option value="other">Other</option>
            </select>
            <Button size="sm" type="submit" isLoading={addingMember}>
              Save Member
            </Button>
            <button
              type="button"
              onClick={() => setShowAddFamily(false)}
              className="text-xs text-stone-500 hover:underline"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* ─── 2. VERY LARGE PROMINENT REORDER BUTTON (SPEC REQUIREMENT) ─── */}
      <div className="bg-gradient-to-b from-teal-50 to-white border-2 border-teal-600/30 rounded-xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="max-w-xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
            <span className="w-2 h-2 rounded-full bg-teal-600"></span>
            Monthly Medicine Refill
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            {t('homeTitle')}
          </h1>
          <p className="text-stone-600 text-base">
            {t('pharmacistCheckNotice')}
          </p>
        </div>

        <div className="pt-2">
          <Link href="/customer/order/new">
            <Button size="xl" className="w-full sm:w-auto px-12 py-5 text-xl font-bold shadow-lg">
              {t('reorderButton')}
            </Button>
          </Link>
        </div>

        <p className="text-xs text-stone-500 pt-2 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {t('pharmacistCheckNotice')}
        </p>
      </div>

      {/* ─── 3. REFILL REMINDERS SECTION ───────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-bold text-stone-900">
              {t('refillReminders')}
            </CardTitle>
            <p className="text-sm text-stone-600">
              Calculated based on your prescribed dosage to make sure you never run out.
            </p>
          </div>
          <Badge variant={refills.length > 0 ? 'caution' : 'default'}>
            {refills.length > 0 ? 'Refill Alert' : 'Active Monitoring'}
          </Badge>
        </CardHeader>
        <CardContent>
          {refills.length > 0 ? (
            <div className="space-y-3">
              {refills.map((refill) => (
                <div
                  key={refill.id}
                  className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-stone-900">
                        {refill.productName} ({refill.packSize})
                      </span>
                      <Badge variant={refill.schedule === 'H' ? 'h' : 'default'}>
                        Schedule {refill.schedule}
                      </Badge>
                    </div>
                    <p className="text-sm text-stone-600">
                      For: <span className="font-semibold text-stone-800 capitalize">{refill.forProfile}</span>
                    </p>
                    <p className="text-xs text-amber-900 font-medium">
                      Estimated run-out date: {new Date(refill.runOutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <Link href="/customer/order/new">
                    <Button size="sm" className="whitespace-nowrap">
                      {t('oneTapReorder')}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-stone-200 bg-stone-50/70 rounded-lg p-4 text-xs text-stone-600 space-y-1">
              <span className="font-semibold text-stone-800 block text-sm">
                No immediate refill alerts pending.
              </span>
              <p>
                When your prescriptions are approved and dispensed, we automatically calculate remaining supply based on doctor-prescribed dosage and alert you 5 days before your medicine runs out.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 4. RECENT ORDERS ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-stone-900">
            {t('recentOrders')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              No orders found for this profile. Tap &quot;Reorder My Monthly Medicines&quot; above to place your refill.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredOrders.map((ord) => {
                const statusBadgeVariant =
                  ord.status === 'APPROVED' || ord.status === 'PACKED' || ord.status === 'DELIVERED'
                    ? 'success'
                    : ord.status === 'ON_HOLD'
                    ? 'caution'
                    : ord.status === 'REJECTED'
                    ? 'blocked'
                    : 'default';

                return (
                  <div key={ord.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-base">{ord.displayId}</span>
                        <Badge variant={statusBadgeVariant}>{ord.status.replace('_', ' ')}</Badge>
                        {ord.familyProfile && (
                          <span className="text-xs text-stone-500 capitalize">
                            (For {ord.familyProfile.relationship}: {ord.familyProfile.name})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-600">
                        {ord.lines.length} item(s) • Routed Store:{' '}
                        <span className="font-medium text-stone-800">
                          {ord.store?.name || 'Nearest Stocked Store'}
                        </span>
                      </p>
                      <p className="text-xs text-stone-400">
                        Placed on {new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <Link href={`/customer/order/${ord.id}`}>
                      <Button variant="outline" size="sm">
                        View Tracking Timeline &rarr;
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 5. SIMULATED CUSTOMER NOTIFICATIONS (MOCK HONESTY) ─── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span>Simulated SMS & WhatsApp Notifications</span>
                <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded">
                  Mock Dispatch Outbox
                </span>
              </CardTitle>
              <p className="text-xs text-stone-500 mt-0.5">
                Real-time delivery simulations for prescription approvals, order updates, and refill alerts.
              </p>
            </div>
            <Badge variant="default" className="text-xs">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="py-6 text-center text-xs text-stone-500 bg-stone-50 rounded-lg border border-dashed border-stone-200">
              No simulated messages dispatched yet. Place a refill order above to see instant WhatsApp & SMS dispatch simulations.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-3 bg-stone-50 hover:bg-stone-100/70 rounded-lg border border-stone-200 text-xs space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          msg.channel === 'WHATSAPP'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {msg.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">✓ Delivered (Mock)</span>
                  </div>
                  <p className="text-stone-800 text-xs font-mono bg-white p-2 rounded border border-stone-200">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
