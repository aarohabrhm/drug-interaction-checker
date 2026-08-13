import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ScreeningWarning } from '../../utils/api';
import { bySeverityDescending, severityStyle, sourceStyle } from '../lib/severity';

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
    <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        {count} drug pair{count > 1 ? 's' : ''} could not be screened
      </p>
      {pairs && pairs.length > 0 && (
        <ul className="mt-1 text-xs text-amber-900 list-disc pl-5">
          {pairs.map((pair) => (
            <li key={`${pair.drug_1}-${pair.drug_2}`}>
              {pair.drug_1} + {pair.drug_2}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-amber-900 mt-1">
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
 * is the most dangerous thing a drug-interaction UI can do, and the previous
 * version did exactly that -- any failure surfaced as "No interactions found".
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
      <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-4">
        <p className="flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          Interaction check could not be completed
        </p>
        <p className="text-sm text-amber-900 mt-1">
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
      <div className="border border-green-300 bg-green-50 rounded-lg p-4">
        <p className="flex items-center gap-2 font-medium text-green-900">
          <ShieldCheck className="h-5 w-5" />
          No known interactions found
        </p>
        <p className="text-xs text-green-900/80 mt-1">
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
      <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
        <AlertTriangle className="h-4 w-4" />
        {sorted.length} interaction{sorted.length > 1 ? 's' : ''} found
      </p>

      {/* Shown above the results: the list below is incomplete, and that
          matters more than any individual row in it. */}
      {unscreened > 0 && (
        <PartialCoverageNotice pairs={unscreenedPairs} count={unscreened} />
      )}

      <ul className="space-y-2">
        {sorted.map((warning) => {
          const severity = severityStyle(warning.severity);
          const source = sourceStyle(warning.source);
          return (
            <li
              key={warning.id ?? `${warning.drug_1}-${warning.drug_2}`}
              className={`rounded-lg border border-gray-200 p-3 ${severity.row}`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severity.badge}`}
                >
                  {warning.severity_label || severity.label}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${source.badge}`}>
                  {source.label}
                </span>
                <span className="font-medium text-sm">
                  {warning.drug_1} + {warning.drug_2}
                </span>
              </div>

              <p className="text-sm text-gray-800">{warning.interaction_description}</p>

              {warning.management_recommendation && (
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Management:</strong> {warning.management_recommendation}
                </p>
              )}

              <p className="text-xs text-gray-600 mt-1">{severity.hint}</p>
            </li>
          );
        })}
      </ul>

      {hasUnverified && (
        <p className="text-xs text-purple-900 bg-purple-50 border border-purple-300 rounded-lg p-3">
          <strong>Some results are AI-generated and unverified.</strong> They are
          not from a curated pharmacology source and may be incomplete or wrong.
          Confirm against a clinical reference before acting on them.
        </p>
      )}
    </div>
  );
}
