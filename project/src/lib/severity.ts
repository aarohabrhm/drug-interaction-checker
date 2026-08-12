import type { InteractionSourceId, Severity } from '../../utils/api';

/**
 * Presentation rules for interaction warnings.
 *
 * Centralised so the prescription form and the history page cannot drift apart
 * on something safety-relevant: a "contraindicated" pair must look the same
 * wherever a doctor meets it.
 */

interface SeverityStyle {
  label: string;
  /** Row/badge colours. */
  row: string;
  badge: string;
  /** Short guidance shown next to the grade. */
  hint: string;
}

const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  contraindicated: {
    label: 'Contraindicated',
    row: 'bg-red-100',
    badge: 'bg-red-600 text-white',
    hint: 'Do not co-prescribe.',
  },
  major: {
    label: 'Major',
    row: 'bg-red-50',
    badge: 'bg-red-500 text-white',
    hint: 'Avoid or monitor closely.',
  },
  moderate: {
    label: 'Moderate',
    row: 'bg-amber-50',
    badge: 'bg-amber-500 text-white',
    hint: 'Monitor; may need dose adjustment.',
  },
  minor: {
    label: 'Minor',
    row: 'bg-yellow-50',
    badge: 'bg-yellow-400 text-yellow-900',
    hint: 'Usually manageable.',
  },
  // Deliberately still coloured as a caution. An ungraded interaction is one
  // nobody has ranked -- presenting it in a calm neutral grey would read as
  // "probably fine", which is exactly what it does not mean.
  unknown: {
    label: 'Ungraded',
    row: 'bg-slate-50',
    badge: 'bg-slate-500 text-white',
    hint: 'Severity not graded by the source.',
  },
};

export function severityStyle(severity: Severity | string): SeverityStyle {
  return SEVERITY_STYLES[severity as Severity] ?? SEVERITY_STYLES.unknown;
}

export function severityRank(severity: Severity | string): number {
  const order: Record<string, number> = {
    contraindicated: 4,
    major: 3,
    moderate: 2,
    minor: 1,
    unknown: 0,
  };
  return order[severity] ?? 0;
}

interface SourceStyle {
  label: string;
  badge: string;
  /** True when the doctor must be told this is not curated clinical data. */
  needsCaveat: boolean;
}

const SOURCE_STYLES: Record<InteractionSourceId, SourceStyle> = {
  dataset: {
    label: 'Curated dataset',
    badge: 'bg-blue-100 text-blue-800',
    needsCaveat: false,
  },
  openfda: {
    label: 'openFDA label',
    badge: 'bg-indigo-100 text-indigo-800',
    needsCaveat: false,
  },
  ai_unverified: {
    label: 'AI · unverified',
    badge: 'bg-purple-100 text-purple-900 border border-purple-400',
    needsCaveat: true,
  },
};

export function sourceStyle(source: InteractionSourceId | string): SourceStyle {
  return (
    SOURCE_STYLES[source as InteractionSourceId] ?? {
      label: source || 'Unknown source',
      badge: 'bg-gray-100 text-gray-700',
      needsCaveat: true,
    }
  );
}

/** Most severe first, then alphabetical for a stable order. */
export function bySeverityDescending<T extends { severity: string; drug_1: string }>(
  a: T,
  b: T
): number {
  const diff = severityRank(b.severity) - severityRank(a.severity);
  return diff !== 0 ? diff : a.drug_1.localeCompare(b.drug_1);
}
