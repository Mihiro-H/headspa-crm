"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildMemberWhereClause, type CustomerFilterCondition } from "@/lib/customer/filter";

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
    select: { lineUserId: true },
  });

  const eligible =
    channelMode === "line" ? members.filter((m) => m.lineUserId !== null) : members;

  const lineCount =
    channelMode === "email" ? 0 : eligible.filter((m) => m.lineUserId !== null).length;
  const emailCount = channelMode === "line" ? 0 : eligible.length - lineCount;

  return {
    totalCount: eligible.length,
    lineCount,
    emailCount,
  };
}
