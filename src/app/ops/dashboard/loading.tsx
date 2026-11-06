// src/app/ops/dashboard/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function OpsDashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading operations dashboard">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80 bg-stone-200 dark:bg-stone-800 rounded-md" />
          <Skeleton className="h-4 w-96 bg-stone-100 dark:bg-stone-850 rounded" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36 bg-teal-100 dark:bg-teal-950/50 rounded-lg" />
          <Skeleton className="h-10 w-28 bg-stone-100 dark:bg-stone-800 rounded-lg" />
        </div>
      </div>

      {/* 4 Top KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Stores' },
          { label: 'Median SLA' },
          { label: 'Rejection Rate' },
          { label: 'Blocked Items' },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-3 shadow-sm"
          >
            <Skeleton className="h-4 w-28 bg-stone-100 dark:bg-stone-800 rounded" />
            <Skeleton className="h-9 w-20 bg-teal-100/70 dark:bg-teal-950/70 rounded-md" />
            <Skeleton className="h-3 w-36 bg-stone-100 dark:bg-stone-850 rounded" />
          </div>
        ))}
      </div>

      {/* Main Grid: Orders by Store & Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4 shadow-sm">
          <Skeleton className="h-6 w-48 bg-stone-200 dark:bg-stone-800 rounded" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-850/50 rounded-lg">
                <Skeleton className="h-5 w-44 bg-stone-200 dark:bg-stone-800 rounded" />
                <Skeleton className="h-5 w-16 bg-stone-200 dark:bg-stone-800 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4 shadow-sm">
          <Skeleton className="h-6 w-36 bg-stone-200 dark:bg-stone-800 rounded" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full bg-stone-50 dark:bg-stone-850/50 rounded-lg" />
            <Skeleton className="h-16 w-full bg-stone-50 dark:bg-stone-850/50 rounded-lg" />
            <Skeleton className="h-16 w-full bg-stone-50 dark:bg-stone-850/50 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
