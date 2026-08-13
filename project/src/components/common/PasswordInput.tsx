import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

/**
 * Password field with a reveal toggle.
 *
 * Being able to see what you typed is the difference between one attempt and
 * three, particularly on a phone keyboard. The toggle is a real button so it is
 * reachable by keyboard, and it announces its own state rather than relying on
 * the icon to carry it.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          // `tabIndex={-1}` would keep it out of the tab order, but someone
          // typing a password is exactly who needs to reach it without a mouse.
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
