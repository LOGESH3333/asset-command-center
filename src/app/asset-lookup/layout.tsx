import type { Metadata, Viewport } from 'next';
import { getCompanyName } from '@/lib/assets/qr-code';

export const metadata: Metadata = {
  title: `Asset Verification | ${getCompanyName()}`,
  description: 'Scan-to-verify enterprise asset registry',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#050508',
};

export default function AssetLookupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
