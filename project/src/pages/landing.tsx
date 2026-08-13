import { Link } from 'react-router-dom';
import { ArrowRight, Ban, HelpCircle, Layers, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/**
 * The hero is a worked example rather than a claim.
 *
 * Showing one real screening -- a contraindication, an ungraded finding, and a
 * pair nothing could answer -- says what the product does in less space than a
 * paragraph about it would, and demonstrates the one behaviour that
 * distinguishes it.
 */
const EXAMPLE = [
  {
    pair: 'clarithromycin + simvastatin',
    label: 'Contraindicated',
    detail: 'Strong CYP3A4 inhibition; risk of rhabdomyolysis.',
    className: 'border-l-sev-contraindicated-border bg-sev-contraindicated-bg',
    text: 'text-sev-contraindicated',
    icon: Ban,
  },
  {
    pair: 'clarithromycin + warfarin',
    label: 'Ungraded',
    detail: 'Reported in labelling, with no severity assigned by the source.',
    className: 'border-l-sev-unknown-border bg-sev-unknown-bg',
    text: 'text-sev-unknown',
    icon: HelpCircle,
  },
  {
    pair: 'clarithromycin + metformin',
    label: 'No known interaction',
    detail: 'Checked against the loaded sources.',
    className: 'border-l-sev-clear-border bg-sev-clear-bg',
    text: 'text-sev-clear',
    icon: ShieldCheck,
  },
];

export default function Landing() {
  useDocumentMeta('SafeMeds | Drug interaction checking for prescribers');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">SafeMeds</span>
          </span>
          <nav className="flex items-center gap-2">
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
        <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-label uppercase tracking-wide text-primary">
                Prescribing support
              </p>
              <h1 className="mt-4 text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[52px]">
                Check the interaction before you write the script.
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground">
                SafeMeds screens what you intend to prescribe against everything the
                patient already takes, grades what it finds by clinical severity, and
                tells you plainly when it could not check something.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Get started
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>

            {/* One screening, as the app renders it. */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-card">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <p className="text-section">Screening result</p>
                <p className="tabular text-xs text-muted-foreground">3 pairs</p>
              </div>
              <ul className="space-y-2.5">
                {EXAMPLE.map((row) => {
                  const Icon = row.icon;
                  return (
                    <li
                      key={row.pair}
                      className={`rounded-lg border border-l-4 border-border p-3.5 ${row.className}`}
                    >
                      <p className={`flex items-center gap-1.5 text-xs font-medium ${row.text}`}>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {row.label}
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-foreground">{row.pair}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
            {[
              {
                icon: Layers,
                title: 'Graded, with provenance',
                body: 'Every warning states its severity and where the statement came from. An AI-generated answer is never presented as curated pharmacology.',
              },
              {
                icon: HelpCircle,
                title: 'Honest about gaps',
                body: 'A pair no source could answer is reported as unchecked, never folded into the ones that came back clear.',
              },
              {
                icon: ShieldCheck,
                title: 'Nothing saved early',
                body: 'Screening runs before the prescription is written, so a contraindication arrives while you can still act on it.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="grid h-9 w-9 place-items-center rounded-md bg-primary-subtle text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <h2 className="mt-4 text-section">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-display text-foreground">Screen your first prescription</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Create an account, add a patient with their current medications, and check
            what you intend to prescribe against them.
          </p>
          <Button size="lg" className="mt-7" asChild>
            <Link to="/signup">
              Create account
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-xs text-muted-foreground">
            A demonstration project. Not a certified clinical tool, and not a substitute
            for a pharmacist or a maintained interaction database.
          </p>
        </div>
      </footer>
    </div>
  );
}
