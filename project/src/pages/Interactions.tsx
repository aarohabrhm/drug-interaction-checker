import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DataTable, type Column } from '../components/common/DataTable';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { EmptyState, ErrorState, PageHeader } from '../components/common/states';
import { severityStyle } from '../lib/severity';
import { fetchInteractions, type DatasetInteraction } from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

const PAGE_SIZE = 25;
const ALL = 'all';

const GRADES = ['contraindicated', 'major', 'moderate', 'minor', 'unknown'] as const;

export function Interactions() {
  const [rows, setRows] = useState<DatasetInteraction[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DatasetInteraction | null>(null);

  useDocumentMeta('SafeMeds | Interaction database');

  const load = useCallback(
    async (currentPage: number, term: string, grade: string) => {
      setLoading(true);
      try {
        const result = await fetchInteractions({
          page: currentPage,
          pageSize: PAGE_SIZE,
          search: term,
          severity: grade === ALL ? undefined : grade,
        });
        setRows(result.results);
        setCount(result.count);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load the dataset.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounced, and any filter change returns to page one -- staying on page 40
  // of a different result set shows nothing and looks broken.
  useEffect(() => {
    const timer = setTimeout(() => void load(page, search, severity), 250);
    return () => clearTimeout(timer);
  }, [page, search, severity, load]);

  useEffect(() => {
    setPage(1);
  }, [search, severity]);

  const columns: Column<DatasetInteraction>[] = [
    {
      header: 'Pair',
      cell: (row) => (
        <span className="font-medium">
          {row.drug_1} <span className="text-muted-foreground">+</span> {row.drug_2}
        </span>
      ),
    },
    {
      header: 'Grade',
      cell: (row) => (
        <SeverityBadge severity={row.severity} label={row.severity_label} size="sm" />
      ),
    },
    {
      header: 'Effect',
      cell: (row) => (
        <span className="line-clamp-2 text-muted-foreground">{row.interaction}</span>
      ),
      hideOnMobile: true,
    },
  ];

  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Interaction database"
        description="Every drug pair SafeMeds knows about, and how serious each one is."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search either drug name"
            className="pl-9"
            aria-label="Search interactions"
          />
        </div>

        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="sm:w-52" aria-label="Filter by grade">
            <SelectValue placeholder="All grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All grades</SelectItem>
            {GRADES.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {severityStyle(grade).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!loading && !error && (
        <p className="tabular mb-3 text-sm text-muted-foreground">
          {count.toLocaleString()} interaction{count === 1 ? '' : 's'}
          {search && ` matching "${search}"`}
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => void load(page, search, severity)} />
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={loading}
            onRowClick={setSelected}
            empty={
              <EmptyState
                icon={Table2}
                title={search ? `Nothing matches "${search}"` : 'No interactions loaded'}
                description={
                  search
                    ? 'Try a different drug name, or clear the grade filter.'
                    : 'No interaction data has been loaded yet.'
                }
              />
            }
          />

          {count > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="tabular text-sm text-muted-foreground">
                Page {page.toLocaleString()} of {lastPage.toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* A Sheet rather than a route: reading one entry should not lose your
          place in a 191k-row table. */}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.drug_1} <span className="text-muted-foreground">+</span>{' '}
                  {selected.drug_2}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Details of this interaction.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <SeverityBadge severity={selected.severity} label={selected.severity_label} />

                <div>
                  <h3 className="text-label uppercase tracking-wide text-muted-foreground">
                    Effect
                  </h3>
                  <p className="mt-1.5 text-sm">{selected.interaction}</p>
                </div>

                {selected.management_recommendation && (
                  <div>
                    <h3 className="text-label uppercase tracking-wide text-muted-foreground">
                      Management
                    </h3>
                    <p className="mt-1.5 text-sm">{selected.management_recommendation}</p>
                  </div>
                )}

                <p className="rounded-md bg-surface p-3 text-xs text-muted-foreground">
                  {severityStyle(selected.severity).hint}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default Interactions;
