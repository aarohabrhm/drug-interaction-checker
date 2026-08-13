import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toast host.
 *
 * The generated wrapper reads the active theme from `next-themes`. This app has
 * no theme provider -- dark mode is a `.dark` class on the root and light is
 * what ships -- so the toasts are styled from our own tokens instead, which
 * also keeps them consistent with the rest of the surface treatment.
 */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-card group-[.toaster]:rounded-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error:
            'group-[.toaster]:border-sev-contraindicated-border group-[.toaster]:text-sev-contraindicated',
          success:
            'group-[.toaster]:border-sev-clear-border group-[.toaster]:text-sev-clear',
        },
      }}
      {...props}
    />
  );
}
