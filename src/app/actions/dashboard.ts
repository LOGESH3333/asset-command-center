'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { PENDING_REQUEST_STATUSES, REQUEST_STATUS } from '@/lib/constants/request-status';

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

export async function getDashboardMetricsAction() {
  const { profile } = await getSessionUser();
  if (!profile) {
    return { error: 'You must be signed in to view the dashboard.' };
  }

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
      allAssetsRes,
      costRecordsRes,
      catAssetsRes,
      vendorAssetsRes,
    ] = await Promise.all([
      supabaseAdmin.from('assets').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'Available'),
      supabaseAdmin.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'Allocated'),
      supabaseAdmin.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'Under Maintenance'),
      supabaseAdmin
        .from('asset_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', PENDING_REQUEST_STATUSES),
      supabaseAdmin
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .not('warranty_expiry', 'is', null)
        .lte('warranty_expiry', warrantyCutoff),
      supabaseAdmin.from('maintenance_records').select('*', { count: 'exact', head: true }).is('completed_date', null),
      supabaseAdmin.from('assets').select('cost'),
      supabaseAdmin
        .from('procurements')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Draft', 'Submitted', 'Approved', 'Ordered']),
      supabaseAdmin.from('purchase_orders').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .not('expected_delivery', 'is', null)
        .gte('expected_delivery', new Date().toISOString().split('T')[0]),
      supabaseAdmin.from('request_approvals').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabaseAdmin
        .from('request_approvals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending')
        .eq('approval_stage', 'Finance'),
      supabaseAdmin.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.APPROVED),
      supabaseAdmin.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.PURCHASING),
      supabaseAdmin.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.RECEIVED),
      supabaseAdmin.from('asset_requests').select('*', { count: 'exact', head: true }).eq('status', REQUEST_STATUS.FULFILLED),
      supabaseAdmin.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'Received'),
      supabaseAdmin.from('asset_requests').select('status'),
      supabaseAdmin.from('assets').select('status, created_at, cost'),
      supabaseAdmin
        .from('maintenance_records')
        .select('completed_date, cost')
        .not('completed_date', 'is', null)
        .not('cost', 'is', null),
      supabaseAdmin.from('assets').select('category_id, asset_categories(name)'),
      supabaseAdmin.from('assets').select('vendor_id, vendors(name)'),
    ]);

    const totalCount = totalRes.count ?? 0;
    const availableCount = availRes.count ?? 0;
    const allocatedCount = allocRes.count ?? 0;
    const maintenanceCount = maintRes.count ?? 0;
    const assetValue = (assetsCostRes.data ?? []).reduce(
      (sum, asset) => sum + (Number(asset.cost) || 0),
      0
    );

    const statusMap: Record<string, number> = {};
    allRequestsRes.data?.forEach((r) => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1;
    });

    const allAssetRows = allAssetsRes.data ?? [];
    const monthBuckets: { label: string; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      monthBuckets.push({ label: d.toLocaleString('default', { month: 'short' }), end });
    }

    const growthTrend = monthBuckets.map(({ label, end }) => ({
      month: label,
      total: allAssetRows.filter((asset) => new Date(asset.created_at) <= end).length,
    }));

    const allocationTrend = monthBuckets.map(({ label, end }) => {
      const pool = allAssetRows.filter((asset) => new Date(asset.created_at) <= end);
      return {
        month: label,
        allocated: pool.filter((asset) => asset.status === 'Allocated').length,
        available: pool.filter((asset) => asset.status === 'Available').length,
      };
    });

    const healthTrend = monthBuckets.map(({ label, end }) => {
      const pool = allAssetRows.filter((asset) => new Date(asset.created_at) <= end);
      const t = pool.length;
      const av = pool.filter((asset) => asset.status === 'Available').length;
      const al = pool.filter((asset) => asset.status === 'Allocated').length;
      const mt = pool.filter((asset) => asset.status === 'Under Maintenance').length;
      return { month: label, score: computeHealthScore(av, al, mt, t) };
    });

    const kpiSparklines = {
      total: growthTrend.map((g) => g.total),
      allocated: allocationTrend.map((a) => a.allocated),
      value: monthBuckets.map(({ end }) =>
        allAssetRows
          .filter((asset) => new Date(asset.created_at) <= end)
          .reduce((sum, asset) => sum + (Number(asset.cost) || 0), 0)
      ),
    };

    const costsByMonth: Record<string, number> = {};
    costRecordsRes.data?.forEach((rec) => {
      const monthKey = new Date(rec.completed_date).toLocaleString('default', { month: 'short' });
      costsByMonth[monthKey] = (costsByMonth[monthKey] || 0) + (Number(rec.cost) || 0);
    });
    const maintenanceCostData = monthBuckets.map(({ label }) => ({
      month: label,
      cost: costsByMonth[label] ?? 0,
    }));

    const catMap: Record<string, number> = {};
    catAssetsRes.data?.forEach((a) => {
      const cat = a.asset_categories as { name?: string } | { name?: string }[] | null;
      const name = (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? 'Uncategorized';
      catMap[name] = (catMap[name] || 0) + 1;
    });
    const categoryData = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .slice(0, 6);

    const vendMap: Record<string, number> = {};
    vendorAssetsRes.data?.forEach((a) => {
      const vend = a.vendors as { name?: string } | { name?: string }[] | null;
      const name = (Array.isArray(vend) ? vend[0]?.name : vend?.name) ?? 'Unknown';
      vendMap[name] = (vendMap[name] || 0) + 1;
    });
    const vendorData = Object.entries(vendMap)
      .map(([vendor, assets]) => ({ vendor, assets }))
      .sort((a, b) => b.assets - a.assets)
      .slice(0, 6);

    return {
      stats: {
        total: totalCount,
        available: availableCount,
        allocated: allocatedCount,
        maintenance: maintenanceCount,
        assetValue: Math.round(assetValue),
        pendingRequests: reqsRes.count ?? 0,
        warrantyAlerts: warrantyRes.count ?? 0,
        maintenanceDue: maintDueRes.count ?? 0,
        healthScore: computeHealthScore(availableCount, allocatedCount, maintenanceCount, totalCount),
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
      },
      requestStatusData: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
      growthTrend,
      healthTrend,
      allocationTrend,
      maintenanceCostData,
      categoryData,
      vendorData,
      kpiSparklines,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load dashboard metrics.' };
  }
}
