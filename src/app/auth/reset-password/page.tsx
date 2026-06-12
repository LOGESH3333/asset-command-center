'use client';

import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { Skeleton } from '@/components/common/Skeleton';

export default function AuthResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell heading="Set a new password">
          <div className="space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
