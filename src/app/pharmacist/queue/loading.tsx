// src/app/pharmacist/queue/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PharmacistQueueLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading verification queue">
      {/* Page Title & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-stone-200 dark:bg-stone-800 rounded-md" />
          <Skeleton className="h-4 w-96 bg-stone-100 dark:bg-stone-850 rounded" />
        </div>
        <Skeleton className="h-9 w-36 bg-teal-100 dark:bg-teal-950/40 rounded-full" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex gap-2 pb-2">
        <Skeleton className="h-10 w-24 rounded-lg bg-teal-100 dark:bg-teal-950/60" />
        <Skeleton className="h-10 w-24 rounded-lg bg-stone-100 dark:bg-stone-850" />
        <Skeleton className="h-10 w-24 rounded-lg bg-stone-100 dark:bg-stone-850" />
        <Skeleton className="h-10 w-24 rounded-lg bg-stone-100 dark:bg-stone-850" />
      </div>

      {/* Queue Items List Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-28 bg-stone-200 dark:bg-stone-800 rounded" />
                <Skeleton className="h-6 w-20 bg-amber-100 dark:bg-amber-950/50 rounded-full" />
              </div>
              <Skeleton className="h-4 w-32 bg-stone-100 dark:bg-stone-850 rounded" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 border-y border-stone-100 dark:border-stone-800">
              <Skeleton className="h-12 w-full bg-stone-50 dark:bg-stone-850 rounded" />
              <Skeleton className="h-12 w-full bg-stone-50 dark:bg-stone-850 rounded" />
              <Skeleton className="h-12 w-full bg-stone-50 dark:bg-stone-850 rounded" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-48 bg-stone-100 dark:bg-stone-850 rounded" />
              <Skeleton className="h-11 w-32 bg-teal-700/30 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
