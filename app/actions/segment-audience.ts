"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildMemberWhereClause, type CustomerFilterCondition } from "@/lib/customer/filter";
import { resolveMemberChannel } from "@/lib/delivery/resolve-channel";

export type SegmentChannelMode = "email" | "line" | "auto";
export type SegmentCondition = CustomerFilterCondition;

export interface AudiencePreview {
  totalCount: number;
  lineCount: number;
  emailCount: number;
}

// 会員の氏名・LINE連携有無をステータス条件で絞り込んで返すため、
// Server Actionとして直接呼び出されても管理者以外には見せない。
const ADMIN_ROLES = new Set(["hq", "manager", "staff"]);

export async function previewSegmentAudience(
  condition: SegmentCondition,
  channelMode: SegmentChannelMode,
): Promise<AudiencePreview> {
  const session = await auth();
  if (!session?.user || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error("unauthorized");
  }

  const members = await prisma.member.findMany({
    where: buildMemberWhereClause(condition),
    select: { lineUserId: true, emailNotificationEnabled: true, lineNotificationEnabled: true },
  });

  // 実際の配信ロジック（resolveMemberChannel）と同じ判定を使うことで、
  // ここでのプレビュー人数と実際の送信対象がズレないようにする
  // （会員本人が配信を無効にしている場合はどちらのカウントにも入らない）。
  const channels = members.map((m) => resolveMemberChannel(channelMode, m));
  const lineCount = channels.filter((c) => c === "line").length;
  const emailCount = channels.filter((c) => c === "email").length;

  return {
    totalCount: lineCount + emailCount,
    lineCount,
    emailCount,
  };
}
