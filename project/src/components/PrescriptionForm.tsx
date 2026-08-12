import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { InteractionWarnings } from './InteractionWarnings';
import type {
  InteractionWarning,
  Patient,
  PrescribedMedication,
  Prescription,
} from "../../utils/api";
import { createPrescription } from "../../utils/api";

interface PrescriptionFormProps {
  patients: Patient[];
  /** Called with the saved prescription once it has been persisted. */
  onSaved?: (prescription: Prescription) => void;
}

export function PrescriptionForm({ patients, onSaved }: PrescriptionFormProps) {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState<PrescribedMedication[]>([]);
  const [newMed, setNewMed] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration: ''
  });
  

  const navigate = useNavigate(); 
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [interaction, setInteraction] = useState<InteractionWarning[]>([]);
  const [showProceedButton, setShowProceedButton] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [savedPrescription, setSavedPrescription] = useState<Prescription | null>(null);

  const generatePDF = async () => {
    // jsPDF + autotable are ~400kB. Loading them on demand keeps them out of
    // the initial bundle for a screen the doctor may never print from.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF();

    // Find selected patient details
    const patient = patients.find((p) => p.id === (selectedPatient));
  
  
    doc.setFont("courier", "normal");
    const pageWidth = doc.internal.pageSize.getWidth();
    const textWidth = doc.getTextWidth("Prescription");
    const centerX = (pageWidth - textWidth) / 2;  
    // Prescription Title
    doc.setFontSize(16);
    doc.text("Prescription", centerX, 50); 
  
    // Patient Information
    doc.setFontSize(12);
    doc.text(`Patient Name: ${patient ? patient.name : "Unknown"}`, 20, 65);
    doc.text(`Age: ${patient ? patient.age : "N/A"}`, 20, 75); // Fetch patient age
    doc.text(`Diagnosis: ${diagnosis}`, 20, 85);
  
    const leftMargin = 20;
    // Add Medication List in a Box
    doc.setFontSize(12);
    doc.text("Medications:", leftMargin, 100);
    
  
    autoTable(doc, {
      startY: 105, // Position below patient details
      margin: { left: leftMargin },
      styles: { font: "courier", fontSize: 12 },
      headStyles: { fontSize: 12 },
      head: [["Medicine Name", "Dosage", "Frequency", "Duration"]],
      body: medications.map((med) => [med.name, med.dosage, med.frequency, med.duration]),
      theme: "grid", // Box style
    });
  
    // Footer with Date
    doc.setFontSize(10);
    doc.text("Generated on: " + new Date().toLocaleString(), 20, doc.internal.pageSize.height - 10);
  
    // Save the PDF
    const fileName = `${patient ? patient.name : "Unknown"} - Prescription.pdf`;
    doc.save(fileName);
  };
  

  const handleAddMedication = () => {
    if (newMed.name && newMed.dosage && newMed.frequency && newMed.duration) {
      setMedications([...medications, { ...newMed }]);
      setNewMed({ name: '', dosage: '', frequency: '', duration: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !diagnosis || medications.length === 0) return;

    setLoading(true);
    setFormSubmitted(true);
    setInteraction([]);
    setCheckError(null);
    setShowProceedButton(false);

    try {
      // One call: the server saves the prescription and screens it in the same
      // transaction, then returns the warnings it raised. Previously the
      // prescription was never stored at all and the check ran twice.
      const saved = await createPrescription({
        patientId: Number(selectedPatient),
        diagnosis,
        medications,
      });
      setSavedPrescription(saved);
      setInteraction(saved.warnings);
      onSaved?.(saved);
      // Only offer the PDF once the prescription actually saved -- otherwise a
      // doctor could print a prescription that was never recorded or screened.
      setShowProceedButton(true);
    } catch (error) {
      setCheckError(
        error instanceof Error
          ? `${error.message} The prescription was not saved or screened.`
          : "Failed to save the prescription."
      );
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="flex gap-4  w-full">
      {/* Left Side: Prescription Form */}
 
      <div className={`transition-all min-w-[500px] duration-500 ${formSubmitted ? "w-1/3" : "w-full"}`}>
        <div className="bg-gray-50 rounded-lg shadow-sm max-w-2xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Create Prescription</h2>
            <button onClick={() => navigate('/dashboard')} className="text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Patient
              </label>
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              >
                <option value="">-- Select a Patient --</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                This prescription will be assigned to the selected patient.
              </div>
            </div>

            {/* Diagnosis Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Diagnosis
              </label>
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                required
                placeholder="Enter diagnosis"
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
              />
            </div>

            {/* Medication Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Input
                  placeholder="Medicine name"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                />
                <Input
                  placeholder="Dosage"
                  value={newMed.dosage}
                  onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                />
                <Input
                  placeholder="Frequency"
                  value={newMed.frequency}
                  onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                />
                <div className="flex gap-4">
                  <Input
                    className='w-full'
                    placeholder="Duration"
                    value={newMed.duration}
                    onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                  />
                  <Button type="button" onClick={handleAddMedication} className="bg-blue-500 text-white p-2 rounded-lg">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {medications.length > 0 && (
                <div className="mt-4 space-y-2">
                  {medications.map((med, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="grid grid-cols-4 gap-4 flex-1">
                        <span className="text-sm">{med.name}</span>
                        <span className="text-sm">{med.dosage}</span>
                        <span className="text-sm">{med.frequency}</span>
                        <span className="text-sm">{med.duration}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedications(medications.filter((_, i) => i !== index))}
                        className="text-gray-500 hover:text-red-500 ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-4 border-t border-gray-200 mt-6 flex justify-center space-x-4">
              <Button onClick={() => navigate('/dashboard')} type="button" className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!selectedPatient || !diagnosis || medications.length === 0}
                className={`px-4 py-2 text-white rounded-lg ${
                  !selectedPatient || !diagnosis || medications.length === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                Generate Prescription
              </Button>
              {showProceedButton && (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void generatePDF();
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Proceed
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Right Side: Interaction Table */}
      {formSubmitted && (
        <div className="w-full min-w-[500px] bg-white p-4 rounded shadow">
          <h2 className="text-xl max-w-full font-semibold mb-4">Drug Interactions</h2>
          {savedPrescription && (
            <p className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded">
              Prescription #{savedPrescription.id} saved for{' '}
              {savedPrescription.patient_name} on{' '}
              {new Date(savedPrescription.created_at).toLocaleString()}.
            </p>
          )}
          {loading ? (
            <p className="text-gray-500">Saving and checking interactions...</p>
          ) : (
            // `unavailable` keeps a failed check visually distinct from a clean
            // one -- an empty list after an error is not an all-clear.
            <InteractionWarnings warnings={interaction} unavailable={Boolean(checkError)} />
          )}
          {checkError && (
            <p className="text-sm text-red-700 bg-red-50 p-3 rounded mt-3">{checkError}</p>
          )}

                </div>
              )}
    </div>
  );
}
