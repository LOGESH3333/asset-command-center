'use client';

import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Button } from '@/components/ui/button';

export default function CategoriesError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <ErrorAlert message={error.message || 'An unexpected error occurred while loading categories.'} />
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
