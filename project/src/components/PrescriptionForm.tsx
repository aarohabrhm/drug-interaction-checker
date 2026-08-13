import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, Info, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InteractionWarnings } from './InteractionWarnings';
import { CoverageMatrix } from './common/CoverageMatrix';
import { DrugCombobox } from './common/DrugCombobox';
import { DrugChip } from './common/DrugChip';
import { EmptyState } from './common/states';
import { cn } from '@/lib/utils';
import type {
  Patient,
  PrescribedMedication,
  Prescription,
  ScreeningWarning,
  UnscreenedPair,
} from '../../utils/api';
import { checkPrescriptionInteractions, createPrescription } from '../../utils/api';

interface PrescriptionFormProps {
  patients: Patient[];
  /** Called with the saved prescription once it has been persisted. */
  onSaved?: (prescription: Prescription) => void;
}

const EMPTY_MED = { name: '', dosage: '', frequency: '', duration: '' };

export function PrescriptionForm({ patients, onSaved }: PrescriptionFormProps) {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState<PrescribedMedication[]>([]);
  const [newMed, setNewMed] = useState(EMPTY_MED);

  const navigate = useNavigate();

  /** `editing` -> screen it -> `checked` -> commit it -> `saved`.
   *
   *  The point of the split: warnings used to appear only after the
   *  prescription had already been written, which is too late to act on. */
  const [phase, setPhase] = useState<'editing' | 'checked' | 'saved'>('editing');
  const [loading, setLoading] = useState(false);
  const [interaction, setInteraction] = useState<ScreeningWarning[]>([]);
  const [unscreenedPairs, setUnscreenedPairs] = useState<UnscreenedPair[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [savedPrescription, setSavedPrescription] = useState<Prescription | null>(null);

  const patient = patients.find((p) => String(p.id) === String(selectedPatient));

  /** What the patient already takes, for the matrix. */
  const currentMedications = useMemo(
    () =>
      (patient?.current_medications ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    [patient]
  );

  /**
   * Discard a completed screening because what it screened has changed.
   *
   * Without this a prescriber could check drug A, swap it for drug B, and
   * confirm against results that never covered B -- a false all-clear invented
   * by the form rather than by the interaction data. Every input calls this.
   */
  const invalidateCheck = () => {
    setPhase((current) => (current === 'checked' ? 'editing' : current));
    setInteraction([]);
    setUnscreenedPairs([]);
    setCheckError(null);
  };

  const generatePDF = async () => {
    // jsPDF + autotable are ~400kB. Loading them on demand keeps them out of
    // the initial bundle for a screen the doctor may never print from.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF();
    doc.setFont('courier', 'normal');
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = (pageWidth - doc.getTextWidth('Prescription')) / 2;

    doc.setFontSize(16);
    doc.text('Prescription', centerX, 50);

    doc.setFontSize(12);
    doc.text(`Patient Name: ${patient ? patient.name : 'Unknown'}`, 20, 65);
    doc.text(`Age: ${patient ? patient.age : 'N/A'}`, 20, 75);
    doc.text(`Diagnosis: ${diagnosis}`, 20, 85);
    doc.text('Medications:', 20, 100);

    autoTable(doc, {
      startY: 105,
      margin: { left: 20 },
      styles: { font: 'courier', fontSize: 12 },
      headStyles: { fontSize: 12 },
      head: [['Medicine Name', 'Dosage', 'Frequency', 'Duration']],
      body: medications.map((med) => [med.name, med.dosage, med.frequency, med.duration]),
      theme: 'grid',
    });

    doc.setFontSize(10);
    doc.text(
      'Generated on: ' + new Date().toLocaleString(),
      20,
      doc.internal.pageSize.height - 10
    );
    doc.save(`${patient ? patient.name : 'Unknown'} - Prescription.pdf`);
  };

  const handleAddMedication = () => {
    if (newMed.name && newMed.dosage && newMed.frequency && newMed.duration) {
      setMedications([...medications, { ...newMed }]);
      setNewMed(EMPTY_MED);
      invalidateCheck();
    }
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
    invalidateCheck();
  };

  const readyToCheck =
    Boolean(selectedPatient) && Boolean(diagnosis) && medications.length > 0;

  /** Screen the medications without writing anything. */
  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readyToCheck) return;

    setLoading(true);
    setInteraction([]);
    setUnscreenedPairs([]);
    setCheckError(null);

    try {
      const result = await checkPrescriptionInteractions(
        Number(selectedPatient),
        medications.map((med) => med.name)
      );
      setInteraction(result.interactions);
      setUnscreenedPairs(result.unscreened_pairs);
      setPhase('checked');
    } catch (error) {
      // Stay in `editing`: a failed screen is not a screen, and confirming must
      // not be offered on the strength of one.
      setCheckError(
        error instanceof Error
          ? `${error.message} Nothing has been screened or saved.`
          : 'Failed to check interactions. Nothing has been screened or saved.'
      );
    } finally {
      setLoading(false);
    }
  };

  /** Commit the prescription the prescriber has now seen the warnings for. */
  const handleConfirm = async () => {
    if (phase !== 'checked') return;

    setLoading(true);
    setCheckError(null);

    try {
      // The server screens again as it saves, so the stored record carries the
      // warnings raised at the moment of prescribing rather than whatever the
      // browser happened to be showing.
      const saved = await createPrescription({
        patientId: Number(selectedPatient),
        diagnosis,
        medications,
      });
      setSavedPrescription(saved);
      setInteraction(saved.warnings);
      setUnscreenedPairs([]);
      setPhase('saved');
      onSaved?.(saved);
      toast.success('Prescription issued', {
        description: `Recorded for ${saved.patient_name}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.message} The prescription was not saved.`
          : 'Failed to save the prescription.';
      setCheckError(message);
      toast.error('Prescription not saved', { description: message });
    } finally {
      setLoading(false);
    }
  };

  const showResults = phase !== 'editing' || loading || Boolean(checkError);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      {/* Compose */}
      <form onSubmit={handleCheck} className="space-y-5">
        <div className="space-y-5 rounded-lg border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="patient">Patient</Label>
            <Select
              value={selectedPatient}
              onValueChange={(value) => {
                setSelectedPatient(value);
                invalidateCheck();
              }}
            >
              <SelectTrigger id="patient">
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentMedications.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="pt-1 text-xs text-muted-foreground">Currently takes:</span>
                {currentMedications.map((name) => (
                  <DrugChip key={name} name={name} variant="current" />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input
              id="diagnosis"
              value={diagnosis}
              onChange={(event) => {
                setDiagnosis(event.target.value);
                invalidateCheck();
              }}
              placeholder="Enter diagnosis"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medicine">Add a medicine</Label>
            <DrugCombobox
              id="medicine"
              value={newMed.name}
              onChange={(name) => setNewMed({ ...newMed, name })}
              placeholder="Medicine name"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Dosage"
                value={newMed.dosage}
                onChange={(event) => setNewMed({ ...newMed, dosage: event.target.value })}
              />
              <Input
                placeholder="Frequency"
                value={newMed.frequency}
                onChange={(event) => setNewMed({ ...newMed, frequency: event.target.value })}
              />
              <Input
                placeholder="Duration"
                value={newMed.duration}
                onChange={(event) => setNewMed({ ...newMed, duration: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              aria-label="Add medication"
              onClick={handleAddMedication}
              className="w-full"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add to prescription
            </Button>
          </div>

          {medications.length > 0 && (
            <ul className="space-y-2 border-t border-border pt-4">
              {medications.map((med, index) => (
                <li
                  key={`${med.name}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{med.name}</p>
                    <p className="tabular truncate text-xs text-muted-foreground">
                      {med.dosage} · {med.frequency} · {med.duration}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${med.name}`}
                    onClick={() => removeMedication(index)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {phase !== 'saved' && (
              <Button type="submit" disabled={!readyToCheck || loading} className="flex-1">
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                {loading && phase === 'editing' ? 'Checking…' : 'Check interactions'}
              </Button>
            )}

            {/* Only reachable once a screening has completed for exactly what
                is in the form now -- editing anything sends it back. */}
            {phase === 'checked' && (
              <Button
                type="button"
                disabled={loading}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleConfirm();
                }}
                className="flex-1 bg-sev-clear text-white hover:bg-sev-clear/90"
              >
                {loading ? 'Saving…' : 'Confirm & prescribe'}
              </Button>
            )}

            {/* The PDF stays behind the save, so nothing can be printed that
                was never recorded or screened. */}
            {phase === 'saved' && (
              <Button
                type="button"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  void generatePDF();
                }}
                className="flex-1"
              >
                <FileDown className="mr-1.5 h-4 w-4" />
                Download PDF
              </Button>
            )}

            <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')}>
              Cancel
            </Button>
          </div>
        </div>

        {/* Never dismissible on this screen. */}
        <p className="flex items-start gap-2 rounded-lg bg-surface px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Screening supports clinical judgement, it does not replace it. Absence
            of a warning is not proof of safety — verify against a primary source
            before prescribing.
          </span>
        </p>
      </form>

      {/* Results */}
      <div aria-live="polite" className="space-y-4">
        {!showResults && (
          <EmptyState
            icon={ShieldCheck}
            title="Nothing screened yet"
            description="Pick a patient and add the medicines you intend to prescribe. Nothing is saved until you confirm."
            className="h-full min-h-[280px]"
          />
        )}

        {showResults && (
          <>
            {phase === 'checked' && (
              <p className="rounded-lg border border-primary/20 bg-primary-subtle px-4 py-3 text-sm text-primary">
                Screened only — <strong className="font-semibold">nothing has been saved yet.</strong>{' '}
                Review the result, then confirm to issue the prescription.
              </p>
            )}

            {savedPrescription && (
              <p className="rounded-lg border-l-4 border-sev-clear-border bg-sev-clear-bg px-4 py-3 text-sm text-sev-clear">
                Prescription #{savedPrescription.id} saved for {savedPrescription.patient_name} on{' '}
                {new Date(savedPrescription.created_at).toLocaleString()}.
              </p>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground">
                {phase === 'checked' ? 'Saving prescription…' : 'Checking interactions…'}
              </p>
            ) : (
              <>
                <InteractionWarnings
                  warnings={interaction}
                  unavailable={Boolean(checkError) && phase === 'editing'}
                  unscreenedPairs={phase === 'checked' ? unscreenedPairs : undefined}
                  unscreenedCount={
                    phase === 'saved' ? savedPrescription?.unscreened_pair_count ?? 0 : undefined
                  }
                />

                {phase === 'checked' && (
                  <CoverageMatrix
                    newMedications={medications.map((med) => med.name)}
                    currentMedications={currentMedications}
                    warnings={interaction}
                    unscreenedPairs={unscreenedPairs}
                  />
                )}
              </>
            )}

            {checkError && (
              <p className={cn('rounded-lg bg-sev-contraindicated-bg px-4 py-3 text-sm text-sev-contraindicated')}>
                {checkError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
