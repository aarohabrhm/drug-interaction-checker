export interface Patient {
  id: string;
  name: string;
  age: number;
  disease: string;  // Ensure this field is included
  currentMedications: string[]; // Ensure this field exists
}


export interface PatientFormData {
  name: string;
  disease: string;
  currentMedications: string[];
}

export interface Prescription {
  id: string;
  patientId: string;
  date: string;
  diagnosis: string;
  medications: PrescribedMedication[];
}

export interface PrescribedMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}