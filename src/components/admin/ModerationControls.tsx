'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Content } from '@/content';
import { closeReportsAction, moderateAction } from '@/lib/admin/actions';
import { fmt } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

type Labels = Content['admin'];
type Action = 'reset_username' | 'clear_bio' | 'reset_images' | 'hide_profile' | 'ban' | 'unban' | 'clear_scores';

interface ModerationControlsProps {
  user: { id: string; username: string | null; bannedAt: Date | string | null; profilePublic: boolean };
  /** Haftalık sezon ("2026-W46"): puan silme yalnızca bu sezonu etkiler. */
  season: string;
  hasOpenReports: boolean;
  content: Labels;
}

const chip =
  'rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold transition hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-50';

/** Bir kullanıcıya yönetici işlemleri. Her işlem onay ister; yasaklama gerekçe ister. */
export default function ModerationControls({ user, season, hasOpenReports, content: a }: ModerationControlsProps) {
  const [pending, startTransition] = useTransition();
  const [resolveToo, setResolveToo] = useState(hasOpenReports);
  const [banOpen, setBanOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { push } = useToast();
  const name = user.username ?? user.id;

  const run = (action: Action, extra: { reason?: string } = {}) => {
    setError(null);
    if (action !== 'ban' && !window.confirm(fmt(a.actions.confirm, { action: a.actions[action], user: name }))) return;
    startTransition(async () => {
      try {
        const result = await moderateAction(user.id, action, { ...extra, season, resolveReports: resolveToo && hasOpenReports });
        if (result.ok) {
          push(a.actions.done);
          setBanOpen(false);
          setReason('');
          router.refresh();
        } else setError(a.actions.errors[result.error] ?? a.actions.errors.generic);
      } catch {
        setError(a.actions.errors.generic);
      }
    });
  };

  const actions: Action[] = ['reset_username', 'clear_bio', 'reset_images', ...(user.profilePublic ? (['hide_profile'] as const) : []), 'clear_scores'];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button key={action} type="button" disabled={pending} onClick={() => run(action)} className={chip}>
            {a.actions[action]}
          </button>
        ))}
        {user.bannedAt ? (
          <button type="button" disabled={pending} onClick={() => run('unban')} className={chip}>
            {a.actions.unban}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setBanOpen((v) => !v)}
            aria-expanded={banOpen}
            className={`${chip} border-primary/50 text-primary-text`}
          >
            ⛔ {a.actions.ban}
          </button>
        )}
      </div>

      {banOpen && !user.bannedAt && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim()) {
              setError(a.actions.errors.reason_required);
              return;
            }
            run('ban', { reason });
          }}
        >
          <label className="sr-only" htmlFor={`ban-${user.id}`}>
            {a.actions.banReason}
          </label>
          <input
            id={`ban-${user.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder={a.actions.banReason}
            className="field flex-1"
          />
          <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {a.actions.banConfirm}
          </button>
        </form>
      )}

      {hasOpenReports && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={resolveToo} onChange={(e) => setResolveToo(e.target.checked)} className="accent-[rgb(var(--primary))]" />
          {a.actions.resolveToo}
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-primary-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** Şikâyetleri işlem yapmadan kapat. */
export function CloseReportsButtons({ userId, content: a }: { userId: string; content: Labels }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  const close = (status: 'RESOLVED' | 'DISMISSED') =>
    startTransition(async () => {
      try {
        const result = await closeReportsAction(userId, status);
        push(result.ok ? a.actions.done : a.actions.errors.generic);
        if (result.ok) router.refresh();
      } catch {
        push(a.actions.errors.generic);
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => close('RESOLVED')} className={chip}>
        ✓ {a.reports.resolve}
      </button>
      <button type="button" disabled={pending} onClick={() => close('DISMISSED')} className={chip}>
        ✕ {a.reports.dismiss}
      </button>
    </div>
  );
}
