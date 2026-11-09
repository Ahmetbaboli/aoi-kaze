# Veritabanı

PostgreSQL 16 + Prisma 6. Geliştirme ve canlı ortam **aynı sağlayıcıyı** kullanır; migration'lar tek bir sağlayıcıya kilitlidir.

## Hızlı başlangıç

```bash
copy .env.example .env.local     # macOS/Linux: cp .env.example .env.local
npm run db:up                    # Docker ile Postgres (localhost:5432)
npm run db:migrate               # migration'ları uygular
npm run db:seed                  # sağlayıcılar + Blender açık filmleri
npm run db:studio                # tabloları tarayıcıda gör
```

Docker kullanamıyorsan `.env.example` içindeki Neon / Supabase örneklerine bak ve `DATABASE_URL`'i değiştir.

### Tek ortam dosyası: `.env.local`

Next.js `.env.local`'ı okur ama Prisma CLI yalnızca `.env`'i okur. İki dosya tutmamak için tüm `db:*` komutları
`dotenv -e .env.local -- prisma …` ile çalışır; böylece Next.js ve Prisma aynı dosyayı kullanır.
`npx prisma …`'yi doğrudan çalıştırırsan `DATABASE_URL` bulunamaz; onun yerine `npm run db:*` kullan
(ya da `npx dotenv -e .env.local -- prisma <komut>`).

## ⚠️ `prisma db push` KULLANMA

`prisma/migrations/…_init/migration.sql` dosyasında Prisma şemasında ifade edilemeyen, **elle yazılmış** parçalar vardır:

| Parça | Amaç |
|---|---|
| `EpisodeSource_licensed_provider` tetikleyicisi | `EpisodeSource` yalnızca `licensed = true` olan bir `ProviderConfig`'e bağlanabilir |
| `ProviderConfig_protect_licensed` tetikleyicisi | Bağlı kaynak varken bir sağlayıcının lisans işareti kaldırılamaz |
| `CHECK` kısıtları | Oy ±1, bölüm puanı 1–5, liste puanı 1–10, intro bitişi > başlangıcı |

`prisma db push` migration dosyalarını çalıştırmaz; şemayı doğrudan veritabanına uygular. Bu durumda tetikleyiciler
ve kısıtlar **hiç oluşmaz** (ya da var olanlar sessizce düşer) ve lisans koruması kalkar. Bu yüzden:

- Şema değişiklikleri **her zaman** `npm run db:migrate` (`prisma migrate dev`) ile yapılır.
- Canlıda yalnızca `npm run db:deploy` (`prisma migrate deploy`) çalıştırılır.
- Şemayı sıfırlamak için `npm run db:reset` (`prisma migrate reset`); tüm migration'lar yeniden uygulanır ve seed çalışır.

## Şema değiştirirken tetikleyicileri korumak

1. `prisma/schema.prisma`'yı düzenle.
2. `npx dotenv -e .env.local -- prisma migrate dev --create-only --name kisa_aciklama` ile migration'ı **oluştur ama uygulama**.
3. Üretilen `migration.sql`'i gözden geçir. Prisma bir tabloyu yeniden oluşturuyorsa (`DROP TABLE` + `CREATE TABLE`),
   o tabloya bağlı tetikleyici ve `CHECK` kısıtlarını yeni migration'a **elle yeniden ekle**.
4. `npm run db:migrate` ile uygula.

Prisma, `CHECK` kısıtlarını ve tetikleyicileri şemadan göremez; bu yüzden drift (sapma) uyarısı vermez, ama düşürürse de haber vermez.
İlgili migration dosyasını silme ya da yeniden yazma; her zaman yeni bir migration ekle.

## Lisans korumasının katmanları

1. **Veritabanı** — yukarıdaki tetikleyiciler (son savunma hattı).
2. **Sunucu** — kaynak ekleyen Server Action/API, `ProviderConfig.licensed`'ı ayrıca doğrular (adım c'de eklenecek).
3. **Admin paneli** — yalnızca lisanslı sağlayıcılar seçilebilir (Aşama 7).

`local` sağlayıcısı yalnızca `scripts/make-hls.mjs`'in ürettiği Blender açık filmleri içindir. `public/media/`
altına lisansı belirsiz içerik koyma: `local` sağlayıcısı `licensed = true` işaretlidir ve koruma bu işarete dayanır.

## Yerel HLS videoları (Blender açık filmleri)

```bash
npm run media:hls                      # Big Buck Bunny, Sintel, Tears of Steel (indirir + dönüştürür)
npm run media:hls -- --only sintel     # yalnızca biri
npm run media:hls -- --short 60        # her filmin ilk 60 saniyesi (hızlı deneme)
npm run media:hls -- --force           # var olanı yeniden üret
npm run db:seed                        # dosyalar varsa "local" kaynaklarını ekler
```

- **ffmpeg** PATH'te olmalı (`winget install Gyan.FFmpeg`, `brew install ffmpeg`, `sudo apt install ffmpeg`).
- Çıktı `public/media/<slug>/master.m3u8` (720p + 480p). İndirilen kaynaklar `media-src/` altında önbelleğe alınır.
  İkisi de `.gitignore`'dadır.
- Filmler Blender Foundation'a aittir, CC BY 3.0 ile yayımlanır; her çıktı klasöründe atıf içeren bir `LICENSE.txt` bulunur.
- Dosyalar büyüktür (yaklaşık yarım GB indirme); tam dönüştürme birkaç dakika sürebilir. Önce `--short 60` ile dene.
