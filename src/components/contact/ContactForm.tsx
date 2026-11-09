'use client';

import { useState, type FormEvent } from 'react';
import type { Content } from '@/content';
import { CONTACT_LIMITS } from '@/lib/contact/schema';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/ui/LocaleProvider';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

type Field = 'name' | 'email' | 'message';
type Errors = Partial<Record<Field, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-base text-fg placeholder:text-muted focus-visible:border-primary';

export default function ContactForm({ content }: { content: Content['contact']['form'] }) {
  const { push } = useToast();
  const locale = useLocale();
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
    };

    const nextErrors: Errors = {};
    if (!values.name) nextErrors.name = content.required;
    if (!values.email) nextErrors.email = content.required;
    else if (!EMAIL_PATTERN.test(values.email)) nextErrors.email = content.invalidEmail;
    if (values.message.length < CONTACT_LIMITS.minMessage) nextErrors.message = content.required;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // "website" bir honeypot alanıdır: gerçek kullanıcılar bunu görmez ve boş bırakır.
        body: JSON.stringify({ ...values, locale, website: String(data.get('website') ?? '') }),
      });
      if (response.ok) {
        push(content.success);
        form.reset();
      } else {
        push(response.status === 429 ? content.tooMany : content.error);
      }
    } catch {
      push(content.error);
    } finally {
      setSending(false);
    }
  };

  const fields: Array<{ name: Field; label: string; placeholder: string; type?: string; max: number }> = [
    { name: 'name', label: content.name, placeholder: content.namePlaceholder, max: CONTACT_LIMITS.name },
    { name: 'email', label: content.email, placeholder: content.emailPlaceholder, type: 'email', max: CONTACT_LIMITS.email },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-cel-sm sm:p-8">
      <form onSubmit={handleSubmit} noValidate className="relative grid gap-5">
        {fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="mb-1 block font-bold">
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              type={field.type ?? 'text'}
              autoComplete={field.name === 'name' ? 'name' : 'email'}
              placeholder={field.placeholder}
              maxLength={field.max}
              aria-invalid={errors[field.name] ? true : undefined}
              aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
              className={cn(inputClass, errors[field.name] && 'border-primary')}
            />
            {errors[field.name] && (
              <p id={`${field.name}-error`} role="alert" className="mt-1 text-sm font-bold text-primary-text">
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}

        <div>
          <label htmlFor="message" className="mb-1 block font-bold">
            {content.message}
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            maxLength={CONTACT_LIMITS.message}
            placeholder={content.messagePlaceholder}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? 'message-error' : undefined}
            className={cn(inputClass, 'resize-y', errors.message && 'border-primary')}
          />
          {errors.message && (
            <p id="message-error" role="alert" className="mt-1 text-sm font-bold text-primary-text">
              {errors.message}
            </p>
          )}
        </div>

        {/* Honeypot: ekranda ve ekran okuyucuda görünmez, klavyeyle de odaklanılamaz. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div>
          <Button type="submit" disabled={sending}>
            {sending ? content.sending : content.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
