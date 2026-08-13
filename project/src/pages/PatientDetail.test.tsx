import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionWarning, Patient, Prescription } from '../../utils/api';
import { PatientDetail } from './PatientDetail';

vi.mock('../../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/api')>();
  return {
    ...actual,
    fetchPatient: vi.fn(),
    fetchPrescriptions: vi.fn(),
    fetchPatientInteractionHistory: vi.fn(),
  };
});

const { fetchPatient, fetchPrescriptions, fetchPatientInteractionHistory } = await import(
  '../../utils/api'
);
const mockPatient = vi.mocked(fetchPatient);
const mockPrescriptions = vi.mocked(fetchPrescriptions);
const mockHistory = vi.mocked(fetchPatientInteractionHistory);

const PATIENT: Patient = {
  id: '7',
  name: 'Margaret Hale',
  age: 74,
  registered_date: '2026-01-01T00:00:00Z',
  medical_condition: 'Atrial fibrillation',
  remarks: null,
  phone_number: '5550100001',
  email: 'm@example.com',
  current_medications: 'Coumadin, Zocor, metformin',
};

function warning(overrides: Partial<InteractionWarning> = {}): InteractionWarning {
  return {
    id: 1,
    drug_1: 'clarithromycin',
    drug_2: 'zocor',
    interaction_description: 'Rhabdomyolysis risk.',
    severity: 'contraindicated',
    severity_label: 'Contraindicated',
    source: 'dataset',
    source_label: 'Curated dataset',
    management_recommendation: 'Suspend the statin.',
    checked_at: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

function prescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: 4,
    patient: 7,
    patient_name: 'Margaret Hale',
    prescribed_by_username: 'demodoctor',
    diagnosis: 'Chest infection',
    notes: '',
    created_at: '2026-02-01T10:00:00Z',
    items: [{ id: 1, drug_name: 'clarithromycin', dosage: '500mg', frequency: 'BD', duration: '7d' }],
    warnings: [],
    unscreened_pair_count: 0,
    screening_complete: true,
    ...overrides,
  };
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/patients/7']}>
      <Routes>
        <Route path="/patients/:patientId" element={<PatientDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PatientDetail', () => {
  beforeEach(() => {
    mockPatient.mockReset().mockResolvedValue(PATIENT);
    mockPrescriptions.mockReset().mockResolvedValue({
      prescriptions: [prescription()],
      count: 1,
      hasNext: false,
    });
    mockHistory.mockReset().mockResolvedValue([warning()]);
  });

  it('lists the medications screening compares against', async () => {
    renderDetail();
    expect(await screen.findByText('Coumadin')).toBeInTheDocument();
    expect(screen.getByText('Zocor')).toBeInTheDocument();
    expect(screen.getByText('metformin')).toBeInTheDocument();
  });

  it('says so when a patient has no medications recorded', async () => {
    // An empty list means every screening comes back clear by default, which is
    // worth stating rather than leaving as a blank panel.
    mockPatient.mockResolvedValue({ ...PATIENT, current_medications: '' });
    renderDetail();
    expect(await screen.findByText(/nothing to compare against/i)).toBeInTheDocument();
  });

  it('surfaces the warning history', async () => {
    // The endpoint existed and was tested for a long time with nothing calling
    // it; this screen is what finally reads it back.
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole('tab', { name: /warning history/i }));

    // DataTable renders each row twice on purpose -- a table for wide screens
    // and cards for narrow -- so every row assertion here counts both.
    await waitFor(() =>
      expect(screen.getAllByText(/clarithromycin/i).length).toBeGreaterThan(0)
    );
    expect(mockHistory).toHaveBeenCalledWith('7');
  });

  it('summarises a prescription that could not be fully screened', async () => {
    // "Two pairs unscreened" must not render like "clear".
    mockPrescriptions.mockResolvedValue({
      prescriptions: [prescription({ unscreened_pair_count: 2, screening_complete: false })],
      count: 1,
      hasNext: false,
    });
    renderDetail();
    expect((await screen.findAllByText(/2 not screened/i)).length).toBe(2);
    expect(screen.queryAllByText(/^Clear$/)).toHaveLength(0);
  });

  it('marks a fully screened prescription as clear', async () => {
    renderDetail();
    expect((await screen.findAllByText('Clear')).length).toBe(2);
  });

  it('reports the worst grade of a prescription that raised warnings', async () => {
    mockPrescriptions.mockResolvedValue({
      prescriptions: [
        prescription({
          warnings: [
            warning({ id: 2, severity: 'minor', severity_label: 'Minor' }),
            warning({ id: 3, severity: 'contraindicated', severity_label: 'Contraindicated' }),
          ],
        }),
      ],
      count: 1,
      hasNext: false,
    });
    renderDetail();
    // The most dangerous grade is the one that belongs in a summary.
    expect((await screen.findAllByText('Contraindicated')).length).toBe(2);
    expect(screen.queryAllByText('Minor')).toHaveLength(0);
  });

  it('offers a retry when the patient fails to load', async () => {
    mockPatient.mockRejectedValue(new Error('Network unreachable.'));
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText(/network unreachable/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(mockPatient).toHaveBeenCalledTimes(2));
  });
});
