// src/components/ui/badge.tsx
import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'otc' | 'h' | 'h1' | 'blocked' | 'success' | 'caution' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'default',
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border';

  const variants = {
    default: 'bg-stone-100 text-stone-800 border-stone-200',
    otc: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    h: 'bg-teal-50 text-teal-800 border-teal-200',
    h1: 'bg-amber-50 text-amber-900 border-amber-300 font-bold',
    blocked: 'bg-red-50 text-red-800 border-red-200 line-through decoration-red-400',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    caution: 'bg-amber-50 text-amber-800 border-amber-200',
    neutral: 'bg-stone-50 text-stone-600 border-stone-200',
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
