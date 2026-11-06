// src/app/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function RootLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 space-y-6 animate-pulse" aria-busy="true" aria-label="Loading page content">
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e3ddef]">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-[#e2d9f3] rounded-md" />
          <Skeleton className="h-4 w-72 bg-[#f3effa] rounded" />
        </div>
        <Skeleton className="h-10 w-28 bg-[#fcf8db] rounded-lg" />
      </div>

      {/* Content cards skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs">
          <Skeleton className="h-5 w-24 bg-[#e2d9f3] rounded" />
          <Skeleton className="h-10 w-full bg-[#f3effa] rounded" />
          <Skeleton className="h-4 w-36 bg-[#f3effa] rounded" />
        </div>

        <div className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs">
          <Skeleton className="h-5 w-32 bg-[#e2d9f3] rounded" />
          <Skeleton className="h-10 w-full bg-[#f3effa] rounded" />
          <Skeleton className="h-4 w-28 bg-[#f3effa] rounded" />
        </div>

        <div className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs">
          <Skeleton className="h-5 w-28 bg-[#e2d9f3] rounded" />
          <Skeleton className="h-10 w-full bg-[#f3effa] rounded" />
          <Skeleton className="h-4 w-40 bg-[#f3effa] rounded" />
        </div>
      </div>

      {/* Main content table/list skeleton */}
      <div className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs">
        <Skeleton className="h-6 w-52 bg-[#e2d9f3] rounded" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-14 w-full bg-[#f3effa] rounded-lg" />
          <Skeleton className="h-14 w-full bg-[#f3effa] rounded-lg" />
          <Skeleton className="h-14 w-full bg-[#f3effa] rounded-lg" />
        </div>
      </div>
    </div>
  );
}
