// src/app/customer/profile/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/components/providers/session-provider';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load data');
  return res.json();
};

export default function CustomerProfilePage() {
  const t = useTranslations('profile');
  const router = useRouter();
  const { user: sessionUser, refresh, updateTheme, updateLanguage } = useSession();

  const { data: profileData, mutate: mutateProfile, isLoading: profileLoading } = useSWR('/api/auth/me', fetcher);
  const { data: familyData, mutate: mutateFamily, isLoading: familyLoading } = useSWR('/api/customer/family-profiles', fetcher);

  // Personal Info Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'bn'>('en');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Address Form State
  const [addressText, setAddressText] = useState('');
  const [pincode, setPincode] = useState('');
  const [addressLabel, setAddressLabel] = useState('Home');
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMessage, setAddressMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Family Member State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRel, setNewMemberRel] = useState('spouse');
  const [addingMember, setAddingMember] = useState(false);
  const [familyMessage, setFamilyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Logout All State
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Populate form with fetched data
  useEffect(() => {
    if (profileData?.user) {
      const u = profileData.user;
      setName(u.name || '');
      setEmail(u.email || '');
      setLanguage(u.language || 'en');
      setTheme(u.theme || 'system');

      if (u.addresses && u.addresses.length > 0) {
        const addr = u.addresses[0];
        setAddressText(addr.addressText || '');
        setPincode(addr.pincode || '');
        setAddressLabel(addr.label || 'Home');
      }
    }
  }, [profileData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    if (name.trim().length < 2) {
      setProfileMessage({ type: 'error', text: 'Name must be at least 2 characters' });
      setProfileSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          language,
          theme,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      await updateTheme(theme);
      await updateLanguage(language);
      await mutateProfile();
      await refresh();
      setProfileMessage({ type: 'success', text: t('successMessage') });
    } catch (err: unknown) {
      setProfileMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error updating profile',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressSaving(true);
    setAddressMessage(null);

    if (addressText.trim().length < 5) {
      setAddressMessage({ type: 'error', text: 'Address must be at least 5 characters' });
      setAddressSaving(false);
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      setAddressMessage({ type: 'error', text: 'Enter a valid 6-digit Indian PIN code' });
      setAddressSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultAddress: {
            addressText: addressText.trim(),
            pincode: pincode.trim(),
            label: addressLabel,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update address');
      }

      await mutateProfile();
      await refresh();
      setAddressMessage({ type: 'success', text: t('addressSuccess') });
    } catch (err: unknown) {
      setAddressMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error saving address',
      });
    } finally {
      setAddressSaving(false);
    }
  };

  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    setFamilyMessage(null);

    if (newMemberName.trim().length < 2) {
      setFamilyMessage({ type: 'error', text: 'Member name must be at least 2 characters' });
      setAddingMember(false);
      return;
    }

    try {
      const res = await fetch('/api/customer/family-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          relationship: newMemberRel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add family member');
      }

      setNewMemberName('');
      await mutateFamily();
      setFamilyMessage({ type: 'success', text: t('memberAdded') });
    } catch (err: unknown) {
      setFamilyMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error adding member',
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleDeleteFamilyMember = async (id: string) => {
    if (!confirm('Remove this family member?')) return;
    setFamilyMessage(null);

    try {
      const res = await fetch(`/api/customer/family-profiles/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete member');
      }

      await mutateFamily();
      setFamilyMessage({ type: 'success', text: t('memberDeleted') });
    } catch (err: unknown) {
      setFamilyMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error deleting member',
      });
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm(t('logoutAllConfirm'))) return;
    setLoggingOutAll(true);

    try {
      await fetch('/api/auth/logout-all', { method: 'POST' });
      await refresh();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout all error:', err);
    } finally {
      setLoggingOutAll(false);
    }
  };

  if (profileLoading && !profileData) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const user = profileData?.user || sessionUser;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          {t('title')}
        </h1>
        <p className="text-stone-600 dark:text-stone-400 mt-1">{t('subtitle')}</p>
      </div>

      {/* 1. Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileMessage && (
              <div
                className={`p-3 rounded text-sm ${
                  profileMessage.type === 'success'
                    ? 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800'
                    : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}
              >
                {profileMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('fullName')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-stone-900 dark:text-stone-100 focus:outline-teal-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('phoneNumber')}
                </label>
                <input
                  type="text"
                  value={user?.phone || ''}
                  disabled
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 rounded text-stone-500 cursor-not-allowed"
                />
                <span className="text-xs text-stone-500 mt-0.5 block">{t('phoneImmutable')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-stone-900 dark:text-stone-100 focus:outline-teal-600"
                />
                <span className="text-xs text-stone-500 mt-0.5 block">{t('emailHelp')}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('language')}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'hi' | 'bn')}
                  className="w-full px-3 py-2 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-stone-900 dark:text-stone-100 focus:outline-teal-600"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                {t('theme')}
              </label>
              <div className="flex gap-4">
                {(['light', 'dark', 'system'] as const).map((th) => (
                  <label key={th} className="flex items-center gap-1.5 cursor-pointer text-sm text-stone-700 dark:text-stone-300">
                    <input
                      type="radio"
                      name="theme"
                      value={th}
                      checked={theme === th}
                      onChange={() => setTheme(th)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="capitalize">{th}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={profileSaving}>
                {profileSaving ? t('saving') : t('saveChanges')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Default Delivery Address */}
      <Card>
        <CardHeader>
          <CardTitle>{t('deliveryAddress')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveAddress} className="space-y-4">
            {addressMessage && (
              <div
                className={`p-3 rounded text-sm ${
                  addressMessage.type === 'success'
                    ? 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800'
                    : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}
              >
                {addressMessage.text}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Delivery Address *
              </label>
              <textarea
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                rows={2}
                placeholder={t('addressPlaceholder')}
                required
                className="w-full px-3 py-2 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-stone-900 dark:text-stone-100 focus:outline-teal-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('pincode')} *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('pincodePlaceholder')}
                  required
                  className="w-full px-3 py-2 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-stone-900 dark:text-stone-100 focus:outline-teal-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Label
                </label>
                <select
                  value={addressLabel}
                  onChange={(e) => setAddressLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-stone-900 dark:text-stone-100 focus:outline-teal-600"
                >
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Parents">Parents</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={addressSaving}>
                {addressSaving ? t('saving') : t('saveAddress')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 3. Family Members */}
      <Card>
        <CardHeader>
          <CardTitle>{t('familyProfiles')}</CardTitle>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{t('familySubtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {familyMessage && (
            <div
              className={`p-3 rounded text-sm ${
                familyMessage.type === 'success'
                  ? 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800'
                  : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}
            >
              {familyMessage.text}
            </div>
          )}

          {/* Existing Members List */}
          <div className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden">
            {familyLoading ? (
              <div className="p-4 text-center text-sm text-stone-500">Loading family members...</div>
            ) : familyData?.profiles?.length > 0 ? (
              familyData.profiles.map((member: { id: string; name: string; relationship: string }) => (
                <div key={member.id} className="p-4 flex items-center justify-between bg-white dark:bg-stone-900">
                  <div>
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">{member.name}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 capitalize">Relationship: {member.relationship}</span>
                  </div>
                  {member.relationship !== 'self' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFamilyMember(member.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      {t('delete')}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-stone-500">No additional family members yet.</div>
            )}
          </div>

          {/* Add Member Form */}
          <form onSubmit={handleAddFamilyMember} className="bg-stone-50 dark:bg-stone-800/40 p-4 rounded-lg border border-stone-200 dark:border-stone-800 space-y-4">
            <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100">{t('addMember')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('memberName')} *
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Arati Roy"
                  required
                  className="w-full px-3 py-1.5 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-sm text-stone-900 dark:text-stone-100 focus:outline-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t('relationship')} *
                </label>
                <select
                  value={newMemberRel}
                  onChange={(e) => setNewMemberRel(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 rounded text-sm text-stone-900 dark:text-stone-100 focus:outline-teal-600"
                >
                  <option value="spouse">Spouse</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="son">Son</option>
                  <option value="daughter">Daughter</option>
                  <option value="brother">Brother</option>
                  <option value="sister">Sister</option>
                  <option value="other">Other Dependent</option>
                </select>
              </div>
            </div>

            <Button type="submit" size="sm" disabled={addingMember}>
              {addingMember ? 'Adding...' : t('addMember')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 4. Security & Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('security')}</CardTitle>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">{t('securityDesc')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/40 rounded border border-stone-200 dark:border-stone-800 text-sm">
            <div>
              <span className="font-semibold text-stone-900 dark:text-stone-100 block">Current Session Version</span>
              <span className="text-xs text-stone-500">Security generation: v{user?.sessionVersion || 1}</span>
            </div>
            <Badge variant="default">Active</Badge>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={handleLogoutAll}
              disabled={loggingOutAll}
              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
            >
              {loggingOutAll ? 'Revoking...' : t('logoutAll')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
