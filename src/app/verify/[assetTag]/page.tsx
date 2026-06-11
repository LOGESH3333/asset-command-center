import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ assetTag: string }>;
};

export default async function VerifyAssetPage({ params }: PageProps) {
  const { assetTag } = await params;
  redirect(`/asset-lookup/${encodeURIComponent(assetTag)}`);
}
