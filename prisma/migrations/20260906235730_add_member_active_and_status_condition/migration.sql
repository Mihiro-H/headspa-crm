-- CreateEnum
CREATE TYPE "status_condition_mode" AS ENUM ('or', 'and');

-- AlterTable
ALTER TABLE "customer_statuses" ADD COLUMN     "condition_mode" "status_condition_mode" NOT NULL DEFAULT 'and',
ADD COLUMN     "min_total_spent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
