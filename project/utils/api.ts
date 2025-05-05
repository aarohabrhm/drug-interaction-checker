import axios from "axios";

const api = axios.create({
  baseURL: 'http://localhost:8000', // Base URL without /api
  headers: {
    'Content-Type': 'application/json',
  },
});

export const signupDoctor = async (username: string, password: string, specialty: string) => {
  try {
    const response = await api.post('/auth/signup/', {
      username,
      password,
      specialty,
    });
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data || "Signup failed" };
  }
};

export const loginDoctor = async (username: string, password: string) => {
  try {
    const response = await api.post('/auth/login/', {
      username,
      password,
    });

    const data = response.data;

    if (data.token) {
      localStorage.setItem("authToken", data.token);  // Store token for authentication
    }

    return data;
  } catch (error: any) {
    return { error: error.response?.data || "Login failed" };
  }
};

export interface Patient {
  id: string;
  name: string;
  age: number | null;
  registered_date: string;
  medical_condition: string;
  remarks: string | null;
  phone_number: string;
  email: string;
  current_medications: string;
}

export interface PrescribedMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export const fetchPatients = async (): Promise<Patient[]> => {
  try {
    const response = await api.get<Patient[]>('/api/patients/');
    return response.data;
  } catch (error) {
    console.error('Error fetching patients:', error);
    throw error;
  }
};

export const fetchDoctorDetails = async () => {
  try {
    const token = localStorage.getItem("authToken");  
    if (!token) {
      throw new Error("No authentication token found");
    }

    const response = await api.get('/auth/user/', {
      headers: {
        "Authorization": `Token ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching doctor details:", error);
    return null;
  }
};

export const addPatient = async (patientData: Omit<Patient, "id" | "registered_date">) => {
  try {
    const response = await api.post('/api/patients/add/', patientData);
    return response.data;
  } catch (error: any) {
    return { error: error.response?.data || "Failed to add patient" };
  }
};

export interface DrugInteraction {
  drug_1: string;
  drug_2: string;
  interaction: string;
}

export interface InteractionResponse {
  interactions: DrugInteraction[];
  message: string;
}

export const checkPrescriptionInteractions = async (
  patientId: number,
  newMedications: string[]
): Promise<InteractionResponse | null> => {
  if (!newMedications || newMedications.length === 0) {
    console.log("⏳ Skipping API request: No new medications provided.");
    return null;
  }

  const payload = {
    patient_id: patientId,
    new_medications: newMedications,
  };

  console.log("📤 Sending Data:", JSON.stringify(payload));

  try {
    const response = await api.post('/api/prescriptions/check/', payload);
    console.log("✅ API Response:", response.data);

    return {
      interactions: response.data.interactions || [],
      message: response.data.message || "No interactions found",
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("❌ API Error:", error.response?.data || error.message);
    } else {
      console.error("❌ Unknown Error:", (error as Error).message);
    }
    return null;
  }
};