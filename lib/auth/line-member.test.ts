import { describe, it, expect, vi, beforeEach } from "vitest";
import { findOrFlagLineMember, linkLineToMember } from "./line-member";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("findOrFlagLineMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing member when line_user_id is already linked", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 5,
      email: "hanako@example.com",
      name: "佐藤花子",
      lineUserId: "U1234567890",
    } as never);

    const result = await findOrFlagLineMember("U1234567890", "花子");

    expect(result).toEqual({
      status: "existing",
      id: "5",
      email: "hanako@example.com",
      name: "佐藤花子",
      role: "member",
    });
  });

  it("flags profile completion when no member is linked to this LINE account yet", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const result = await findOrFlagLineMember("U9999999999", "花子");

    expect(result).toEqual({
      status: "needs_profile_completion",
      lineUserId: "U9999999999",
      name: "花子",
    });
  });
});

describe("linkLineToMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links the LINE account to the member when it is not used by anyone else", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const result = await linkLineToMember(5, "U1234567890");

    expect(result).toEqual({ status: "linked" });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { lineUserId: "U1234567890" },
    });
  });

  it("links (idempotently) when the LINE account is already linked to this same member", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: 5, lineUserId: "U1234567890" } as never);

    const result = await linkLineToMember(5, "U1234567890");

    expect(result).toEqual({ status: "linked" });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { lineUserId: "U1234567890" },
    });
  });

  it("refuses to link when the LINE account is already linked to a different member", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: 9, lineUserId: "U1234567890" } as never);

    const result = await linkLineToMember(5, "U1234567890");

    expect(result).toEqual({ status: "already_linked_elsewhere" });
    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});
