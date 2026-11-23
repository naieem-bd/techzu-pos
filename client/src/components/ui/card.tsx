import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('rounded-card border border-border bg-card p-6', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn('m-0 text-[17px] font-bold', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('m-0 text-[13px] text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';
