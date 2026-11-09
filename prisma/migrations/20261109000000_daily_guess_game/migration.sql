-- Mini oyun (Günlük Tahmin): günlük bulmaca, oyunlar, haftalık sezon ödülleri ve takılı kozmetikler.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equippedFrame" TEXT,
ADD COLUMN     "equippedName" TEXT,
ADD COLUMN     "equippedTitle" TEXT;

-- CreateTable
CREATE TABLE "GamePuzzle" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePuzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlay" (
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "guesses" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GamePlay_pkey" PRIMARY KEY ("userId","puzzleId")
);

-- CreateTable
CREATE TABLE "GameSeason" (
    "id" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamePuzzle_day_key" ON "GamePuzzle"("day");

-- CreateIndex
CREATE INDEX "GamePuzzle_mediaId_idx" ON "GamePuzzle"("mediaId");

-- CreateIndex
CREATE INDEX "GamePlay_season_score_idx" ON "GamePlay"("season", "score");

-- CreateIndex
CREATE INDEX "GamePlay_userId_day_idx" ON "GamePlay"("userId", "day");

-- CreateIndex
CREATE INDEX "GameReward_userId_idx" ON "GameReward"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameReward_userId_season_item_key" ON "GameReward"("userId", "season", "item");

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "GamePuzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameReward" ADD CONSTRAINT "GameReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Son savunma hattı: puan negatif olamaz, en fazla 6 tahmin, seri negatif olamaz.
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_score_check" CHECK ("score" >= 0 AND "score" <= 1000);
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_guesses_check" CHECK (cardinality("guesses") <= 6);
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_streak_check" CHECK ("streak" >= 0);
