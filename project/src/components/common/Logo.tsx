import { cn } from '@/lib/utils';

interface LogoProps {
  /** Rendered box size in pixels. The source is square. */
  size?: number;
  /** Show the wordmark beside the mark. */
  withName?: boolean;
  className?: string;
}

/**
 * The SafeMeds mark.
 *
 * One component so every placement stays identical -- sidebar, sign-in, landing
 * header. The image is decorative wherever a visible "SafeMeds" sits beside it,
 * and carries the alt text when it stands alone.
 */
export function Logo({ size = 32, withName = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/logo.png"
        alt={withName ? '' : 'SafeMeds'}
        aria-hidden={withName || undefined}
        width={size}
        height={size}
        // Explicit dimensions: the source is 930px square, so without them the
        // page reflows once it loads.
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
      />
      {withName && (
        <span className="text-[15px] font-semibold tracking-[-0.01em]">SafeMeds</span>
      )}
    </span>
  );
}
