import { DashboardShell } from '@/components/layout/dashboard-shell';
import { RouteAccessGuard } from '@/components/auth/route-access-guard';
import { ErrorBoundary } from '@/components/common/error-boundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      <ErrorBoundary fallbackTitle="Module error">
        <RouteAccessGuard>{children}</RouteAccessGuard>
      </ErrorBoundary>
    </DashboardShell>
  );
}
