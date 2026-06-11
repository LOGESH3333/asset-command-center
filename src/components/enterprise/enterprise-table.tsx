"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

interface EnterpriseTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  stickyHeader?: boolean;
  fitColumns?: boolean;
  mobileLabel?: (row: TData) => string;
  mobileSubtitle?: (row: TData) => string | undefined;
}

export function EnterpriseTable<TData, TValue>({
  columns,
  data,
  stickyHeader = true,
  fitColumns = false,
  mobileLabel,
  mobileSubtitle,
}: EnterpriseTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-2xl bg-transparent text-white">
      {/* Mobile card fallback */}
      <div className="space-y-2 p-3 md:hidden">
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">No results found.</p>
        ) : (
          data.map((row, i) => (
            <div
              key={i}
              className="rounded-xl border border-violet-500/15 bg-[rgba(11,11,20,0.72)] p-4 transition-colors active:bg-violet-500/[0.06]"
            >
              <p className="font-medium text-white">
                {mobileLabel ? mobileLabel(row) : `Record ${i + 1}`}
              </p>
              {mobileSubtitle?.(row) && (
                <p className="mt-0.5 text-xs text-zinc-500">{mobileSubtitle(row)}</p>
              )}
              <div className="mt-3 space-y-2 border-t border-white/[0.04] pt-3">
                {table.getRowModel().rows[i]?.getVisibleCells().slice(0, 4).map((cell) => (
                  <div key={cell.id} className="flex justify-between gap-3 text-xs">
                    <span className="text-zinc-500">
                      {typeof cell.column.columnDef.header === 'string'
                        ? cell.column.columnDef.header
                        : cell.column.id}
                    </span>
                    <span className="max-w-[60%] truncate text-right text-zinc-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div
        className={cn(
          "scrollbar-thin hidden bg-transparent md:block",
          fitColumns ? "overflow-x-hidden" : "overflow-x-auto"
        )}
      >
        <Table
          className={cn("bg-transparent", fitColumns && "w-full table-fixed")}
          containerClassName={fitColumns ? "overflow-x-hidden" : undefined}
        >
          <TableHeader className={cn(stickyHeader && "sticky top-0 z-10")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-[rgba(139,92,246,0.12)] bg-[rgba(7,7,16,0.8)] hover:bg-[rgba(7,7,16,0.8)]"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-11 text-[11px] font-semibold uppercase tracking-wider text-[#c4b5fd]",
                      (header.column.columnDef.meta as ColumnMeta | undefined)?.headerClassName
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1 transition-colors hover:text-white",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <>
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                            )}
                          </>
                        )}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="bg-transparent">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="group border-[rgba(139,92,246,0.12)] bg-[rgba(11,11,20,0.58)] transition-all duration-200 hover:bg-violet-500/[0.07] hover:shadow-[inset_3px_0_0_0_rgba(139,92,246,0.6),0_0_24px_-16px_rgba(139,92,246,0.8)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-4 text-sm text-zinc-100",
                        (cell.column.columnDef.meta as ColumnMeta | undefined)?.cellClassName
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center text-zinc-400">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
