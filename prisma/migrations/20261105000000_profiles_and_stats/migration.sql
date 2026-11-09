-- Profil ve seviye: kullanıcı profili alanları ve istatistik için eser önbelleği.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "usernameChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Anime" ADD COLUMN     "totalUnits" INTEGER,
ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Biyografi en fazla 200 karakter (uygulama katmanında da doğrulanır).
ALTER TABLE "User" ADD CONSTRAINT "User_bio_length" CHECK ("bio" IS NULL OR char_length("bio") <= 200);
