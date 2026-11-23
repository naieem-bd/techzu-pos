import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-11 w-full rounded-control border border-input bg-card px-3 text-sm text-foreground placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-danger aria-invalid:ring-danger/20',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
