'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import type { Notification } from '@/lib/supabase/notifications';

async function requireUserId() {
  const { profile } = await getSessionUser();
  if (!profile) throw new Error('Not authenticated');
  return profile.id;
}

export async function getNotificationsAction(): Promise<{
  data: Notification[];
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return { data: [], error: error.message };
    return { data: (data as Notification[]) ?? [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Failed to load notifications' };
  }
}

export async function getUnreadCountAction(): Promise<{ count: number; error?: string }> {
  try {
    const userId = await requireUserId();
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
      .or(`user_id.eq.${userId},user_id.is.null`);

    if (error) return { count: 0, error: error.message };
    return { count: count ?? 0 };
  } catch {
    return { count: 0 };
  }
}

export async function markNotificationReadAction(id: string) {
  try {
    const userId = await requireUserId();
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .or(`user_id.eq.${userId},user_id.is.null`);
    return { error: error?.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to mark notification as read' };
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const userId = await requireUserId();
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
      .or(`user_id.eq.${userId},user_id.is.null`);
    return { error: error?.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to mark notifications as read' };
  }
}

export async function deleteNotificationAction(id: string) {
  try {
    const userId = await requireUserId();
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .or(`user_id.eq.${userId},user_id.is.null`);
    return { error: error?.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete notification' };
  }
}
