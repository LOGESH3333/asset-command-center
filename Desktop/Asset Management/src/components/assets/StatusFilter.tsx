import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StatusFilterProps {
  value: string | undefined;
  onChange: (status: string | undefined) => void;
}

const statuses = ['Available', 'Allocated', 'Under Maintenance', 'Retired'];

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <Select value={value} onValueChange={(val: any) => onChange(val)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">All</SelectItem>
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
