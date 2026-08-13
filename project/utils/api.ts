import axios, { AxiosError } from "axios";

/**
 * API client.
 *
 * The base URL comes from `VITE_API_BASE_URL` -- it was hardcoded to
 * `http://localhost:8000`, which meant any production build pointed the browser
 * at the user's own machine.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

export const AUTH_TOKEN_KEY = "authToken";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// Attach the token to every request from one place. Previously only
// `fetchDoctorDetails` sent it, so every other authenticated call would have
// failed once the API stopped allowing anonymous access.
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// A 401 means the token is missing, expired or revoked server-side. Drop it and
// bounce to login instead of leaving the UI in a half-authenticated state.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearAuthToken();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

/** Shape of the error envelope every API endpoint returns. */
interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: { fields?: Record<string, string[]>; [key: string]: unknown };
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly fields?: Record<string, string[]>;

  constructor(message: string, code: string, status?: number, fields?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/** Normalize any thrown value into an ApiError with a user-safe message. */
function toApiError(error: unknown, fallback: string): ApiError {
  if (axios.isAxiosError(error)) {
    const envelope = error.response?.data as ApiErrorEnvelope | undefined;
    const detail = envelope?.error;
    return new ApiError(
      detail?.message ?? fallback,
      detail?.code ?? "network_error",
      error.response?.status,
      detail?.details?.fields
    );
  }
  return new ApiError(fallback, "unknown_error");
}

export interface DoctorProfile {
  username: string;
  email?: string;
  specialty: string;
}

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

/** One interaction as returned by the pre-prescribing check.
 *
 *  Field names differ from the stored form below (`interaction` rather than
 *  `interaction_description`), so this shape is mapped to that one before it
 *  reaches the UI -- see `toWarning`. */
export interface DrugInteraction {
  drug_1: string;
  drug_2: string;
  interaction: string;
  severity: Severity;
  source: InteractionSourceId;
  management: string;
}

/** Clinical significance, most urgent first. `unknown` means the source gave no
 *  grading -- it is NOT a synonym for "safe". */
export type Severity = 'contraindicated' | 'major' | 'moderate' | 'minor' | 'unknown';

/** Where an interaction statement came from. `ai_unverified` must always be
 *  visually distinguished from curated data. */
export type InteractionSourceId = 'dataset' | 'openfda' | 'ai_unverified';

export const SEVERITY_RANK: Record<Severity, number> = {
  contraindicated: 4,
  major: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

/** A warning as stored against a prescription or patient history. */
export interface InteractionWarning {
  id: number;
  drug_1: string;
  drug_2: string;
  interaction_description: string;
  severity: Severity;
  severity_label: string;
  source: InteractionSourceId;
  source_label: string;
  management_recommendation: string;
  checked_at: string;
}

/** What the warnings UI renders.
 *
 *  A warning found before prescribing has no database id and no server-rendered
 *  labels, but is otherwise the same fact as one stored afterwards. Both are
 *  mapped to this so there is a single rendering path: if the two travelled
 *  separate paths, the same interaction could look different either side of the
 *  decision to prescribe, which is exactly the confusion this app exists to
 *  avoid. Labels are derived from `severity`/`source` when absent. */
export type ScreeningWarning = Omit<
  InteractionWarning,
  'id' | 'severity_label' | 'source_label' | 'checked_at'
> &
  Partial<Pick<InteractionWarning, 'id' | 'severity_label' | 'source_label' | 'checked_at'>>;

/** Map a pre-prescribing check result onto the stored warning shape. */
export function toWarning(interaction: DrugInteraction): ScreeningWarning {
  return {
    drug_1: interaction.drug_1,
    drug_2: interaction.drug_2,
    interaction_description: interaction.interaction,
    severity: interaction.severity ?? 'unknown',
    source: interaction.source ?? 'dataset',
    management_recommendation: interaction.management ?? '',
  };
}

/** Wire shape of a medication line. The form uses `name`; the API uses
 *  `drug_name`. Mapped in `createPrescription` / `toPrescribedMedication`
 *  rather than reshaping the form component. */
export interface PrescriptionItem {
  id?: number;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

/** A pair that no source could be reached for. Nothing is known about it --
 *  it is NOT a pair that was checked and found clear. */
export interface UnscreenedPair {
  drug_1: string;
  drug_2: string;
}

export interface Prescription {
  id: number;
  patient: number;
  patient_name: string;
  prescribed_by_username: string | null;
  diagnosis: string;
  notes: string;
  created_at: string;
  items: PrescriptionItem[];
  warnings: InteractionWarning[];
  unscreened_pair_count: number;
  screening_complete: boolean;
}

export function toPrescribedMedication(item: PrescriptionItem): PrescribedMedication {
  return {
    name: item.drug_name,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
  };
}

export interface InteractionResponse {
  /** Already mapped to the shape the warnings UI renders. */
  interactions: ScreeningWarning[];
  /** Pairs no source could answer. A non-empty list means the screen was
   *  incomplete, regardless of how many interactions were found. */
  unscreened_pairs: UnscreenedPair[];
  screening_complete: boolean;
  message?: string;
}

/** DRF PageNumberPagination envelope. */
interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PatientPage {
  patients: Patient[];
  count: number;
  hasNext: boolean;
}

export const signupDoctor = async (
  username: string,
  password: string,
  specialty: string
): Promise<{ message: string; username: string }> => {
  try {
    const response = await api.post("/auth/signup/", { username, password, specialty });
    return response.data;
  } catch (error) {
    throw toApiError(error, "Signup failed. Please try again.");
  }
};

export const loginDoctor = async (
  username: string,
  password: string
): Promise<{ token: string; username: string; specialty: string }> => {
  try {
    const response = await api.post("/auth/login/", { username, password });
    if (response.data?.token) {
      setAuthToken(response.data.token);
    }
    return response.data;
  } catch (error) {
    throw toApiError(error, "Login failed. Please try again.");
  }
};

export const logoutDoctor = async (): Promise<void> => {
  try {
    // Invalidate server-side so the token cannot be replayed; the old UI only
    // navigated away and left the token live.
    await api.post("/auth/logout/");
  } catch {
    // A failed logout must not trap the user in the app.
  } finally {
    clearAuthToken();
  }
};

/** Fetch one page of patients. The endpoint is paginated and searchable. */
export const fetchPatients = async (
  options: { search?: string; page?: number; pageSize?: number } = {}
): Promise<PatientPage> => {
  try {
    const response = await api.get<Paginated<Patient>>("/api/patients/", {
      params: {
        search: options.search || undefined,
        page: options.page || undefined,
        page_size: options.pageSize || undefined,
      },
    });
    return {
      patients: response.data.results,
      count: response.data.count,
      hasNext: Boolean(response.data.next),
    };
  } catch (error) {
    throw toApiError(error, "Failed to load patients.");
  }
};

export const fetchDoctorDetails = async (): Promise<DoctorProfile | null> => {
  if (!getAuthToken()) {
    return null;
  }
  try {
    const response = await api.get("/auth/user/");
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to load your profile.");
  }
};

export const addPatient = async (
  patientData: Omit<Patient, "id" | "registered_date">
): Promise<Patient> => {
  try {
    const response = await api.post<Patient>("/api/patients/add/", patientData);
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to add patient.");
  }
};

export const fetchPatient = async (patientId: number | string): Promise<Patient> => {
  try {
    const response = await api.get<Patient>(`/api/patients/${patientId}/`);
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to load patient.");
  }
};

export const updatePatient = async (
  patientId: number | string,
  changes: Partial<Omit<Patient, "id" | "registered_date">>
): Promise<Patient> => {
  try {
    const response = await api.patch<Patient>(`/api/patients/${patientId}/`, changes);
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to update patient.");
  }
};

/** Issue a prescription. The server runs the interaction check and returns the
 *  saved prescription with any warnings it raised. */
export const createPrescription = async (input: {
  patientId: number;
  diagnosis: string;
  notes?: string;
  medications: PrescribedMedication[];
}): Promise<Prescription> => {
  try {
    const response = await api.post<Prescription>("/api/prescriptions/", {
      patient: input.patientId,
      diagnosis: input.diagnosis,
      notes: input.notes ?? "",
      items: input.medications.map((med) => ({
        drug_name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
      })),
    });
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to save the prescription.");
  }
};

export interface PrescriptionPage {
  prescriptions: Prescription[];
  count: number;
  hasNext: boolean;
}

export const fetchPrescriptions = async (
  options: { patientId?: number | string; page?: number } = {}
): Promise<PrescriptionPage> => {
  try {
    const response = await api.get<Paginated<Prescription>>("/api/prescriptions/", {
      params: { patient: options.patientId || undefined, page: options.page || undefined },
    });
    return {
      prescriptions: response.data.results,
      count: response.data.count,
      hasNext: Boolean(response.data.next),
    };
  } catch (error) {
    throw toApiError(error, "Failed to load prescriptions.");
  }
};

export const fetchPatientInteractionHistory = async (
  patientId: number | string
): Promise<InteractionWarning[]> => {
  try {
    const response = await api.get<Paginated<InteractionWarning>>(
      `/api/patients/${patientId}/interactions/`
    );
    return response.data.results;
  } catch (error) {
    throw toApiError(error, "Failed to load interaction history.");
  }
};

export const checkPrescriptionInteractions = async (
  patientId: number,
  newMedications: string[]
): Promise<InteractionResponse> => {
  if (!newMedications || newMedications.length === 0) {
    return { interactions: [], unscreened_pairs: [], screening_complete: true };
  }
  try {
    const response = await api.post("/api/prescriptions/check/", {
      patient_id: patientId,
      new_medications: newMedications,
    });
    const unscreened = response.data.unscreened_pairs ?? [];
    return {
      interactions: (response.data.interactions ?? []).map(toWarning),
      unscreened_pairs: unscreened,
      // Defaults to the pessimistic reading if the field is absent, so an old
      // or unexpected response never presents as a confirmed clean screen.
      screening_complete: response.data.screening_complete ?? unscreened.length === 0,
      message: response.data.message,
    };
  } catch (error) {
    throw toApiError(error, "Failed to check drug interactions.");
  }
};

/** Update your own details. Username is not editable server-side. */
export const updateProfile = async (changes: {
  specialty?: string;
  email?: string;
}): Promise<DoctorProfile> => {
  try {
    const response = await api.patch<DoctorProfile>('/auth/user/update/', changes);
    return response.data;
  } catch (error) {
    throw toApiError(error, 'Could not save your details.');
  }
};

/**
 * Change your password.
 *
 * The server destroys every existing token and issues a fresh one, so this
 * stores the new token to keep the current session alive -- without it the very
 * next request would 401.
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  try {
    const response = await api.post<{ token: string }>('/auth/user/password/', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    if (response.data.token) setAuthToken(response.data.token);
  } catch (error) {
    throw toApiError(error, 'Could not change your password.');
  }
};

// --------------------------------------------------------------------------- //
// Reference data
// --------------------------------------------------------------------------- //

export interface DrugSuggestion {
  name: string;
  /** `dataset` can be graded; `patient` is a name one of your patients takes. */
  source: 'dataset' | 'patient';
}

/**
 * Autocomplete over known drug names.
 *
 * Offering a name that exists in the dataset is what stops a typo becoming an
 * unscreened pair, so this is a safety feature as much as a convenience.
 * Queries under two characters return nothing rather than most of the table.
 */
export const searchDrugs = async (
  query: string,
  limit = 10
): Promise<DrugSuggestion[]> => {
  if (query.trim().length < 2) return [];
  try {
    const response = await api.get<{ results: DrugSuggestion[] }>(
      '/api/drugs/search/',
      { params: { q: query.trim(), limit } }
    );
    return response.data.results ?? [];
  } catch (error) {
    throw toApiError(error, 'Could not search drug names.');
  }
};

export interface DatasetInteraction {
  id: number;
  drug_1: string;
  drug_2: string;
  interaction: string;
  severity: Severity;
  severity_label: string;
  management_recommendation: string;
}

export const fetchInteractions = async (params: {
  search?: string;
  severity?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paginated<DatasetInteraction>> => {
  try {
    const response = await api.get<Paginated<DatasetInteraction>>('/api/interactions/', {
      params: {
        search: params.search || undefined,
        severity: params.severity || undefined,
        page: params.page,
        page_size: params.pageSize,
      },
    });
    return response.data;
  } catch (error) {
    throw toApiError(error, 'Could not load the interaction dataset.');
  }
};

export interface Stats {
  patients: number;
  prescriptions: number;
  warnings: number;
  contraindicated: number;
  /** Pairs no source could answer. Not a count of safe pairs. */
  unscreened_pairs: number;
  dataset_size: number;
  by_severity: { severity: Severity; count: number }[];
}

export const fetchStats = async (): Promise<Stats> => {
  try {
    const response = await api.get<Stats>('/api/stats/');
    return response.data;
  } catch (error) {
    throw toApiError(error, 'Could not load your dashboard figures.');
  }
};

export default api;
