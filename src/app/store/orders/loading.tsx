// src/app/store/orders/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StoreOrdersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading store orders">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#e3ddef]">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-[#e2d9f3] rounded-md" />
          <Skeleton className="h-4 w-80 bg-[#f3effa] rounded" />
        </div>
        <Skeleton className="h-9 w-44 bg-[#fcf8db] rounded-full" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 pb-2">
        <Skeleton className="h-10 w-28 rounded-lg bg-[#B69D0C]/30" />
        <Skeleton className="h-10 w-24 rounded-lg bg-[#f3effa]" />
        <Skeleton className="h-10 w-24 rounded-lg bg-[#f3effa]" />
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-32 bg-[#e2d9f3] rounded" />
                  <Skeleton className="h-6 w-24 bg-[#fcf8db] rounded-full" />
                </div>
                <Skeleton className="h-4 w-48 bg-[#f3effa] rounded" />
              </div>
              <Skeleton className="h-5 w-20 bg-[#f3effa] rounded" />
            </div>

            <div className="p-4 bg-[#f9f8fc] border border-[#e3ddef] rounded-lg space-y-2">
              <Skeleton className="h-4 w-full bg-[#e2d9f3] rounded" />
              <Skeleton className="h-4 w-3/4 bg-[#f3effa] rounded" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-10 w-44 bg-[#f3effa] rounded-lg" />
              <Skeleton className="h-11 w-36 bg-[#190042]/20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
