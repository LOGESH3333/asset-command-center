'use client';

import { motion } from 'framer-motion';
import { Check, Clock, X, GitBranch } from 'lucide-react';
import type { RequestApproval } from '@/lib/brd/types';
import { formatPersonName } from '@/lib/display-labels';
import { getWorkflowProgressSteps, getWorkflowStageLabel } from '@/lib/brd/request-workflow';
import type { ApprovalStage } from '@/lib/brd/types';
import { cn } from '@/lib/utils';

type ApprovalWorkflowTimelineProps = {
  requestStatus: string;
  approvals: RequestApproval[];
};

const stageOrder: ApprovalStage[] = ['Manager', 'Procurement', 'Finance'];

function stageIcon(status: string) {
  if (status === 'Approved') return { Icon: Check, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  if (status === 'Rejected') return { Icon: X, className: 'text-red-400 bg-red-500/10 border-red-500/20' };
  return { Icon: Clock, className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
}

export function ApprovalWorkflowTimeline({ requestStatus, approvals }: ApprovalWorkflowTimelineProps) {
  const progressSteps = getWorkflowProgressSteps(requestStatus);

  const approvalsByStage = stageOrder.map((stage) =>
    approvals.filter((a) => a.approval_stage === stage)
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="h-4 w-4 text-violet-400" />
          Workflow Progress
        </h3>
        <div className="flex flex-wrap gap-2">
          {progressSteps.map((step, i) => (
            <div
              key={step.key}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium',
                step.done && 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
                step.active && !step.done && 'border-violet-500/30 bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/20',
                !step.done && !step.active && 'border-white/[0.06] bg-white/[0.02] text-zinc-500'
              )}
            >
              <span className="mr-1 text-[10px] text-zinc-600">{i + 1}.</span>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold">Approval History</h3>
        <div className="relative space-y-0">
          <div className="absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-violet-500/40 via-indigo-500/20 to-transparent" />

          {stageOrder.map((stage, stageIdx) => {
            const stageApprovals = approvalsByStage[stageIdx];
            const latest = stageApprovals[stageApprovals.length - 1];
            const config = stageIcon(latest?.status ?? 'Pending');
            const Icon = config.Icon;

            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: stageIdx * 0.06 }}
                className="relative flex gap-4 pb-8 last:pb-0"
              >
                <div
                  className={cn(
                    'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                    config.className
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {getWorkflowStageLabel(stage)}
                    </span>
                    <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-violet-300">
                      {latest?.status ?? 'Not started'}
                    </span>
                  </div>

                  {stageApprovals.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No approval record yet.</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {stageApprovals.map((entry) => (
                        <li key={entry.id} className="border-t border-white/[0.04] pt-3 first:border-0 first:pt-0">
                          <p className="text-sm text-zinc-300">
                            {entry.status === 'Pending'
                              ? 'Awaiting decision'
                              : `${entry.status} by ${formatPersonName(entry.users, 'System')}`}
                          </p>
                          {entry.comments && (
                            <p className="mt-1 text-xs italic text-zinc-500">
                              &ldquo;{entry.comments}&rdquo;
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-zinc-600">
                            {entry.decided_at
                              ? `Decided ${new Date(entry.decided_at).toLocaleString()}`
                              : `Created ${new Date(entry.created_at).toLocaleString()}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
