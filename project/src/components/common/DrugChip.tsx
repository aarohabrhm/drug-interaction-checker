import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrugChipProps {
  name: string;
  /** Renders a remove control. Omit for read-only contexts. */
  onRemove?: () => void;
  /** Marks a drug the patient already takes, versus one being added. */
  variant?: 'new' | 'current';
  className?: string;
}

/**
 * A single medicine, as a token.
 *
 * The two variants matter clinically: screening compares what is being added
 * against what is already taken, so those two lists must be distinguishable at
 * a glance rather than merging into one undifferentiated row of pills.
 */
export function DrugChip({ name, onRemove, variant = 'new', className }: DrugChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full py-1 text-sm',
        onRemove ? 'pl-3 pr-1.5' : 'px-3',
        variant === 'new'
          ? 'bg-primary-subtle text-primary'
          : 'bg-surface text-muted-foreground ring-1 ring-inset ring-border',
        className
      )}
    >
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors hover:bg-primary/15"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
