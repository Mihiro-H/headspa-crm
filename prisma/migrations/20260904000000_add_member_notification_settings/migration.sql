-- AlterTable
ALTER TABLE "members" ADD COLUMN "email_notification_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "members" ADD COLUMN "line_notification_enabled" BOOLEAN NOT NULL DEFAULT true;
