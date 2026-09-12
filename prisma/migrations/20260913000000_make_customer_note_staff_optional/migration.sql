/*
  Warnings:

  - Made the column `staff_id` on table `customer_notes` optional.
    管理者が特定のスタッフに紐づかない自由記述メモ（カルテ・メモ機能）を
    書けるようにするため。既存の外部キー制約（customer_notes_staff_id_fkey）
    はNULL値には適用されないため、変更不要。このテーブルはこれまで
    未使用（既存データ0件）のため、データ移行は不要。
*/
ALTER TABLE "customer_notes" ALTER COLUMN "staff_id" DROP NOT NULL;
