import { useEffect, useState } from "react";
import { PrescriptionForm } from "../components/PrescriptionForm";
import { Patient, fetchPatients } from "../../utils/api";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function AddPrescription() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta("SafeMeds | New prescription");

  useEffect(() => {
    const loadPatients = async () => {
      try {
        // Request a full page of patients so the selector is not limited to the
        // default page size.
        const page = await fetchPatients({ pageSize: 100 });
        setPatients(page.patients);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load patients.");
      }
    };

    void loadPatients();
  }, []);

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
        )}
        {/* The form saves the prescription and renders its own warnings; it no
            longer reports them a second time through a parent alert. */}
        <PrescriptionForm patients={patients} />
      </div>
    </div>
  );
}

export default AddPrescription;
