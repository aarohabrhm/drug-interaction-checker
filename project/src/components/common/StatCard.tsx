import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  caption?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Lifts one card in a row as the thing worth looking at first. */
  emphasis?: boolean;
  /** Ties the icon tint to a severity, for counts that carry clinical weight. */
  tone?: 'primary' | 'contraindicated' | 'major' | 'unknown';
  className?: string;
}

const TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'bg-primary-subtle text-primary',
  contraindicated: 'bg-sev-contraindicated-bg text-sev-contraindicated',
  major: 'bg-sev-major-bg text-sev-major',
  unknown: 'bg-sev-unknown-bg text-sev-unknown',
};

/**
 * One number, with enough context to mean something.
 *
 * The value is tabular so a row of these lines up rather than jittering as the
 * digits change.
 */
export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  emphasis = false,
  tone = 'primary',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-6',
        emphasis
          ? 'border-primary/20 bg-primary-subtle'
          : 'border-border bg-card',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-label font-mono uppercase text-muted-foreground">{label}</p>
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-md',
            emphasis ? 'bg-primary text-primary-foreground' : TONES[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="tabular mt-3 text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground">
        {value}
      </p>
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}
