'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AppRole } from '@/lib/auth/roles';

export type NotificationEventType =
  | 'request_submitted'
  | 'request_approved'
  | 'request_rejected'
  | 'procurement_created'
  | 'purchase_order_created'
  | 'asset_allocated'
  | 'maintenance_due'
  | 'asset_returned'
  | 'general';

const EVENT_PRIORITY: Record<NotificationEventType, 'high' | 'medium' | 'low'> = {
  request_rejected: 'high',
  request_submitted: 'medium',
  request_approved: 'medium',
  procurement_created: 'medium',
  purchase_order_created: 'medium',
  asset_allocated: 'medium',
  maintenance_due: 'high',
  asset_returned: 'low',
  general: 'low',
};

const ROLE_ROUTING: Partial<Record<NotificationEventType, AppRole[]>> = {
  request_submitted: ['Admin', 'Manager'],
  request_approved: ['Admin', 'Manager', 'Procurement', 'Employee'],
  request_rejected: ['Admin', 'Manager', 'Employee'],
  procurement_created: ['Admin', 'Manager', 'Procurement', 'Finance'],
  purchase_order_created: ['Admin', 'Manager', 'Procurement', 'Finance'],
  asset_allocated: ['Admin', 'Manager', 'Employee'],
  maintenance_due: ['Admin', 'Manager', 'Procurement'],
  asset_returned: ['Admin', 'Manager'],
};

function prefixTitle(eventType: NotificationEventType | undefined, title: string) {
  const priority = eventType ? EVENT_PRIORITY[eventType] : 'low';
  const tag = priority === 'high' ? '[HIGH] ' : priority === 'medium' ? '[MED] ' : '';
  return `${tag}${title}`;
}

async function resolveRecipientIds(
  userId: string | null | undefined,
  eventType?: NotificationEventType
): Promise<string[]> {
  if (userId) return [userId];

  const roles = eventType ? ROLE_ROUTING[eventType] : undefined;
  if (!roles?.length) return [];

  const { data } = await supabaseAdmin.from('users').select('id').in('role', roles);
  return (data ?? []).map((u) => u.id);
}

export async function createBrdNotification(input: {
  userId?: string | null;
  title: string;
  message: string;
  eventType?: NotificationEventType;
}) {
  try {
    const recipientIds = await resolveRecipientIds(input.userId, input.eventType);
    const title = prefixTitle(input.eventType, input.title);

    if (!recipientIds.length) {
      await supabaseAdmin.from('notifications').insert([
        {
          user_id: null,
          title,
          message: input.message,
          read: false,
        },
      ]);
      return;
    }

    await supabaseAdmin.from('notifications').insert(
      recipientIds.map((id) => ({
        user_id: id,
        title,
        message: input.message,
        read: false,
      }))
    );
  } catch {
    // Non-blocking
  }
}

export async function notifyRoles(
  roles: AppRole[],
  input: { title: string; message: string; eventType?: NotificationEventType }
) {
  const { data } = await supabaseAdmin.from('users').select('id').in('role', roles);
  for (const user of data ?? []) {
    await createBrdNotification({ userId: user.id, ...input });
  }
}
