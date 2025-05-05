import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import type { DrugInteraction, Patient, PrescribedMedication } from "../../utils/api";
import { checkPrescriptionInteractions } from "../../utils/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


interface PrescriptionFormProps {
  patients: Patient[];
  onSubmit: (prescription: any) => void;
  isSubmitting?: boolean;
}

export function PrescriptionForm({ patients, onSubmit }: PrescriptionFormProps) {
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
  const [interaction, setInteraction] = useState<DrugInteraction[]>([]);
  const [showProceedButton, setShowProceedButton] = useState(false);

  const generatePDF = () => {
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
    setShowProceedButton(true);

    // Extract only medication names
    const medNames = medications.map((med) => med.name);

    if (medNames.length > 0) {  // ✅ Only send request if there are medications
        try {
            const result = await checkPrescriptionInteractions(Number(selectedPatient), medNames);
            console.log("API Response:", result);
            if (result) {
              setInteraction(result.interactions || []);
          }

            
            
        } catch (error) {
            console.error("Error checking interactions:", error);
        }
    }

    setLoading(false);

    // Save prescription (even if no interaction is found)
    const prescription = {
        id: Date.now().toString(),
        patientId: selectedPatient,
        date: new Date().toISOString(),
        diagnosis,
        medications
    };
    onSubmit(prescription);
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
                onClick={(e) => {
                  e.stopPropagation(); // Prevents triggering other events
                  generatePDF(); // Just generate the PDF without changing state
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
          {loading ? (
          <p className="text-gray-500">Checking interactions...</p>
        ) : interaction.length > 0 ? ( // ✅ Check if there are interactions
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-200">
                <th className="border p-2">Drug 1</th>
                <th className="border p-2">Drug 2</th>
                <th className="border p-2">Interaction</th>
              </tr>
            </thead>
            <tbody>
              {interaction.map((interaction, index) => (
                  <tr key={index} className={interaction.interaction.toLowerCase().includes("no") ? "bg-green-200" : "bg-red-200"}>
                    <td className="border p-2">{interaction.drug_1}</td>
                    <td className="border p-2">{interaction.drug_2}</td>
                    <td className="border p-2">{interaction.interaction}</td>
                  </tr>
                ))}
            </tbody>

          </table>
        ) : (
          <p className="text-gray-500">No interactions found</p> // ✅ Handle no interactions case
        )}

                </div>
              )}
    </div>
  );
}
