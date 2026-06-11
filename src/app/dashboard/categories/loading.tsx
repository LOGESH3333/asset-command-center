import { TableSkeleton } from '@/components/common/LoadingSkeleton';

export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-violet-500/10" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-violet-500/10" />
        </div>
        <div className="h-8 w-32 animate-pulse rounded bg-violet-500/10" />
      </div>
      <div className="h-8 w-80 animate-pulse rounded bg-violet-500/10" />
      <TableSkeleton rows={5} cols={3} />
    </div>
  );
}
