'use client';

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import type { Content } from '@/content';
import { reportUserAction } from '@/lib/admin/actions';
import { USER_REPORT_REASONS } from '@/lib/admin/reasons';
import Button from '@/components/ui/Button';
import Link from '@/components/ui/LocLink';
import { useToast } from '@/components/ui/Toast';

interface ReportButtonProps {
  username: string;
  signedIn: boolean;
  loginHref: string;
  content: Content['report'];
}

/** Profil şikâyeti: küçük bir düğme, tıklayınca neden + not soran açılır form (dialog). */
export default function ReportButton({ username, signedIn, loginHref, content: r }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { push } = useToast();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!signedIn) {
    return (
      <Link href={loginHref} className="text-xs font-semibold text-muted hover:text-primary-text hover:underline" title={r.signIn}>
        ⚑ {r.button}
      </Link>
    );
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!reason) {
      setError(r.errors.invalid_reason);
      return;
    }
    startTransition(async () => {
      try {
        const result = await reportUserAction(username, reason, note);
        if (result.ok) {
          push(r.sent);
          setOpen(false);
          setReason('');
          setNote('');
        } else setError(r.errors[result.error] ?? r.errors.generic);
      } catch {
        setError(r.errors.generic);
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-muted hover:text-primary-text hover:underline">
        ⚑ {r.button}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-cel-lg backdrop:bg-black/60"
      >
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h2 id={titleId} className="font-display text-xl">
            {r.title}
          </h2>
          <p className="text-sm text-muted">{r.text}</p>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{r.reason}</legend>
            <div className="space-y-1.5">
              {USER_REPORT_REASONS.map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[rgb(var(--primary))]" />
                  {r.reasons[value]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${titleId}-note`} className="mb-1 block text-sm font-semibold">
              {r.note}
            </label>
            <textarea id={`${titleId}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} placeholder={r.notePlaceholder} className="field w-full resize-y" />
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-primary-text">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {r.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {r.send}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
