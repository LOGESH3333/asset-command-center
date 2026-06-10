import type { Metadata } from 'next';
import { fetchAssetVerificationProfile } from '@/lib/assets/asset-verification';
import { getCompanyName } from '@/lib/assets/qr-code';
import {
  AssetNotFoundView,
  AssetVerificationProfileView,
} from '@/components/enterprise/asset-verification-profile';

type PageProps = {
  params: Promise<{ assetTag: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { assetTag } = await params;
  const decoded = decodeURIComponent(assetTag);
  const companyName = getCompanyName();

  return {
    title: `Verify ${decoded} | ${companyName}`,
    description: `Enterprise asset verification for ${decoded}`,
    robots: { index: false, follow: false },
  };
}

export default async function AssetLookupPage({ params }: PageProps) {
  const { assetTag } = await params;
  const decodedTag = decodeURIComponent(assetTag);
  const profile = await fetchAssetVerificationProfile(decodedTag);

  return (
    <main className="min-h-dvh bg-[#050508] px-4 py-8 sm:px-6 sm:py-12">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.18),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(79,70,229,0.08),transparent)]"
        aria-hidden
      />

      {profile ? (
        <AssetVerificationProfileView profile={profile} />
      ) : (
        <AssetNotFoundView assetTag={decodedTag} />
      )}
    </main>
  );
}
