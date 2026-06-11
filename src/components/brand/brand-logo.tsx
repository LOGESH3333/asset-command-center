import Image from 'next/image';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

type BrandLogoProps = {
  variant?: 'sidebar' | 'compact' | 'auth';
  showProductLabel?: boolean;
  className?: string;
};

const variantStyles = {
  sidebar: {
    shell: 'rounded-lg bg-white px-2.5 py-1.5 shadow-[0_0_24px_-6px_rgba(46,74,158,0.45)] ring-1 ring-white/20',
    image: { width: 148, height: 40, className: 'h-8 w-auto max-w-[148px] object-contain object-left' },
  },
  compact: {
    shell: 'rounded-md bg-white px-2 py-1 shadow-[0_0_16px_-4px_rgba(46,74,158,0.4)] ring-1 ring-white/15',
    image: { width: 120, height: 32, className: 'h-7 w-auto max-w-[120px] object-contain object-left' },
  },
  auth: {
    shell: 'rounded-xl bg-white px-4 py-2.5 shadow-[0_0_32px_-8px_rgba(124,58,237,0.5)] ring-1 ring-white/25',
    image: { width: 180, height: 48, className: 'h-10 w-auto max-w-[180px] object-contain' },
  },
} as const;

export function BrandLogo({
  variant = 'sidebar',
  showProductLabel = true,
  className,
}: BrandLogoProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('inline-flex', styles.shell)}>
        <Image
          src={BRAND.logoPath}
          alt={BRAND.logoAlt}
          width={styles.image.width}
          height={styles.image.height}
          className={styles.image.className}
          priority
        />
      </div>
      {showProductLabel && (
        <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ror-blue-soft,#93a8e8)]">
          {BRAND.productName}
        </p>
      )}
    </div>
  );
}
