/**
 * DB整合性チェックスクリプト（読み取り専用・UPDATE/INSERT/DELETE一切なし）
 *
 * 背景：2026-09-07〜09-08にかけて、以下のマイグレーションで
 * 単一カラム(primary_store_id / target_store_id / admins.store_id)を
 * 中間テーブル(member_stores / campaign_store_targets / admin_stores)に
 * 置き換えた。このうちMemberStoreの回では、バックフィルSQLを書く前に
 * マイグレーションが一度適用されてしまい、山田花子さん(member_id=1)の
 * 店舗紐付けが失われるニアミスが発生（Prisma Studioから該当1行だけ手動INSERTで復旧）。
 * 同じタイミングで他の会員・キャンペーン・管理者のバックフィルが
 * 正しく行われたかは未確認のため、本スクリプトで機械的に洗い出す。
 *
 * 実行方法（.envが読める、ユーザー自身のターミナルで実行すること。
 * Claudeのサンドボックスからは DIRECT_URL が読めないため実行不可）：
 *   npx tsx scripts/check-db-integrity.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTableCounts() {
  console.log("\n=== 0. 全テーブルの件数一覧 ===");
  console.log("（会員・予約はDB開発中のため0でも問題ないが、予約に必要な店舗系マスタは0だと復旧が必要）");

  const counts: Array<[string, number]> = [
    ["stores（店舗）", await prisma.store.count()],
    ["store_holidays（店舗休業日）", await prisma.storeHoliday.count()],
    ["staff（スタッフ）", await prisma.staff.count()],
    ["staff_shifts（シフト）", await prisma.staffShift.count()],
    ["course_categories（コースカテゴリ）", await prisma.courseCategory.count()],
    ["courses（コース）", await prisma.course.count()],
    ["options（オプション）", await prisma.option.count()],
    ["customer_statuses（会員ステータス）", await prisma.customerStatus.count()],
    ["campaigns（キャンペーン）", await prisma.campaign.count()],
    ["campaign_store_targets", await prisma.campaignStoreTarget.count()],
    ["campaign_course_targets", await prisma.campaignCourseTarget.count()],
    ["campaign_category_targets", await prisma.campaignCategoryTarget.count()],
    ["admins（管理者）", await prisma.admin.count()],
    ["admin_stores（管理者×店舗）", await prisma.adminStore.count()],
    ["role_page_permissions（権限設定）", await prisma.rolePagePermission.count()],
    ["terms_of_service（利用規約）", await prisma.termsOfService.count()],
    ["delivery_templates（配信テンプレート）", await prisma.deliveryTemplate.count()],
    ["auto_delivery_settings（自動配信設定）", await prisma.autoDeliverySetting.count()],
    ["--- 以下は開発中データなので0でも問題なし ---", -1],
    ["members（会員）", await prisma.member.count()],
    ["member_stores（会員×店舗）", await prisma.memberStore.count()],
    ["reservations（予約）", await prisma.reservation.count()],
    ["reservation_items（予約明細）", await prisma.reservationItem.count()],
    ["customer_notes（顧客メモ）", await prisma.customerNote.count()],
    ["notifications（通知）", await prisma.notification.count()],
    ["email_line_logs（配信ログ）", await prisma.emailLineLog.count()],
  ];

  for (const [label, count] of counts) {
    if (count === -1) {
      console.log(label);
      continue;
    }
    console.log(`  ${label}: ${count}`);
  }
}

async function checkMemberStores() {
  console.log("\n=== 1. member_stores が0件の会員 ===");
  const totalMembers = await prisma.member.count();
  const membersNoStore = await prisma.member.findMany({
    where: { usedStores: { none: {} } },
    select: { id: true, name: true, visitCount: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  console.log(`会員総数: ${totalMembers} / 店舗紐付けなし: ${membersNoStore.length}`);
  for (const m of membersNoStore) {
    console.log(
      `  member_id=${m.id} name=${m.name} visitCount=${m.visitCount} createdAt=${m.createdAt.toISOString()}`
    );
  }
}

async function checkReservationStoreMismatch() {
  console.log("\n=== 2. 予約履歴の店舗が member_stores に未登録の会員 ===");
  console.log("（過去に予約した店舗はusedStoresに含まれているはず、という前提でのクロスチェック）");
  const reservations = await prisma.reservation.findMany({
    where: { memberId: { not: null } },
    select: { memberId: true, storeId: true },
  });
  const memberStores = await prisma.memberStore.findMany({
    select: { memberId: true, storeId: true },
  });

  const storeSetByMember = new Map<number, Set<number>>();
  for (const ms of memberStores) {
    const set = storeSetByMember.get(ms.memberId) ?? new Set<number>();
    set.add(ms.storeId);
    storeSetByMember.set(ms.memberId, set);
  }

  const mismatches = new Map<number, Set<number>>();
  for (const r of reservations) {
    if (r.memberId == null) continue;
    const known = storeSetByMember.get(r.memberId) ?? new Set<number>();
    if (!known.has(r.storeId)) {
      const set = mismatches.get(r.memberId) ?? new Set<number>();
      set.add(r.storeId);
      mismatches.set(r.memberId, set);
    }
  }

  console.log(`件数: ${mismatches.size}`);
  for (const [memberId, stores] of mismatches) {
    console.log(
      `  member_id=${memberId} 予約先store_id=[${[...stores].join(",")}] だがmember_storesに未登録 → 復旧の手がかりになる`
    );
  }
}

async function checkCampaignStoreTargets() {
  console.log("\n=== 3. campaign_store_targets が0件のキャンペーン ===");
  console.log("（元々「全店舗対象」だった場合は正常。個別に内容を見て判断すること）");
  const totalCampaigns = await prisma.campaign.count();
  const campaignsNoTarget = await prisma.campaign.findMany({
    where: { storeTargets: { none: {} } },
    select: { id: true, name: true, startDate: true, endDate: true, isPublished: true },
    orderBy: { id: "asc" },
  });
  console.log(`キャンペーン総数: ${totalCampaigns} / 店舗ターゲットなし: ${campaignsNoTarget.length}`);
  for (const c of campaignsNoTarget) {
    console.log(
      `  campaign_id=${c.id} name=${c.name} isPublished=${c.isPublished} ${c.startDate
        .toISOString()
        .slice(0, 10)}~${c.endDate.toISOString().slice(0, 10)}`
    );
  }
}

async function checkAdminStores() {
  console.log("\n=== 4. admin_stores が0件の管理者（hq以外） ===");
  console.log("（hqロールは店舗スコープなしが正常。manager/staffで0件は異常の疑い）");
  const adminsNoStore = await prisma.admin.findMany({
    where: { role: { not: "hq" }, stores: { none: {} } },
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { id: "asc" },
  });
  console.log(`件数: ${adminsNoStore.length}`);
  for (const a of adminsNoStore) {
    console.log(`  admin_id=${a.id} name=${a.name} role=${a.role} isActive=${a.isActive}`);
    // メールアドレスは復旧時の本人特定に必要なため出力するが、パスワード等の機密情報は出力しない
    console.log(`    email=${a.email}`);
  }
}

async function main() {
  console.log("DB整合性チェックを開始します（読み取り専用）...");
  await checkTableCounts();
  await checkMemberStores();
  await checkReservationStoreMismatch();
  await checkCampaignStoreTargets();
  await checkAdminStores();
  console.log("\n完了。上記の件数・一覧を確認してください。");
}

main()
  .catch((e) => {
    console.error("チェック中にエラーが発生しました:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
