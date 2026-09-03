import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorizeMember } from "./member-credentials";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: {
      findUnique: vi.fn(),
    },
  },
}));

describe("authorizeMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the member when email and password match", async () => {
    const passwordHash = await hashPassword("himitsu-password");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      email: "taro@example.com",
      name: "山田太郎",
      passwordHash,
    } as never);

    const result = await authorizeMember({
      email: "taro@example.com",
      password: "himitsu-password",
    });

    expect(result).toEqual({
      id: "1",
      email: "taro@example.com",
      name: "山田太郎",
      role: "member",
    });
  });

  it("returns null when the member does not exist", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null);

    const result = await authorizeMember({
      email: "unknown@example.com",
      password: "anything",
    });

    expect(result).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("himitsu-password");
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      email: "taro@example.com",
      name: "山田太郎",
      passwordHash,
    } as never);

    const result = await authorizeMember({
      email: "taro@example.com",
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });

  it("returns null when the member has no password set (LINE-only account)", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: 1,
      email: "taro@example.com",
      name: "山田太郎",
      passwordHash: null,
    } as never);

    const result = await authorizeMember({
      email: "taro@example.com",
      password: "anything",
    });

    expect(result).toBeNull();
  });
});
