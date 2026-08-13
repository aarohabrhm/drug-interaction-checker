import { useEffect, useState } from 'react';
import { Activity, Database, ShieldAlert, Users } from 'lucide-react';
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

interface ProfileCardProps {
  username: string;
  specialty: string;
  patients?: number;
  prescriptions?: number;
}

/** The prescriber's own record: who they are, and what they have done here. */
function ProfileCard({ username, specialty, patients, prescriptions }: ProfileCardProps) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* A soft band behind the avatar, so the card reads as a profile rather
          than another data panel. */}
      <div className="h-20 bg-gradient-to-r from-primary-subtle to-surface" />

      <div className="px-6 pb-6">
        <div className="-mt-9 flex items-end gap-4">
          <span
            aria-hidden
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border-4 border-card bg-primary text-2xl font-semibold text-primary-foreground"
          >
            {initials}
          </span>
          <div className="min-w-0 pb-1">
            <p className="truncate text-section text-foreground">Dr {username}</p>
            <p className="truncate text-sm text-muted-foreground">
              {specialty || 'Specialty not set'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-surface p-4">
            <p className="flex items-center gap-1.5 text-label uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Patients
            </p>
            <p className="tabular mt-1.5 text-2xl font-semibold leading-none">
              {patients ?? '—'}
            </p>
          </div>
          <div className="rounded-md bg-surface p-4">
            <p className="flex items-center gap-1.5 text-label uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Prescriptions
            </p>
            <p className="tabular mt-1.5 text-2xl font-semibold leading-none">
              {prescriptions ?? '—'}
            </p>
          </div>
        </div>
      </div>
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
      <PageHeader title="Settings" description="Your profile and the data behind your screenings." />

      <Tabs defaultValue="profile" className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="about">Interaction data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-5">
          {loading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <>
              <ProfileCard
                username={doctor?.username ?? '—'}
                specialty={doctor?.specialty ?? ''}
                patients={stats?.patients}
                prescriptions={stats?.prescriptions}
              />

              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-section">Account details</h2>
                <dl className="mt-4">
                  <Row label="Username" value={doctor?.username ?? '—'} />
                  <Row label="Specialty" value={doctor?.specialty || 'Not set'} />
                  <Row
                    label="Sessions"
                    value={<span className="text-muted-foreground">Expire after 12 hours</span>}
                  />
                </dl>
                <p className="mt-4 rounded-md bg-surface p-3 text-xs text-muted-foreground">
                  Editing your details is coming soon. In the meantime, ask an
                  administrator if something here needs changing.
                </p>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="about" className="mt-4 space-y-5">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-1 flex items-center gap-2 text-section">
              <Database className="h-4 w-4 text-muted-foreground" />
              Where your results come from
            </h2>
            <p className="text-sm text-muted-foreground">
              Each drug pair is resolved through these in turn, most trusted first.
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
              <Row label="openFDA drug labels" value="Ungraded" />
              <Row label="AI fallback" value="Disabled" />
            </dl>
          </div>

          <div className="rounded-lg border border-l-4 border-border border-l-sev-major-border bg-sev-major-bg p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-sev-major">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Read results with care
            </h2>
            <p className="mt-2 text-sm text-foreground/80">
              SafeMeds supports your judgement; it does not replace it. A pair missing
              from the dataset has not been cleared — it has not been checked. Every
              screening reports what it could not check, so you always know the
              difference.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Settings;
