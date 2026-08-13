import { useCallback, useEffect, useState } from 'react';
import { PrescriptionForm } from '../components/PrescriptionForm';
import { PageHeader, ErrorState } from '../components/common/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Patient, fetchPatients } from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export function AddPrescription() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentMeta('SafeMeds | Interaction checker');

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      // A full page, so the selector is not limited to the default page size.
      const page = await fetchPatients({ pageSize: 100 });
      setPatients(page.patients);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  return (
    <div>
      <PageHeader
        eyebrow="Screening"
        title="Interaction checker"
        description="Check a new prescription against what your patient already takes. Nothing is saved until you confirm."
      />

      {error && (
        <ErrorState
          title="Patients did not load"
          message={`${error} Without the patient list there is nothing to screen against.`}
          onRetry={() => void loadPatients()}
          className="mb-5"
        />
      )}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Skeleton className="h-[520px] rounded-lg" />
          <Skeleton className="h-[280px] rounded-lg" />
        </div>
      ) : (
        <PrescriptionForm patients={patients} />
      )}
    </div>
  );
}

export default AddPrescription;
