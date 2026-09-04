import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMember } from "./register-member";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    member: { findUnique: vi.fn(), create: vi.fn() },
    customerStatus: { findFirstOrThrow: vi.fn() },
  },
}));

describe("registerMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new member with a hashed password and the lowest-tier status", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.customerStatus.findFirstOrThrow).mockResolvedValue({ id: 3 } as never);
    vi.mocked(prisma.member.create).mockResolvedValue({ id: 42 } as never);

    const result = await registerMember({
      name: "山田花子",
      email: "hanako@example.com",
      phone: "090-0000-0000",
      password: "himitsu-password",
      birthMonth: 5,
      gender: "female",
    });

    expect(result).toEqual({ status: "created", memberId: 42 });
    expect(prisma.customerStatus.findFirstOrThrow).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
    });
    const createArgs = vi.mocked(prisma.member.create).mock.calls[0][0];
    expect(createArgs.data.email).toBe("hanako@example.com");
    expect(createArgs.data.statusId).toBe(3);
    expect(createArgs.data.passwordHash).not.toBe("himitsu-password");
  });

  it("refuses to register when the email is already taken", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: 1 } as never);

    const result = await registerMember({
      name: "山田花子",
      email: "hanako@example.com",
      phone: "090-0000-0000",
      password: "himitsu-password",
      birthMonth: 5,
      gender: "female",
    });

    expect(result).toEqual({ status: "email_taken" });
    expect(prisma.member.create).not.toHaveBeenCalled();
  });
});
