import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vendors - Dashboard',
};

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      {children}
    </section>
  );
}
