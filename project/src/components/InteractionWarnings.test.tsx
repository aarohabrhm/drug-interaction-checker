import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InteractionWarning } from '../../utils/api';
import { InteractionWarnings } from './InteractionWarnings';

/**
 * These tests guard the most safety-critical rendering in the app: the three
 * outcomes -- "checked and clear", "checked and found something", "could not
 * check" -- must never be presented as each other.
 */

function warning(overrides: Partial<InteractionWarning> = {}): InteractionWarning {
  return {
    id: 1,
    drug_1: 'aspirin',
    drug_2: 'warfarin',
    interaction_description: 'Increased bleeding risk.',
    severity: 'major',
    severity_label: 'Major',
    source: 'dataset',
    source_label: 'Curated dataset',
    management_recommendation: '',
    checked_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('InteractionWarnings', () => {
  describe('the three outcomes are distinguishable', () => {
    it('shows a clear result when nothing was found and everything was screened', () => {
      render(<InteractionWarnings warnings={[]} />);
      expect(screen.getByText(/no known interactions found/i)).toBeInTheDocument();
      // Even a clean result must not overclaim.
      expect(screen.getByText(/not proof of safety/i)).toBeInTheDocument();
    });

    it('does NOT show an all-clear when the check could not run', () => {
      render(<InteractionWarnings warnings={[]} unavailable />);
      expect(screen.queryByText(/no known interactions found/i)).not.toBeInTheDocument();
      expect(screen.getByText(/could not be completed/i)).toBeInTheDocument();
      // "not" sits in its own <strong>, and the default matcher only joins
      // direct text nodes -- so match the surrounding phrase instead.
      expect(screen.getByText(/an all-clear/i)).toBeInTheDocument();
      expect(screen.getByText(/no interaction screening has been performed/i)).toBeInTheDocument();
    });

    it('does NOT show an all-clear when some pairs went unscreened', () => {
      render(
        <InteractionWarnings
          warnings={[]}
          unscreenedPairs={[{ drug_1: 'aspirin', drug_2: 'mysterydrug' }]}
        />
      );
      expect(screen.queryByText(/no known interactions found/i)).not.toBeInTheDocument();
      expect(screen.getByText(/could not be screened/i)).toBeInTheDocument();
      expect(screen.getByText(/aspirin \+ mysterydrug/i)).toBeInTheDocument();
    });

    it('reports partial coverage even when interactions were also found', () => {
      render(
        <InteractionWarnings
          warnings={[warning()]}
          unscreenedPairs={[{ drug_1: 'aspirin', drug_2: 'mysterydrug' }]}
        />
      );
      expect(screen.getByText(/1 interaction found/i)).toBeInTheDocument();
      // The incompleteness matters more than any single row in the list.
      expect(screen.getByText(/1 drug pair could not be screened/i)).toBeInTheDocument();
    });

    it('accepts a count-only unscreened total for stored prescriptions', () => {
      render(<InteractionWarnings warnings={[]} unscreenedCount={3} />);
      expect(screen.getByText(/3 drug pairs could not be screened/i)).toBeInTheDocument();
    });
  });

  describe('severity', () => {
    it('renders warnings most severe first regardless of input order', () => {
      render(
        <InteractionWarnings
          warnings={[
            warning({ id: 1, severity: 'minor', severity_label: 'Minor', drug_1: 'a-minor' }),
            warning({
              id: 2,
              severity: 'contraindicated',
              severity_label: 'Contraindicated',
              drug_1: 'z-contra',
            }),
            warning({ id: 3, severity: 'moderate', severity_label: 'Moderate', drug_1: 'm-mod' }),
          ]}
        />
      );

      const items = screen.getAllByRole('listitem');
      // Alphabetically this order would be reversed -- severity must win.
      expect(within(items[0]).getByText('Contraindicated')).toBeInTheDocument();
      expect(within(items[1]).getByText('Moderate')).toBeInTheDocument();
      expect(within(items[2]).getByText('Minor')).toBeInTheDocument();
    });

    it('shows the management recommendation when the source provides one', () => {
      render(
        <InteractionWarnings
          warnings={[warning({ management_recommendation: 'Monitor INR closely.' })]}
        />
      );
      expect(screen.getByText(/monitor inr closely/i)).toBeInTheDocument();
    });

    it('styles an ungraded severity as a caution, not a neutral note', () => {
      render(
        <InteractionWarnings
          warnings={[warning({ severity: 'unknown', severity_label: 'Ungraded' })]}
        />
      );
      expect(screen.getByText('Ungraded')).toBeInTheDocument();
      expect(screen.getByText(/not graded by the source/i)).toBeInTheDocument();
    });
  });

  describe('provenance', () => {
    it('labels AI-sourced results and adds an explicit caveat', () => {
      render(
        <InteractionWarnings
          warnings={[
            warning({ source: 'ai_unverified', source_label: 'AI · unverified' }),
          ]}
        />
      );
      expect(screen.getByText(/AI · unverified/)).toBeInTheDocument();
      expect(screen.getByText(/not from a curated pharmacology source/i)).toBeInTheDocument();
    });

    it('does not show the AI caveat for curated results', () => {
      render(<InteractionWarnings warnings={[warning({ source: 'dataset' })]} />);
      expect(
        screen.queryByText(/not from a curated pharmacology source/i)
      ).not.toBeInTheDocument();
    });

    it('shows the source badge for openFDA results', () => {
      render(
        <InteractionWarnings
          warnings={[warning({ source: 'openfda', source_label: 'openFDA label' })]}
        />
      );
      expect(screen.getByText(/openFDA label/i)).toBeInTheDocument();
    });
  });
});
