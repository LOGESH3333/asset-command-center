import React from 'react';
import Link from 'next/link';
import { Category } from '@/lib/supabase/categories';

interface CategoryTableProps {
  categories: Category[];
}

export function CategoryTable({ categories }: CategoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-violet-500/15">
      <table className="w-full min-w-[600px] table-auto text-white">
        <thead className="bg-[rgba(7,7,16,0.8)]">
          <tr>
            <th className="px-4 py-2 text-left text-[#c4b5fd]">Name</th>
            <th className="px-4 py-2 text-left text-[#c4b5fd]">Created At</th>
            <th className="px-4 py-2 text-left text-[#c4b5fd]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id} className="border-t border-violet-500/12 bg-[rgba(11,11,20,0.58)]">
              <td className="px-4 py-2">{cat.name}</td>
              <td className="px-4 py-2">{new Date(cat.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-2 space-x-2">
                <Link href={`/dashboard/categories/${cat.id}`} className="text-primary underline">
                  View
                </Link>
                <Link href={`/dashboard/categories/${cat.id}/edit`} className="text-primary underline">
                  Edit
                </Link>
                <Link href={`/dashboard/categories/${cat.id}/delete`} className="text-destructive underline">
                  Delete
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
