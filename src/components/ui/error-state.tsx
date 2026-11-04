// src/components/ui/error-state.tsx
import React from 'react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`p-6 bg-red-50 border border-red-200 rounded-lg text-red-900 ${className}`}
      role="alert"
    >
      <h4 className="font-semibold text-base text-red-800">{title}</h4>
      <p className="text-sm text-red-700 mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-red-800 underline hover:text-red-950 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
        >
          Try again
        </button>
      )}
    </div>
  );
};
