import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Categories - Dashboard',
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-bold">Categories</h1>
      {children}
    </section>
  );
}
