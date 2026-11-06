// src/app/ops/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
  unassignedOrdersCount?: number;
  medianVerificationMinutes: number | null;
  rejectionRate: number | null;
  rejectionBreakdown: Array<{ reason: string; count: number }>;
  blockedItemsCount: number;
  blockedItemsRate: number | null;
  totalLinesCount?: number;
  refundDueOrders?: Array<{
    id: string;
    displayId: string;
    paymentMethod: string;
    customerName: string;
    customerPhone: string;
    reason: string;
    createdAt: string;
  }>;
  recentOutboxMessages?: Array<{
    id: string;
    recipient: string;
    channel: string;
    content: string;
    status: string;
    createdAt: string;
  }>;
}

interface ScheduleRuleRow {
  schedule: string;
  canSellOnline: boolean;
  requiresPrescription: boolean;
  requiresPharmacistApproval: boolean;
  requiresRegisterEntry: boolean;
}

export default function OpsDashboardPage() {
  const t = useTranslations('ops');
  const tc = useTranslations('common');
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

  // Schedule Rules Admin state (Spec §5.1, Screen 8)
  const [rules, setRules] = useState<ScheduleRuleRow[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState<string | null>(null);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);

  // Refund management state
  const [processingRefundId, setProcessingRefundId] = useState<string | null>(null);
  const [refundRefInputs, setRefundRefInputs] = useState<Record<string, string>>({});
  const [refundMessage, setRefundMessage] = useState<string | null>(null);

  const handleProcessRefund = async (orderId: string) => {
    const ref = refundRefInputs[orderId]?.trim() || `REF-${Date.now().toString().slice(-6)}`;
    setProcessingRefundId(orderId);
    setRefundMessage(null);
    try {
      const res = await fetch('/api/ops/process-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, refundRef: ref }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process refund');
      }
      setRefundMessage(data.message);
      await loadMetrics();
    } catch (err: unknown) {
      setRefundMessage(err instanceof Error ? err.message : 'Error processing refund');
    } finally {
      setProcessingRefundId(null);
    }
  };

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

  const loadRules = async () => {
    try {
      const res = await fetch('/api/admin/schedule-rules');
      const data = await res.json();
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch {
      // Non-fatal
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    loadRules();
    const interval = setInterval(loadMetrics, 15000);
    return () => {
      clearInterval(interval);
    };
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

  const handleToggleRule = (
    schedule: string,
    field: keyof Omit<ScheduleRuleRow, 'schedule'>,
    value: boolean
  ) => {
    setRules((prev) =>
      prev.map((r) => (r.schedule === schedule ? { ...r, [field]: value } : r))
    );
  };

  const handleSaveRule = async (rule: ScheduleRuleRow) => {
    setSavingSchedule(rule.schedule);
    setRuleMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/schedule-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to update schedule rule.');
        return;
      }

      setRuleMessage(`Schedule ${rule.schedule} rules successfully updated in database.`);
    } catch {
      setError('Network communication failed.');
    } finally {
      setSavingSchedule(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {t('dashboardTitle')}
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Real-time multi-store fulfillment tracking, pharmacist verification SLAs, inventory, and regulatory rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadMetrics()}
            isLoading={metricsLoading}
            className="shadow-xs text-xs"
          >
            ↻ Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleRunReminders}
            isLoading={runningReminders}
            className="shadow-sm"
          >
            {t('runReminders')} ⚡
          </Button>
        </div>
      </div>

      {remindersResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md font-medium">
          {remindersResult}
        </div>
      )}

      {ruleMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md font-medium">
          {ruleMessage}
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
            <span className="text-xs uppercase font-bold text-stone-500">{t('activeStores')}</span>
            <p className="text-3xl font-extrabold text-stone-900 mt-1">
              {metrics?.activeStoresCount ?? 0}
            </p>
            <span className="text-xs text-stone-500">Kolkata & Howrah Network</span>
          </Card>

          <Card className="p-4">
            <span className="text-xs uppercase font-bold text-stone-500">{t('medianSla')}</span>
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
            <span className="text-xs uppercase font-bold text-stone-500">{t('rejectionRate')}</span>
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
            <span className="text-xs uppercase font-bold text-stone-500">{t('blockedItems')}</span>
            <p className="text-3xl font-extrabold text-red-700 mt-1">
              {metrics?.blockedItemsCount ?? 0}
              {metrics?.blockedItemsRate !== null && metrics?.blockedItemsRate !== undefined && (
                <span className="text-sm font-semibold text-stone-500 ml-2">
                  ({metrics.blockedItemsRate}%)
                </span>
              )}
            </p>
            <span className="text-xs text-stone-500">Schedule X / Unsellable lines blocked</span>
          </Card>
        </div>
      )}

      {/* ─── ORDERS BY STORE BREAKDOWN ──────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900 flex items-center justify-between">
            <span>{t('ordersByStore')}</span>
            {metrics?.unassignedOrdersCount ? (
              <Badge variant="caution" className="text-xs">
                {metrics.unassignedOrdersCount} Unassigned / Pending Routing
              </Badge>
            ) : null}
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
              {metrics.unassignedOrdersCount ? (
                <div className="p-3 bg-amber-50 rounded border border-amber-300">
                  <span className="font-bold text-amber-900 block">Pending Store Assignment</span>
                  <span className="text-2xl font-extrabold text-amber-900 block mt-1">
                    {metrics.unassignedOrdersCount} order{metrics.unassignedOrdersCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs text-amber-700">Requires manual pharmacist/ops store routing</span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-stone-500 py-4 text-center">No store fulfillment data available.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── SCHEDULE RULES ADMIN EDITOR (SPEC §5.1, SCREEN 8) ─ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900 flex items-center justify-between">
            <span>{t('scheduleRules')}</span>
            <span className="text-xs text-stone-500 font-normal">
              Database-driven regulatory controls (DPDP & DCA compliance)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-stone-600">
            Online pharmacy rules are configurable. Updating any rule here instantly modifies server-side gating in cart, dispatch assertions, and store packing.
          </p>

          {rulesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                  <tr>
                    <th className="p-3">Schedule</th>
                    <th className="p-3 text-center">Can Sell Online</th>
                    <th className="p-3 text-center">Requires Prescription</th>
                    <th className="p-3 text-center">Requires Pharmacist Approval</th>
                    <th className="p-3 text-center">Requires Register Entry (H1)</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {rules.map((rule) => (
                    <tr key={rule.schedule} className="hover:bg-stone-50/50">
                      <td className="p-3 font-bold text-stone-900">
                        <Badge
                          variant={
                            rule.schedule === 'OTC'
                              ? 'otc'
                              : rule.schedule === 'H'
                              ? 'h'
                              : rule.schedule === 'H1'
                              ? 'h1'
                              : 'blocked'
                          }
                        >
                          {rule.schedule}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.canSellOnline}
                          onChange={(e) =>
                            handleToggleRule(rule.schedule, 'canSellOnline', e.target.checked)
                          }
                          className="rounded border-stone-300 text-teal-700 focus:ring-teal-600 h-4 w-4"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.requiresPrescription}
                          onChange={(e) =>
                            handleToggleRule(rule.schedule, 'requiresPrescription', e.target.checked)
                          }
                          className="rounded border-stone-300 text-teal-700 focus:ring-teal-600 h-4 w-4"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.requiresPharmacistApproval}
                          onChange={(e) =>
                            handleToggleRule(rule.schedule, 'requiresPharmacistApproval', e.target.checked)
                          }
                          className="rounded border-stone-300 text-teal-700 focus:ring-teal-600 h-4 w-4"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={rule.requiresRegisterEntry}
                          onChange={(e) =>
                            handleToggleRule(rule.schedule, 'requiresRegisterEntry', e.target.checked)
                          }
                          className="rounded border-stone-300 text-teal-700 focus:ring-teal-600 h-4 w-4"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSaveRule(rule)}
                          isLoading={savingSchedule === rule.schedule}
                        >
                          {tc('save')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── DAILY STOCK CSV IMPORT TOOL (SPEC REQUIREMENT) ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900 flex items-center justify-between">
            <span>{t('stockImport')}</span>
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

      {/* ─── CUSTOMER REFUNDS QUEUE (REFUND_DUE) ────────────────────── */}
      <Card className="border-[#B69D0C]/40 bg-[#fcf8db]/20">
        <CardHeader>
          <CardTitle className="text-base font-bold text-[#190042] flex items-center justify-between">
            <span>Customer Refunds Queue (REFUND_DUE)</span>
            <Badge variant={metrics?.refundDueOrders && metrics.refundDueOrders.length > 0 ? 'caution' : 'default'} className="text-xs">
              {metrics?.refundDueOrders?.length || 0} Pending
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {refundMessage && (
            <div className="mb-4 p-2.5 bg-[#fcf8db] text-[#7b6905] border border-[#B69D0C] rounded text-xs font-medium">
              {refundMessage}
            </div>
          )}
          {!metrics?.refundDueOrders || metrics.refundDueOrders.length === 0 ? (
            <p className="text-xs text-[#796e94] py-3 text-center">
              No orders currently pending refund settlement.
            </p>
          ) : (
            <div className="overflow-x-auto border border-[#e3ddef] rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f9f8fc] text-[#190042] font-bold border-b border-[#e3ddef]">
                  <tr>
                    <th className="p-2.5">Order ID</th>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Cancellation Reason</th>
                    <th className="p-2.5">Refund Ref</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e3ddef] bg-white">
                  {metrics.refundDueOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-[#f3effa]/40">
                      <td className="p-2.5 font-mono font-bold text-[#190042]">
                        {ord.displayId}
                      </td>
                      <td className="p-2.5">
                        <span className="font-semibold block">{ord.customerName}</span>
                        <span className="text-[#796e94] text-[10px]">{ord.customerPhone}</span>
                      </td>
                      <td className="p-2.5">
                        <Badge variant="default" className="text-[10px]">{ord.paymentMethod}</Badge>
                      </td>
                      <td className="p-2.5 max-w-xs text-[#4a3e65] truncate">
                        {ord.reason}
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          placeholder="e.g. UTR / Ref"
                          value={refundRefInputs[ord.id] || ''}
                          onChange={(e) =>
                            setRefundRefInputs((prev) => ({
                              ...prev,
                              [ord.id]: e.target.value,
                            }))
                          }
                          className="px-2 py-1 text-xs border border-[#e3ddef] rounded bg-white w-28 text-[#190042]"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <Button
                          size="sm"
                          onClick={() => handleProcessRefund(ord.id)}
                          disabled={processingRefundId === ord.id}
                          className="text-xs"
                        >
                          {processingRefundId === ord.id ? 'Settling...' : 'Disburse Refund'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── REGULATORY & DISPATCH MESSAGE OUTBOX (SECTION 4 AUDIT) ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900 flex items-center justify-between">
            <span>{t('outboxTitle')}</span>
            <span className="text-xs font-normal text-stone-500">Live message_outbox audit trail</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!metrics?.recentOutboxMessages || metrics.recentOutboxMessages.length === 0 ? (
            <p className="text-xs text-stone-500 py-4 text-center">
              No simulated messages dispatched yet. Trigger &quot;Run Refill Reminders Now&quot; to simulate WhatsApp/SMS alerts.
            </p>
          ) : (
            <div className="overflow-x-auto border border-stone-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                  <tr>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Channel</th>
                    <th className="p-2.5">Recipient</th>
                    <th className="p-2.5">Message Content</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {metrics.recentOutboxMessages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-stone-50/50">
                      <td className="p-2.5 whitespace-nowrap text-stone-500 font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2.5">
                        <Badge variant={msg.channel === 'WHATSAPP' ? 'h' : 'default'} className="text-[10px]">
                          {msg.channel}
                        </Badge>
                      </td>
                      <td className="p-2.5 font-medium text-stone-900">{msg.recipient}</td>
                      <td className="p-2.5 text-stone-700 max-w-md truncate">{msg.content}</td>
                      <td className="p-2.5 text-center">
                        <Badge variant="success" className="text-[10px]">
                          {msg.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
