// src/components/ui/button.tsx
import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'gold' | 'outline' | 'danger' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'xl';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'default', isLoading = false, disabled, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-md cursor-pointer';

    const variants = {
      primary:
        'bg-[#190042] text-white hover:bg-[#26055f] active:bg-[#10002b] border border-[#B69D0C]/40 focus-visible:ring-[#B69D0C]',
      secondary:
        'bg-[#f3effa] text-[#190042] border border-[#e2d9f3] hover:bg-[#e2d9f3] active:bg-[#c1b0e3] focus-visible:ring-[#190042]',
      gold:
        'bg-[#B69D0C] text-[#190042] hover:bg-[#9c8609] active:bg-[#7b6905] border border-[#9c8609] shadow-xs focus-visible:ring-[#190042]',
      outline:
        'border border-[#190042]/30 bg-white text-[#190042] hover:bg-[#f3effa] active:bg-[#e2d9f3] focus-visible:ring-[#B69D0C]',
      danger:
        'bg-[#b91c1c] text-white hover:bg-[#991b1b] active:bg-[#7f1d1d] focus-visible:ring-[#b91c1c]',
      ghost:
        'text-[#190042] hover:bg-[#f3effa] hover:text-[#190042] focus-visible:ring-[#B69D0C]',
    };

    const sizes = {
      sm: 'h-10 px-3 text-sm min-h-[40px]',
      default: 'h-12 px-5 text-base min-h-[48px]', // 48px tap target
      lg: 'h-14 px-6 text-lg min-h-[56px]',
      xl: 'h-16 px-8 text-xl min-h-[64px] font-bold shadow-md', // for large Reorder button
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
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
