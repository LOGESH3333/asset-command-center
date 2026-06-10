'use client';

import React, { useState, useEffect } from 'react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type Notification,
} from '@/lib/supabase/notifications';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Bell, Check, Inbox, MailOpen } from 'lucide-react';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceAnalyticsGrid,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import { WorkspaceDonutChart, WorkspaceAreaChart } from '@/components/workspace/workspace-charts';
import {
  NotificationOperationsCenter,
  NotificationCategoryPills,
  useNotificationInsights,
} from '@/components/workspace/notification-operations-center';
import { groupByDay, percent } from '@/lib/workspace/insights';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotifications();
      if (res.error) setError(res.error.message);
      else setNotifications(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNotifications(); }, []);

  const insights = useNotificationInsights(notifications);
  const readCount = notifications.length - insights.unread;
  const trendData = groupByDay(notifications, (n) => n.created_at);

  const kpis: ModuleKpi[] = [
    { title: 'Unread Alerts', value: insights.unread, icon: Bell, accent: 'violet', trend: insights.unread > 0 ? 15 : -20, trendLabel: 'inbox' },
    { title: 'Approval Alerts', value: insights.byCat.approval, icon: Check, accent: 'amber', trend: 8, trendLabel: 'governance' },
    { title: 'Maintenance', value: insights.byCat.maintenance, icon: Inbox, accent: 'cyan', trend: 3, trendLabel: 'ops' },
    { title: 'Procurement', value: insights.byCat.procurement, icon: MailOpen, accent: 'emerald', trend: 5, trendLabel: 'sourcing' },
    { title: 'Allocations', value: insights.byCat.allocation, icon: Bell, accent: 'blue', trend: 2, trendLabel: 'assignments' },
    { title: 'Read Rate', value: percent(readCount, notifications.length || 1), suffix: '%', icon: Check, accent: 'rose', trend: 11, trendLabel: 'cleared' },
  ];

  const categoryChart = [
    { name: 'Approval', value: insights.byCat.approval },
    { name: 'Maintenance', value: insights.byCat.maintenance },
    { name: 'Procurement', value: insights.byCat.procurement },
    { name: 'Allocation', value: insights.byCat.allocation },
    { name: 'System', value: insights.byCat.general },
  ].filter((d) => d.value > 0);

  const handleMarkRead = async (id: string) => {
    const { error: readErr } = await markNotificationRead(id);
    if (readErr) setError(readErr.message);
    else setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    const { error: readErr } = await markAllNotificationsRead();
    if (readErr) setError(readErr.message);
    else setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDelete = async (id: string) => {
    const { error: delErr } = await deleteNotification(id);
    if (delErr) setError(delErr.message);
    else setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-8">
      <WorkspaceHero
        badge="Alert Operations"
        title="Notification Operations Center"
        description="Prioritized operational alerts across approvals, maintenance, procurement, and allocations."
        actions={
          insights.unread > 0 ? (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 rounded-xl border-violet-500/25 bg-violet-500/10">
              <Check className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={loading} columns={6} />

      <WorkspaceSection title="Alert Intelligence" subtitle="Category distribution and delivery velocity">
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="Alert Categories" data={categoryChart.length ? categoryChart : [{ name: 'None', value: 1 }]} />
          <WorkspaceAreaChart title="Alert Volume" subtitle="Last 7 days" data={trendData} />
          <div className="ops-glass-card rounded-2xl border border-[rgba(139,92,246,0.15)] p-5">
            <h3 className="text-sm font-semibold text-white">Category Breakdown</h3>
            <p className="mt-0.5 mb-4 text-xs text-zinc-500">Live classification</p>
            <NotificationCategoryPills counts={insights.byCat} />
          </div>
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Alert Inbox" subtitle={`${insights.unread} unread · ${notifications.length} total`}>
        <WorkspaceDataPanel>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : (
            <NotificationOperationsCenter
              notifications={notifications}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          )}
        </WorkspaceDataPanel>
      </WorkspaceSection>
    </div>
  );
}
