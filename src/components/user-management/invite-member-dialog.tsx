'use client';

import { useState } from 'react';
import { inviteUserAction } from '@/app/actions/invitations';
import type { AppRole } from '@/lib/auth/roles';
import { INVITABLE_ROLES } from '@/lib/auth/roles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2, Send } from 'lucide-react';

type InviteMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const inviteFieldClass =
  'rounded-xl border border-violet-500/25 bg-[rgba(11,11,20,0.82)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-zinc-500 focus-visible:border-violet-400/60 focus-visible:ring-violet-500/30';

const inviteLabelClass = 'text-sm font-medium text-white';

export function InviteMemberDialog({ open, onOpenChange, onSuccess }: InviteMemberDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<AppRole>('Employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setDepartment('');
    setRole('Employee');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const result = await inviteUserAction({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim() || undefined,
      role,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccessMsg(
      result.activationUrl
        ? `Invitation sent. Activation link (dev): ${result.activationUrl}`
        : 'Invitation sent successfully.'
    );
    onSuccess();
    setTimeout(() => {
      reset();
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="overflow-hidden rounded-2xl border border-violet-500/25 bg-[linear-gradient(145deg,rgba(12,12,20,0.96),rgba(8,8,15,0.98))] text-white shadow-[0_24px_80px_-30px_rgba(0,0,0,0.95),0_0_44px_-24px_rgba(139,92,246,0.95)] backdrop-blur-2xl duration-200 sm:max-w-md data-open:zoom-in-95">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">Invite Member</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-zinc-400">
            Send a secure invitation to join Asset Command Center. They will create their password on first login.
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorAlert message={error} />}
        {successMsg && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {successMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className={inviteLabelClass}>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={inviteFieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label className={inviteLabelClass}>Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={inviteFieldClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className={inviteLabelClass}>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inviteFieldClass}
            />
          </div>

          <div className="space-y-2">
            <Label className={inviteLabelClass}>Department</Label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Operations"
              className={inviteFieldClass}
            />
          </div>

          <div className="space-y-2">
            <Label className={inviteLabelClass}>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className={inviteFieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-0 bg-transparent p-4 shadow-none sm:flex-row sm:justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-violet-400/20 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_28px_-12px_rgba(139,92,246,0.95)] transition-all duration-200 hover:shadow-[0_0_34px_-8px_rgba(139,92,246,1)] disabled:opacity-60"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
