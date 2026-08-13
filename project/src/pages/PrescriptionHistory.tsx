import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { DrugChip } from '../components/common/DrugChip';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { InteractionWarnings } from '../components/InteractionWarnings';
import { EmptyState, ErrorState, PageHeader } from '../components/common/states';
import { bySeverityDescending } from '../lib/severity';
import {
  fetchPatients,
  fetchPrescriptions,
  type Patient,
  type Prescription,
} from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

const ALL = 'all';

/** One row's screening outcome, as the three states that must stay distinct. */
function ScreeningResult({ prescription }: { prescription: Prescription }) {
  if (prescription.unscreened_pair_count > 0) {
    return (
      <SeverityBadge
        severity="unscreened"
        size="sm"
        label={`${prescription.unscreened_pair_count} not screened`}
      />
    );
  }
  if (prescription.warnings.length === 0) {
    return <SeverityBadge severity="clear" size="sm" label="Clear" />;
  }
  const worst = [...prescription.warnings].sort(bySeverityDescending)[0];
  return <SeverityBadge severity={worst.severity} size="sm" />;
}

export function PrescriptionHistory() {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Prescription | null>(null);

  useDocumentMeta('SafeMeds | Prescriptions');

  useEffect(() => {
    fetchPatients({ pageSize: 100 })
      .then((page) => setPatients(page.patients))
      // The filter is a convenience; the list below still loads without it.
      .catch(() => undefined);
  }, []);

  const load = useCallback(async (filter: string) => {
    setLoading(true);
    try {
      const page = await fetchPrescriptions({
        patientId: filter === ALL ? undefined : filter,
      });
      setPrescriptions(page.prescriptions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(patientId);
  }, [patientId, load]);

  const columns: Column<Prescription>[] = [
    {
      header: 'Patient',
      cell: (row) => <span className="font-medium">{row.patient_name}</span>,
    },
    {
      header: 'Diagnosis',
      cell: (row) => <span className="text-muted-foreground">{row.diagnosis}</span>,
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
      cell: (row) => <ScreeningResult prescription={row} />,
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

  return (
    <div>
      <PageHeader
        title="Prescriptions"
        description="Everything you have prescribed, with the warnings you saw at the time."
        actions={<Button onClick={() => navigate('/check')}>Screen a prescription</Button>}
      />

      <div className="mb-4 max-w-xs">
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger aria-label="Filter by patient">
            <SelectValue placeholder="All patients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All patients</SelectItem>
            {patients.map((patient) => (
              <SelectItem key={patient.id} value={String(patient.id)}>
                {patient.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load(patientId)} />
      ) : (
        <DataTable
          rows={prescriptions}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          onRowClick={setSelected}
          empty={
            <EmptyState
              icon={Activity}
              title={
                patientId === ALL
                  ? 'No prescriptions yet'
                  : 'Nothing issued for this patient'
              }
              description="Screen a prescription and it will be recorded here with its warnings."
              action={<Button onClick={() => navigate('/check')}>Screen a prescription</Button>}
            />
          }
        />
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.patient_name}</SheetTitle>
                <SheetDescription>
                  {selected.diagnosis} · {new Date(selected.created_at).toLocaleString()}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="text-label font-mono uppercase text-muted-foreground">
                    Prescribed
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {selected.items.map((item) => (
                      <li
                        key={item.id ?? item.drug_name}
                        className="rounded-md bg-surface px-3 py-2"
                      >
                        <p className="text-sm font-medium">{item.drug_name}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          {item.dosage} · {item.frequency} · {item.duration}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="mb-2 text-label font-mono uppercase text-muted-foreground">
                    Screening at the time
                  </h3>
                  {/* The same renderer as the checker, so a warning cannot look
                      one way when raised and another way in the record. */}
                  <InteractionWarnings
                    warnings={selected.warnings}
                    unscreenedCount={selected.unscreened_pair_count}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default PrescriptionHistory;
