'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { SearchIcon } from 'lucide-react';

interface SearchInputProps {
  placeholder?: string;
  onSearch: (term: string) => void;
  defaultValue?: string;
}

export function SearchInput({ placeholder = 'Search...', onSearch, defaultValue = '' }: SearchInputProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [value, onSearch]);

  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 w-full max-w-md rounded-xl border-0 bg-muted/40 pl-9 focus-visible:ring-1 focus-visible:ring-primary/30"
      />
    </div>
  );
}
