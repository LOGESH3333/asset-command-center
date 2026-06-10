'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  exportToCsv,
  exportToExcel,
  exportToPdf,
  type ExportColumn,
} from '@/lib/export/enterprise-export';

type ExportToolbarProps<T> = {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  dateRange?: { from?: string; to?: string };
  disabled?: boolean;
};

export function ExportToolbar<T>({
  filename,
  title,
  columns,
  rows,
  dateRange,
  disabled,
}: ExportToolbarProps<T>) {
  const options = { filename, title, columns, rows, dateRange };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || rows.length === 0}
        className="inline-flex h-8 items-center justify-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10 disabled:pointer-events-none disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-white/10 bg-[#0c0c12]">
        <DropdownMenuItem onClick={() => exportToCsv(options)} className="gap-2">
          <FileText className="h-4 w-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(options)} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPdf(options)} className="gap-2">
          <FileText className="h-4 w-4" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
