'use client';

import React from 'react';
import { Skeleton } from '@/components/common/Skeleton';

export function TableSkeleton({ rows = 5, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border border-violet-500/15">
      <table className="w-full">
        <thead className="bg-[rgba(7,7,16,0.8)]">
          <tr>
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i} className="border-t border-violet-500/12">
              {[...Array(cols)].map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <Skeleton className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
