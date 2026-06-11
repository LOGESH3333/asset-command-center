import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table"; // assuming a generic DataTable component exists in shadcn UI
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Asset } from "@/lib/supabase/assets";

// Define columns for the Asset table
const columns: ColumnDef<Asset>[] = [
  {
    accessorKey: "asset_tag",
    header: "Tag",
    cell: ({ row }) => (
      <Link href={`/dashboard/assets/${row.original.asset_tag}`}>"{row.original.asset_tag}"</Link>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "category_id",
    header: "Category",
    cell: ({ row }) => {
      const asset = row.original as Asset & { category?: { name: string } | null };
      return asset.category?.name ?? "—";
    },
  },
  {
    accessorKey: "vendor_id",
    header: "Vendor",
    cell: ({ row }) => {
      const asset = row.original as Asset & { vendor?: { name: string } | null };
      return asset.vendor?.name ?? "—";
    },
  },
  {
    accessorKey: "cost",
    header: "Cost",
    cell: ({ row }) => row.original.cost ? `$${row.original.cost.toFixed(2)}` : "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={"secondary"}>{row.original.status}</Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex space-x-2">
        <Link
          href={`/dashboard/assets/${row.original.asset_tag}`}
          className="text-sm text-primary underline"
        >
          View
        </Link>
        <Link
          href={`/dashboard/assets/${row.original.asset_tag}/edit`}
          className="text-sm text-primary underline"
        >
          Edit
        </Link>
        <Link
          href={`/dashboard/assets/${row.original.asset_tag}/delete`}
          className="text-sm text-destructive underline"
        >
          Delete
        </Link>
      </div>
    ),
  },
];

interface AssetTableProps {
  assets: Asset[];
}

export function AssetTable({ assets }: AssetTableProps) {
  return (
    <div className="rounded-md border">
      <DataTable columns={columns} data={assets} />
    </div>
  );
}
