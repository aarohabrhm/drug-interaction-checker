import { NavLink } from 'react-router-dom';
import { LogOut, Settings, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

interface SidebarNavProps {
  /** Icon-only rail. Labels are still announced to screen readers. */
  collapsed?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate, onLogout }: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex items-center gap-2.5 px-5 h-16 shrink-0',
          collapsed && 'justify-center px-0'
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-[18px] w-[18px]" />
        </span>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-[-0.01em]">SafeMeds</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                // The 3px left indicator is drawn with a pseudo-element rather
                // than a border so the text does not shift when it appears.
                'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                'before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary before:opacity-0',
                isActive
                  ? 'bg-primary-subtle font-medium text-primary before:opacity-100'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                collapsed && 'justify-center px-0'
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border px-3 py-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary-subtle font-medium text-primary'
                : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              collapsed && 'justify-center px-0'
            )
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          <span className={cn(collapsed && 'sr-only')}>Settings</span>
        </NavLink>

        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Log out' : undefined}
          className={cn(
            // Muted until hover: signing out is a destructive-ish action, but it
            // should not sit there shouting in red all day.
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className={cn(collapsed && 'sr-only')}>Log out</span>
        </button>
      </div>
    </div>
  );
}
