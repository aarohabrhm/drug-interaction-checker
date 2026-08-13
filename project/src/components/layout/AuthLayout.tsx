import { Link } from 'react-router-dom';
import { Logo } from '../common/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Split layout for signing in and signing up.
 *
 * The right panel states what the product actually does rather than selling it,
 * and names the one behaviour that distinguishes it -- reporting what it could
 * not check. On a phone the panel is dropped entirely: it is context, and
 * context should not push the form below the fold.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-10 inline-flex">
            <Logo size={36} withName />
          </Link>

          <h1 className="text-display-lg text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>

      {/* Decorative, so it is not announced and not rendered on small screens. */}
      <div
        aria-hidden
        className="relative hidden overflow-hidden bg-gradient-to-br from-primary-subtle via-primary-subtle to-background lg:block"
      >
        <div className="flex h-full flex-col justify-center px-16">
          <p className="text-label uppercase tracking-wide text-primary">
            Prescribing support
          </p>
          <p className="mt-4 max-w-md text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Screen a prescription against everything the patient already takes —
            before you issue it.
          </p>
          <p className="mt-5 max-w-md text-sm text-muted-foreground">
            Interactions are graded by clinical severity and labelled with where
            each answer came from. When a pair cannot be checked, SafeMeds says
            so rather than reporting it as clear.
          </p>

          <div className="mt-10 flex flex-wrap gap-2">
            {[
              ['Contraindicated', 'bg-sev-contraindicated-bg text-sev-contraindicated'],
              ['Major', 'bg-sev-major-bg text-sev-major'],
              ['Moderate', 'bg-sev-moderate-bg text-sev-moderate'],
              ['Not screened', 'bg-background text-sev-unknown border border-dashed border-sev-unknown-border'],
            ].map(([label, className]) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
