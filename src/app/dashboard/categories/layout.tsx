import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Categories - Dashboard',
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>;
}
