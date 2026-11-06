// src/app/pharmacist/queue/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PharmacistQueueLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading verification queue">
      {/* Page Title & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#e3ddef]">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-[#e2d9f3] rounded-md" />
          <Skeleton className="h-4 w-96 bg-[#f3effa] rounded" />
        </div>
        <Skeleton className="h-9 w-36 bg-[#fcf8db] rounded-full" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex gap-2 pb-2">
        <Skeleton className="h-10 w-24 rounded-lg bg-[#B69D0C]/30" />
        <Skeleton className="h-10 w-24 rounded-lg bg-[#f3effa]" />
        <Skeleton className="h-10 w-24 rounded-lg bg-[#f3effa]" />
        <Skeleton className="h-10 w-24 rounded-lg bg-[#f3effa]" />
      </div>

      {/* Queue Items List Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-28 bg-[#e2d9f3] rounded" />
                <Skeleton className="h-6 w-20 bg-[#fcf8db] rounded-full" />
              </div>
              <Skeleton className="h-4 w-32 bg-[#f3effa] rounded" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 border-y border-[#e3ddef]">
              <Skeleton className="h-12 w-full bg-[#f9f8fc] rounded" />
              <Skeleton className="h-12 w-full bg-[#f9f8fc] rounded" />
              <Skeleton className="h-12 w-full bg-[#f9f8fc] rounded" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-48 bg-[#f3effa] rounded" />
              <Skeleton className="h-11 w-32 bg-[#190042]/20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
