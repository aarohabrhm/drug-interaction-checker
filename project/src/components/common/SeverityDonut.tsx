import { GRADE_COLOURS, severityStyle } from '@/lib/severity';
import type { Severity } from '../../../utils/api';

interface SeverityDonutProps {
  data: { severity: Severity; count: number }[];
  size?: number;
  thickness?: number;
}

/**
 * Warning counts as a donut.
 *
 * Drawn with stroke-dasharray on plain circles rather than a charting library:
 * one ring of five segments does not justify ~330kB of dependency, and this
 * renders identically with no runtime to boot.
 *
 * The chart is decorative -- the legend beside it carries the labels and
 * numbers, so nothing here is the only way to read the data.
 */
export function SeverityDonut({ data, size = 168, thickness = 26 }: SeverityDonutProps) {
  const total = data.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let consumed = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={data
        .map((row) => `${severityStyle(row.severity).label}: ${row.count}`)
        .join(', ')}
    >
      {/* Rotated so the first segment starts at twelve o'clock. */}
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {data.map((row) => {
          const fraction = row.count / total;
          // A 2px gap between segments, but never on a segment too small to
          // survive it.
          const gap = fraction * circumference > 6 ? 2 : 0;
          const length = fraction * circumference - gap;
          const offset = -consumed * circumference;
          consumed += fraction;

          return (
            <circle
              key={row.severity}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={GRADE_COLOURS[row.severity]}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(length, 0)} ${circumference}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </g>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[20px] font-semibold"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {total}
      </text>
    </svg>
  );
}
