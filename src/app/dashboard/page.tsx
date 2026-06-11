'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getDashboardMetricsAction } from '@/app/actions/dashboard';
import { DashboardHero } from '@/components/dashboard/dashboard-hero';
import { PremiumKpiCard } from '@/components/dashboard/premium-kpi-card';
import { OperationsOverview } from '@/components/dashboard/operations-overview';
import {
  AssetHealthTrendChart,
  MaintenanceCostTrendChart,
  AssetDistributionChart,
  VendorPerformanceChart,
  AllocationTrendChart,
  RequestStatusChart,
} from '@/components/dashboard/dashboard-charts';
import { DashboardActivityFeed } from '@/components/dashboard/activity-feed';
import { QuickActionsPanel } from '@/components/dashboard/quick-actions';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { ProcurementSnapshot } from '@/components/dashboard/procurement-snapshot';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { AmbientBackground } from '@/components/dashboard/ambient-background';
import { DashboardLoadingSkeleton } from '@/components/dashboard/dashboard-loading';
import { SectionHeading } from '@/components/dashboard/section-heading';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import {
  Package,
  DollarSign,
  Activity,
  FileText,
  ShoppingCart,
  ShieldAlert,
  BarChart3,
  GitBranch,
  Radio,
  Zap,
} from 'lucide-react';

