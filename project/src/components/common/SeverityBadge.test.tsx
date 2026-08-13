import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeverityBadge, SourceBadge } from './SeverityBadge';

describe('SeverityBadge', () => {
  it('names every grade in text, not only in colour', () => {
    // The accessibility floor for this component. Colour alone fails for a
    // colour-blind reader, in print, and on a washed-out screen -- and this is
    // a medical tool.
    const grades = [
      ['contraindicated', 'Contraindicated'],
      ['major', 'Major'],
      ['moderate', 'Moderate'],
      ['minor', 'Minor'],
      ['unknown', 'Ungraded'],
    ] as const;

    for (const [grade, label] of grades) {
      const { unmount } = render(<SeverityBadge severity={grade} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders an icon alongside the label', () => {
    const { container } = render(<SeverityBadge severity="major" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('distinguishes "checked and clear" from "could not check"', () => {
    // These two must never be presented as one another; it is the distinction
    // the whole screening layer exists to preserve.
    const { unmount } = render(<SeverityBadge severity="clear" />);
    expect(screen.getByText('No known interaction')).toBeInTheDocument();
    unmount();

    render(<SeverityBadge severity="unscreened" />);
    expect(screen.getByText('Not screened')).toBeInTheDocument();
  });

  it('prefers a server-supplied label when there is one', () => {
    render(<SeverityBadge severity="major" label="Major (DDInter)" />);
    expect(screen.getByText('Major (DDInter)')).toBeInTheDocument();
  });

  it('falls back to ungraded for an unrecognised grade', () => {
    render(<SeverityBadge severity="something-new" />);
    expect(screen.getByText('Ungraded')).toBeInTheDocument();
  });
});

describe('SourceBadge', () => {
  it('labels curated and AI provenance differently', () => {
    const { unmount } = render(<SourceBadge source="dataset" />);
    expect(screen.getByText('Curated dataset')).toBeInTheDocument();
    unmount();

    render(<SourceBadge source="ai_unverified" />);
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });

  it('shows an unrecognised source rather than hiding it', () => {
    render(<SourceBadge source="some-new-source" />);
    expect(screen.getByText('some-new-source')).toBeInTheDocument();
  });
});
