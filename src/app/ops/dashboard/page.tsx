// src/app/ops/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface OpsMetrics {
  activeStoresCount: number;
  totalOrdersCount: number;
  statusCounts: Record<string, number>;
  ordersByStore: Array<{
    storeId: string;
    storeName: string;
    address: string | null;
    orderCount: number;
  }>;
  medianVerificationMinutes: number | null;
  rejectionRate: number | null;
  rejectionBreakdown: Array<{ reason: string; count: number }>;
  blockedItemsCount: number;
}

export default function OpsDashboardPage() {
  const [runningReminders, setRunningReminders] = useState(false);
  const [remindersResult, setRemindersResult] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<OpsMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Stock CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    validCount?: number;
    errorCount?: number;
    committed?: boolean;
    errors?: Array<{ rowNumber: number; error: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      const res = await fetch('/api/ops/metrics');
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch {
      // Non-fatal if metrics fails
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleRunReminders = async () => {
    setRunningReminders(true);
    setRemindersResult(null);
    try {
      const res = await fetch('/api/ops/run-reminders', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setRemindersResult(
          `Refill job executed: Evaluated ${data.evaluatedCount} patients, sent ${data.remindersTriggered} reminders to message outbox.`
        );
      } else {
        setError(data.error || 'Failed to run reminders.');
      }
    } catch {
      setError('Failed to trigger cron endpoint.');
    } finally {
      setRunningReminders(false);
    }
  };

  const handleCsvImport = async (commit: boolean) => {
    if (!csvFile) return;
    setImporting(true);
    setError(null);
    setCsvResult(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('commit', commit ? 'true' : 'false');

      const res = await fetch('/api/stock/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Import failed.');
        return;
      }

      setCsvResult(data);
    } catch {
      setError('Failed to upload stock CSV.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            Central Operations & Admin Dashboard
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Real-time multi-store fulfillment tracking, pharmacist verification SLAs, and inventory management.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleRunReminders}
          isLoading={runningReminders}
          className="shadow-sm"
        >
          Run Refill Reminders Now ⚡
        </Button>
      </div>

      {remindersResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md font-medium">
          {remindersResult}
        </div>
      )}

      {error && <ErrorState message={error} />}

      {/* ─── DYNAMIC METRIC CARDS ───────────────────────────── */}
      {metricsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <span className="text-xs uppercase font-bold text-stone-500">Active Stores</span>
            <p className="text-3xl font-extrabold text-stone-900 mt-1">
              {metrics?.activeStoresCount ?? 0}
            </p>
            <span className="text-xs text-stone-500">Kolkata & Howrah Network</span>
          </Card>

          <Card className="p-4">
            <span className="text-xs uppercase font-bold text-stone-500">Median Verification SLA</span>
            <p className="text-3xl font-extrabold text-teal-700 mt-1">
              {metrics?.medianVerificationMinutes !== null && metrics?.medianVerificationMinutes !== undefined
                ? `${metrics.medianVerificationMinutes} min`
                : 'N/A'}
            </p>
            <span className="text-xs text-stone-500 font-medium">
              {metrics?.medianVerificationMinutes !== null && metrics?.medianVerificationMinutes !== undefined
                ? 'Computed from audit log'
                : 'No audit records yet'}
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs uppercase font-bold text-stone-500">Rejection Rate</span>
            <p className="text-3xl font-extrabold text-stone-900 mt-1">
              {metrics?.rejectionRate !== null && metrics?.rejectionRate !== undefined
                ? `${metrics.rejectionRate}%`
                : 'N/A'}
            </p>
            <span className="text-xs text-stone-500">
              {metrics?.rejectionBreakdown && metrics.rejectionBreakdown.length > 0
                ? `Top: ${metrics.rejectionBreakdown[0].reason}`
                : 'No rejections recorded'}
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs uppercase font-bold text-stone-500">Online Blocked Items</span>
            <p className="text-3xl font-extrabold text-red-700 mt-1">
              {metrics?.blockedItemsCount ?? 0}
            </p>
            <span className="text-xs text-stone-500">Schedule X / Unsellable lines blocked</span>
          </Card>
        </div>
      )}

      {/* ─── ORDERS BY STORE BREAKDOWN ──────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">
            Fulfillment Volume by Store (Database Counts)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics && metrics.ordersByStore && metrics.ordersByStore.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {metrics.ordersByStore.map((store) => (
                <div key={store.storeId} className="p-3 bg-stone-50 rounded border border-stone-200">
                  <span className="font-bold text-stone-800 block">{store.storeName}</span>
                  <span className="text-2xl font-extrabold text-teal-900 block mt-1">
                    {store.orderCount} order{store.orderCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs text-stone-500">{store.address || 'Kolkata'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500 py-4 text-center">No store fulfillment data available.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── DAILY STOCK CSV IMPORT TOOL (SPEC REQUIREMENT) ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900 flex items-center justify-between">
            <span>Daily Store Stock CSV Import</span>
            <span className="text-xs font-normal text-stone-500">Per-row Zod validation & preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-stone-600">
            Upload daily store inventory CSV with columns: <code className="bg-stone-100 px-1 py-0.5 rounded">store_id, product_id, quantity</code>.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="text-xs border p-2 rounded"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCsvImport(false)}
              disabled={!csvFile}
              isLoading={importing}
            >
              Validate & Preview
            </Button>
            <Button
              size="sm"
              onClick={() => handleCsvImport(true)}
              disabled={!csvFile}
              isLoading={importing}
            >
              Commit Stock Update
            </Button>
          </div>

          {csvResult && (
            <div className="p-4 bg-stone-50 border rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-3 font-semibold">
                <span className="text-emerald-800">Valid Rows: {csvResult.validCount}</span>
                <span className="text-red-700">Errors: {csvResult.errorCount}</span>
                {csvResult.committed && (
                  <Badge variant="success">All-or-Nothing Committed Successfully ✓</Badge>
                )}
              </div>
              {csvResult.errors && csvResult.errors.length > 0 && (
                <div className="space-y-1 text-red-700">
                  {csvResult.errors.map((err, i) => (
                    <div key={i}>
                      Row {err.rowNumber}: {err.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
