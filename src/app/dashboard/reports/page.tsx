'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { PageHeader } from '@/components/enterprise/page-header';
import { KpiCard } from '@/components/enterprise/kpi-card';
import {
  CategoryDistributionChart,
  MaintenanceCostChart,
  VendorPerformanceChart,
} from '@/components/enterprise/charts';
import { BarChart3, DollarSign, Tag, Wrench } from 'lucide-react';

interface BreakdownItem {
  name: string;
  count: number;
  cost: number;
}

type ReportAsset = {
  cost: number | string | null;
  status: string | null;
  asset_categories: { name?: string } | { name?: string }[] | null;
  vendors: { name?: string } | { name?: string }[] | null;
};

type ReportMaintenanceRecord = {
  cost: number | string | null;
  scheduled_date: string | null;
  completed_date: string | null;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState({
    totalCost: 0,
    averageCost: 0,
    totalAssets: 0,
    activeMaintenance: 0,
  });

  const [categoryBreakdown, setCategoryBreakdown] = useState<BreakdownItem[]>([]);
  const [vendorBreakdown, setVendorBreakdown] = useState<BreakdownItem[]>([]);
  const [maintenanceCosts, setMaintenanceCosts] = useState<{ month: string; cost: number }[]>([]);

  useEffect(() => {
    async function fetchReportData() {
      setLoading(true);
      setError(null);
      try {
        const [assetsRes, maintRes] = await Promise.all([
          supabase
            .from('assets')
            .select('cost, status, category_id, vendor_id, asset_categories(name), vendors(name)'),
          supabase
            .from('maintenance_records')
            .select('cost, scheduled_date, completed_date'),
        ]);

        if (assetsRes.error) throw assetsRes.error;

        const assets = (assetsRes.data ?? []) as ReportAsset[];
        const totalAssets = assets.length;
        let totalCost = 0;
        let costCount = 0;
        let activeMaintenance = 0;

        const categoriesMap: Record<string, { count: number; cost: number }> = {};
        const vendorsMap: Record<string, { count: number; cost: number }> = {};

        assets.forEach((asset: ReportAsset) => {
          const assetCost = asset.cost ? Number(asset.cost) : 0;
          if (asset.cost !== null && asset.cost !== undefined) {
            totalCost += assetCost;
            costCount++;
          }

          if (asset.status === 'Under Maintenance') activeMaintenance++;

          const categoryObj = asset.asset_categories as { name?: string } | { name?: string }[] | null;
          const catName =
            (Array.isArray(categoryObj) ? categoryObj[0]?.name : categoryObj?.name) || 'Uncategorized';
          if (!categoriesMap[catName]) categoriesMap[catName] = { count: 0, cost: 0 };
          categoriesMap[catName].count++;
          categoriesMap[catName].cost += assetCost;

          const vendorObj = asset.vendors as { name?: string } | { name?: string }[] | null;
          const vendName =
            (Array.isArray(vendorObj) ? vendorObj[0]?.name : vendorObj?.name) || 'Unknown Vendor';
          if (!vendorsMap[vendName]) vendorsMap[vendName] = { count: 0, cost: 0 };
          vendorsMap[vendName].count++;
          vendorsMap[vendName].cost += assetCost;
        });

        setSummary({
          totalAssets,
          totalCost,
          averageCost: costCount > 0 ? totalCost / costCount : 0,
          activeMaintenance,
        });

        setCategoryBreakdown(
          Object.keys(categoriesMap)
            .map((name) => ({
              name,
              count: categoriesMap[name].count,
              cost: categoriesMap[name].cost,
            }))
            .sort((a, b) => b.cost - a.cost)
        );

        setVendorBreakdown(
          Object.keys(vendorsMap)
            .map((name) => ({
              name,
              count: vendorsMap[name].count,
              cost: vendorsMap[name].cost,
            }))
            .sort((a, b) => b.cost - a.cost)
        );

        const maintenanceRows = (maintRes.data ?? []) as ReportMaintenanceRecord[];
        if (maintenanceRows.length > 0) {
          const monthMap: Record<string, number> = {};
          maintenanceRows.forEach((rec: ReportMaintenanceRecord) => {
            const dateStr = rec.completed_date || rec.scheduled_date;
            if (!dateStr || !rec.cost) return;
            const month = new Date(dateStr).toLocaleDateString('en-US', {
              month: 'short',
              year: '2-digit',
            });
            monthMap[month] = (monthMap[month] || 0) + Number(rec.cost);
          });
          setMaintenanceCosts(
            Object.entries(monthMap).map(([month, cost]) => ({ month, cost }))
          );
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to compile reporting data.');
      } finally {
        setLoading(false);
      }
    }

    fetchReportData();
  }, []);

  const categoryChartData = categoryBreakdown.map((c) => ({
    name: c.name,
    value: c.count,
  }));

  const vendorChartData = vendorBreakdown.slice(0, 6).map((v) => ({
    vendor: v.name.length > 14 ? `${v.name.slice(0, 14)}…` : v.name,
    assets: v.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Analytics"
        title="Reports & Intelligence"
        description="Financial valuations, operational breakdowns, and maintenance cost analysis."
      />

      {error && <ErrorAlert message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <KpiCard
              title="Total Valuation"
              value={summary.totalCost}
              prefix="$"
              decimals={2}
              icon={DollarSign}
              accent="green"
              delay={0}
            />
            <KpiCard
              title="Average Asset Cost"
              value={summary.averageCost}
              prefix="$"
              decimals={2}
              icon={BarChart3}
              accent="violet"
              delay={0.05}
            />
            <KpiCard
              title="Inventory Count"
              value={summary.totalAssets}
              icon={Tag}
              accent="blue"
              delay={0.1}
            />
            <KpiCard
              title="Under Maintenance"
              value={summary.activeMaintenance}
              icon={Wrench}
              accent="rose"
              delay={0.15}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </>
        ) : (
          <>
            <CategoryDistributionChart data={categoryChartData} />
            <VendorPerformanceChart data={vendorChartData} />
          </>
        )}
      </div>

      {!loading && maintenanceCosts.length > 0 && (
        <MaintenanceCostChart data={maintenanceCosts} />
      )}
    </div>
  );
}
