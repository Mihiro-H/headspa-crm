-- CreateEnum
CREATE TYPE "staff_shift_request_type" AS ENUM ('full', 'day_off', 'reduced');

-- AlterTable: 旧is_day_off_requestedの意味(false=時間指定)を引き継ぐデフォルトで追加
ALTER TABLE "staff_shift_requests" ADD COLUMN "request_type" "staff_shift_request_type" NOT NULL DEFAULT 'reduced';

-- Backfill: 既存データの意味をそのまま新カラムに反映
UPDATE "staff_shift_requests" SET "request_type" = 'day_off' WHERE "is_day_off_requested" = true;

-- 今後の新規行のデフォルトを'full'に変更(Prisma側の@defaultと合わせる)
ALTER TABLE "staff_shift_requests" ALTER COLUMN "request_type" SET DEFAULT 'full';

-- 旧カラムを削除
ALTER TABLE "staff_shift_requests" DROP COLUMN "is_day_off_requested";
