import { useEffect, useState } from 'react';
import { Database, ShieldAlert, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '../components/common/states';
import { fetchDoctorDetails, fetchStats, type Stats } from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function Settings() {
  const [doctor, setDoctor] = useState<{ username: string; specialty: string } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentMeta('SafeMeds | Settings');

  useEffect(() => {
    Promise.all([fetchDoctorDetails(), fetchStats().catch(() => null)])
      .then(([profile, figures]) => {
        setDoctor(profile);
        setStats(figures);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Settings" description="Your account, and where the data comes from." />

      <Tabs defaultValue="profile" className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="about">About the data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-section">
              <User className="h-4 w-4 text-muted-foreground" />
              Account
            </h2>
            {loading ? (
              <Skeleton className="mt-4 h-24" />
            ) : (
              <dl className="mt-4">
                <Row label="Username" value={doctor?.username ?? '—'} />
                <Row label="Specialty" value={doctor?.specialty || 'Not specified'} />
                <Row
                  label="Patients"
                  value={<span className="tabular">{stats?.patients ?? '—'}</span>}
                />
                <Row
                  label="Prescriptions issued"
                  value={<span className="tabular">{stats?.prescriptions ?? '—'}</span>}
                />
              </dl>
            )}
            <p className="mt-4 rounded-md bg-surface p-3 text-xs text-muted-foreground">
              Changing your password or specialty is not supported yet — the API has no
              endpoint for it.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="about" className="mt-4 space-y-5">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-section">
              <Database className="h-4 w-4 text-muted-foreground" />
              Interaction data
            </h2>
            <p className="text-sm text-muted-foreground">
              Screening resolves each pair through these, in descending order of trust.
            </p>
            <dl className="mt-4">
              <Row
                label="Curated dataset"
                value={
                  <span className="tabular">
                    {stats ? `${stats.dataset_size.toLocaleString()} pairs` : '—'}
                  </span>
                }
              />
              <Row label="openFDA drug labels" value="Ungraded free text" />
              <Row label="AI fallback" value="Off unless configured" />
            </dl>
          </div>

          <div className="rounded-lg border border-l-4 border-border border-l-sev-major-border bg-sev-major-bg p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-sev-major">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              What this tool is not
            </h2>
            <p className="mt-2 text-sm text-foreground/80">
              SafeMeds supports clinical judgement; it does not replace it. A pair absent
              from the dataset has not been checked and found safe — it has not been
              checked. Coverage is reported per screening for that reason, and anything
              that could not be checked is marked rather than omitted.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Settings;
