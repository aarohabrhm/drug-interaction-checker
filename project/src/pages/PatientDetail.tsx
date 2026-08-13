import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, History, Mail, Phone, Pill, ShieldCheck, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DrugChip } from '../components/common/DrugChip';
import { SeverityBadge, SourceBadge } from '../components/common/SeverityBadge';
import { DataTable, type Column } from '../components/common/DataTable';
import { EmptyState, ErrorState, PageHeader } from '../components/common/states';
import { bySeverityDescending } from '../lib/severity';
import {
  fetchPatient,
  fetchPatientInteractionHistory,
  fetchPrescriptions,
  type InteractionWarning,
  type Patient,
  type Prescription,
} from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [history, setHistory] = useState<InteractionWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta(patient ? `SafeMeds | ${patient.name}` : 'SafeMeds | Patient');

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      // Fetched together: a record with its medications but not its warning
      // history is only half the picture a prescriber needs.
      const [record, prescriptionPage, warnings] = await Promise.all([
        fetchPatient(patientId),
        fetchPrescriptions({ patientId }),
        fetchPatientInteractionHistory(patientId),
      ]);
      setPatient(record);
      setPrescriptions(prescriptionPage.prescriptions);
      setHistory(warnings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this patient.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const medications = (patient?.current_medications || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  const prescriptionColumns: Column<Prescription>[] = [
    {
      header: 'Issued',
      cell: (row) => (
        <span className="tabular text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Diagnosis',
      cell: (row) => <span className="font-medium">{row.diagnosis}</span>,
    },
    {
      header: 'Medicines',
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          {row.items.map((item) => (
            <DrugChip key={item.id ?? item.drug_name} name={item.drug_name} />
          ))}
        </div>
      ),
    },
    {
      header: 'Screening',
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
  ];

  const historyColumns: Column<InteractionWarning>[] = [
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
      header: 'Source',
      cell: (row) => <SourceBadge source={row.source} label={row.source_label} />,
    },
    {
      header: 'Raised',
      cell: (row) => (
        <span className="tabular text-muted-foreground">
          {new Date(row.checked_at).toLocaleDateString()}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate('/patients')} className="mb-4">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to patients
        </Button>
        <ErrorState
          title="Patient did not load"
          message={error ?? 'That patient could not be found.'}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/patients"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Patients
      </Link>

      <PageHeader
        title={patient.name}
        description={patient.medical_condition || 'No condition recorded'}
        actions={
          <Button onClick={() => navigate('/check')}>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Screen a prescription
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-section">
            <Pill className="h-4 w-4 text-muted-foreground" />
            Current medications
          </h2>
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None recorded. Screening has nothing to compare against until there are
              some — a prescription for this patient would come back clear by default.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {medications.map((name) => (
                  <DrugChip key={name} name={name} variant="current" />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Updated automatically when a prescription is issued.
              </p>
            </>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-section">Contact</h2>
          <p className="tabular flex items-center gap-2 text-sm text-muted-foreground">
            <Stethoscope className="h-4 w-4 shrink-0" />
            {patient.age != null ? `${patient.age} years old` : 'Age unknown'}
          </p>
          <p className="tabular flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            {patient.phone_number || '—'}
          </p>
          <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{patient.email || '—'}</span>
          </p>
          {patient.remarks && (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              {patient.remarks}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="prescriptions">
        <TabsList>
          <TabsTrigger value="prescriptions">
            Prescriptions
            <span className="tabular ml-1.5 text-muted-foreground">{prescriptions.length}</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            Warning history
            <span className="tabular ml-1.5 text-muted-foreground">{history.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prescriptions" className="mt-4">
          <DataTable
            rows={prescriptions}
            columns={prescriptionColumns}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={Pill}
                title="No prescriptions yet"
                description="Nothing has been issued for this patient."
                action={
                  <Button onClick={() => navigate('/check')}>Screen a prescription</Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {/* Every warning this patient has ever been shown. Kept separate from
              the prescriptions above because a warning raised during a check
              that was never confirmed still happened, and is still worth
              seeing. */}
          <DataTable
            rows={[...history].sort(bySeverityDescending)}
            columns={historyColumns}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={History}
                title="No warnings raised yet"
                description="Interactions found while screening for this patient will be listed here."
              />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PatientDetail;
