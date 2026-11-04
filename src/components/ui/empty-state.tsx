// src/components/ui/empty-state.tsx
import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-stone-50 rounded-lg border border-dashed border-stone-200 ${className}`}
    >
      {icon && <div className="text-stone-400 mb-3">{icon}</div>}
      <h4 className="text-lg font-semibold text-stone-800">{title}</h4>
      <p className="text-sm text-stone-500 max-w-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

