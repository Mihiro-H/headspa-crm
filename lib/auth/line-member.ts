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
