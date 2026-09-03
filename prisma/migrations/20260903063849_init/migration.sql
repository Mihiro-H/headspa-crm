-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('hq', 'manager', 'staff');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('female', 'male', 'other');

-- CreateEnum
CREATE TYPE "gender_restriction" AS ENUM ('none', 'female', 'male');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('percentage', 'fixed_amount');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('temp_hold', 'confirmed', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "reservation_source" AS ENUM ('web', 'phone');

-- CreateEnum
CREATE TYPE "reservation_item_type" AS ENUM ('course', 'option');

-- CreateEnum
CREATE TYPE "channel_mode" AS ENUM ('email', 'line', 'auto');

-- CreateEnum
CREATE TYPE "auto_delivery_type" AS ENUM ('birthday', 'reminder');

-- CreateEnum
CREATE TYPE "delivery_channel" AS ENUM ('email', 'line');

-- CreateEnum
CREATE TYPE "delivery_template_type" AS ENUM ('birthday', 'reminder', 'segment');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "stores" (
    "store_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(255),
    "phone" VARCHAR(20) NOT NULL,
    "weekday_open" TIME NOT NULL,
    "weekday_close" TIME NOT NULL,
    "weekend_open" TIME NOT NULL,
    "weekend_close" TIME NOT NULL,
    "luxury_last_order_weekday" TIME NOT NULL,
    "luxury_last_order_weekend" TIME NOT NULL,
    "nearest_station" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("store_id")
);

-- CreateTable
CREATE TABLE "store_holidays" (
    "holiday_id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "holiday_date" DATE NOT NULL,
    "reason" VARCHAR(100),

    CONSTRAINT "store_holidays_pkey" PRIMARY KEY ("holiday_id")
);

-- CreateTable
CREATE TABLE "staff" (
    "staff_id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "photo_url" VARCHAR(255),
    "bio" TEXT,
    "nomination_fee" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "shift_id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "start_time" TIME,
    "end_time" TIME,
    "is_day_off" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("shift_id")
);

-- CreateTable
CREATE TABLE "admins" (
    "admin_id" SERIAL NOT NULL,
    "store_id" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "admin_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("admin_id")
);

-- CreateTable
CREATE TABLE "customer_statuses" (
    "status_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "min_visit_count" INTEGER NOT NULL,
    "color_code" VARCHAR(7) NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "customer_statuses_pkey" PRIMARY KEY ("status_id")
);

-- CreateTable
CREATE TABLE "members" (
    "member_id" SERIAL NOT NULL,
    "primary_store_id" INTEGER,
    "status_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_kana" VARCHAR(100),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password_hash" VARCHAR(255),
    "gender" "gender" NOT NULL,
    "birth_date" DATE NOT NULL,
    "line_user_id" VARCHAR(100),
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "total_spent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "course_categories" (
    "category_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "gender_restriction" "gender_restriction" NOT NULL DEFAULT 'none',
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "courses" (
    "course_id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "duration_estimate_min" INTEGER NOT NULL,
    "treatment_time_min" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "gender_restriction" "gender_restriction" NOT NULL DEFAULT 'none',
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "options" (
    "option_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "gender_restriction" "gender_restriction" NOT NULL DEFAULT 'none',
    "requires_advance_booking" BOOLEAN NOT NULL DEFAULT true,
    "discount_exempt" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "options_pkey" PRIMARY KEY ("option_id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "campaign_id" SERIAL NOT NULL,
    "target_store_id" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "discount_type" "discount_type" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateTable
CREATE TABLE "campaign_course_targets" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,

    CONSTRAINT "campaign_course_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_category_targets" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "campaign_category_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "reservation_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "staff_id" INTEGER,
    "reservation_date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "status" "reservation_status" NOT NULL,
    "source" "reservation_source" NOT NULL,
    "nomination_fee_applied" INTEGER NOT NULL DEFAULT 0,
    "total_price" INTEGER NOT NULL,
    "temp_hold_expires_at" TIMESTAMP(3),
    "cancellation_deadline" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "reservation_items" (
    "item_id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "item_type" "reservation_item_type" NOT NULL,
    "course_id" INTEGER,
    "option_id" INTEGER,
    "applied_campaign_id" INTEGER,
    "price_at_booking" INTEGER NOT NULL,

    CONSTRAINT "reservation_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "note_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "note_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("note_id")
);

-- CreateTable
CREATE TABLE "segment_campaigns" (
    "segment_campaign_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "condition_json" JSONB NOT NULL,
    "channel_mode" "channel_mode" NOT NULL,
    "template_id" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "target_count" INTEGER NOT NULL,
    "created_by_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segment_campaigns_pkey" PRIMARY KEY ("segment_campaign_id")
);

-- CreateTable
CREATE TABLE "auto_delivery_settings" (
    "setting_id" SERIAL NOT NULL,
    "type" "auto_delivery_type" NOT NULL,
    "channel_mode" "channel_mode" NOT NULL,
    "send_timing" VARCHAR(50) NOT NULL,
    "template_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "auto_delivery_settings_pkey" PRIMARY KEY ("setting_id")
);

-- CreateTable
CREATE TABLE "email_line_logs" (
    "log_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "channel" "delivery_channel" NOT NULL,
    "template_type" "delivery_template_type" NOT NULL,
    "segment_campaign_id" INTEGER,
    "subject" VARCHAR(255),
    "sent_at" TIMESTAMP(3) NOT NULL,
    "status" "job_status" NOT NULL,

    CONSTRAINT "email_line_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "cron_job_logs" (
    "log_id" SERIAL NOT NULL,
    "job_name" VARCHAR(100) NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "status" "job_status" NOT NULL,
    "target_count" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "cron_job_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_name_key" ON "stores"("name");

-- CreateIndex
CREATE UNIQUE INDEX "store_holidays_store_id_holiday_date_key" ON "store_holidays"("store_id", "holiday_date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shifts_staff_id_work_date_key" ON "staff_shifts"("staff_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_statuses_name_key" ON "customer_statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "members_line_user_id_key" ON "members"("line_user_id");

-- CreateIndex
CREATE INDEX "members_status_id_visit_count_idx" ON "members"("status_id", "visit_count");

-- CreateIndex
CREATE INDEX "members_birth_date_idx" ON "members"("birth_date");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_name_key" ON "course_categories"("name");

-- CreateIndex
CREATE INDEX "reservations_store_id_reservation_date_staff_id_idx" ON "reservations"("store_id", "reservation_date", "staff_id");

-- CreateIndex
CREATE INDEX "reservations_status_temp_hold_expires_at_idx" ON "reservations"("status", "temp_hold_expires_at");

-- CreateIndex
CREATE INDEX "reservations_member_id_status_idx" ON "reservations"("member_id", "status");

-- CreateIndex
CREATE INDEX "email_line_logs_member_id_sent_at_idx" ON "email_line_logs"("member_id", "sent_at");

-- AddForeignKey
ALTER TABLE "store_holidays" ADD CONSTRAINT "store_holidays_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "customer_statuses"("status_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_primary_store_id_fkey" FOREIGN KEY ("primary_store_id") REFERENCES "stores"("store_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "course_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_target_store_id_fkey" FOREIGN KEY ("target_store_id") REFERENCES "stores"("store_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_course_targets" ADD CONSTRAINT "campaign_course_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_course_targets" ADD CONSTRAINT "campaign_course_targets_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_category_targets" ADD CONSTRAINT "campaign_category_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_category_targets" ADD CONSTRAINT "campaign_category_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "course_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("reservation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "options"("option_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_applied_campaign_id_fkey" FOREIGN KEY ("applied_campaign_id") REFERENCES "campaigns"("campaign_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_campaigns" ADD CONSTRAINT "segment_campaigns_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("admin_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_line_logs" ADD CONSTRAINT "email_line_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_line_logs" ADD CONSTRAINT "email_line_logs_segment_campaign_id_fkey" FOREIGN KEY ("segment_campaign_id") REFERENCES "segment_campaigns"("segment_campaign_id") ON DELETE SET NULL ON UPDATE CASCADE;
