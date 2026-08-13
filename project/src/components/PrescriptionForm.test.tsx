import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionResponse, Patient, Prescription } from '../../utils/api';
import { PrescriptionForm } from './PrescriptionForm';

// The form's only side effects are these two calls. Which of them runs, and
// when, is the behaviour under test: screening must not write anything, and
// writing must only follow a screening of what is actually in the form.
vi.mock('../../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/api')>();
  return {
    ...actual,
    createPrescription: vi.fn(),
    checkPrescriptionInteractions: vi.fn(),
  };
});

const { createPrescription, checkPrescriptionInteractions } = await import(
  '../../utils/api'
);
const mockCreate = vi.mocked(createPrescription);
const mockCheck = vi.mocked(checkPrescriptionInteractions);

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

function checkResult(overrides: Partial<InteractionResponse> = {}): InteractionResponse {
  return {
    interactions: [],
    unscreened_pairs: [],
    screening_complete: true,
    ...overrides,
  };
}

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

async function fillValidPrescription(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole('combobox'), '1');
  await user.type(screen.getByPlaceholderText(/enter diagnosis/i), 'Chest infection');
  await user.type(screen.getByPlaceholderText(/medicine name/i), 'clarithromycin');
  await user.type(screen.getByPlaceholderText(/dosage/i), '500mg');
  await user.type(screen.getByPlaceholderText(/frequency/i), 'BD');
  await user.type(screen.getByPlaceholderText(/duration/i), '7d');
  await user.click(screen.getByRole('button', { name: /add medication/i }));
}

const checkButton = () => screen.getByRole('button', { name: /check interactions/i });
const confirmButton = () => screen.queryByRole('button', { name: /confirm & prescribe/i });

