'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import type { Content } from '@/content';
import { saveProfile } from '@/lib/profile/actions';
import type { AvatarChoice, BannerChoice, ProfileError, SaveResult } from '@/lib/profile/profile-core';
import { cn, fmt } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Link from '@/components/ui/LocLink';
import { useToast } from '@/components/ui/Toast';

export interface ImageOption {
  id: number;
  title: string;
  cover: string | null;
  banner: string | null;
}

interface ProfileFormProps {
  content: Content['settings'];
  locale: string;
  initial: { username: string; bio: string; profilePublic: boolean; avatar: string | null; banner: string | null; providerImage: string | null };
  /** null: AniList'e ulaşılamadı */
  options: ImageOption[] | null;
  bioMax: number;
}

type Errors = Partial<Record<'username' | 'bio' | 'avatar' | 'banner', ProfileError>>;

const pickClass = (selected: boolean) =>
  cn(
    'relative overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    selected ? 'border-primary ring-2 ring-primary/40' : 'border-transparent opacity-80 hover:opacity-100',
  );

export default function ProfileForm({ content: s, locale, initial, options, bioMax }: ProfileFormProps) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [isPublic, setIsPublic] = useState(initial.profilePublic);
  const [avatar, setAvatar] = useState<AvatarChoice>('keep');
  const [banner, setBanner] = useState<BannerChoice>('keep');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState(initial.username);

  // Seçili görünen avatar/banner: değiştirilmemişse kayıtlı olanla eşleşen seçenek.
  const avatarSelected = (key: 'provider' | number) =>
    avatar === 'keep' ? (key === 'provider' ? !initial.avatar : options?.find((o) => o.id === key)?.cover === initial.avatar) : avatar === key;
  const bannerSelected = (key: 'none' | number) =>
    banner === 'keep'
      ? key === 'none'
        ? !initial.banner
        : [options?.find((o) => o.id === key)?.banner, options?.find((o) => o.id === key)?.cover].includes(initial.banner)
      : banner === key;

  const message = (error: ProfileError | undefined, retryAt?: number) =>
    error
      ? fmt(s.errors[error], {
          max: bioMax,
          date: retryAt ? new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long' }).format(retryAt) : '',
        })
      : null;

  const [retryAt, setRetryAt] = useState<number | undefined>();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    startTransition(async () => {
      let result: SaveResult;
      try {
        result = await saveProfile({ username, bio, profilePublic: isPublic, avatar, banner });
      } catch {
        setFormError(s.errors.generic);
        return;
      }
      if (result.ok) {
        setErrors({});
        setSavedName(result.username);
        setUsername(result.username);
        push(s.saved);
        router.refresh(); // menüdeki avatar ve sayfa verisi yenilensin
        return;
      }
      setErrors(result.errors);
      setRetryAt(result.retryAt);
      if (result.form) setFormError(s.errors[result.form]);
      else if (Object.keys(result.errors).length === 0) setFormError(s.errors.generic);
    });
  };

  const fieldError = (field: keyof Errors) =>
    errors[field] ? (
      <p id={`${field}-error`} role="alert" className="mt-1.5 text-sm font-semibold text-primary-text">
        {message(errors[field], retryAt)}
      </p>
    ) : null;

  const withImages = options?.filter((o) => o.cover) ?? [];

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <div className="flex justify-end">
        <Link href={`/u/${savedName}`} className="text-sm font-semibold text-primary-text hover:underline">
          {s.viewProfile} →
        </Link>
      </div>

      {/* Kullanıcı adı */}
      <div>
        <label htmlFor="username" className="mb-1 block font-semibold">
          {s.username}
        </label>
        <div className="flex items-center rounded-lg border border-line bg-surface focus-within:ring-2 focus-within:ring-primary">
          <span aria-hidden="true" className="pl-3 text-muted">
            @
          </span>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
            maxLength={20}
            autoComplete="username"
            spellCheck={false}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? 'username-error username-hint' : 'username-hint'}
            className="w-full bg-transparent px-1.5 py-2.5 outline-none"
          />
        </div>
        <p id="username-hint" className="mt-1.5 text-sm text-muted">
          {s.usernameHint}
        </p>
        {fieldError('username')}
      </div>

      {/* Biyografi */}
      <div>
        <label htmlFor="bio" className="mb-1 block font-semibold">
          {s.bio}
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={bioMax + 50}
          placeholder={s.bioPlaceholder}
          aria-invalid={!!errors.bio}
          aria-describedby={errors.bio ? 'bio-error bio-hint' : 'bio-hint'}
          className="field w-full resize-y"
        />
        <p id="bio-hint" className={cn('mt-1.5 text-sm', bio.length > bioMax ? 'font-semibold text-primary-text' : 'text-muted')}>
          {fmt(s.bioHint, { max: bioMax })} ({bio.length}/{bioMax})
        </p>
        {fieldError('bio')}
      </div>

      {/* Gizlilik */}
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-1 h-5 w-5 accent-[rgb(var(--primary))]" />
        <span>
          <span className="block font-semibold">{s.public}</span>
          <span className="block text-sm text-muted">{s.publicHint}</span>
        </span>
      </label>

      {options === null && <p className="rounded-lg bg-volt p-3 text-sm font-semibold text-ink">{s.unavailable}</p>}

      {/* Avatar */}
      <fieldset aria-describedby="avatar-hint">
        <legend className="mb-1 font-semibold">{s.avatar}</legend>
        <p id="avatar-hint" className="mb-3 text-sm text-muted">
          {options && withImages.length === 0 ? s.noOptions : s.pickHint}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" aria-pressed={avatarSelected('provider')} onClick={() => setAvatar('provider')} className={cn(pickClass(avatarSelected('provider')), 'h-16 w-16 rounded-full')} title={s.avatarProvider}>
            {initial.providerImage ? (
              <Image src={initial.providerImage} alt={s.avatarProvider} fill sizes="64px" unoptimized className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary font-bold text-white">{initial.username[0]?.toUpperCase()}</span>
            )}
          </button>
          {withImages.map((o) => (
            <button key={o.id} type="button" aria-pressed={avatarSelected(o.id)} onClick={() => setAvatar(o.id)} className={cn(pickClass(avatarSelected(o.id)), 'h-16 w-16 rounded-full')} title={o.title}>
              <Image src={o.cover!} alt={o.title} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
        {fieldError('avatar')}
      </fieldset>

      {/* Banner */}
      <fieldset>
        <legend className="mb-3 font-semibold">{s.banner}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button type="button" aria-pressed={bannerSelected('none')} onClick={() => setBanner('none')} className={cn(pickClass(bannerSelected('none')), 'flex aspect-[3/1] items-center justify-center bg-fg/5 text-sm font-semibold text-muted')}>
            {s.bannerNone}
          </button>
          {withImages.map((o) => (
            <button key={o.id} type="button" aria-pressed={bannerSelected(o.id)} onClick={() => setBanner(o.id)} className={cn(pickClass(bannerSelected(o.id)), 'aspect-[3/1] bg-night')} title={o.title}>
              <Image src={(o.banner ?? o.cover)!} alt={o.title} fill sizes="(min-width: 640px) 15rem, 45vw" className="object-cover" />
            </button>
          ))}
        </div>
        {fieldError('banner')}
      </fieldset>

      {formError && (
        <p role="alert" className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm font-semibold">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? s.saving : s.save}
      </Button>
    </form>
  );
}
