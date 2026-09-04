-- DropIndex
DROP INDEX "members_birth_date_idx";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "birth_date";
-- 既存行がある場合に備え、いったんDEFAULTを付けて追加してから外す
-- （誕生日メールジョブは月のみ参照するため、実データはこの後アプリ側で正しい値に更新する想定）
ALTER TABLE "members" ADD COLUMN "birth_month" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "members" ALTER COLUMN "birth_month" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "members_birth_month_idx" ON "members"("birth_month");
