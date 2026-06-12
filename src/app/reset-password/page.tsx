'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Skeleton } from '@/components/common/Skeleton';

function LegacyResetPasswordRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    router.replace(`/auth/reset-password${qs ? `?${qs}` : ''}${hash}`);
  }, [router, searchParams]);

  return (
    <AuthShell heading="Set a new password">
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </AuthShell>
  );
}

/** Legacy route — forwards to /auth/reset-password with query/hash intact. */
export default function ResetPasswordRedirectPage() {
  return (
    <Suspense
      fallback={
        <AuthShell heading="Set a new password">
          <Skeleton className="h-64 rounded-xl" />
        </AuthShell>
      }
    >
      <LegacyResetPasswordRedirect />
    </Suspense>
  );
}
