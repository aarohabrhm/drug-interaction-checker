import { Link } from 'react-router-dom';
import { ArrowRight, Ban, HelpCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '../components/common/Logo';
import { useDocumentMeta } from '../lib/useDocumentMeta';


const SCREENING = [
  {
    a: 'clarithromycin',
    b: 'simvastatin',
    grade: 'Contraindicated',
    note: 'CYP3A4 inhibition — rhabdomyolysis risk',
    tone: 'text-sev-contraindicated',
    rule: 'bg-sev-contraindicated-border',
    icon: Ban,
  },
  {
    a: 'clarithromycin',
    b: 'warfarin',
    grade: 'Ungraded',
    note: 'In the label, with no severity assigned',
    tone: 'text-sev-unknown',
    rule: 'bg-sev-unknown-border',
    icon: HelpCircle,
  },
  {
    a: 'clarithromycin',
    b: 'metformin',
    grade: 'No known interaction',
    note: 'Checked against every source',
    tone: 'text-sev-clear',
    rule: 'bg-sev-clear-border',
    icon: ShieldCheck,
  },
];

/** Ordered because a check genuinely happens in this order. */
const STEPS: [string, string][] = [
  [
    'Choose the patient',
    'Their current medications load with them — including anything you have prescribed before.',
  ],
  [
    'Add what you intend to prescribe',
    'Names autocomplete from the interaction dataset, so a typo does not become a blind spot.',
  ],
  [
    'Every pair is compared',
    'Each new medicine against everything they already take. Brand names resolve to their ingredient first.',
  ],
  [
    'Each pair resolves, or does not',
    'Curated data, then drug labels. If nothing can answer, the pair is marked — never quietly dropped.',
  ],
  [
    'Review, then confirm',
    'Nothing is written until you say so, and the record keeps the warnings exactly as you saw them.',
  ],
];

const SOURCES: [string, string][] = [
  ['Curated dataset', 'Severity-graded pairs. The only source that can say how serious something is.'],
  ['openFDA drug labels', 'Prescribing information, free text, no grading. Shown as ungraded.'],
  ['RxNorm', 'Resolves brand names to their active ingredient, so Coumadin matches warfarin.'],
  ['AI fallback', 'Off unless configured, and always labelled unverified when it is on.'],
];

export default function Landing() {
  useDocumentMeta('SafeMeds | Drug interaction screening for prescribers');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo size={30} withName />
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-start lg:gap-16">
            <div>
              <p className="text-label font-mono uppercase text-muted-foreground">
                Drug interaction screening
              </p>
              <h1 className="mt-6 max-w-[15ch] text-display-xl text-foreground">
                Screen every pair before you prescribe.
              </h1>
              <p className="mt-7 max-w-md text-[17px] leading-relaxed text-muted-foreground">
                SafeMeds checks what you are about to prescribe against everything
                your patient already takes, grades what it finds, and marks what it
                could not answer.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Create account
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>

            {/* The signature: a screening resolving pair by pair on load. */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
                <p className="text-label font-mono uppercase text-muted-foreground">
                  Screening
                </p>
                <p className="tabular font-mono text-xs text-muted-foreground">3 pairs</p>
              </div>

              <ul>
                {SCREENING.map((row, index) => {
                  const Icon = row.icon;
                  return (
                    <li
                      key={row.b}
                      className="settle flex items-start gap-4 border-b border-border px-5 py-4 last:border-0"
                      style={{ animationDelay: `${180 + index * 190}ms` }}
                    >
                      <span
                        aria-hidden
                        className={`mt-1 h-8 w-[3px] shrink-0 rounded-full ${row.rule}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[13px] text-foreground">
                          {row.a} <span className="text-muted-foreground">+</span> {row.b}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
                      </div>
                      <span
                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium ${row.tone}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {row.grade}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ------------------------------------------------------- the steps */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-label font-mono uppercase text-muted-foreground">
                How a check runs
              </p>
              <h2 className="mt-5 text-display-lg text-foreground">
                Five steps, in this order.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                The order is the point. Screening happens before anything is written,
                so a contraindication reaches you while you can still act on it.
              </p>
            </div>

            {/* Numbered because this is genuinely a sequence: each step depends
                on the one before it. */}
            <ol className="border-t border-border">
              {STEPS.map(([title, body], index) => (
                <li key={title} className="flex gap-6 border-b border-border py-6 sm:gap-8">
                  <span className="tabular shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-section text-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ------------------------------------------------------ provenance */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-label font-mono uppercase text-muted-foreground">
                Behind the answers
              </p>
              <h2 className="mt-5 text-display-lg text-foreground">
                Every warning says where it came from.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                A graded entry from a curated dataset and a sentence lifted from a
                drug label are not the same kind of evidence, so SafeMeds never
                prints them the same way. Anything generated rather than sourced is
                marked unverified, every time it appears.
              </p>
            </div>

            <dl className="border-t border-border">
              {SOURCES.map(([term, detail]) => (
                <div key={term} className="border-b border-border py-5">
                  <dt className="font-mono text-[13px] text-foreground">{term}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* -------------------------------------------------------------- cta */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-xl">
            <h2 className="text-display-lg text-foreground">Run your first screening.</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
              Add a patient with their current medications, then check what you plan
              to prescribe against them. It takes about a minute.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link to="/signup">
                Create account
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <Logo size={28} withName />
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            SafeMeds is a demonstration project. It supports clinical judgement and
            does not replace it, and it is not a substitute for a pharmacist or a
            maintained commercial interaction database.
          </p>
        </div>
      </footer>
    </div>
  );
}
