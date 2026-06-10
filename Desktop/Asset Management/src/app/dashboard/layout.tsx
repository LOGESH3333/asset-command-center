import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Route protection is handled by middleware (demo_session cookie).
  return <DashboardShell>{children}</DashboardShell>;
}
