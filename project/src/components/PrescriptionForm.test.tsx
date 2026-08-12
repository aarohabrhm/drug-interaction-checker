import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Patient, Prescription } from '../../utils/api';
import { PrescriptionForm } from './PrescriptionForm';

// The form's only side effect is this call; stub it so the tests cover the
// component's behaviour rather than the network.
vi.mock('../../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/api')>();
  return { ...actual, createPrescription: vi.fn() };
});

const { createPrescription } = await import('../../utils/api');
const mockCreate = vi.mocked(createPrescription);

const PATIENTS: Patient[] = [
  {
    id: '1',
    name: 'Margaret Hale',
    age: 74,
    registered_date: '2026-01-01T00:00:00Z',
    medical_condition: 'AFib',
    remarks: null,
    phone_number: '5550100001',
    email: 'm@example.com',
    current_medications: 'warfarin',
  },
];

function prescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: 42,
    patient: 1,
    patient_name: 'Margaret Hale',
    prescribed_by_username: 'demodoctor',
    diagnosis: 'AFib',
    notes: '',
    created_at: '2026-01-02T10:00:00Z',
    items: [],
    warnings: [],
    unscreened_pair_count: 0,
    screening_complete: true,
    ...overrides,
  };
}

function renderForm() {
  return render(
    <MemoryRouter>
      <PrescriptionForm patients={PATIENTS} />
    </MemoryRouter>
  );
}

/** Fill the form to the point where it can be submitted. */
async function fillValidPrescription(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole('combobox'), '1');
  await user.type(screen.getByPlaceholderText(/enter diagnosis/i), 'Chest infection');
  await user.type(screen.getByPlaceholderText(/medicine name/i), 'clarithromycin');
  await user.type(screen.getByPlaceholderText(/dosage/i), '500mg');
  await user.type(screen.getByPlaceholderText(/frequency/i), 'BD');
  await user.type(screen.getByPlaceholderText(/duration/i), '7d');
  // The "+" button adds the medication row.
  await user.click(screen.getAllByRole('button')[1]);
}

describe('PrescriptionForm', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('disables submission until a patient, diagnosis and medication are present', async () => {
    const user = userEvent.setup();
    renderForm();

    const submit = screen.getByRole('button', { name: /generate prescription/i });
    expect(submit).toBeDisabled();

    await fillValidPrescription(user);
    expect(submit).toBeEnabled();
  });

  it('submits the medications and renders the returned warnings', async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue(
      prescription({
        warnings: [
          {
            id: 1,
            drug_1: 'clarithromycin',
            drug_2: 'warfarin',
            interaction_description: 'Raises INR.',
            severity: 'major',
            severity_label: 'Major',
            source: 'dataset',
            source_label: 'Curated dataset',
            management_recommendation: 'Monitor INR.',
            checked_at: '2026-01-02T10:00:00Z',
          },
        ],
      })
    );

    renderForm();
    await fillValidPrescription(user);
    await user.click(screen.getByRole('button', { name: /generate prescription/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 1,
        diagnosis: 'Chest infection',
        medications: [expect.objectContaining({ name: 'clarithromycin' })],
      })
    );

    expect(await screen.findByText(/1 interaction found/i)).toBeInTheDocument();
    expect(screen.getByText('Major')).toBeInTheDocument();
    expect(screen.getByText(/prescription #42 saved/i)).toBeInTheDocument();
  });

  it('calls the API exactly once per submission', async () => {
    // Regression: the parent page used to re-run the interaction check from its
    // own submit handler, doubling every request.
    const user = userEvent.setup();
    mockCreate.mockResolvedValue(prescription());

    renderForm();
    await fillValidPrescription(user);
    await user.click(screen.getByRole('button', { name: /generate prescription/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  });

  it('does not offer the PDF when saving failed', async () => {
    // A doctor must not be able to print a prescription that was never stored
    // or screened.
    const user = userEvent.setup();
    mockCreate.mockRejectedValue(new Error('Network unreachable.'));

    renderForm();
    await fillValidPrescription(user);
    await user.click(screen.getByRole('button', { name: /generate prescription/i }));

    expect(await screen.findByText(/could not be completed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /proceed/i })).not.toBeInTheDocument();
    expect(screen.getByText(/was not saved or screened/i)).toBeInTheDocument();
  });

  it('offers the PDF once the prescription saved', async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue(prescription());

    renderForm();
    await fillValidPrescription(user);
    await user.click(screen.getByRole('button', { name: /generate prescription/i }));

    expect(await screen.findByRole('button', { name: /proceed/i })).toBeInTheDocument();
  });

  it('surfaces incomplete screening on a saved prescription', async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue(
      prescription({ unscreened_pair_count: 2, screening_complete: false })
    );

    renderForm();
    await fillValidPrescription(user);
    await user.click(screen.getByRole('button', { name: /generate prescription/i }));

    expect(
      await screen.findByText(/2 drug pairs could not be screened/i)
    ).toBeInTheDocument();
    // Saved, but must not read as a clean bill of health.
    expect(screen.queryByText(/no known interactions found/i)).not.toBeInTheDocument();
  });
});
