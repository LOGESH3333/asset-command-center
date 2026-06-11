'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';
import { DeleteBlockingPanel } from '@/components/common/delete-blocking-panel';

export const deleteDialogContentClass =
  'overflow-hidden rounded-2xl border border-violet-500/25 bg-[linear-gradient(145deg,rgba(12,12,20,0.96),rgba(8,8,15,0.98))] text-white shadow-[0_24px_80px_-30px_rgba(0,0,0,0.95),0_0_44px_-24px_rgba(139,92,246,0.95)] backdrop-blur-2xl duration-200 sm:max-w-sm data-open:zoom-in-95';

export const deleteDialogFooterClass =
  '-mx-4 -mb-4 border-t border-violet-500/15 bg-black/20';

export const deleteDialogCancelClass =
  'rounded-xl border-violet-500/20 bg-[rgba(11,11,20,0.82)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-violet-400/45 hover:bg-violet-500/10 hover:text-white';

export const deleteDialogConfirmClass =
  'rounded-xl border border-rose-300/20 bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 text-white shadow-[0_0_28px_-12px_rgba(244,63,94,0.95)] transition-all duration-200 hover:from-rose-500 hover:via-red-500 hover:to-orange-500 hover:shadow-[0_0_34px_-8px_rgba(244,63,94,1)] disabled:opacity-60';

export const deleteDialogDangerSectionClass =
  'rounded-2xl border border-rose-500/25 bg-[linear-gradient(135deg,rgba(127,29,29,0.18),rgba(15,15,25,0.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_28px_-20px_rgba(244,63,94,0.85)]';

type RegistryDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  detail?: string | null;
  onConfirm: () => void;
  confirming?: boolean;
  confirmLabel?: string;
  blocking?: DeleteBlockingInfo | null;
  children?: ReactNode;
  contentClassName?: string;
};

/** Shared delete confirmation dialog for all registry modules. */
export function RegistryDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  detail,
  onConfirm,
  confirming = false,
  confirmLabel = 'Delete',
  blocking = null,
  children,
  contentClassName,
}: RegistryDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(deleteDialogContentClass, contentClassName)}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">{title}</DialogTitle>
        </DialogHeader>
        <div className={deleteDialogDangerSectionClass}>
          <p className="text-sm leading-6 whitespace-pre-line text-zinc-300">{description}</p>
          {detail ? (
            <p className="mt-3 truncate rounded-xl border border-rose-500/20 bg-black/20 px-3 py-2 text-xs text-rose-200">
              {detail}
            </p>
          ) : null}
        </div>
        {blocking ? <DeleteBlockingPanel blocking={blocking} /> : null}
        {children}
        <DialogFooter className={deleteDialogFooterClass}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className={deleteDialogCancelClass}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={confirming || Boolean(blocking)}
            className={deleteDialogConfirmClass}
          >
            {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use RegistryDeleteDialogTriggerButton */
export const DeleteConfirmDialog = RegistryDeleteDialog;

type RegistryDeleteDialogTriggerButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function RegistryDeleteDialogTriggerButton({
  onClick,
  disabled,
  className,
  children,
}: RegistryDeleteDialogTriggerButtonProps) {
  return (
    <Button
      type="button"
      variant="destructive"
      onClick={onClick}
      disabled={disabled}
      className={cn(deleteDialogConfirmClass, className)}
    >
      {children}
    </Button>
  );
}

/** @deprecated Use RegistryDeleteDialogTriggerButton */
export const DeleteConfirmTriggerButton = RegistryDeleteDialogTriggerButton;
