-- CreateEnum
CREATE TYPE "permission_level" AS ENUM ('edit', 'view', 'hidden');

-- CreateTable
CREATE TABLE "role_page_permissions" (
    "id" SERIAL NOT NULL,
    "role" "admin_role" NOT NULL,
    "page_key" VARCHAR(100) NOT NULL,
    "level" "permission_level" NOT NULL DEFAULT 'edit',

    CONSTRAINT "role_page_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_page_permissions_role_page_key_key" ON "role_page_permissions"("role", "page_key");

-- 初期シードは任意（行が存在しないロール×ページの組み合わせはアプリケーション側で「編集可能」として扱われる、
-- Task 4のJWTコールバック実装を参照）。全ロール×全ページの行を最初から揃えたい場合は以下を実行する：
--
-- INSERT INTO "role_page_permissions" ("role", "page_key", "level")
-- SELECT r.role, p.page_key, 'edit'
-- FROM (VALUES ('hq'), ('manager'), ('staff')) AS r(role)
-- CROSS JOIN (VALUES
--   ('/admin/dashboard'), ('/admin/calendar'), ('/admin/customers'), ('/admin/customer-statuses'),
--   ('/admin/reservations/new'), ('/admin/menu'), ('/admin/campaigns'), ('/admin/staff'),
--   ('/admin/stores'), ('/admin/reports'), ('/admin/segment-campaigns'),
--   ('/admin/cron-logs'), ('/admin/accounts'), ('/admin/permissions'), ('/admin/terms')
-- ) AS p(page_key)
-- ON CONFLICT ("role", "page_key") DO NOTHING;
