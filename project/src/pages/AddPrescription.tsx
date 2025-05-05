import { useEffect, useState } from "react";
//import { useNavigate } from "react-router-dom";
import { PrescriptionForm } from "../components/PrescriptionForm";
import { checkPrescriptionInteractions, fetchPatients, Patient } from "../../utils/api"; // Import API function

export function AddPrescription() {
  //const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);

  // Fetch patients on component mount
  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await fetchPatients();
        setPatients(data);
      } catch (error) {
        console.error("Failed to fetch patients:", error);
      }
    };

    loadPatients();
  }, []);

  const handleSubmit = async (prescription: any) => {
    try {
        if (!prescription.newMedications || prescription.newMedications.length === 0) {
            console.log("⏳ No new medications to check. Skipping API call.");
            return;
        }

        const interaction = await checkPrescriptionInteractions(
            prescription.patientId,
            prescription.newMedications
        );

        console.log("✅ API Interactions Response:", interaction); // 🛠 Debugging step

        // 🔍 Check if interactions exist
        if (interaction && Object.keys(interaction).length > 0) {
            console.warn("⚠️ Drug interactions found:", interaction);
            alert("⚠️ Warning: Drug interactions detected!");
        } else {
            alert("✅ No interactions detected.");
        }

    } catch (error) {
        console.error("❌ Error checking interactions:", error);
    }
};



  
  

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6"></div>

        {/* Pass patients to PrescriptionForm */}
        <PrescriptionForm patients={patients} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
