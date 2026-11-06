// src/app/store/orders/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StoreOrdersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading store orders">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-stone-200 dark:bg-stone-800 rounded-md" />
          <Skeleton className="h-4 w-80 bg-stone-100 dark:bg-stone-850 rounded" />
        </div>
        <Skeleton className="h-9 w-44 bg-teal-100 dark:bg-teal-950/40 rounded-full" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 pb-2">
        <Skeleton className="h-10 w-28 rounded-lg bg-teal-100 dark:bg-teal-950/60" />
        <Skeleton className="h-10 w-24 rounded-lg bg-stone-100 dark:bg-stone-850" />
        <Skeleton className="h-10 w-24 rounded-lg bg-stone-100 dark:bg-stone-850" />
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-32 bg-stone-200 dark:bg-stone-800 rounded" />
                  <Skeleton className="h-6 w-24 bg-teal-100 dark:bg-teal-950/50 rounded-full" />
                </div>
                <Skeleton className="h-4 w-48 bg-stone-100 dark:bg-stone-850 rounded" />
              </div>
              <Skeleton className="h-5 w-20 bg-stone-100 dark:bg-stone-850 rounded" />
            </div>

            <div className="p-4 bg-stone-50 dark:bg-stone-850/50 rounded-lg space-y-2">
              <Skeleton className="h-4 w-full bg-stone-100 dark:bg-stone-800 rounded" />
              <Skeleton className="h-4 w-3/4 bg-stone-100 dark:bg-stone-800 rounded" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-10 w-44 bg-stone-100 dark:bg-stone-850 rounded-lg" />
              <Skeleton className="h-11 w-36 bg-teal-700/30 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
