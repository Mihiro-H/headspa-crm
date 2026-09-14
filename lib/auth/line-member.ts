import { prisma } from "@/lib/db";

export type LineMemberLookupResult =
  | { status: "existing"; id: string; email: string; name: string; role: "member" }
  | { status: "needs_profile_completion"; lineUserId: string; name: string };

export async function findOrFlagLineMember(
  lineUserId: string,
  displayName: string,
): Promise<LineMemberLookupResult> {
  const member = await prisma.member.findUnique({ where: { lineUserId } });

  if (member) {
    return {
      status: "existing",
      id: String(member.id),
      email: member.email,
      name: member.name,
      role: "member",
    };
  }

  return {
    status: "needs_profile_completion",
    lineUserId,
    name: displayName,
  };
}

export type LinkLineToMemberResult = { status: "linked" } | { status: "already_linked_elsewhere" };

/**
 * メール/パスワードで既にログイン中の会員に、認証済みのLINEアカウントを後付けで
 * 紐付ける（「LINEでログイン」する新規登録フローとは別の、既存会員向けの操作）。
 * そのLINEアカウントが既に別の会員に紐付いている場合は、黙って上書き・統合せず拒否する。
 */
export async function linkLineToMember(
  memberId: number,
  lineUserId: string,
): Promise<LinkLineToMemberResult> {
  const existing = await prisma.member.findUnique({ where: { lineUserId } });
  if (existing && existing.id !== memberId) {
    return { status: "already_linked_elsewhere" };
  }

  await prisma.member.update({ where: { id: memberId }, data: { lineUserId } });
  return { status: "linked" };
}