describe('PrescriptionForm', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCheck.mockReset();
  });

  it('disables checking until a patient, diagnosis and medication are present', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(checkButton()).toBeDisabled();
    await fillValidPrescription(user);
    expect(checkButton()).toBeEnabled();
  });

  it('screens without saving anything', async () => {
    // The whole point of the two-step flow: the prescriber sees the warning
    // while they can still act on it.
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(
      checkResult({
        interactions: [
          {
            drug_1: 'clarithromycin',
            drug_2: 'simvastatin',
            interaction_description: 'Rhabdomyolysis risk.',
            severity: 'contraindicated',
            source: 'dataset',
            management_recommendation: 'Suspend the statin.',
          },
        ],
      })
    );

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());

    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));
    expect(mockCheck).toHaveBeenCalledWith(1, ['clarithromycin']);
    // Nothing was written.
    expect(mockCreate).not.toHaveBeenCalled();

    expect(await screen.findByText(/1 interaction found/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing has been saved yet/i)).toBeInTheDocument();
  });

  it('renders the severity of a checked interaction', async () => {
    // Guards the client-side mapping: the check endpoint returns `severity` and
    // `source`, and dropping them would render a contraindication as ungraded.
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(
      checkResult({
        interactions: [
          {
            drug_1: 'clarithromycin',
            drug_2: 'simvastatin',
            interaction_description: 'Rhabdomyolysis risk.',
            severity: 'contraindicated',
            source: 'dataset',
            management_recommendation: '',
          },
        ],
      })
    );

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());

    expect(await screen.findByText('Contraindicated')).toBeInTheDocument();
    expect(screen.getByText('Curated dataset')).toBeInTheDocument();
  });

  it('only offers confirmation after a completed screening', async () => {
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(checkResult());

    renderForm();
    await fillValidPrescription(user);
    expect(confirmButton()).not.toBeInTheDocument();

    await user.click(checkButton());
    await waitFor(() => expect(confirmButton()).toBeInTheDocument());
  });

  it('saves only when the prescriber confirms', async () => {
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(checkResult());
    mockCreate.mockResolvedValue(prescription());

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());
    await waitFor(() => expect(confirmButton()).toBeInTheDocument());

    await user.click(confirmButton()!);

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 1,
        diagnosis: 'Chest infection',
        medications: [expect.objectContaining({ name: 'clarithromycin' })],
      })
    );
    expect(await screen.findByText(/prescription #42 saved/i)).toBeInTheDocument();
  });

  it('discards the screening when the medications change', async () => {
    // The most important behaviour here. Without it a prescriber could screen
    // drug A, swap it for drug B, and confirm against a result that never
    // covered B -- a false all-clear invented by the form.
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(
      checkResult({
        interactions: [
          {
            drug_1: 'clarithromycin',
            drug_2: 'simvastatin',
            interaction_description: 'Rhabdomyolysis risk.',
            severity: 'contraindicated',
            source: 'dataset',
            management_recommendation: '',
          },
        ],
      })
    );

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());
    await waitFor(() => expect(confirmButton()).toBeInTheDocument());

    // Remove the medication that was screened.
    await user.click(screen.getByRole('button', { name: /remove clarithromycin/i }));

    expect(confirmButton()).not.toBeInTheDocument();
    expect(screen.queryByText('Contraindicated')).not.toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('discards the screening when the diagnosis changes', async () => {
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(checkResult());

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());
    await waitFor(() => expect(confirmButton()).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/enter diagnosis/i), ' revised');

    expect(confirmButton()).not.toBeInTheDocument();
  });

  it('does not offer confirmation when the screening failed', async () => {
    // A failed screen is not a screen. Offering to prescribe on the strength of
    // one would present "we could not check" as "nothing found".
    const user = userEvent.setup();
    mockCheck.mockRejectedValue(new Error('Network unreachable.'));

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());

    expect(await screen.findByText(/could not be completed/i)).toBeInTheDocument();
    expect(confirmButton()).not.toBeInTheDocument();
    expect(screen.getByText(/nothing has been screened or saved/i)).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('offers the PDF only once the prescription saved', async () => {
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(checkResult());
    mockCreate.mockResolvedValue(prescription());

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());
    await waitFor(() => expect(confirmButton()).toBeInTheDocument());

    // Screened but not yet saved: nothing to print.
    expect(screen.queryByRole('button', { name: /download pdf/i })).not.toBeInTheDocument();

    await user.click(confirmButton()!);
    expect(
      await screen.findByRole('button', { name: /download pdf/i })
    ).toBeInTheDocument();
  });

  it('does not offer the PDF when saving failed', async () => {
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(checkResult());
    mockCreate.mockRejectedValue(new Error('Network unreachable.'));

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());
    await waitFor(() => expect(confirmButton()).toBeInTheDocument());
    await user.click(confirmButton()!);

    expect(await screen.findByText(/was not saved/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download pdf/i })).not.toBeInTheDocument();
  });

  it('surfaces pairs that could not be screened before prescribing', async () => {
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(
      checkResult({
        unscreened_pairs: [{ drug_1: 'warfarin', drug_2: 'clarithromycin' }],
        screening_complete: false,
      })
    );

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());

    expect(
      await screen.findByText(/1 drug pair could not be screened/i)
    ).toBeInTheDocument();
    // Incomplete is not clean.
    expect(screen.queryByText(/no known interactions found/i)).not.toBeInTheDocument();
  });

  it('surfaces incomplete screening on a saved prescription', async () => {
    const user = userEvent.setup();
    mockCheck.mockResolvedValue(checkResult());
    mockCreate.mockResolvedValue(
      prescription({ unscreened_pair_count: 2, screening_complete: false })
    );

    renderForm();
    await fillValidPrescription(user);
    await user.click(checkButton());
    await waitFor(() => expect(confirmButton()).toBeInTheDocument());
    await user.click(confirmButton()!);

    expect(
      await screen.findByText(/2 drug pairs could not be screened/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/no known interactions found/i)).not.toBeInTheDocument();
  });
});
