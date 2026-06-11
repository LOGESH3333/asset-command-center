import { supabase } from './client';

export type Notification = {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export async function getNotifications() {
  const { data, error, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  return { data: (data as Notification[]) ?? [], error, total: count ?? 0 };
}

export async function getUnreadCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);
  return { count: count ?? 0, error };
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  return { error };
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false);
  return { error };
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  return { error };
}