function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 12 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function computeHealthScore(available: number, allocated: number, maintenance: number, total: number) {
  if (total === 0) return 0;
  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (available / total) * 40 + (allocated / total) * 35 + Math.max(0, 1 - maintenance / total) * 25
      )
    )
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    allocated: 0,
    maintenance: 0,
    assetValue: 0,
    pendingRequests: 0,
    warrantyAlerts: 0,
    maintenanceDue: 0,
    healthScore: 0,
    procurementPipeline: 0,
    openProcurements: 0,
    purchaseOrders: 0,
    expectedDeliveries: 0,
    pendingApprovals: 0,
    pendingFinanceApprovals: 0,
    approvedRequests: 0,
    purchasingRequests: 0,
    receivedRequests: 0,
    fulfilledRequests: 0,
    purchasedCount: 0,
  });

  const [growthTrend, setGrowthTrend] = useState<{ month: string; total: number }[]>([]);
  const [healthTrend, setHealthTrend] = useState<{ month: string; score: number }[]>([]);
  const [allocationTrend, setAllocationTrend] = useState<{ month: string; allocated: number; available: number }[]>([]);
  const [maintenanceCostData, setMaintenanceCostData] = useState<{ month: string; cost: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [vendorData, setVendorData] = useState<{ vendor: string; assets: number }[]>([]);
  const [requestStatusData, setRequestStatusData] = useState<{ status: string; count: number }[]>([]);
  const [kpiSparklines, setKpiSparklines] = useState<Record<string, number[]>>({});

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const result = await getDashboardMetricsAction();
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.stats) setStats(result.stats);
        if (result.requestStatusData) setRequestStatusData(result.requestStatusData);
        if (result.growthTrend) setGrowthTrend(result.growthTrend);
        if (result.healthTrend) setHealthTrend(result.healthTrend);
        if (result.allocationTrend) setAllocationTrend(result.allocationTrend);
        if (result.maintenanceCostData) setMaintenanceCostData(result.maintenanceCostData);
        if (result.categoryData) setCategoryData(result.categoryData);
        if (result.vendorData) setVendorData(result.vendorData);
        if (result.kpiSparklines) setKpiSparklines(result.kpiSparklines);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const prevTotal = growthTrend.length >= 2 ? growthTrend[growthTrend.length - 2].total : 0;
  const currTotal = growthTrend.length ? growthTrend[growthTrend.length - 1].total : stats.total;

  const criticalAlerts =
    stats.warrantyAlerts + stats.maintenanceDue + stats.pendingApprovals + stats.pendingRequests;

  const topVendor = vendorData[0] ?? { vendor: 'No vendors', assets: 0 };

  const alerts = useMemo(
    () => [
      {
        id: 'warranty',
        label: 'Warranty Expiring',
        count: stats.warrantyAlerts,
        href: '/dashboard/assets',
        severity: 'warning' as const,
      },
      {
        id: 'maintenance',
        label: 'Assets in Maintenance',
        count: stats.maintenance,
        href: '/dashboard/maintenance',
        severity: 'info' as const,
      },
      {
        id: 'overdue',
        label: 'Overdue Requests',
        count: stats.pendingRequests,
        href: '/dashboard/requests',
        severity: 'critical' as const,
      },
      {
        id: 'approvals',
        label: 'Pending Approvals',
        count: stats.pendingApprovals,
        href: '/dashboard/approvals',
        severity: 'warning' as const,
      },
      {
        id: 'finance',
        label: 'Finance Approval Queue',
        count: stats.pendingFinanceApprovals,
        href: '/dashboard/approvals?stage=Finance',
        severity: 'critical' as const,
      },
    ],
    [stats]
  );

  const heroStats = {
    activeAssets: stats.available + stats.allocated,
    maintenanceAssets: stats.maintenance,
    pendingRequests: stats.pendingRequests,
    procurementPipeline: stats.procurementPipeline,
    alertsCount: criticalAlerts,
  };

  const pipeline = {
    requested: stats.pendingRequests,
    approved: stats.approvedRequests + stats.purchasingRequests + stats.receivedRequests + stats.fulfilledRequests,
    procurement: stats.openProcurements,
    purchased: stats.purchasedCount + stats.receivedRequests,
    allocated: stats.fulfilledRequests > 0 ? stats.fulfilledRequests : stats.allocated,
  };

  const lifecycle = {
    available: stats.available,
    allocated: stats.allocated,
    maintenance: stats.maintenance,
    retired: Math.max(0, stats.total - stats.available - stats.allocated - stats.maintenance),
  };

  return (
    <div className="ops-dashboard relative space-y-6 pb-8 md:space-y-7">
      <AmbientBackground />

      <DashboardHero stats={heroStats} />

      {error && <ErrorAlert message={error} />}

      {loading ? (
        <DashboardLoadingSkeleton />
      ) : stats.total === 0 ? (
        <DashboardEmptyState />
      ) : (
        <>
          <section className="space-y-4">
            <SectionHeading icon={Activity} title="Executive Metrics" subtitle="Real-time portfolio KPIs" />
            <div className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
            <PremiumKpiCard
              title="Total Assets"
              value={stats.total}
              icon={Package}
              accent="violet"
              delay={0}
              trend={computeTrend(currTotal, prevTotal)}
              trendLabel="vs last month"
              sparklineData={kpiSparklines.total}
            />
            <PremiumKpiCard
              title="Asset Value"
              value={stats.assetValue}
              prefix="$"
              icon={DollarSign}
              accent="emerald"
              delay={0.04}
              trend={8}
              trendLabel="portfolio"
              sparklineData={kpiSparklines.value}
            />
            <PremiumKpiCard
              title="Active Allocations"
              value={stats.allocated}
              icon={Activity}
              accent="blue"
              delay={0.08}
              trend={12}
              trendLabel="utilization"
              sparklineData={kpiSparklines.allocated}
            />
            <PremiumKpiCard
              title="Open Requests"
              value={stats.pendingRequests}
              icon={FileText}
              accent="amber"
              delay={0.12}
              trend={stats.pendingRequests > 0 ? 8 : 0}
              trendLabel="workflow"
            />
            <PremiumKpiCard
              title="Procurement Cases"
              value={stats.openProcurements}
              icon={ShoppingCart}
              accent="cyan"
              delay={0.16}
              trend={stats.openProcurements > 0 ? 5 : -2}
              trendLabel="pipeline"
            />
            <PremiumKpiCard
              title="Critical Alerts"
              value={criticalAlerts}
              icon={ShieldAlert}
              accent="rose"
              delay={0.2}
              trend={criticalAlerts > 0 ? 15 : -5}
              trendLabel="attention"
            />
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading icon={GitBranch} title="Operations Overview" subtitle="Lifecycle, approvals, and procurement pipelines" />
            <OperationsOverview
            lifecycle={lifecycle}
            pipeline={pipeline}
            pendingApprovals={stats.pendingApprovals}
            openProcurements={stats.openProcurements}
            />
          </section>

          <section className="space-y-4">
            <SectionHeading icon={BarChart3} title="Analytics Intelligence" subtitle="Trends, distribution, and workflow insights" />
            <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            <AssetHealthTrendChart data={healthTrend} loading={loading} />
            <MaintenanceCostTrendChart data={maintenanceCostData} loading={loading} />
            <AssetDistributionChart data={categoryData} loading={loading} />
            <VendorPerformanceChart data={vendorData} loading={loading} />
            <AllocationTrendChart data={allocationTrend} loading={loading} />
            <RequestStatusChart data={requestStatusData} loading={loading} />
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading icon={Radio} title="Live Operations" subtitle="Activity stream and operational alerts" />
            <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <DashboardActivityFeed />
            </div>
            <div className="space-y-4 xl:col-span-5">
              <AlertsPanel alerts={alerts} />
              <ProcurementSnapshot
                data={{
                  openProcurements: stats.openProcurements,
                  purchaseOrders: stats.purchaseOrders,
                  expectedDeliveries: stats.expectedDeliveries,
                  topVendor: topVendor.vendor,
                  topVendorAssets: topVendor.assets,
                }}
              />
            </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading icon={Zap} title="Command Actions" subtitle="One-click workflow launchers" />
            <QuickActionsPanel />
          </section>
        </>
      )}
    </div>
  );
}
