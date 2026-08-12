import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { InteractionWarning } from '../../utils/api';
import { bySeverityDescending, severityStyle, sourceStyle } from '../lib/severity';

interface InteractionWarningsProps {
  warnings: InteractionWarning[];
  /** True when the check could not be completed. An empty list then means
   *  "unknown", not "clear", and must not be shown as an all-clear. */
  unavailable?: boolean;
}

/**
 * Renders interaction warnings, most severe first.
 *
 * The important distinction this component enforces: "we checked and found
 * nothing" and "we could not check" look completely different. Conflating them
 * is the most dangerous thing a drug-interaction UI can do, and the previous
 * version did exactly that -- any failure surfaced as "No interactions found".
 */
export function InteractionWarnings({ warnings, unavailable }: InteractionWarningsProps) {
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
