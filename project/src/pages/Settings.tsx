import { useEffect, useState } from 'react';
import { Check, Pencil, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordInput } from '../components/common/PasswordInput';
import { PageHeader } from '../components/common/states';
import {
  changePassword,
  fetchDoctorDetails,
  fetchStats,
  updateProfile,
  type Stats,
} from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** One row of a ruled definition list. */
function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="font-mono text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:text-right">
        <span className="font-medium">{value}</span>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </dd>
    </div>
  );
}

export function Settings() {
  const [doctor, setDoctor] = useState<{ username: string; specialty: string; email?: string } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ specialty: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [changing, setChanging] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string[]>>({});

  useDocumentMeta('SafeMeds | Settings');

  useEffect(() => {
    Promise.all([
      fetchDoctorDetails(),
      // Figures are a nicety here; the profile is the point, so a failure to
      // load them must not blank the whole screen.
      fetchStats().catch(() => null),
    ])
      .then(([profile, figures]) => {
        // Null only when there is no token at all, which ProtectedRoute has
        // already handled by the time this screen renders.
        if (profile) {
          setDoctor(profile);
          setForm({
            specialty: profile.specialty === 'Not Specified' ? '' : profile.specialty,
            email: profile.email ?? '',
          });
        }
        setStats(figures);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const updated = await updateProfile({
        specialty: form.specialty,
        email: form.email,
      });
      setDoctor(updated);
      setEditing(false);
      toast.success('Details saved');
    } catch (error) {
      const fields = (error as { fields?: Record<string, string[]> }).fields;
      if (fields) setFieldErrors(fields);
      toast.error('Details not saved', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setChanging(true);
    setPasswordErrors({});
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '' });
      toast.success('Password changed', {
        description: 'Any other session has been signed out.',
      });
    } catch (error) {
      const fields = (error as { fields?: Record<string, string[]> }).fields;
      if (fields) setPasswordErrors(fields);
      toast.error('Password not changed', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setChanging(false);
    }
  };

  const initials = (doctor?.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, your password, and the data behind your screenings."
      />

      {loading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : (
        <>
          {/* Identity, stated once and quietly. */}
          <div className="mb-10 flex items-center gap-5">
            <span
              aria-hidden
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary font-display text-xl text-primary-foreground"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-display text-foreground">Dr {doctor?.username}</p>
              <p className="tabular mt-1 font-mono text-xs text-muted-foreground">
                {stats?.patients ?? 0} patients · {stats?.prescriptions ?? 0} prescriptions
              </p>
            </div>
          </div>

          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="about">Interaction data</TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------------ profile */}
            <TabsContent value="profile" className="mt-8">
              {editing ? (
                <form onSubmit={handleSave}>
                  <div className="space-y-5 border-t border-border pt-6">
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input
                        id="specialty"
                        value={form.specialty}
                        onChange={(event) => setForm({ ...form, specialty: event.target.value })}
                        placeholder="General practice"
                      />
                      {fieldErrors.specialty && (
                        <p className="text-xs text-destructive">{fieldErrors.specialty.join(' ')}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                        placeholder="you@practice.example"
                      />
                      {fieldErrors.email && (
                        <p className="text-xs text-destructive">{fieldErrors.email.join(' ')}</p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button type="submit" disabled={saving}>
                        <Check className="mr-1.5 h-4 w-4" />
                        {saving ? 'Saving…' : 'Save changes'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditing(false);
                          setFieldErrors({});
                        }}
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <dl className="border-t border-border">
                    <Row
                      label="username"
                      value={doctor?.username ?? '—'}
                      hint="You sign in with this, so it cannot be changed."
                    />
                    <Row label="specialty" value={doctor?.specialty || 'Not set'} />
                    <Row label="email" value={doctor?.email || 'Not set'} />
                    <Row label="session" value="Expires after 12 hours" />
                  </dl>
                  <Button variant="outline" className="mt-6" onClick={() => setEditing(true)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit details
                  </Button>
                </>
              )}
            </TabsContent>

            {/* ----------------------------------------------------- password */}
            <TabsContent value="password" className="mt-8">
              <form onSubmit={handlePassword} className="max-w-sm space-y-5 border-t border-border pt-6">
                <div className="space-y-2">
                  <Label htmlFor="current">Current password</Label>
                  <PasswordInput
                    id="current"
                    autoComplete="current-password"
                    value={passwords.current}
                    onChange={(event) =>
                      setPasswords({ ...passwords, current: event.target.value })
                    }
                  />
                  {passwordErrors.current_password && (
                    <p className="text-xs text-destructive">
                      {passwordErrors.current_password.join(' ')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="next">New password</Label>
                  <PasswordInput
                    id="next"
                    autoComplete="new-password"
                    value={passwords.next}
                    onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                  />
                  {passwordErrors.new_password && (
                    <p className="text-xs text-destructive">
                      {passwordErrors.new_password.join(' ')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    At least 10 characters, and not a commonly used password.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={changing || !passwords.current || !passwords.next}
                >
                  {changing ? 'Changing…' : 'Change password'}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Changing your password signs out every other device. You will stay
                  signed in here.
                </p>
              </form>
            </TabsContent>

            {/* -------------------------------------------------------- about */}
            <TabsContent value="about" className="mt-8 space-y-8">
              <div>
                <p className="text-label font-mono uppercase text-muted-foreground">
                  Behind the answers
                </p>
                <h2 className="mt-3 text-section text-foreground">
                  Each pair is resolved through these in turn, most trusted first.
                </h2>
                <dl className="mt-5 border-t border-border">
                  <Row
                    label="curated dataset"
                    value={
                      <span className="tabular">
                        {stats ? `${stats.dataset_size.toLocaleString()} pairs` : '—'}
                      </span>
                    }
                    hint="The only source that grades severity."
                  />
                  <Row label="openFDA labels" value="Ungraded" />
                  <Row label="AI fallback" value="Disabled" />
                </dl>
              </div>

              <div className="border-l-2 border-sev-major-border bg-sev-major-bg p-5">
                <h2 className="flex items-center gap-2 text-sm font-medium text-sev-major">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Read results with care
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                  SafeMeds supports your judgement; it does not replace it. A pair
                  missing from the dataset has not been cleared — it has not been
                  checked. Every screening reports what it could not check, so you
                  always know the difference.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

export default Settings;
