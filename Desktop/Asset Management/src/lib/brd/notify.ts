'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';

export async function createBrdNotification(input: {
  userId?: string | null;
  title: string;
  message: string;
}) {
  try {
    await supabaseAdmin.from('notifications').insert([
      {
        user_id: input.userId ?? null,
        title: input.title,
        message: input.message,
        read: false,
      },
    ]);
  } catch {
    // Non-blocking
  }
}
