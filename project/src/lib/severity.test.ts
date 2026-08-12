import { describe, expect, it } from 'vitest';
import { bySeverityDescending, severityRank, severityStyle, sourceStyle } from './severity';

describe('severityRank', () => {
  it('ranks clinically, not alphabetically', () => {
    // Alphabetical order would be major < minor < moderate, which is wrong.
    expect(severityRank('contraindicated')).toBeGreaterThan(severityRank('major'));
    expect(severityRank('major')).toBeGreaterThan(severityRank('moderate'));
    expect(severityRank('moderate')).toBeGreaterThan(severityRank('minor'));
    expect(severityRank('minor')).toBeGreaterThan(severityRank('unknown'));
  });

  it('treats an unrecognised grade as lowest rather than throwing', () => {
    expect(severityRank('nonsense')).toBe(0);
  });
});

describe('bySeverityDescending', () => {
  it('sorts most dangerous first', () => {
    const rows = [
      { severity: 'minor', drug_1: 'a' },
      { severity: 'contraindicated', drug_1: 'b' },
      { severity: 'moderate', drug_1: 'c' },
      { severity: 'major', drug_1: 'd' },
    ];
    expect([...rows].sort(bySeverityDescending).map((r) => r.severity)).toEqual([
      'contraindicated',
      'major',
      'moderate',
      'minor',
    ]);
  });

  it('breaks ties alphabetically so the order is stable', () => {
    const rows = [
      { severity: 'major', drug_1: 'zinc' },
      { severity: 'major', drug_1: 'aspirin' },
    ];
    expect([...rows].sort(bySeverityDescending).map((r) => r.drug_1)).toEqual([
      'aspirin',
      'zinc',
    ]);
  });
});

describe('severityStyle', () => {
  it('gives every known grade a label and a hint', () => {
    for (const grade of ['contraindicated', 'major', 'moderate', 'minor', 'unknown']) {
      const style = severityStyle(grade);
      expect(style.label).toBeTruthy();
      expect(style.hint).toBeTruthy();
      expect(style.badge).toBeTruthy();
    }
  });

  it('falls back to the ungraded style for an unknown value', () => {
    expect(severityStyle('something-new').label).toBe('Ungraded');
  });

  it('does not present an ungraded interaction as reassuring', () => {
    expect(severityStyle('unknown').hint).toMatch(/not graded/i);
  });
});

describe('sourceStyle', () => {
  it('flags AI output as needing a caveat', () => {
    expect(sourceStyle('ai_unverified').needsCaveat).toBe(true);
  });

  it('does not flag curated sources', () => {
    expect(sourceStyle('dataset').needsCaveat).toBe(false);
    expect(sourceStyle('openfda').needsCaveat).toBe(false);
  });

  it('treats an unrecognised source as untrusted', () => {
    // Fail closed: a source we do not recognise gets the caveat.
    expect(sourceStyle('some-new-source').needsCaveat).toBe(true);
  });
});
