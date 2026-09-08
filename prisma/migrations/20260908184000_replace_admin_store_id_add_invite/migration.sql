-- CreateTable
CREATE TABLE "admin_stores" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,

    CONSTRAINT "admin_stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_stores_admin_id_store_id_key" ON "admin_stores"("admin_id", "store_id");

-- AddForeignKey
ALTER TABLE "admin_stores" ADD CONSTRAINT "admin_stores_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("admin_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_stores" ADD CONSTRAINT "admin_stores_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: hqロールの管理者は元々store_idがNULLだったためadmin_storesの行は作成されない
-- （Phase Iで「hqロールは店舗スコープなし」として扱う設計と一致する）。
INSERT INTO "admin_stores" ("admin_id", "store_id")
SELECT "admin_id", "store_id" FROM "admins" WHERE "store_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "admins" DROP CONSTRAINT "admins_store_id_fkey";

-- AlterTable
-- password_hashをNULL許容化（招待済みだがまだパスワード未設定のアカウントを表すため）。
-- 既存行はすべてpassword_hashに値を持つため、これによるデータ移行は不要。
ALTER TABLE "admins"
    DROP COLUMN "store_id",
    ALTER COLUMN "password_hash" DROP NOT NULL,
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "invite_token" VARCHAR(255),
    ADD COLUMN "invite_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "admins_invite_token_key" ON "admins"("invite_token");
