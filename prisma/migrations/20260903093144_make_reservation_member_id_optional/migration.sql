-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_member_id_fkey";

-- AlterTable
ALTER TABLE "reservations" ALTER COLUMN "member_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE SET NULL ON UPDATE CASCADE;
