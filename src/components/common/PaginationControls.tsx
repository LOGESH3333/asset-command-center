'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between rounded-2xl border border-violet-500/15 bg-[rgba(10,10,20,0.65)] px-4 py-3 backdrop-blur-xl">
      <p className="text-sm text-zinc-400">
        Showing <span className="font-medium text-white">{start}–{end}</span> of{' '}
        <span className="font-medium text-white">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="rounded-xl border-violet-500/20 bg-[rgba(11,11,20,0.72)] text-zinc-200 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-zinc-400">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="rounded-xl border-violet-500/20 bg-[rgba(11,11,20,0.72)] text-zinc-200 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
