'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PENDING_REQUEST_STATUSES, REQUEST_STATUS } from '@/lib/constants/request-status';
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
        const warrantyCutoff = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

        const [
          totalRes,
          availRes,
          allocRes,
          maintRes,
          reqsRes,
          warrantyRes,
          maintDueRes,
          assetsCostRes,
          openProcRes,
          poRes,
          deliveryRes,
          pendingApprovalRes,
          pendingFinanceRes,
          approvedReqRes,
          purchasingReqRes,
          receivedReqRes,
          fulfilledReqRes,
          purchasedProcRes,
          allRequestsRes,
        ] = await Promise.all([
          supabase.from('assets').select('*', { count: 'exact', head: true }),
          supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'Available'),
          supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'Allocated'),
          supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'Under Maintenance'),
          supabase
            .from('asset_requests')
            .select('*', { count: 'exact', head: true })
            .in('status', PENDING_REQUEST_STATUSES),
          supabase
            .from('assets')
            .select('*', { count: 'exact', head: true })
            .not('warranty_expiry', 'is', null)
            .lte('warranty_expiry', warrantyCutoff),
          supabase.from('maintenance_records').select('*', { count: 'exact', head: true }).is('completed_date', null),
          supabase.from('assets').select('cost'),
          supabase
            .from('procurements')
            .select('*', { count: 'exact', head: true })
            .in('status', ['Draft', 'Submitted', 'Approved', 'Ordered']),
          supabase.from('purchase_orders').select('*', { count: 'exact', head: true }),
          supabase
            .from('purchase_orders')
            .select('*', { count: 'exact', head: true })
            .not('expected_delivery', 'is', null)
            .gte('expected_delivery', new Date().toISOString().split('T')[0]),
          supabase.from('request_approvals').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
          supabase
            .from('request_approvals')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Pending')
            .eq('approval_stage', 'Finance'),
          supabase.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.APPROVED),
          supabase.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.PURCHASING),
          supabase.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.RECEIVED),
          supabase.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.FULFILLED),
          supabase
            .from('purchase_orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Received'),
          supabase.from('asset_requests').select('status'),
        ]);

        const totalCount = totalRes.count ?? 0;
        const availableCount = availRes.count ?? 0;
        const allocatedCount = allocRes.count ?? 0;
        const maintenanceCount = maintRes.count ?? 0;

        const assetValue =
          assetsCostRes.data?.reduce((sum, a) => sum + (Number(a.cost) || 0), 0) ?? 0;

        const healthScore = computeHealthScore(availableCount, allocatedCount, maintenanceCount, totalCount);

        setStats({
          total: totalCount,
          available: availableCount,
          allocated: allocatedCount,
          maintenance: maintenanceCount,
          assetValue: Math.round(assetValue),
          pendingRequests: reqsRes.count ?? 0,
          warrantyAlerts: warrantyRes.count ?? 0,
          maintenanceDue: maintDueRes.count ?? 0,
          healthScore,
          procurementPipeline: openProcRes.count ?? 0,
          openProcurements: openProcRes.count ?? 0,
          purchaseOrders: poRes.count ?? 0,
          expectedDeliveries: deliveryRes.count ?? 0,
          pendingApprovals: pendingApprovalRes.count ?? 0,
          pendingFinanceApprovals: pendingFinanceRes.count ?? 0,
          approvedRequests: approvedReqRes.count ?? 0,
          purchasingRequests: purchasingReqRes.count ?? 0,
          receivedRequests: receivedReqRes.count ?? 0,
          fulfilledRequests: fulfilledReqRes.count ?? 0,
          purchasedCount: purchasedProcRes.count ?? 0,
        });

        const statusMap: Record<string, number> = {};
        allRequestsRes.data?.forEach((r: { status: string }) => {
          statusMap[r.status] = (statusMap[r.status] || 0) + 1;
        });
        setRequestStatusData(
          Object.entries(statusMap).map(([status, count]) => ({ status, count }))
        );

        const { data: allAssets } = await supabase.from('assets').select('status, created_at, cost');

        const monthBuckets: { label: string; end: Date }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() - i);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          monthBuckets.push({ label: d.toLocaleString('default', { month: 'short' }), end });
        }

        const growth = monthBuckets.map(({ label, end }) => ({
          month: label,
          total: (allAssets ?? []).filter((a) => new Date(a.created_at) <= end).length,
        }));
        setGrowthTrend(growth);

        const allocTrend = monthBuckets.map(({ label, end }) => {
          const pool = (allAssets ?? []).filter((a) => new Date(a.created_at) <= end);
          return {
            month: label,
            allocated: pool.filter((a) => a.status === 'Allocated').length,
            available: pool.filter((a) => a.status === 'Available').length,
          };
        });
        setAllocationTrend(allocTrend);

        const healthByMonth = monthBuckets.map(({ label, end }) => {
          const pool = (allAssets ?? []).filter((a) => new Date(a.created_at) <= end);
          const t = pool.length;
          const av = pool.filter((a) => a.status === 'Available').length;
          const al = pool.filter((a) => a.status === 'Allocated').length;
          const mt = pool.filter((a) => a.status === 'Under Maintenance').length;
          return { month: label, score: computeHealthScore(av, al, mt, t) };
        });
        setHealthTrend(healthByMonth);

        setKpiSparklines({
          total: growth.map((g) => g.total),
          allocated: allocTrend.map((a) => a.allocated),
          value: monthBuckets.map(({ end }) =>
            (allAssets ?? [])
              .filter((a) => new Date(a.created_at) <= end)
              .reduce((s, a) => s + (Number(a.cost) || 0), 0)
          ),
        });

        const { data: costRecords } = await supabase
          .from('maintenance_records')
          .select('completed_date, cost')
          .not('completed_date', 'is', null)
          .not('cost', 'is', null);

        const costsByMonth: Record<string, number> = {};
        costRecords?.forEach((rec: { completed_date: string; cost: number }) => {
          const monthKey = new Date(rec.completed_date).toLocaleString('default', { month: 'short' });
          costsByMonth[monthKey] = (costsByMonth[monthKey] || 0) + (rec.cost || 0);
        });
        setMaintenanceCostData(
          monthBuckets.map(({ label }) => ({ month: label, cost: costsByMonth[label] ?? 0 }))
        );

        const { data: catAssets } = await supabase
          .from('assets')
          .select('category_id, asset_categories(name)');
        const catMap: Record<string, number> = {};
        catAssets?.forEach((a: { asset_categories?: { name?: string } | { name?: string }[] | null }) => {
          const cat = a.asset_categories;
          const name = (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? 'Uncategorized';
          catMap[name] = (catMap[name] || 0) + 1;
        });
        setCategoryData(
          Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .slice(0, 6)
        );

        const { data: vendorAssets } = await supabase.from('assets').select('vendor_id, vendors(name)');
        const vendMap: Record<string, number> = {};
        vendorAssets?.forEach((a: { vendors?: { name?: string } | { name?: string }[] | null }) => {
          const vend = a.vendors;
          const name = (Array.isArray(vend) ? vend[0]?.name : vend?.name) ?? 'Unknown';
          vendMap[name] = (vendMap[name] || 0) + 1;
        });
        const vendorEntries = Object.entries(vendMap)
          .map(([vendor, assets]) => ({ vendor, assets }))
          .sort((a, b) => b.assets - a.assets)
          .slice(0, 6);
        setVendorData(vendorEntries);
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
