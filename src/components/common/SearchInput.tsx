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
      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 w-full max-w-md rounded-xl border border-violet-500/25 bg-[rgba(11,11,20,0.82)] pl-9 text-white placeholder:text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:border-violet-400/60 focus-visible:ring-violet-500/30"
      />
    </div>
  );
}
