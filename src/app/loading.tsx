// src/app/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function RootLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6 animate-pulse" aria-busy="true" aria-label="Loading page content">
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-stone-200 dark:bg-stone-800 rounded-md" />
          <Skeleton className="h-4 w-72 bg-stone-100 dark:bg-stone-850 rounded" />
        </div>
        <Skeleton className="h-10 w-28 bg-teal-100 dark:bg-teal-950/50 rounded-lg" />
      </div>

      {/* Content cards skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4">
          <Skeleton className="h-5 w-24 bg-stone-200 dark:bg-stone-800 rounded" />
          <Skeleton className="h-10 w-full bg-stone-100 dark:bg-stone-850 rounded" />
          <Skeleton className="h-4 w-36 bg-stone-100 dark:bg-stone-850 rounded" />
        </div>

        <div className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4">
          <Skeleton className="h-5 w-32 bg-stone-200 dark:bg-stone-800 rounded" />
          <Skeleton className="h-10 w-full bg-stone-100 dark:bg-stone-850 rounded" />
          <Skeleton className="h-4 w-28 bg-stone-100 dark:bg-stone-850 rounded" />
        </div>

        <div className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4">
          <Skeleton className="h-5 w-28 bg-stone-200 dark:bg-stone-800 rounded" />
          <Skeleton className="h-10 w-full bg-stone-100 dark:bg-stone-850 rounded" />
          <Skeleton className="h-4 w-40 bg-stone-100 dark:bg-stone-850 rounded" />
        </div>
      </div>

      {/* Main content table/list skeleton */}
      <div className="p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl space-y-4">
        <Skeleton className="h-6 w-52 bg-stone-200 dark:bg-stone-800 rounded" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-14 w-full bg-stone-100 dark:bg-stone-850 rounded-lg" />
          <Skeleton className="h-14 w-full bg-stone-100 dark:bg-stone-850 rounded-lg" />
          <Skeleton className="h-14 w-full bg-stone-100 dark:bg-stone-850 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
