/*
  Warnings:

  - You are about to drop the column `target_store_id` on the `campaigns` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_target_store_id_fkey";

-- CreateTable
CREATE TABLE "campaign_store_targets" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,

    CONSTRAINT "campaign_store_targets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "campaign_store_targets" ADD CONSTRAINT "campaign_store_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_store_targets" ADD CONSTRAINT "campaign_store_targets_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: 既存のtarget_store_idをcampaign_store_targetsへ移し替える（drop前・campaign_store_targets作成後に実行する必要がある）
INSERT INTO "campaign_store_targets" ("campaign_id", "store_id")
SELECT "campaign_id", "target_store_id" FROM "campaigns" WHERE "target_store_id" IS NOT NULL;

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "target_store_id";
