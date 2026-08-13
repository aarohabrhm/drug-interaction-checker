import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Ban, Database, HelpCircle, ShieldCheck, Users } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { StatCard } from '../components/common/StatCard';
import { DataTable, type Column } from '../components/common/DataTable';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { DrugChip } from '../components/common/DrugChip';
import { CardSkeleton, EmptyState, ErrorState, PageHeader } from '../components/common/states';
import { bySeverityDescending, severityStyle } from '../lib/severity';
import {
  fetchPrescriptions,
  fetchStats,
  type Prescription,
  type Severity,
  type Stats,
} from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** Hex per grade, read from the tokens so the chart cannot drift from the badges. */
const CHART_COLOURS: Record<Severity, string> = {
  contraindicated: 'hsl(0 72% 51%)',
  major: 'hsl(21 90% 48%)',
  moderate: 'hsl(45 93% 39%)',
  minor: 'hsl(199 89% 48%)',
  unknown: 'hsl(215 20% 65%)',
};

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta('SafeMeds | Dashboard');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [figures, prescriptions] = await Promise.all([
        fetchStats(),
        fetchPrescriptions(),
      ]);
      setStats(figures);
      setRecent(prescriptions.prescriptions.slice(0, 5));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<Prescription>[] = [
    {
      header: 'Patient',
      cell: (row) => <span className="font-medium">{row.patient_name}</span>,
    },
    {
      header: 'Medicines',
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          {row.items.slice(0, 2).map((item) => (
            <DrugChip key={item.id ?? item.drug_name} name={item.drug_name} />
          ))}
          {row.items.length > 2 && (
            <span className="tabular self-center text-xs text-muted-foreground">
              +{row.items.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Result',
      cell: (row) => {
        if (row.unscreened_pair_count > 0) {
          return (
            <SeverityBadge
              severity="unscreened"
              size="sm"
              label={`${row.unscreened_pair_count} not screened`}
            />
          );
        }
        if (row.warnings.length === 0) {
          return <SeverityBadge severity="clear" size="sm" label="Clear" />;
        }
        const worst = [...row.warnings].sort(bySeverityDescending)[0];
        return <SeverityBadge severity={worst.severity} size="sm" />;
      },
    },
    {
      header: 'Issued',
      cell: (row) => (
        <span className="tabular text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ErrorState message={error ?? 'No figures returned.'} onRetry={() => void load()} />
      </div>
    );
  }

  const graded = stats.by_severity.filter((row) => row.count > 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your patients, what you have prescribed, and what screening found."
        actions={
          <Button onClick={() => navigate('/check')}>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Screen a prescription
          </Button>
        }
      />

      <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Patients" value={stats.patients} icon={Users} caption="On your list" />
        <StatCard
          label="Prescriptions"
          value={stats.prescriptions}
          icon={Activity}
          caption="Issued by you"
        />
        <StatCard
          label="Contraindicated"
          value={stats.contraindicated}
          icon={Ban}
          tone="contraindicated"
          caption="Warnings at the highest grade"
          emphasis={stats.contraindicated > 0}
        />
        {/* Sits beside the warning count deliberately: a low warning count next
            to a high unscreened count is not a good result. */}
        <StatCard
          label="Unscreened pairs"
          value={stats.unscreened_pairs}
          icon={HelpCircle}
          tone="unknown"
          caption="No source could answer — not known to be safe"
        />
      </div>

      <div className="mb-8 grid gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-section">Warnings by grade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Across every screening you have run.
          </p>

          {graded.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No warnings raised yet.
            </p>
          ) : (
            <>
              <div className="mt-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={graded}
                      dataKey="count"
                      nameKey="severity"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {graded.map((row) => (
                        <Cell key={row.severity} fill={CHART_COLOURS[row.severity]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '0.5rem',
                        border: '1px solid hsl(210 40% 93%)',
                        fontSize: '12px',
                      }}
                      // Recharts types the payload loosely; narrow it here
                      // rather than widening our own signature to `any`.
                      formatter={(value, name) => [
                        Number(value ?? 0),
                        severityStyle(String(name)).label,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* The legend carries the labels; the chart is not the only way to
                  read this. */}
              <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                {graded.sort((a, b) => b.count - a.count).map((row) => (
                  <li key={row.severity} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLOURS[row.severity] }}
                      />
                      <span className="text-muted-foreground">
                        {severityStyle(row.severity).label}
                      </span>
                    </span>
                    <span className="tabular font-medium">{row.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-section">Reference data</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/interactions')}>
              Browse
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">What screening compares against.</p>

          <div className="mt-5 flex items-baseline gap-2">
            <Database className="h-5 w-5 shrink-0 text-primary" />
            <span className="tabular text-[28px] font-semibold leading-none tracking-[-0.02em]">
              {stats.dataset_size.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">interactions loaded</span>
          </div>

          <p className="mt-4 rounded-md bg-surface p-3 text-xs text-muted-foreground">
            A pair absent from this table has not been checked and found safe — it has
            not been checked. Coverage is reported per screening, not assumed.
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-section">Recent prescriptions</h2>
        {recent.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/prescriptions')}>
            View all
          </Button>
        )}
      </div>

      <DataTable
        rows={recent}
        columns={columns}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Activity}
            title="Nothing prescribed yet"
            description="Screen a prescription and it will appear here."
            action={<Button onClick={() => navigate('/check')}>Screen a prescription</Button>}
          />
        }
      />
    </div>
  );
}

export default Dashboard;
