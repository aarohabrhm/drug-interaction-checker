import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverageMatrix } from './CoverageMatrix';
import type { ScreeningWarning } from '../../../utils/api';

const warning = (
  drug_1: string,
  drug_2: string,
  severity: ScreeningWarning['severity']
): ScreeningWarning => ({
  drug_1,
  drug_2,
  interaction_description: 'x',
  severity,
  source: 'dataset',
  management_recommendation: '',
});

function renderMatrix(props: Partial<React.ComponentProps<typeof CoverageMatrix>> = {}) {
  return render(
    <CoverageMatrix
      newMedications={['clarithromycin']}
      currentMedications={['simvastatin', 'metformin']}
      warnings={[]}
      unscreenedPairs={[]}
      {...props}
    />
  );
}

describe('CoverageMatrix', () => {
  it('renders one cell per pair', () => {
    renderMatrix({ newMedications: ['a', 'b'], currentMedications: ['x', 'y', 'z'] });
    // 2 x 3 pairs, plus the five legend swatches.
    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.getByText(/6 pairs/i)).toBeInTheDocument();
  });

  it('names each cell in its accessible label rather than by colour', () => {
    // The cell itself is a coloured square; without this a screen reader gets
    // nothing at all.
    renderMatrix({ warnings: [warning('clarithromycin', 'simvastatin', 'contraindicated')] });
    expect(
      screen.getByRole('button', { name: /clarithromycin with simvastatin: contraindicated/i })
    ).toBeInTheDocument();
  });

  it('matches a pair regardless of which way round it is reported', () => {
    // The API returns whichever order the pair was stored in; the grid has a
    // fixed orientation.
    renderMatrix({ warnings: [warning('Simvastatin', 'Clarithromycin', 'major')] });
    expect(
      screen.getByRole('button', { name: /clarithromycin with simvastatin: major/i })
    ).toBeInTheDocument();
  });

  it('shows an unscreened pair as unscreened, never as clear', () => {
    // The distinction the whole grid exists for.
    renderMatrix({
      unscreenedPairs: [{ drug_1: 'clarithromycin', drug_2: 'metformin' }],
    });
    expect(
      screen.getByRole('button', { name: /clarithromycin with metformin: not screened/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /clarithromycin with simvastatin: no known interaction/i })
    ).toBeInTheDocument();
  });

  it('treats a pair that produced a warning as screened', () => {
    // A pair can appear in both lists if the server reported it twice; a
    // finding is proof it was looked at.
    renderMatrix({
      warnings: [warning('clarithromycin', 'simvastatin', 'major')],
      unscreenedPairs: [{ drug_1: 'clarithromycin', drug_2: 'simvastatin' }],
    });
    expect(
      screen.getByRole('button', { name: /clarithromycin with simvastatin: major/i })
    ).toBeInTheDocument();
  });

  it('renders nothing when there is no pairing to show', () => {
    const { container } = renderMatrix({ currentMedications: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
