import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileText } from 'lucide-react';
import {
  Patient,
  Prescription,
  fetchPatients,
  fetchPrescriptions,
} from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/**
 * Prescription history.
 *
 * Reads back what previously had no reader: prescriptions were never stored at
 * all, and the interaction warnings written alongside them were never surfaced
 * outside the Django admin.
 */
export default function PrescriptionHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const patientFilter = searchParams.get('patient') ?? '';

  useDocumentMeta('SafeMeds | Prescription history');

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const page = await fetchPatients({ pageSize: 100 });
        setPatients(page.patients);
      } catch {
        // The filter dropdown is optional; the list below still works.
      }
    };
    void loadPatients();
  }, []);

  const load = useCallback(async (patientId: string) => {
    try {
      setLoading(true);
      const page = await fetchPrescriptions({ patientId: patientId || undefined });
      setPrescriptions(page.prescriptions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(patientFilter);
  }, [patientFilter, load]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-transparent">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Prescription History</h1>
          </div>

          <select
            value={patientFilter}
            onChange={(e) => {
              const value = e.target.value;
              setSearchParams(value ? { patient: value } : {});
            }}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            <option value="">All patients</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="container mx-auto px-4 py-2">
        {loading && <div className="text-center py-8 text-gray-500">Loading…</div>}
        {error && <div className="text-center py-8 text-red-600">{error}</div>}

        {!loading && !error && prescriptions.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No prescriptions yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {!loading &&
            !error &&
            prescriptions.map((prescription) => (
              <article
                key={prescription.id}
                className="bg-gray-50 border-2 border-white rounded-2xl shadow-sm p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h2 className="font-semibold">{prescription.patient_name}</h2>
                    <p className="text-sm text-gray-500">{prescription.diagnosis}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{new Date(prescription.created_at).toLocaleString()}</p>
                    {prescription.prescribed_by_username && (
                      <p>by {prescription.prescribed_by_username}</p>
                    )}
                  </div>
                </div>

                <ul className="flex flex-wrap gap-1 mb-3">
                  {prescription.items.map((item) => (
                    <li
                      key={item.id ?? item.drug_name}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                    >
                      {item.drug_name}
                      {item.dosage ? ` · ${item.dosage}` : ''}
                    </li>
                  ))}
                </ul>

                {prescription.warnings.length > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-red-800 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      {prescription.warnings.length} interaction
                      {prescription.warnings.length > 1 ? 's' : ''} flagged at the time
                      of prescribing
                    </p>
                    <ul className="space-y-1">
                      {prescription.warnings.map((warning) => (
                        <li key={warning.id} className="text-xs text-red-900">
                          <strong>
                            {warning.drug_1} + {warning.drug_2}:
                          </strong>{' '}
                          {warning.interaction_description}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    No interactions were flagged when this was issued.
                  </p>
                )}
              </article>
            ))}
        </div>
      </main>
    </div>
  );
}
