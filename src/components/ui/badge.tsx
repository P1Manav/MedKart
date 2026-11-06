// src/components/ui/badge.tsx
import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'otc' | 'h' | 'h1' | 'blocked' | 'success' | 'caution' | 'neutral' | 'gold';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'default',
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border select-none';

  const variants = {
    default: 'bg-[#f3effa] text-[#190042] border-[#190042]/20',
    otc: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    h: 'bg-[#f3effa] text-[#190042] border-[#190042]/40 font-bold',
    h1: 'bg-[#fcf8db] text-[#7b6905] border-[#B69D0C] font-extrabold',
    gold: 'bg-[#B69D0C] text-[#190042] border-[#9c8609] font-bold shadow-2xs',
    blocked: 'bg-red-50 text-red-800 border-red-200 line-through decoration-red-400',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    caution: 'bg-[#fef9c3] text-[#7b6905] border-[#eab308]',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
