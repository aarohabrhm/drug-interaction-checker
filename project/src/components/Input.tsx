import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../lib/utils';

// An empty interface extending the DOM props adds nothing; alias it instead.
type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          className
        )}
        {...props}
      />
    );
  }
);