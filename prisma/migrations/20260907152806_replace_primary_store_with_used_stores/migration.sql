/*
  Warnings:

  - You are about to drop the column `primary_store_id` on the `members` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_primary_store_id_fkey";

-- CreateTable
CREATE TABLE "member_stores" (
    "id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,

    CONSTRAINT "member_stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_stores_member_id_store_id_key" ON "member_stores"("member_id", "store_id");

-- AddForeignKey
ALTER TABLE "member_stores" ADD CONSTRAINT "member_stores_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_stores" ADD CONSTRAINT "member_stores_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: 既存のprimary_store_idをmember_storesへ移し替える（drop前・member_stores作成後に実行する必要がある）
INSERT INTO "member_stores" ("member_id", "store_id")
SELECT "member_id", "primary_store_id" FROM "members" WHERE "primary_store_id" IS NOT NULL;

-- AlterTable
ALTER TABLE "members" DROP COLUMN "primary_store_id";
