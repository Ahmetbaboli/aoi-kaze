-- Listem senkronu: liste kartlarının AniList'e ulaşılamasa da çizilebilmesi için kapak ve renk önbelleği.
-- AlterTable
ALTER TABLE "Anime" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "color" TEXT;
