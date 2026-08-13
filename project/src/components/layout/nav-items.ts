import {
  Activity,
  LayoutDashboard,
  ShieldCheck,
  Table2,
  Users,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Primary navigation, shared by the sidebar and the command palette so the two
 * cannot list different destinations.
 *
 * Ordered the way a shift runs: check something, find the patient it was for,
 * look back at what was issued, then the reference data. The dashboard leads
 * because it is the landing point, not because it is the most used screen.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/check', label: 'Interaction checker', icon: ShieldCheck },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/prescriptions', label: 'Prescriptions', icon: Activity },
  { to: '/interactions', label: 'Interaction database', icon: Table2 },
];
