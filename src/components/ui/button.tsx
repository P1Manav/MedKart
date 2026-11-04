// src/components/ui/button.tsx
import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'xl';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'default', isLoading = false, disabled, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-md';

    const variants = {
      primary:
        'bg-[#0f766e] text-white hover:bg-[#0d6560] active:bg-[#0a5550] focus-visible:ring-[#0f766e]',
      secondary:
        'bg-[#f0fdfa] text-[#0f766e] border border-[#ccfbf1] hover:bg-[#ccfbf1] active:bg-[#99f6e4] focus-visible:ring-[#0f766e]',
      outline:
        'border border-[#e7e5e4] bg-white text-[#1c1917] hover:bg-[#fafaf9] active:bg-[#f5f5f4] focus-visible:ring-[#0f766e]',
      danger:
        'bg-[#b91c1c] text-white hover:bg-[#991b1b] active:bg-[#7f1d1d] focus-visible:ring-[#b91c1c]',
      ghost:
        'text-[#57534e] hover:bg-[#fafaf9] hover:text-[#1c1917] focus-visible:ring-[#0f766e]',
    };

    const sizes = {
      sm: 'h-10 px-3 text-sm min-h-[40px]',
      default: 'h-12 px-5 text-base min-h-[48px]', // 48px tap target
      lg: 'h-14 px-6 text-lg min-h-[56px]',
      xl: 'h-16 px-8 text-xl min-h-[64px] font-semibold shadow-md', // for large Reorder button
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin -ml-1 mr-2 h-5 w-5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
