import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ScreeningWarning } from '../../utils/api';
import { bySeverityDescending, severityStyle, sourceStyle } from '../lib/severity';
import { SeverityBadge, SourceBadge } from './common/SeverityBadge';
import { cn } from '@/lib/utils';

interface InteractionWarningsProps {
  /** Warnings from before prescribing or from a stored prescription -- both
   *  arrive in the same shape, so neither can be presented differently. */
  warnings: ScreeningWarning[];
  /** True when the check could not be run at all. An empty list then means
   *  "unknown", not "clear", and must not be shown as an all-clear. */
  unavailable?: boolean;
  /** Pairs that individually could not be screened. Partial coverage: some
   *  results are trustworthy, some pairs were never looked at. */
  unscreenedPairs?: { drug_1: string; drug_2: string }[];
  /** Count-only variant, for stored prescriptions where the pair names were
   *  not retained. */
  unscreenedCount?: number;
}

function PartialCoverageNotice({
  pairs,
  count,
}: {
  pairs?: { drug_1: string; drug_2: string }[];
  count: number;
}) {
  return (
    <div className="rounded-lg border border-l-4 border-border border-l-sev-unknown-border bg-sev-unknown-bg p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-sev-unknown">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {count} drug pair{count > 1 ? 's' : ''} could not be screened
      </p>
      {pairs && pairs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pairs.map((pair) => (
            <li
              key={`${pair.drug_1}-${pair.drug_2}`}
              className="hatched inline-flex rounded-md border border-dashed border-sev-unknown-border bg-background px-2 py-0.5 text-xs text-sev-unknown"
            >
              {pair.drug_1} + {pair.drug_2}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-sev-unknown/90">
        No source was reachable for {count > 1 ? 'these' : 'this'}. Nothing is
        known about {count > 1 ? 'them' : 'it'} either way — check manually.
      </p>
    </div>
  );
}

/**
 * Renders interaction warnings, most severe first.
 *
 * The important distinction this component enforces: "we checked and found
 * nothing" and "we could not check" look completely different. Conflating them
 * is the most dangerous thing a drug-interaction UI can do.
 */
export function InteractionWarnings({
  warnings,
  unavailable,
  unscreenedPairs,
  unscreenedCount,
}: InteractionWarningsProps) {
  const unscreened = unscreenedCount ?? unscreenedPairs?.length ?? 0;

  if (unavailable) {
    return (
      <div
        className="rounded-lg border border-l-4 border-border border-l-sev-major-border bg-sev-major-bg p-5"
        role="alert"
      >
        <p className="flex items-center gap-2 font-medium text-sev-major">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Interaction check could not be completed
        </p>
        <p className="mt-1.5 text-sm text-foreground/80">
          This is <strong>not</strong> an all-clear. No interaction screening has
          been performed for this prescription — check manually before issuing.
        </p>
      </div>
    );
  }

  if (warnings.length === 0) {
    // Nothing found, but some pairs went unchecked -- that is not a clean
    // result, so it must not get the green treatment.
    if (unscreened > 0) {
      return <PartialCoverageNotice pairs={unscreenedPairs} count={unscreened} />;
    }
    return (
      <div className="rounded-lg border border-l-4 border-border border-l-sev-clear-border bg-sev-clear-bg p-5">
        <p className="flex items-center gap-2 font-medium text-sev-clear">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          No known interactions found
        </p>
        <p className="mt-1.5 text-xs text-sev-clear/90">
          Based on the loaded dataset only. Absence of a warning is not proof of
          safety.
        </p>
      </div>
    );
  }

  const sorted = [...warnings].sort(bySeverityDescending);
  const hasUnverified = sorted.some((w) => sourceStyle(w.source).needsCaveat);

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-sev-major" />
        {sorted.length} interaction{sorted.length > 1 ? 's' : ''} found
      </p>

      {/* Shown above the results: the list below is incomplete, and that
          matters more than any individual row in it. */}
      {unscreened > 0 && (
        <PartialCoverageNotice pairs={unscreenedPairs} count={unscreened} />
      )}

      <ul className="space-y-2.5">
        {sorted.map((warning) => {
          const severity = severityStyle(warning.severity);
          return (
            <li
              key={warning.id ?? `${warning.drug_1}-${warning.drug_2}`}
              className={cn(
                'rounded-lg border border-l-4 border-border bg-card p-4',
                severity.border
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <SeverityBadge
                  severity={warning.severity}
                  label={warning.severity_label}
                  size="sm"
                />
                <SourceBadge source={warning.source} label={warning.source_label} />
                <span className="text-sm font-medium text-foreground">
                  {warning.drug_1} <span className="text-muted-foreground">+</span>{' '}
                  {warning.drug_2}
                </span>
              </div>

              <p className="text-sm text-foreground/85">{warning.interaction_description}</p>

              {warning.management_recommendation && (
                <p className="mt-1.5 text-sm text-foreground/85">
                  <strong className="font-medium">Management:</strong>{' '}
                  {warning.management_recommendation}
                </p>
              )}

              <p className="mt-1.5 text-xs text-muted-foreground">{severity.hint}</p>
            </li>
          );
        })}
      </ul>

      {hasUnverified && (
        <p className="rounded-lg border border-dashed border-sev-unknown-border bg-sev-unknown-bg p-4 text-xs text-sev-unknown">
          <strong className="font-medium">
            Some results are AI-generated and unverified.
          </strong>{' '}
          They are not from a curated pharmacology source and may be incomplete or
          wrong. Confirm against a clinical reference before acting on them.
        </p>
      )}
    </div>
  );
}
