// src/components/ui/skeleton.tsx
import React from 'react';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => {
  return (
    <div
      className={`animate-pulse rounded bg-stone-200/70 ${className}`}
      {...props}
    />
  );
};

