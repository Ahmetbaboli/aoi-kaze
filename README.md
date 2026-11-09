# Aoi Kaze — Anime, Manga & Manhwa Rehberi

Next.js 14 (App Router) + TypeScript + Tailwind ile yapılmış, sade ve modern arayüzlü, iki dilli (TR/EN) bir **keşif ve takip sitesi**. Katalog verisi [AniList](https://anilist.co) API'sinden gelir.

> **Önemli:** Bu site **içerik yayınlamaz** (izleme/okuma yok). Eserlerin yanında yalnızca AniList'in listelediği **resmî platformlara** bağlantı verir.

## Özellikler

- **Katalog:** Ana sayfa vitrini ve şeritler, `/anime` `/manga` `/manhwa` listeleri (tür/format/durum/yıl filtresi, sıralama, sayfalama), detay sayfaları, anlık arama, haftalık yayın takvimi.
- **Karakter, kişi, stüdyo:** `/karakter/<id>` (biyografi, bilgiler, yer aldığı eserler, tüm dillerdeki seslendirenler), `/kisi/<id>` (seslendirdiği karakterler, yapım görevleri), `/studyo/<id>` (stüdyonun eserleri). AniList açıklamalarındaki `~!spoiler!~` blokları gizli gelir, tıklayınca açılır; açıklamalar HTML olarak basılmaz. Yalnızca +18 eserlerde geçen karakterler ve +18 eserler listelenmez. Ana sayfada **bugün doğum günü olan karakterler** şeridi var.
- **Esere özel tema:** detay sayfası eserin rengine bürünür (düğme, rozet, bağlantı, odak halkası). Renk, açık ve koyu temada WCAG 4.5:1 kontrastı sağlayana kadar otomatik koyulaştırılır/açılır (`src/lib/media-theme.ts`). Banner'a türe göre doku eklenir: korku/gerilim kumlanma, aksiyon/spor hız çizgisi, bilim kurgu/mecha ızgara, fantastik ışıltı, romantik/gündelik yumuşak ışık.
- **Mini oyun: Günlük Tahmin** (`/oyun`): her gün herkes için aynı anime (en popüler 500 TV/film animesi arasından, 365 gün tekrar yok). 6 tahmin hakkı; her yanlışta yeni ipucu açılır (yapım bilgisi → türler → stüdyo → temalar → bulanık kapak → ana karakter).
  - **Puan:** 1. tahmin 100 … 6. tahmin 15; art arda çözülen her gün +5 seri bonusu (en fazla +50). Puanlar **haftalık sezonda** toplanır (sezon pazartesi 00:00, Türkiye saati).
  - **Ödüller (yalnızca kozmetik, satın alınamaz):** sezon sonunda ilk 3'e altın çerçeve + gradyan isim + "Sezon Şampiyonu" unvanı, 4–10'a gümüş çerçeve + renkli isim, 11–50'ye bronz çerçeve. Ödüller `/oyun`'dan takılır; profilde ve sıralamada görünür. Ödüller sezon bittikten sonraki ilk sayfa açılışında dağıtılır (tekrar dağıtılmaz).
  - **Hile koruması:** cevap ve açılmamış ipuçları tarayıcıya hiç gönderilmez, tahmin ve puan sunucuda hesaplanır, kullanıcı başına günde tek oyun, eşzamanlı tahminlere karşı iyimser kilit, veritabanında puan/tahmin sınırı. Günün animesi `AUTH_SECRET`'tan türetilen gizli anahtarla seçilir (kaynak koddan tahmin edilemez). Oynamak için giriş gerekir; gizli profilli oyuncular sıralamada adıyla görünmez.
- **Listem:** Durum (planlıyorum / takipteyim / tamamladım / bıraktım), ilerleme ve favoriler; JSON olarak dışa/içe aktarılır. Hesap gerekmez: girişsizken tarayıcıda saklanır, giriş yapınca hesaba taşınır ve cihazlar arasında senkronlanır (son yazan kazanır; çevrimdışı değişiklikler kuyrukta bekler). Çıkış yapınca liste o cihazdan silinir, hesapta kalır.
- **Profil ve seviye:** `/u/<kullanıcı-adı>` profil sayfası: banner, avatar, biyografi, seviye/XP, istatistikler (izlenen/okunan bölüm, tahmini süre, tür dağılımı), 11 rozet, favori vitrini, son hareketler. Ayarlar `/hesap`'ta.
  - **XP:** anime bölümü 10, manga bölümü 4, tamamlanan eser +50. Seviye L için gereken XP: `100·(L−1)²`. İlerleme eserin toplam bölüm sayısıyla (bilinmiyorsa 5000) kırpılır. Veri kullanıcının kendi beyanı olduğu için seviye **ödüllü yarışlarda kullanılmaz**.
  - **Güvenli görseller:** dosya yükleme yok. Avatar/banner yalnızca listedeki eserlerden seçilir; istemci eser kimliği gönderir, görsel adresini sunucu AniList'ten alır ve +18 işaretli eserleri reddeder.
  - **Kullanıcı adı / biyografi filtresi:** Türkçe + İngilizce küfür ve +18 listesi (`src/lib/profile/moderation.ts`), leet ve aralıklı yazıma karşı normalizasyon, ayrılmış adlar (`admin`, `destek`...), ad 30 günde bir değişir. Hiçbir liste kusursuz değildir: listeye kelime eklemek için o dosyayı düzenle.
  - Gizli profil yalnızca sahibine görünür; profiller arama motorlarında dizine eklenmez.
- **Blog (MDX):** Okuma süresi, okuma çubuğu, içindekiler, Shiki ile kod renklendirme + kopyala düğmesi, Giscus yorumları (isteğe bağlı), RSS.
- **Ctrl+K komut paleti:** Sayfalar, tema eylemleri, katalog ve blog araması.
- **Açık / koyu tema:** Cihaz tercihini izler, seçim hatırlanır.
- **İki dil:** `/tr/...` ve `/en/...`, hreflang, dil bazlı sitemap ve RSS.
- **İletişim formu:** zod doğrulaması, honeypot, hız sınırı, Resend ve/veya webhook.
- **Erişilebilirlik / performans:** `prefers-reduced-motion` saygısı, klavye ve ekran okuyucu desteği, ağır parçalar tembel yüklenir.

## Hızlı başlangıç

Gereksinimler: **Node.js 20+** ve npm.

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev                  # http://localhost:3000
```

Üretim sürümünü denemek için: `npm run build && npm start`.

> **Windows PowerShell "betik çalıştırma devre dışı" hatası verirse:** `npm.cmd run dev` kullan ya da
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` çalıştır.

## Veritabanı (PostgreSQL + Prisma)

**İlk kurulumda önce `npm run doctor` çalıştır:** Node, Docker, ffmpeg, `.env.local` değişkenleri, veritabanı bağlantısı ve migration durumunu ✅/❌ ile listeler (gizli değerleri yazdırmaz).
Docker olmadan veritabanı mantığını doğrulamak için: `npm run db:verify` (bellekte PostgreSQL ile migration + seed + lisans tetikleyicisi testi).

```bash
npm run db:up        # Docker ile Postgres  ·  Docker yoksa .env.example'daki Neon/Supabase örneğine bak
npm run db:migrate   # migration'ları uygula
npm run db:seed      # örnek veri (sağlayıcılar + Blender açık filmleri)
```

**Docker yoksa ya da kurumsal ağ 5432 portunu engelliyorsa (ör. Neon'a ulaşılamıyorsa):** `npm run db:local`.
PGlite ile bilgisayarında, ağa çıkmadan çalışan gerçek bir PostgreSQL açar (veri `.pglite/` klasöründe kalıcıdır, `127.0.0.1:5433`).
O pencereyi açık bırak ve `.env.local`'de şu adresi kullan:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable&connection_limit=1&pgbouncer=true
```

Yerel veritabanında migration'ları `npm run db:deploy` ile uygula. `db:migrate` (`prisma migrate dev`) ikinci bir "gölge" veritabanı
oluşturmak ister, PGlite bunu desteklemez. Yeni migration *yazman* gerekirse bunu Docker'lı ya da Neon'lu bir ortamda yap.
Sıfırlamak için: `db:local` penceresini kapat, `.pglite/` klasörünü sil, yeniden başlat ve `db:deploy` + `db:seed` çalıştır.
Yalnızca geliştirme içindir.

Next.js ve Prisma tek dosyayı (`.env.local`) kullanır: `db:*` komutları `dotenv-cli` ile onu yükler (Prisma CLI normalde yalnızca `.env` okur).

**`prisma db push` kullanma:** migration'daki tetikleyiciler (lisans koruması) ve kısıtlar yalnızca `prisma migrate` ile oluşur; şema değişiklikleri her zaman `npm run db:migrate` ile yapılır.

Ayrıntılar, yerel HLS üretimi (`npm run media:hls`) ve şema değiştirme adımları: [docs/DATABASE.md](docs/DATABASE.md).

## Giriş (Auth.js v5: GitHub + e-posta)

Oturumlar veritabanında tutulur (`database` stratejisi): oturumlar sunucudan iptal edilebilir, rol her istekte veritabanından okunur. Şifreli giriş yoktur.
Bir giriş yöntemi yalnızca gerekli ortam değişkenleri tanımlıysa etkindir; giriş sayfası yalnızca etkin olanları gösterir.

| Yöntem | Değişkenler |
|---|---|
| GitHub | `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` |
| E-posta sihirli linki | `EMAIL_SERVER`, `EMAIL_FROM` |
| Discord (kodda hazır, **kapalı**) | `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` |

Her zaman gerekli: `AUTH_SECRET`. Üret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
(`npx auth secret` artık başka bir kütüphanenin aracını indiriyor ve `BETTER_AUTH_SECRET` üretiyor; kullanma).
Yönetici yapmak için e-postayı `ADMIN_EMAILS` listesine ekle (virgülle ayrılmış). Yetki için **ikisi birden** gerekir: veritabanında
`ADMIN` rolü (listedeki e-postayla ilk girişte otomatik verilir) ve e-postanın hâlâ listede olması. Listeden çıkarılan kişi yetkisini hemen kaybeder.
`.env.local` değişince `npm run dev`'i yeniden başlat.

- **GitHub OAuth uygulaması:** github.com/settings/developers → *New OAuth App* → Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- **Giriş e-postaları geliştirmede http://localhost:8025 adresine düşer** (Mailpit: `docker compose up -d mailpit`, SMTP `localhost:1025`).
- Korumalı sayfalar (`/hesap`, `/admin`): middleware yalnızca oturum çerezinin varlığına bakar; asıl yetki kontrolü sunucu bileşenlerinde (`requireUser`, `requireAdmin` — `src/lib/auth-guards.ts`).
- Kimlik mantığı testi: `npm run test:auth` (bellekte PostgreSQL ile kullanıcı oluşturma, ADMIN_EMAILS, oturum ve yetki kontrolü).
- Diğer testler: `npm run test:watchlist` (Listem senkronu), `npm run test:profile` (seviye, rozetler, küfür filtresi, profil kaydı), `npm run test:catalog` (spoiler ayrıştırıcı, tema kontrastı), `npm run test:game` (oyun kuralları, hile koruması, sezon ödülleri).

## Klasör yapısı

```
src/
├─ content/          TÜM METİNLER: tr.ts, en.ts (+ types.ts) ve blog/<dil>/*.mdx
├─ app/
│  ├─ [locale]/      Sayfalar (/tr, /en altında): ana sayfa, [kind] (anime/manga/manhwa),
│  │                 [kind]/[id], ara, takvim, listem, blog, hakkimda, projeler, iletisim, rss.xml
│  ├─ api/           /api/search, /api/contact
│  └─ globals.css    Tasarım jetonları (renkler/temalar) ve ortak CSS
├─ components/       catalog, blog, layout, palette, projects, contact, ui
├─ lib/              catalog/ (AniList), blog.ts, i18n.ts, theme.ts, watchlist.ts, ...
├─ fonts/            Gömülü yazı tipi (Nunito; SIL OFL lisanslı)
└─ middleware.ts     Dil yönlendirmesi (/ → /tr veya /en)
```

## İçeriği değiştirme

| Ne? | Nerede? |
|---|---|
| Site adı, slogan, SEO başlık/açıklamaları | `src/content/tr.ts` ve `en.ts` → `site`, `seo` |
| Menü, tüm sayfa metinleri, buton yazıları | Aynı dosyalar |
| Projeler (portfolyo sayfası) | `tr.ts` / `en.ts` → `const projects` (kendi projelerinle değiştir; `links` boşsa bağlantı gösterilmez, `image` ile kapak görseli eklenir) |
| Sosyal bağlantılar ve herkese açık e-posta | `.env.local` → `NEXT_PUBLIC_SOCIAL_*`, `NEXT_PUBLIC_CONTACT_EMAIL` (tanımsız olan görünmez) |
| Hakkımda metni, teknoloji listesi, ilkeler | `about` ve `const skills` |
| **Yeni blog yazısı** | `src/content/blog/tr/yazi-adi.mdx` (ve çeviriyse `en/` altına **aynı dosya adıyla**) |
| Renkler | `src/app/globals.css` (`--primary`, `--electric`, `--volt` ... ve açık/koyu tema blokları) |
| Logo | `src/components/ui/LogoMark.tsx` (SVG). Kendi logonu `public/` altına koyup bileşeni `next/image` ile değiştirebilirsin |
| Yazı tipi | `src/fonts/` (woff2 dosyaları) ve `src/fonts/index.ts` |

**Blog yazısı başlığı (frontmatter):**

```mdx
---
title: 'Yazının Başlığı'
description: 'Kısa özet (liste ve SEO için).'
date: '2026-05-01'
tags: ['CSS', 'Rehber']
---

İçerik burada. `## Başlık` içindekiler listesine eklenir.

```css title="dosya.css"
.ornek { color: red; }
```
```

Yazılar tarihe göre yeniden eskiye sıralanır; okuma süresi **otomatik** hesaplanır.

**Yeni dil eklemek:** `src/content/tr.ts` dosyasını kopyalayıp `xx.ts` yap, çevir, `src/content/index.ts` içindeki sözlüğe ve `src/lib/i18n.ts` içindeki `locales` listesine ekle, `src/content/blog/xx/` klasörünü aç. TypeScript eksik anahtarları sana gösterir.

> URL parçaları (`/hakkimda`, `/iletisim`, `/takvim`, `/listem`...) tüm dillerde aynıdır; yalnızca `/tr` / `/en` öneki değişir.

## Ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyala. `NEXT_PUBLIC_` ile başlayanlar **build sırasında** koda gömülür: değiştirince yeniden build al.

| Değişken | Zorunlu? | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Üretimde evet | Canlı adres (canonical, sitemap, RSS, paylaşım görseli) |
| `ANILIST_ENABLED` | Hayır | `false` → katalog kapanır, sayfalar "veriye ulaşılamıyor" uyarısı gösterir |
| `NEXT_PUBLIC_SOCIAL_GITHUB`, `_LINKEDIN`, `_TWITTER` | Hayır | İletişim sayfasındaki bağlantılar (`https://` ile başlamalı); boş olan görünmez |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Hayır | İletişim sayfasında görünen herkese açık e-posta (form hedefinden ayrıdır) |
| `CONTACT_WEBHOOK_URL` | İletişim için biri | n8n/Zapier vb. webhook adresi |
| `CONTACT_WEBHOOK_SECRET` | Hayır | `X-Webhook-Secret` başlığı olarak gönderilir |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | İletişim için biri | Resend ile e-posta (üçü birlikte) |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Hayır | Umami analitiği; ikisi de doluysa yüklenir |
| `NEXT_PUBLIC_GISCUS_REPO`, `_REPO_ID`, `_CATEGORY`, `_CATEGORY_ID` | Hayır | Blog yorumları; dördü de doluysa görünür |

### İletişim formu: Resend mi, webhook mu?

| | Resend | Webhook (n8n) |
|---|---|---|
| Kurulum | Hesap + alan adı doğrulama + API anahtarı | Yalnızca bir URL |
| Sonuç | Doğrudan e-postana düşer (yanıtla = ziyaretçiye gider) | Sen karar verirsin: e-posta, Telegram, Notion, tablo... |
| Maliyet | Ücretsiz kota var | Kendi n8n'inde sıfır |
| Dikkat | Gönderen alan adı doğrulanmalı | n8n'e erişilebilir ve (tercihen) gizli anahtar kontrollü olmalı |

İkisini birlikte tanımlarsan mesaj **ikisine de** gider; biri başarısız olsa bile diğeri başarılıysa kullanıcıya başarı döner.

Webhook'a giden JSON: `{ "name", "email", "message", "locale", "receivedAt" }`. n8n'de "Webhook" düğümünde yöntemi `POST` yap, gizli anahtarı kullanıyorsan `X-Webhook-Secret` başlığını bir IF düğümüyle doğrula.

Hiçbir hedef tanımlı değilse: geliştirmede mesaj sunucu konsoluna yazılır; **üretimde form 503 döner** (mesaj sessizce kaybolmasın diye).

## Katalog verisi

Veri AniList GraphQL API'sinden gelir. Başarılı yanıtlar sunucuda bir saat önbelleğe alınır. Katalog sayfaları (ana sayfa, listeler, detay, takvim) her istekte render edilir; böylece bir AniList hatası önbelleğe girmez ve kaynak düzelince sayfa kendiliğinden toparlanır.

- **AniList'e ulaşılamazsa uydurma veri gösterilmez.** Sayfada "Katalog verisine şu an ulaşılamıyor" uyarısı çıkar, arama API'si 503 döner. Hata sonrası 60 saniye boyunca yeniden denenmez; geçici hatalarda (ağ kopması, 429, 5xx) istek artan aralıklarla (0,4 sn, 1,2 sn) iki kez daha denenir; zaman aşımı (8 sn) tekrarlanmaz.
- Başlık ve özetler AniList'ten İngilizce gelir (arayüz çevrilir, içerik çevrilmez).
- AniList'in kullanım koşullarına saygı için footer'da atıf vardır; kaldırma.
- **Kurumsal ağda** SSL denetimi AniList isteklerini bozabilir: kurumsal kök sertifikayı PEM olarak dışa aktarıp `NODE_EXTRA_CA_CERTS=C:\yol\kok.pem` ortam değişkeniyle Node'a tanıt (değişkeni ayarladıktan sonra terminali yeniden aç).

## Yayına alma

### Vercel

1. Projeyi GitHub'a it.
2. [vercel.com/new](https://vercel.com/new) → depoyu içe aktar (Framework: Next.js, ayar gerekmez).
3. *Settings → Environment Variables* bölümüne `.env.example` içindeki değişkenleri gir (en az `NEXT_PUBLIC_SITE_URL` ve bir iletişim hedefi).
4. Deploy et. Alan adını *Settings → Domains* bölümünden bağla ve `NEXT_PUBLIC_SITE_URL`'i güncelleyip yeniden deploy al.

Not: İletişim formunun hız sınırı bellek içidir; Vercel'de her sunucusuz örnek ayrı sayar. Kesin sınır istersen Upstash Redis gibi paylaşımlı bir depo kullan.

### Docker (kendi sunucun)

Dockerfile çok aşamalıdır ve Next.js `standalone` çıktısını kullanır (küçük imaj, root olmayan kullanıcı).

```bash
cp .env.example .env.local        # değerleri doldur
docker compose up -d --build      # http://sunucu:3000
```

Elle çalıştırmak istersen:

```bash
docker build -t aoi-kaze \
  --build-arg NEXT_PUBLIC_SITE_URL=https://siten.com .
docker run -d --name aoi-kaze -p 3000:3000 --env-file .env.local --restart unless-stopped aoi-kaze
```

Önüne Nginx/Caddy/Traefik gibi bir ters vekil koyup HTTPS'i orada sonlandır; `X-Forwarded-For` ve `X-Forwarded-Host` başlıklarını ilettiğinden emin ol (hız sınırı ve form kaynak kontrolü bunları kullanır). Güncelleme: `git pull && docker compose up -d --build`.

> Docker imajı bu depoda yerelde **derlenip çalıştırılmadı** (geliştirme makinesinde Docker yoktu); aynı `standalone` çıktı elle çalıştırılıp doğrulandı. İlk Docker build'inde bir sorun görürsen hata çıktısını paylaş.

## Klavye

- **Ctrl+K** (macOS: ⌘K): komut paleti.
- Üst çubukta dil ve tema düğmeleri.

## Erişilebilirlik ve performans

- Tüm etkileşimli öğeler klavyeyle kullanılabilir; modal ve menüler odağı yönetir, bildirimler `aria-live` ile duyurulur.
- `prefers-reduced-motion` açıkken Framer Motion dönüşüm animasyonları ve vitrinin otomatik geçişi devre dışıdır.
- Ağır parçalar (Framer Motion özellikleri, komut paleti) tembel/ertelemeli yüklenir. Yazı tipi projeye gömülüdür (Google'a istek yok).

## Telif ve lisanslar

- Logo kodla üretilmiş orijinal bir SVG'dir.
- Yazı tipi (Nunito) SIL Open Font License altındadır (`src/fonts/LICENSE-*.txt`).
- AniList kapak ve banner görselleri ilgili hak sahiplerine aittir.
