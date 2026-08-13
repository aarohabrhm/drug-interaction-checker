import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasetInteraction } from '../../utils/api';
import { Interactions } from './Interactions';

vi.mock('../../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/api')>();
  return { ...actual, fetchInteractions: vi.fn() };
});

const { fetchInteractions } = await import('../../utils/api');
const mockFetch = vi.mocked(fetchInteractions);

function row(overrides: Partial<DatasetInteraction> = {}): DatasetInteraction {
  return {
    id: 1,
    drug_1: 'clarithromycin',
    drug_2: 'simvastatin',
    interaction: 'Rhabdomyolysis risk.',
    severity: 'contraindicated',
    severity_label: 'Contraindicated',
    management_recommendation: 'Suspend the statin.',
    ...overrides,
  };
}

function page(results: DatasetInteraction[], count = results.length) {
  return { count, next: null, previous: null, results };
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Interactions />
    </MemoryRouter>
  );

describe('Interactions', () => {
  beforeEach(() => {
    mockFetch.mockReset().mockResolvedValue(page([row()]));
  });

  it('reports how large the dataset is', async () => {
    // With 191k rows the count is the orienting fact, not a footnote.
    mockFetch.mockResolvedValue(page([row()], 191139));
    renderPage();
    // Formatted with toLocaleString, so the separator depends on the host
    // locale -- compare against the same formatting rather than hardcoding it.
    const formatted = (191139).toLocaleString();
    expect(
      await screen.findByText((content) => content.includes(formatted))
    ).toBeInTheDocument();
  });

  it('filters by grade', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText(/clarithromycin/i);

    await user.click(screen.getByRole('combobox', { name: /filter by grade/i }));
    await user.click(await screen.findByRole('option', { name: 'Major' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ severity: 'major' }))
    );
  });

  it('sends no severity filter when showing all grades', async () => {
    renderPage();
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ severity: undefined }))
    );
  });

  it('opens an entry without leaving the table', async () => {
    // A Sheet, not a route: reading one row should not lose your place in a
    // 191k-row list.
    const user = userEvent.setup();
    renderPage();
    await user.click((await screen.findAllByText(/clarithromycin/i))[0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/rhabdomyolysis risk/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/suspend the statin/i)).toBeInTheDocument();
  });

  it('offers a retry when the dataset fails to load', async () => {
    mockFetch.mockRejectedValue(new Error('Network unreachable.'));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/network unreachable/i)).toBeInTheDocument();
    mockFetch.mockResolvedValue(page([row()]));
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getAllByText(/clarithromycin/i).length).toBeGreaterThan(0));
  });

  it('explains an empty search rather than showing a blank table', async () => {
    mockFetch.mockResolvedValue(page([]));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/search interactions/i), 'zzz');
    expect(await screen.findByText(/nothing matches "zzz"/i)).toBeInTheDocument();
  });
});
