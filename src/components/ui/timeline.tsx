// src/components/ui/timeline.tsx
import React from 'react';
import type { OrderStatus } from '@/domain/order-state';

export interface TimelineStep {
  status: OrderStatus;
  title: string;
  description?: string;
  timestamp?: string | null;
  state: 'completed' | 'current' | 'upcoming' | 'failed' | 'on_hold';
}

export interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, className = '' }) => {
  return (
    <div className={`relative pl-6 border-l-2 border-stone-200 space-y-6 ${className}`}>
      {steps.map((step, idx) => {
        const dotStyles = {
          completed: 'bg-[#190042] border-[#190042] text-white',
          current: 'bg-[#B69D0C] border-[#9c8609] ring-4 ring-[#fcf8db] text-[#190042]',
          upcoming: 'bg-white border-[#e3ddef] text-[#796e94]',
          failed: 'bg-red-600 border-red-600 text-white',
          on_hold: 'bg-[#B69D0C] border-[#B69D0C] text-white',
        };

        return (
          <div key={idx} className="relative group">
            {/* Dot marker */}
            <div
              className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                dotStyles[step.state]
              }`}
            />
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h4
                  className={`text-base font-semibold ${
                    step.state === 'upcoming' ? 'text-stone-400' : 'text-stone-900'
                  }`}
                >
                  {step.title}
                </h4>
                {step.timestamp && (
                  <span className="text-xs text-stone-500">{step.timestamp}</span>
                )}
              </div>
              {step.description && (
                <p
                  className={`text-sm mt-1 ${
                    step.state === 'on_hold'
                      ? 'text-amber-800 font-medium'
                      : step.state === 'failed'
                      ? 'text-red-700 font-medium'
                      : 'text-stone-600'
                  }`}
                >
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

