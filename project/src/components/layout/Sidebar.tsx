import { NavLink } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import { Logo } from '../common/Logo';

interface SidebarNavProps {
  /** Icon-only rail. Labels are still announced to screen readers. */
  collapsed?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}

/**
 * Navigation, on a dark ground.
 *
 * The sidebar anchors the page and carries the blue theme, so the content area
 * can stay white and let the clinical colours do the talking. It also suits the
 * mark, which is drawn in light blue and barely registers on white.
 */
export function SidebarNav({ collapsed = false, onNavigate, onLogout }: SidebarNavProps) {
  const item = (isActive: boolean) =>
    cn(
      'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
      isActive
        ? 'bg-primary font-medium text-primary-foreground'
        : 'text-sidebar-foreground hover:bg-white/[0.06] hover:text-white',
      collapsed && 'justify-center px-0'
    );

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center px-5',
          collapsed && 'justify-center px-0'
        )}
      >
        <Logo size={30} withName={!collapsed} className="text-white" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3" aria-label="Main">
        {!collapsed && (
          <p className="px-3 pb-2 text-label font-mono uppercase text-sidebar-muted">
            Clinical
          </p>
        )}
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) => item(isActive)}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-sidebar-border px-3 py-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) => item(isActive)}
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
            // should not sit there shouting all day.
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-white/[0.06] hover:text-white',
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
