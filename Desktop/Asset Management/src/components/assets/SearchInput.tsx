import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { SearchIcon } from 'lucide-react';

interface SearchInputProps {
  onSearch: (term: string) => void;
}

export function SearchInput({ onSearch }: SearchInputProps) {
  const [value, setValue] = useState('');

  // Debounce the search input
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [value, onSearch]);

  return (
    <div className="flex items-center space-x-2">
      <SearchIcon className="h-5 w-5 text-muted-foreground" />
      <Input
        placeholder="Search by tag or name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full max-w-sm"
      />
    </div>
  );
}
