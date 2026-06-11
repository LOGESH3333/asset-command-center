import type { DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';

export function DeleteBlockingPanel({ blocking }: { blocking: DeleteBlockingInfo }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-[linear-gradient(135deg,rgba(120,53,15,0.22),rgba(15,15,25,0.82))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_28px_-20px_rgba(245,158,11,0.75)]">
      <p className="text-sm font-semibold text-amber-100">Cannot delete this record</p>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{blocking.explanation}</p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">Blocking area</dt>
          <dd className="mt-1 font-medium text-white">{blocking.tableLabel}</dd>
        </div>
        {blocking.referencedRows != null ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Referencing records</dt>
            <dd className="mt-1 font-medium text-white">{blocking.referencedRows}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
