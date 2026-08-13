import {
  AlertCircle,
  AlertTriangle,
  Ban,
  HelpCircle,
  Info,
  ShieldCheck,
} from 'lucide-react';
import type { InteractionSourceId, Severity } from '../../utils/api';

/**
 * Presentation rules for interaction warnings.
 *
 * Centralised so the checker, the prescription record and the history page
 * cannot drift apart on something safety-relevant: a "contraindicated" pair
 * must look the same wherever a doctor meets it.
 *
 * Severity is never encoded by colour alone. Every entry carries a label and an
 * icon, because colour fails for a colour-blind reader, in print, and on a bad
 * screen at 3am -- and this is a medical tool.
 */

type IconComponent = React.ComponentType<{ className?: string }>;

interface SeverityStyle {
  label: string;
  /** Tinted row/panel background. */
  row: string;
  /** Badge: tinted background, saturated text. */
  badge: string;
  /** Saturated left border, for panels and cards. */
  border: string;
  /** Solid fill for the coverage matrix, where cells are too small for text. */
  cell: string;
  icon: IconComponent;
  /** Short guidance shown next to the grade. */
  hint: string;
}

const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  contraindicated: {
    label: 'Contraindicated',
    row: 'bg-sev-contraindicated-bg',
    badge: 'bg-sev-contraindicated-bg text-sev-contraindicated',
    border: 'border-l-sev-contraindicated-border',
    cell: 'bg-sev-contraindicated-border text-white',
    icon: Ban,
    hint: 'Do not co-prescribe.',
  },
  major: {
    label: 'Major',
    row: 'bg-sev-major-bg',
    badge: 'bg-sev-major-bg text-sev-major',
    border: 'border-l-sev-major-border',
    cell: 'bg-sev-major-border text-white',
    icon: AlertTriangle,
    hint: 'Avoid or monitor closely.',
  },
  moderate: {
    label: 'Moderate',
    row: 'bg-sev-moderate-bg',
    badge: 'bg-sev-moderate-bg text-sev-moderate',
    border: 'border-l-sev-moderate-border',
    cell: 'bg-sev-moderate-border text-white',
    icon: AlertCircle,
    hint: 'Monitor; may need dose adjustment.',
  },
  minor: {
    label: 'Minor',
    row: 'bg-sev-minor-bg',
    badge: 'bg-sev-minor-bg text-sev-minor',
    border: 'border-l-sev-minor-border',
    cell: 'bg-sev-minor-border text-white',
    icon: Info,
    hint: 'Usually manageable.',
  },
  // Deliberately still a caution. An ungraded interaction is one nobody has
  // ranked -- presenting it in a calm neutral grey would read as "probably
  // fine", which is exactly what it does not mean. Green is reserved for
  // "checked and found nothing".
  unknown: {
    label: 'Ungraded',
    row: 'bg-sev-unknown-bg',
    badge: 'bg-sev-unknown-bg text-sev-unknown',
    border: 'border-l-sev-unknown-border',
    cell: 'bg-sev-unknown-border text-white',
    icon: HelpCircle,
    hint: 'Severity not graded by the source.',
  },
};

/** Checked, and nothing found. The only place green is allowed. */
export const CLEAR_STYLE = {
  label: 'No known interaction',
  row: 'bg-sev-clear-bg',
  badge: 'bg-sev-clear-bg text-sev-clear',
  border: 'border-l-sev-clear-border',
  cell: 'bg-sev-clear-bg text-sev-clear',
  icon: ShieldCheck as IconComponent,
  hint: 'Checked against the loaded sources.',
};

/**
 * Could not be checked at all.
 *
 * Not a severity -- it is the absence of an answer, and it must never render
 * like one. Hatched rather than filled, so an unscreened cell cannot be mistaken
 * for a clear one at a glance.
 */
export const UNSCREENED_STYLE = {
  label: 'Not screened',
  row: 'bg-sev-unknown-bg',
  badge: 'bg-background text-sev-unknown border border-dashed border-sev-unknown-border',
  border: 'border-l-sev-unknown-border',
  cell: 'hatched bg-background text-sev-unknown border border-dashed border-sev-unknown-border',
  icon: HelpCircle as IconComponent,
  hint: 'No source could answer for this pair.',
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
    badge: 'bg-primary-subtle text-primary',
    needsCaveat: false,
  },
  openfda: {
    label: 'openFDA label',
    badge: 'bg-accent/10 text-accent',
    needsCaveat: false,
  },
  ai_unverified: {
    label: 'AI · unverified',
    // The only badge with a border. Provenance from a model must not be able to
    // pass for provenance from a pharmacology source at a glance.
    badge: 'bg-background text-sev-unknown border border-dashed border-sev-unknown-border',
    needsCaveat: true,
  },
};

export function sourceStyle(source: InteractionSourceId | string): SourceStyle {
  return (
    SOURCE_STYLES[source as InteractionSourceId] ?? {
      label: source || 'Unknown source',
      // Fail closed: an unrecognised source is treated as untrusted.
      badge: 'bg-background text-muted-foreground border border-dashed border-border',
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
