import type { Metadata } from 'next';
import { getContent } from '@/content';
import { requireUser } from '@/lib/auth-guards';
import { getMediaImages } from '@/lib/catalog';
import { db } from '@/lib/db';
import type { Locale } from '@/lib/i18n';
import { BIO_MAX } from '@/lib/profile/profile-core';
import PageContainer from '@/components/layout/PageContainer';
import ProfileForm from '@/components/profile/ProfileForm';
import SectionHeading from '@/components/ui/SectionHeading';

interface AccountPageProps {
  params: { locale: Locale };
}

export function generateMetadata({ params }: AccountPageProps): Metadata {
  return { title: getContent(params.locale).auth.account.title, robots: { index: false, follow: false } };
}

// Oturuma bağlı: her istekte render edilir.
export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: AccountPageProps) {
  const { locale } = params;
  // Middleware yalnızca çerezin varlığına bakar; asıl kontrol burada, veritabanındaki oturumla yapılır.
  const sessionUser = await requireUser({ locale, callbackUrl: `/${locale}/hesap` });
  const c = getContent(locale);
  const a = c.auth.account;

  const [user, entries] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: sessionUser.id } }),
    // Görsel seçenekleri: önce favoriler, sonra en son güncellenenler (en fazla 30 eser).
    db.listEntry.findMany({
      where: { userId: sessionUser.id, anime: { anilistId: { not: null } } },
      select: { anime: { select: { anilistId: true } } },
      orderBy: [{ favorite: 'desc' }, { updatedAt: 'desc' }],
      take: 30,
    }),
  ]);
  const ids = entries.map((e) => e.anime.anilistId!);
  const images = ids.length > 0 ? await getMediaImages(ids) : [];
  // AniList'in döndürdüğü sırayı listedeki sıraya göre düzenle.
  const options = images === null ? null : ids.map((id) => images.find((m) => m.id === id)).filter((m) => !!m);

  const rows: [string, string][] = [
    [a.email, user.email ?? '—'],
    [a.role, a.roles[user.role]],
    [a.language, user.locale.toUpperCase()],
  ];

  return (
    <PageContainer className="max-w-3xl">
      <SectionHeading title={c.settings.title} subtitle={c.settings.subtitle} />
      <ProfileForm
        content={c.settings}
        locale={locale}
        bioMax={BIO_MAX}
        options={options}
        initial={{
          username: user.username ?? '',
          bio: user.bio ?? '',
          profilePublic: user.profilePublic,
          avatar: user.avatarUrl,
          banner: user.bannerUrl,
          providerImage: user.image,
        }}
      />

      <h2 className="mb-4 mt-14 font-display text-xl">{a.title}</h2>
      <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-5 py-4">
            <dt className="text-sm font-semibold text-muted">{label}</dt>
            <dd className="min-w-0 truncate font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </PageContainer>
  );
}
