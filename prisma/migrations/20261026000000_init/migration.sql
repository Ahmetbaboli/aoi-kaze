-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AudioType" AS ENUM ('SUB', 'DUB');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('ANIME', 'MANGA', 'MANHWA');

-- CreateEnum
CREATE TYPE "ListStatus" AS ENUM ('WATCHING', 'COMPLETED', 'PLANNING', 'DROPPED', 'PAUSED');

-- CreateEnum
CREATE TYPE "SkipType" AS ENUM ('INTRO', 'OUTRO');

-- CreateEnum
CREATE TYPE "SkipSource" AS ENUM ('ANISKIP', 'USER');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('COMMENT', 'SOURCE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "username" TEXT,
    "discordId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "defaultAudio" "AudioType" NOT NULL DEFAULT 'SUB',
    "autoSkip" BOOLEAN NOT NULL DEFAULT false,
    "autoNext" BOOLEAN NOT NULL DEFAULT true,
    "subtitlePrefs" JSONB,
    "profilePublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Anime" (
    "id" TEXT NOT NULL,
    "anilistId" INTEGER,
    "malId" INTEGER,
    "kind" "MediaKind" NOT NULL DEFAULT 'ANIME',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "synopsisTr" TEXT,
    "synopsisEn" TEXT,
    "hasDub" BOOLEAN NOT NULL DEFAULT false,
    "maxQuality" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "thumbnail" TEXT,
    "airedAt" TIMESTAMP(3),
    "isFiller" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licensed" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslatorGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "links" JSONB,

    CONSTRAINT "TranslatorGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeSource" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" "AudioType" NOT NULL,
    "quality" TEXT,
    "translatorGroupId" TEXT,
    "url" TEXT NOT NULL,
    "brokenReports" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkipTime" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "type" "SkipType" NOT NULL,
    "startSec" DOUBLE PRECISION NOT NULL,
    "endSec" DOUBLE PRECISION NOT NULL,
    "source" "SkipSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkipTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkipTimeVote" (
    "userId" TEXT NOT NULL,
    "skipTimeId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "SkipTimeVote_pkey" PRIMARY KEY ("userId","skipTimeId")
);

-- CreateTable
CREATE TABLE "WatchProgress" (
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "positionSec" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("userId","episodeId")
);

-- CreateTable
CREATE TABLE "ListEntry" (
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "status" "ListStatus",
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListEntry_pkey" PRIMARY KEY ("userId","animeId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("userId","episodeId")
);

-- CreateTable
CREATE TABLE "EpisodeRating" (
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,

    CONSTRAINT "EpisodeRating_pkey" PRIMARY KEY ("userId","episodeId")
);

-- CreateTable
CREATE TABLE "AnimeFollow" (
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,

    CONSTRAINT "AnimeFollow_pkey" PRIMARY KEY ("userId","animeId")
);

-- CreateTable
CREATE TABLE "GroupFollow" (
    "userId" TEXT NOT NULL,
    "translatorGroupId" TEXT NOT NULL,

    CONSTRAINT "GroupFollow_pkey" PRIMARY KEY ("userId","translatorGroupId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Anime_anilistId_key" ON "Anime"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "Anime_slug_key" ON "Anime"("slug");

-- CreateIndex
CREATE INDEX "Anime_featured_featuredOrder_idx" ON "Anime"("featured", "featuredOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_animeId_number_key" ON "Episode"("animeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_key_key" ON "ProviderConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TranslatorGroup_slug_key" ON "TranslatorGroup"("slug");

-- CreateIndex
CREATE INDEX "EpisodeSource_episodeId_idx" ON "EpisodeSource"("episodeId");

-- CreateIndex
CREATE INDEX "EpisodeSource_createdAt_idx" ON "EpisodeSource"("createdAt");

-- CreateIndex
CREATE INDEX "EpisodeSource_translatorGroupId_idx" ON "EpisodeSource"("translatorGroupId");

-- CreateIndex
CREATE INDEX "SkipTime_episodeId_type_idx" ON "SkipTime"("episodeId", "type");

-- CreateIndex
CREATE INDEX "WatchProgress_userId_updatedAt_idx" ON "WatchProgress"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ListEntry_userId_status_idx" ON "ListEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "Comment_episodeId_createdAt_idx" ON "Comment"("episodeId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Reaction_episodeId_idx" ON "Reaction"("episodeId");

-- CreateIndex
CREATE INDEX "EpisodeRating_episodeId_idx" ON "EpisodeRating"("episodeId");

-- CreateIndex
CREATE INDEX "AnimeFollow_animeId_idx" ON "AnimeFollow"("animeId");

-- CreateIndex
CREATE INDEX "GroupFollow_translatorGroupId_idx" ON "GroupFollow"("translatorGroupId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeSource" ADD CONSTRAINT "EpisodeSource_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeSource" ADD CONSTRAINT "EpisodeSource_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeSource" ADD CONSTRAINT "EpisodeSource_translatorGroupId_fkey" FOREIGN KEY ("translatorGroupId") REFERENCES "TranslatorGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkipTime" ADD CONSTRAINT "SkipTime_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkipTimeVote" ADD CONSTRAINT "SkipTimeVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkipTimeVote" ADD CONSTRAINT "SkipTimeVote_skipTimeId_fkey" FOREIGN KEY ("skipTimeId") REFERENCES "SkipTime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListEntry" ADD CONSTRAINT "ListEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListEntry" ADD CONSTRAINT "ListEntry_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeRating" ADD CONSTRAINT "EpisodeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeRating" ADD CONSTRAINT "EpisodeRating_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeFollow" ADD CONSTRAINT "AnimeFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeFollow" ADD CONSTRAINT "AnimeFollow_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupFollow" ADD CONSTRAINT "GroupFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupFollow" ADD CONSTRAINT "GroupFollow_translatorGroupId_fkey" FOREIGN KEY ("translatorGroupId") REFERENCES "TranslatorGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Elle eklenen güvenlik katmanları (Prisma şemasında ifade edilemeyenler)
-- ---------------------------------------------------------------------------

-- Lisans zorunluluğu: EpisodeSource yalnızca licensed = true olan bir ProviderConfig'e bağlanabilir.
-- Uygulama katmanı da aynı kontrolü yapar; bu tetikleyici, doğrudan SQL ya da hatalı kodla bile
-- lisanssız kaynak eklenmesini engelleyen son savunma hattıdır.
CREATE OR REPLACE FUNCTION enforce_licensed_provider() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ProviderConfig" WHERE "id" = NEW."providerId" AND "licensed" = true
  ) THEN
    RAISE EXCEPTION 'EpisodeSource requires a licensed ProviderConfig (providerId=%)', NEW."providerId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EpisodeSource_licensed_provider"
  BEFORE INSERT OR UPDATE OF "providerId" ON "EpisodeSource"
  FOR EACH ROW EXECUTE FUNCTION enforce_licensed_provider();

-- Bir sağlayıcının lisans işareti, ona bağlı kaynaklar varken kaldırılamaz.
CREATE OR REPLACE FUNCTION protect_licensed_flag() RETURNS trigger AS $$
BEGIN
  IF OLD."licensed" = true AND NEW."licensed" = false
     AND EXISTS (SELECT 1 FROM "EpisodeSource" WHERE "providerId" = NEW."id") THEN
    RAISE EXCEPTION 'Cannot unlicense ProviderConfig % while EpisodeSource rows reference it', NEW."key"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProviderConfig_protect_licensed"
  BEFORE UPDATE OF "licensed" ON "ProviderConfig"
  FOR EACH ROW EXECUTE FUNCTION protect_licensed_flag();

-- Değer aralıkları (uygulama katmanında da doğrulanır).
ALTER TABLE "SkipTimeVote" ADD CONSTRAINT "SkipTimeVote_value_check" CHECK ("value" IN (-1, 1));
ALTER TABLE "EpisodeRating" ADD CONSTRAINT "EpisodeRating_stars_check" CHECK ("stars" BETWEEN 1 AND 5);
ALTER TABLE "SkipTime" ADD CONSTRAINT "SkipTime_range_check" CHECK ("startSec" >= 0 AND "endSec" > "startSec");
ALTER TABLE "ListEntry" ADD CONSTRAINT "ListEntry_score_check" CHECK ("score" IS NULL OR "score" BETWEEN 1 AND 10);
