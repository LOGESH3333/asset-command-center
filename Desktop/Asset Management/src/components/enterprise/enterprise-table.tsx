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

interface EnterpriseTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  stickyHeader?: boolean;
}

export function EnterpriseTable<TData, TValue>({
  columns,
  data,
  stickyHeader = true,
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
    <div className="glass-panel dark:bm-card overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className={cn(stickyHeader && "sticky top-0 z-10")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-[rgba(139,92,246,0.12)] bg-[rgba(7,7,16,0.8)] hover:bg-[rgba(7,7,16,0.8)]"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-11 text-[11px] font-semibold uppercase tracking-wider text-[#c4b5fd]"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1 transition-colors hover:text-foreground",
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
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="group border-white/[0.04] transition-all duration-200 hover:bg-violet-500/[0.06] hover:shadow-[inset_3px_0_0_0_rgba(139,92,246,0.6)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
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
