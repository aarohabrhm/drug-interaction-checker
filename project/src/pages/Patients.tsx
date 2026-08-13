import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, type Column } from '../components/common/DataTable';
import { DrugChip } from '../components/common/DrugChip';
import { EmptyState, ErrorState, PageHeader } from '../components/common/states';
import { addPatient, fetchPatients, type Patient } from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** Split a stored medication string into individual names. */
function medicationsOf(patient: Patient): string[] {
  return (patient.current_medications || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

const BLANK = {
  name: '',
  age: '',
  medical_condition: '',
  phone_number: '',
  email: '',
  current_medications: '',
  remarks: '',
};

export function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useDocumentMeta('SafeMeds | Patients');

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const page = await fetchPatients({ search: term, pageSize: 100 });
      setPatients(page.patients);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(search), 250);
    return () => clearTimeout(timer);
  }, [search, load]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const created = await addPatient({
        name: form.name,
        age: form.age ? Number(form.age) : null,
        medical_condition: form.medical_condition,
        phone_number: form.phone_number,
        email: form.email,
        current_medications: form.current_medications,
        remarks: form.remarks || null,
      });
      setAddOpen(false);
      setForm(BLANK);
      toast.success('Patient added', { description: `${created.name} is on your list.` });
      void load(search);
    } catch (err) {
      // Field errors belong on the fields; only the summary goes to the toast.
      const fields = (err as { fields?: Record<string, string[]> }).fields;
      if (fields) setFieldErrors(fields);
      toast.error('Patient not added', {
        description: err instanceof Error ? err.message : 'Please check the form.',
      });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Patient>[] = [
    {
      header: 'Patient',
      cell: (patient) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{patient.name}</p>
          <p className="tabular truncate text-xs text-muted-foreground">
            {patient.age != null ? `${patient.age} years` : 'Age unknown'} · {patient.phone_number}
          </p>
        </div>
      ),
    },
    {
      header: 'Condition',
      cell: (patient) => (
        <span className="text-muted-foreground">{patient.medical_condition || '—'}</span>
      ),
    },
    {
      header: 'Current medications',
      cell: (patient) => {
        const medications = medicationsOf(patient);
        if (medications.length === 0) {
          return <span className="text-muted-foreground">None recorded</span>;
        }
        return (
          <div className="flex flex-wrap justify-end gap-1 md:justify-start">
            {medications.slice(0, 3).map((name) => (
              <DrugChip key={name} name={name} variant="current" />
            ))}
            {medications.length > 3 && (
              <span className="tabular self-center text-xs text-muted-foreground">
                +{medications.length - 3} more
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Your list"
        title="Patients"
        description="Everyone in your care. Their medication lists are what new prescriptions get checked against."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add patient
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, phone or condition"
          className="pl-9"
          aria-label="Search patients"
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load(search)} />
      ) : (
        <DataTable
          rows={patients}
          columns={columns}
          rowKey={(patient) => patient.id}
          loading={loading}
          onRowClick={(patient) => navigate(`/patients/${patient.id}`)}
          empty={
            search ? (
              <EmptyState
                icon={Search}
                title={`No patient matches "${search}"`}
                description="Try a different name, phone number or condition."
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No patients yet"
                description="Add a patient to start screening prescriptions against their medications."
                action={
                  <Button onClick={() => setAddOpen(true)}>
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    Add your first patient
                  </Button>
                }
              />
            )
          }
        />
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add patient</DialogTitle>
            <DialogDescription>
              List their current medications as fully as you can — that is what new
              prescriptions get checked against.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name.join(' ')}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={form.age}
                  onChange={(event) => setForm({ ...form, age: event.target.value })}
                />
                {fieldErrors.age && (
                  <p className="text-xs text-destructive">{fieldErrors.age.join(' ')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone_number}
                  onChange={(event) => setForm({ ...form, phone_number: event.target.value })}
                />
                {fieldErrors.phone_number && (
                  <p className="text-xs text-destructive">{fieldErrors.phone_number.join(' ')}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email.join(' ')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Medical condition</Label>
              <Input
                id="condition"
                value={form.medical_condition}
                onChange={(event) => setForm({ ...form, medical_condition: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medications">Current medications</Label>
              <Textarea
                id="medications"
                value={form.current_medications}
                onChange={(event) =>
                  setForm({ ...form, current_medications: event.target.value })
                }
                placeholder="warfarin, metformin"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Separate with commas. Brand names work — SafeMeds matches them to the
                active ingredient.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.name}>
                {saving ? 'Adding…' : 'Add patient'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Patients;
