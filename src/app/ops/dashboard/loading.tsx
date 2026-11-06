// src/app/ops/dashboard/loading.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function OpsDashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading operations dashboard">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#e3ddef]">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80 bg-[#e2d9f3] rounded-md" />
          <Skeleton className="h-4 w-96 bg-[#f3effa] rounded" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36 bg-[#fcf8db] rounded-lg" />
          <Skeleton className="h-10 w-28 bg-[#f3effa] rounded-lg" />
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
            className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-3 shadow-xs"
          >
            <Skeleton className="h-4 w-28 bg-[#f3effa] rounded" />
            <Skeleton className="h-9 w-20 bg-[#fcf8db] rounded-md" />
            <Skeleton className="h-3 w-36 bg-[#f3effa] rounded" />
          </div>
        ))}
      </div>

      {/* Main Grid: Orders by Store & Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs">
          <Skeleton className="h-6 w-48 bg-[#e2d9f3] rounded" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#f9f8fc] rounded-lg border border-[#e3ddef]">
                <Skeleton className="h-5 w-44 bg-[#e2d9f3] rounded" />
                <Skeleton className="h-5 w-16 bg-[#fcf8db] rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-white border border-[#e3ddef] rounded-xl space-y-4 shadow-xs">
          <Skeleton className="h-6 w-36 bg-[#e2d9f3] rounded" />
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full bg-[#f3effa] rounded-lg" />
            <Skeleton className="h-12 w-full bg-[#f3effa] rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
