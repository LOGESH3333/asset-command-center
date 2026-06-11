'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type RegistryDeleteButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  title?: string;
};

export function RegistryDeleteButton({
  onClick,
  disabled,
  className,
  type = 'button',
  title = 'Delete',
}: RegistryDeleteButtonProps) {
  return (
    <Button
      type={type}
      size="sm"
      variant="outline"
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'h-8 w-8 rounded-xl border border-rose-500/35 bg-[linear-gradient(135deg,rgba(11,11,20,0.88),rgba(33,12,24,0.82))] p-0 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(139,92,246,0.08)] transition-all duration-200 hover:scale-105 hover:border-rose-400/70 hover:bg-rose-500/15 hover:text-rose-50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_-8px_rgba(244,63,94,0.75),0_0_18px_-12px_rgba(139,92,246,0.75)] active:scale-95',
        className
      )}
      onClick={onClick}
    >
      <Trash2 className="h-4.5 w-4.5 text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.55)]" />
    </Button>
  );
}
