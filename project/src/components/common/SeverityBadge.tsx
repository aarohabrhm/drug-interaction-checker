import { cn } from '@/lib/utils';
import {
  CLEAR_STYLE,
  UNSCREENED_STYLE,
  severityStyle,
  sourceStyle,
} from '@/lib/severity';
import type { Severity } from '../../../utils/api';

type Variant = Severity | 'clear' | 'unscreened' | string;

function styleFor(variant: Variant) {
  if (variant === 'clear') return CLEAR_STYLE;
  if (variant === 'unscreened') return UNSCREENED_STYLE;
  return severityStyle(variant);
}

interface SeverityBadgeProps {
  severity: Variant;
  /** Server-supplied label, when there is one. Falls back to our own. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The grade of an interaction.
 *
 * Always icon + text, never colour alone -- a colour-blind reader, a printout
 * and a washed-out screen all have to convey the same thing.
 */
export function SeverityBadge({
  severity,
  label,
  size = 'md',
  className,
}: SeverityBadgeProps) {
  const style = styleFor(severity);
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        style.badge,
        className
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {label || style.label}
    </span>
  );
}

interface SourceBadgeProps {
  source: string;
  label?: string;
  className?: string;
}

/**
 * Where an interaction statement came from.
 *
 * Kept visually quieter than severity: provenance matters, but it must not
 * compete with how dangerous the interaction is.
 */
export function SourceBadge({ source, label, className }: SourceBadgeProps) {
  const style = sourceStyle(source);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        style.badge,
        className
      )}
    >
      {label || style.label}
    </span>
  );
}
