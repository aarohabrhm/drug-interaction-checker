import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { clearAuthToken, fetchDoctorDetails, logoutDoctor } from '../../../utils/api';
import { SidebarNav } from './Sidebar';
import { CommandPalette } from './CommandPalette';

/**
 * Chrome shared by every authenticated screen: sidebar, topbar, command
 * palette. Screens render into the outlet and own nothing above their own
 * heading, so navigation cannot drift between them.
 */
export function AppShell() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [doctor, setDoctor] = useState<{ username: string; specialty: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDoctorDetails()
      .then((data) => {
        if (!cancelled) setDoctor(data);
      })
      // A failed profile fetch must not blank the shell -- the screen inside it
      // still works, and ProtectedRoute already handles an expired token.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutDoctor();
    } finally {
      // Clear locally even if the server call failed, or a network blip would
      // leave someone apparently signed in.
      clearAuthToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const initials = (doctor?.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-background transition-[width] duration-200 lg:block',
          collapsed ? 'w-[72px]' : 'w-[264px]'
        )}
      >
        <SidebarNav collapsed={collapsed} onLogout={handleLogout} />
      </aside>

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[264px]')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          {/* Mobile nav */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[264px] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>

          {/* Opens the palette rather than filtering in place: search here spans
              routes and data, so it needs the dialog's own result grouping. */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-[420px] items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search or jump to…</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-surface"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-[13px] font-semibold text-primary">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-medium leading-tight">
                      {doctor?.username ?? '—'}
                    </span>
                    <span className="block text-xs leading-tight text-muted-foreground">
                      {doctor?.specialty || 'Clinician'}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal text-muted-foreground">
                  Signed in as {doctor?.username ?? '—'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/settings')}>Settings</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void handleLogout()}
                  className="text-destructive focus:text-destructive"
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onLogout={handleLogout} />
    </div>
  );
}
