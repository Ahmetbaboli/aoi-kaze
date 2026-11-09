-- AlterTable
ALTER TABLE "EpisodeSource" ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "SubtitleTrack" (
    "id" TEXT NOT NULL,
    "episodeSourceId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'vtt',
    "translatorGroupId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubtitleTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubtitleTrack_episodeSourceId_idx" ON "SubtitleTrack"("episodeSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SubtitleTrack_episodeSourceId_lang_translatorGroupId_key" ON "SubtitleTrack"("episodeSourceId", "lang", "translatorGroupId");

-- AddForeignKey
ALTER TABLE "SubtitleTrack" ADD CONSTRAINT "SubtitleTrack_episodeSourceId_fkey" FOREIGN KEY ("episodeSourceId") REFERENCES "EpisodeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtitleTrack" ADD CONSTRAINT "SubtitleTrack_translatorGroupId_fkey" FOREIGN KEY ("translatorGroupId") REFERENCES "TranslatorGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Elle eklenen kısıtlar (Prisma şemasında ifade edilemeyenler; bkz. docs/DATABASE.md)
-- ---------------------------------------------------------------------------

-- Postgres'te NULL değerler birbirinden farklı sayılır; bu yüzden (kaynak, dil, çevirmen grubu) benzersizliği
-- grup NULL iken işlemez. Grubu olmayan altyazılar için (kaynak, dil) kısmi benzersiz indeksle tamamlanır.
CREATE UNIQUE INDEX "SubtitleTrack_source_lang_nogroup_key"
  ON "SubtitleTrack"("episodeSourceId", "lang")
  WHERE "translatorGroupId" IS NULL;

-- Şimdilik yalnızca WebVTT altyazı biçimi desteklenir.
ALTER TABLE "SubtitleTrack" ADD CONSTRAINT "SubtitleTrack_format_check" CHECK ("format" = 'vtt');

-- Bildirim notu en fazla 300 karakter (uygulama katmanında da doğrulanır).
ALTER TABLE "Report" ADD CONSTRAINT "Report_note_length_check" CHECK ("note" IS NULL OR char_length("note") <= 300);

-- Bozuk kaynak sayacı negatif olamaz.
ALTER TABLE "EpisodeSource" ADD CONSTRAINT "EpisodeSource_brokenReports_check" CHECK ("brokenReports" >= 0);
