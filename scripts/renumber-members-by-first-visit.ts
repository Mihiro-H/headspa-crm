/**
 * 会員ID（member_id）を「初回来店日（最も古いcompleted予約の予約日）が
 * 古い順」に1番から振り直すスクリプト。
 *
 * 安全のためのポイント：
 * - reservations / customer_notes / email_line_logs / member_stores の
 *   member_idへの外部キーは全てON UPDATE CASCADEが設定されているため
 *   （2026-09-13、migration.sqlで確認済み）、membersテーブルのIDを更新
 *   するだけで参照側は自動的に追従する。個別テーブルを手動更新する
 *   必要はない。
 * - IDの重複を避けるため、一旦全員のIDに大きなオフセット（+100000）を
 *   加えてから、最終的な新IDへ1件ずつ振り替える2段階方式にする。
 * - 全ての更新を1つのトランザクションにまとめ、途中で失敗したら
 *   全体がロールバックされるようにする。
 * - 最後にautoincrementシーケンスを最大IDに合わせて再同期する
 *   （これを忘れると次回の会員登録でID重複エラーになる）。
 *
 * 初回来店日を持たない会員（completed予約が1件もない）は、末尾に
 * 元のID昇順で配置する。
 *
 * 実行方法（ユーザー自身のターミナルで。.envが読める環境が必要）：
 *   npx tsx scripts/renumber-members-by-first-visit.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ID_OFFSET = 100000;

async function main() {
  const members = await prisma.member.findMany({ select: { id: true }, orderBy: { id: "asc" } });

  const completedReservations = await prisma.reservation.findMany({
    where: { status: "completed", memberId: { not: null } },
    select: { memberId: true, reservationDate: true },
  });

  const firstVisitByMember = new Map<number, Date>();
  for (const r of completedReservations) {
    if (r.memberId === null) continue;
    const current = firstVisitByMember.get(r.memberId);
    if (!current || r.reservationDate < current) {
      firstVisitByMember.set(r.memberId, r.reservationDate);
    }
  }

  const sorted = [...members].sort((a, b) => {
    const dateA = firstVisitByMember.get(a.id);
    const dateB = firstVisitByMember.get(b.id);
    if (dateA && dateB) return dateA.getTime() - dateB.getTime();
    if (dateA && !dateB) return -1; // 初回来店日がある方を先に
    if (!dateA && dateB) return 1;
    return a.id - b.id; // どちらも来店日なし：元のID順
  });

  const mapping = sorted.map((m, index) => ({ oldId: m.id, newId: index + 1 }));

  console.log("=== 振り替え内容（旧ID → 新ID） ===");
  for (const { oldId, newId } of mapping) {
    const firstVisit = firstVisitByMember.get(oldId);
    console.log(
      `  ${oldId} → ${newId}${firstVisit ? `（初回来店: ${firstVisit.toISOString().slice(0, 10)}）` : "（来店実績なし）"}`,
    );
  }

  const alreadyCorrect = mapping.every(({ oldId, newId }) => oldId === newId);
  if (alreadyCorrect) {
    console.log("\n既に初回来店日順になっているため、変更はありません。");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1段階目：全員のIDを一旦大きくずらして、新旧IDの範囲が絶対に重複しないようにする。
    await tx.$executeRawUnsafe(
      `UPDATE "members" SET "member_id" = "member_id" + ${ID_OFFSET}`,
    );

    // 2段階目：ずらしたIDから最終的な新IDへ1件ずつ振り替える。
    for (const { oldId, newId } of mapping) {
      await tx.$executeRawUnsafe(
        `UPDATE "members" SET "member_id" = ${newId} WHERE "member_id" = ${oldId + ID_OFFSET}`,
      );
    }

    // autoincrementシーケンスを再同期（次回のnew会員作成時にID重複しないようにする）。
    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('members', 'member_id'), (SELECT MAX(member_id) FROM members))`,
    );
  });

  console.log(`\n完了：${mapping.length}名のIDを振り替えました。`);
}

main()
  .catch((e) => {
    console.error("エラーが発生しました（トランザクションはロールバックされています）:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
