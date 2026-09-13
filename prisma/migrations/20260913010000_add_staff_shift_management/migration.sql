-- AlterTable
ALTER TABLE "admins" ADD COLUMN "staff_id" INTEGER;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "staff_shift_requests" (
    "request_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "is_day_off_requested" BOOLEAN NOT NULL DEFAULT false,
    "preferred_start_time" TIME,
    "preferred_end_time" TIME,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_shift_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_shift_requests_staff_id_work_date_key" ON "staff_shift_requests"("staff_id", "work_date");

-- AddForeignKey
ALTER TABLE "staff_shift_requests" ADD CONSTRAINT "staff_shift_requests_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "staff_shift_drafts" (
    "draft_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "start_time" TIME,
    "end_time" TIME,
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_shift_drafts_pkey" PRIMARY KEY ("draft_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_shift_drafts_staff_id_work_date_key" ON "staff_shift_drafts"("staff_id", "work_date");

-- AddForeignKey
ALTER TABLE "staff_shift_drafts" ADD CONSTRAINT "staff_shift_drafts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;
