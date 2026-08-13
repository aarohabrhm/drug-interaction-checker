import { cn } from '@/lib/utils';
import { EmptyState, TableSkeleton } from './states';

export interface Column<T> {
  /** Stable key, also used as the label on the stacked mobile card. */
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Hide on the stacked layout when the value repeats the card's heading. */
  hideOnMobile?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  className?: string;
}

/**
 * A table on desktop, a list of cards on a phone.
 *
 * A horizontally scrolling table is unusable one-handed, so below `md` each row
 * becomes a card with the column headers as inline labels. The same `columns`
 * definition drives both, so the two cannot fall out of step.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  loading = false,
  empty,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton columns={columns.length} />;
  }

  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="Nothing to show yet" />}</>;
  }

  const interactive = Boolean(onRowClick);

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface">
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-label uppercase tracking-wide text-muted-foreground',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={interactive ? () => onRowClick?.(row) : undefined}
                tabIndex={interactive ? 0 : undefined}
                onKeyDown={
                  interactive
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-t border-border transition-colors',
                  interactive && 'cursor-pointer hover:bg-primary-subtle/60 focus:bg-primary-subtle focus:outline-none'
                )}
              >
                {columns.map((column) => (
                  <td key={column.header} className={cn('px-4 py-3.5 align-middle', column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={interactive ? () => onRowClick?.(row) : undefined}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={
              interactive
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick?.(row);
                    }
                  }
                : undefined
            }
            className={cn(
              'rounded-lg border border-border bg-card p-4',
              interactive && 'cursor-pointer transition-colors hover:border-primary/40'
            )}
          >
            <dl className="space-y-2">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.header} className="flex items-start justify-between gap-4">
                    <dt className="text-label uppercase tracking-wide text-muted-foreground">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 text-right text-sm">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
